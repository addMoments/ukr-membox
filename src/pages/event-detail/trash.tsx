import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import MediaCard from '../../v2-components/MediaCard';
import GalleryFilterBar from '../../v2-components/GalleryFilterBar';
import PhotoViewerModal, { photoViewerState } from '../../partials/PhotoViewerModal';
import { UploadEntry as UploadType } from '../../types/uploads';
import { ParticipantInfo } from '../../types/participant-info';
import { pgREST } from '../../client/postgrest';
import { unpackUUID, packUUID } from '../../packages/uuid';
import { S3_ROOT, SERV_ROOT } from '../../consts';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { getAuthToken } from '../../client/core';
import { deleteTrashedUploads } from '../../client/uploads';
import '../../v2-styles/Gallery.css';

// Cop kartlarinda album adi (silinmis albumdekiler "Deleted album" etiketiyle).
type TrashUpload = UploadType & { albums?: { name?: string; deleted_at?: string | null } | null };

// Copteki foto ve videolar bu sureden sonra kalici silinir (backend event_cleanup.TrashTTL, saatlik tarama).
const TRASH_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Kalici silinmeye kac gun kaldigi (en az 1; tarama saatlik oldugu icin son gun "1 day left" okunur).
const daysLeft = (trashedAt: string | null | undefined) => {
  if (!trashedAt) return TRASH_DAYS;
  const normalized = trashedAt.endsWith('Z') || trashedAt.includes('+') ? trashedAt : trashedAt + 'Z';
  const left = new Date(normalized).getTime() + TRASH_DAYS * DAY_MS - Date.now();
  return Math.max(1, Math.ceil(left / DAY_MS));
};

function EventTrash() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [uploads, setUploads] = useState<TrashUpload[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [toast, setToast] = useState<string | null>(null);
  // Coklu secim ve "copu bosalt" (musteri 2 Kasim, 2.26).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!packedUid) return;
    const uid = unpackUUID(packedUid);
    
    Promise.all([
      pgREST(`/uploads?event_uid=eq.${uid}&upload_type=in.(photo,video)&trashed_at=not.is.null&order=trashed_at.desc&select=*,albums(name,deleted_at)`),
      pgREST(`/participants?event_uid=eq.${uid}`)
    ]).then(([uploadsData, participantsData]) => {
      setUploads(uploadsData);
      setParticipants(participantsData);
    });
  }, [packedUid]);

  const participantMap = new Map<string, ParticipantInfo>();
  participants.forEach(p => participantMap.set(p.uid, p));

  const filteredUploads = uploads.filter(upload => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'photos') return upload.upload_type === 'photo';
    if (activeFilter === 'videos') return upload.upload_type === 'video';
    return true;
  });

  // Geri alma basarisiz olabilir: cope atilan medya artik paket kotasindan dusuyor, o yuzden
  // geri almak etkinligi limitin ustune cikarabilir. Kontrol veritabaninda duruyor
  // (uploads_restore_quota trigger'i, db-shell/misc/8-trash-quota.sql) cunku bu PATCH
  // PostgREST'e dogrudan gidiyor ve backend'e hic ugramiyor.
  // Onceki hali sonucu beklemeden karti listeden siliyordu: reddedilen bir geri almada
  // dosya copte kaliyor ama ekrandan kayboluyordu, yani kullanici basarili sandi.
  const handleRestore = async (uploadUid: string) => {
    try {
      await pgREST(`/uploads?uid=eq.${uploadUid}`, {
        method: 'PATCH',
        body: JSON.stringify({ trashed_at: null })
      });
      setUploads(prev => prev.filter(u => u.uid !== uploadUid));
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      showToast(raw.includes('RESTORE_QUOTA_EXCEEDED')
        ? textOr(
            'trash.restoreQuotaExceeded',
            'Cannot restore: your event would go over its package limit. Permanently delete something first, or upgrade the package.',
            'Не вдалося відновити: подія перевищить ліміт пакета. Спочатку видаліть щось назавжди або оновіть пакет.',
          )
        : textOr(
            'trash.restoreError',
            'Could not restore the file. Please try again.',
            'Не вдалося відновити файл. Спробуйте ще раз.',
          ));
    }
  };

  const handleDeletePermanently = async (uploadUid: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(t('trash.deleteConfirm'));
    if (!confirmed) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        showToast(t('errors.forbidden'));
        return;
      }

      const packedUploadUid = packUUID(uploadUid);
      const response = await fetch(`${SERV_ROOT}/api/auth/upload/${packedUploadUid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Delete failed');
      }

      // Update local state
      setUploads(prev => prev.filter(u => u.uid !== uploadUid));
      photoViewerState.open = false;

      // Show success toast
      showToast(t('trash.deleteSuccess'));
    } catch (error) {
      console.error('Delete failed:', error);
      showToast(t('trash.deleteError'));
    }
  };

  const toggleSelected = (uploadUid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uploadUid)) next.delete(uploadUid);
      else next.add(uploadUid);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Ne: Secilenleri ya da tum copu (yalnizca foto/video) tek istekle kalici siler.
  // Not: "Tumu" sunucuda bu etkinligin tum copunu siler; ekrandaki tur filtresinden bagimsiz.
  const handleBulkDelete = async (target: 'all' | 'selected') => {
    const uids = target === 'all' ? [] : Array.from(selected);
    const count = target === 'all' ? uploads.length : uids.length;
    if (count === 0 || bulkDeleting) return;
    const confirmed = window.confirm(target === 'all'
      ? textOr('trash.emptyConfirm', 'Permanently delete all {{count}} photos and videos in the trash? This cannot be undone.', 'Назавжди видалити всі фото та відео в кошику ({{count}})? Цю дію не можна скасувати.', { count })
      : textOr('trash.deleteSelectedConfirm', 'Permanently delete {{count}} selected items? This cannot be undone.', 'Назавжди видалити вибрані елементи ({{count}})? Цю дію не можна скасувати.', { count }));
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const deleted = await deleteTrashedUploads(unpackUUID(packedUid || ''), target === 'all' ? 'all' : uids);
      setUploads(prev => (target === 'all' ? [] : prev.filter(u => !selected.has(u.uid))));
      exitSelectMode();
      showToast(textOr('trash.bulkDeleted', '{{count}} items permanently deleted', 'Назавжди видалено елементів: {{count}}', { count: deleted }));
    } catch (error) {
      console.error('Bulk delete failed:', error);
      showToast(t('trash.deleteError'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const allShownSelected = filteredUploads.length > 0 && filteredUploads.every(u => selected.has(u.uid));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPhotoViewer = (uploadUid: string) => {
    const index = filteredUploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = filteredUploads.map(upload => {
      const participant = participantMap.get(upload.client_uid);
      const name = participant?.name || t('common.unknown');
      const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
      return {
        src: S3_ROOT + upload.value,
        title: name,
        tagline: `${type} · ${formatDate(upload.created_at)}`,
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [
      { icon: 'fa-solid fa-rotate-left', onClick: (id) => handleRestore(id) },
      { icon: 'fa-solid fa-trash', onClick: (id) => handleDeletePermanently(id) },
    ];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <PhotoViewerModal />
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('trash.breadcrumb') },
            ]}
            title={t('trash.title')}
          />

          <p className="trash-retention-note">
            <i className="fa-regular fa-clock" />
            {textOr('trash.retentionNote', 'Photos and videos stay in the trash for {{days}} days, then they are deleted permanently.', 'Фото та відео зберігаються в кошику {{days}} днів, а потім видаляються назавжди.', { days: TRASH_DAYS })}
          </p>

          <GalleryFilterBar
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
            renderSearch={false}
            extraControls={uploads.length > 0 ? (
              <div className="gallery-extra-controls">
                <button
                  type="button"
                  className={`gallery-sort-btn${selectMode ? ' active' : ''}`}
                  onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                >
                  <i className={`fa-solid ${selectMode ? 'fa-xmark' : 'fa-check-double'}`} />
                  <span>{selectMode ? textOr('gallery.cancelSelect', 'Cancel', 'Скасувати') : textOr('gallery.select', 'Select', 'Вибрати')}</span>
                </button>
                <button
                  type="button"
                  className="gallery-sort-btn trash-empty-btn"
                  onClick={() => handleBulkDelete('all')}
                  disabled={bulkDeleting}
                >
                  <i className={`fa-solid ${bulkDeleting && !selectMode ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
                  <span>{textOr('trash.emptyTrash', 'Delete all', 'Видалити все')}</span>
                </button>
              </div>
            ) : undefined}
          />

          {selectMode && (
            <div className="gallery-select-bar">
              <span className="gallery-select-count">
                {textOr('gallery.selectedCount', '{{count}} selected', 'Вибрано: {{count}}', { count: selected.size })}
              </span>
              <button
                type="button"
                className="gallery-select-link"
                onClick={() => setSelected(allShownSelected ? new Set() : new Set(filteredUploads.map(u => u.uid)))}
              >
                {allShownSelected ? textOr('common.deselectAll', 'Deselect all', 'Зняти вибір') : textOr('trash.selectAll', 'Select all', 'Вибрати всі')}
              </button>
              <div className="gallery-select-move">
                <button
                  type="button"
                  className="gallery-select-move-btn trash-delete-selected-btn"
                  disabled={selected.size === 0 || bulkDeleting}
                  onClick={() => handleBulkDelete('selected')}
                >
                  <i className={`fa-solid ${bulkDeleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
                  {textOr('trash.deleteSelected', 'Delete selected', 'Видалити вибрані')}
                </button>
              </div>
            </div>
          )}

          {/* Trash Grid */}
          {filteredUploads.length > 0 ? (
            <>
              <div className="gallery-masonry">
                {filteredUploads.map((upload) => {
                  const participant = participantMap.get(upload.client_uid);
                  const name = participant?.name || t('common.unknown');
                  const albumLabel = upload.albums
                    ? (upload.albums.deleted_at
                      ? textOr('trash.deletedAlbum', 'Deleted album', 'Видалений альбом')
                      : upload.albums.name)
                    : '';
                  const left = daysLeft(upload.trashed_at);
                  const leftLabel = left === 1
                    ? textOr('trash.oneDayLeft', '1 day left', 'Залишився 1 день')
                    : textOr('trash.daysLeft', '{{count}} days left', 'Залишилось днів: {{count}}', { count: left });

                  return (
                    <MediaCard
                      onFullscreen={() => openPhotoViewer(upload.uid)}
                      key={upload.uid}
                      uploaderName={name}
                      uploadEntry={upload}
                      badge={[albumLabel, leftLabel].filter(Boolean).join(' · ')}
                      selectable={selectMode}
                      selected={selected.has(upload.uid)}
                      onSelectToggle={() => toggleSelected(upload.uid)}
                      actions={[
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-magnifying-glass', onClick: () => openPhotoViewer(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-rotate-left', onClick: () => handleRestore(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-trash', onClick: () => handleDeletePermanently(upload.uid) },
                      ]}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="gallery-empty">
              <div className="gallery-empty-icon">
                <i className="fa-solid fa-trash" />
              </div>
              <h3 className="gallery-empty-title">{t('trash.emptyTitle')}</h3>
              <p className="gallery-empty-text">{t('trash.emptyText')}</p>
            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div className="gallery-toast">
              <i className="fa-solid fa-check-circle" />
              {toast}
            </div>
          )}
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventTrash;
