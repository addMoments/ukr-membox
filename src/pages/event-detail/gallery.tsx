import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import MediaCard from '../../v2-components/MediaCard';
import GalleryFilterBar from '../../v2-components/GalleryFilterBar';
import PhotoViewerModal, { photoViewerState } from '../../partials/PhotoViewerModal';
import { UploadEntry as UploadType } from '../../types/uploads';
import { Album, sortAlbums } from '../../types/albums';
import { listAlbums, moveUploadsToAlbum, updateAlbum } from '../../client/albums';
import { pgREST } from '../../client/postgrest';
import { packUUID, unpackUUID } from '../../packages/uuid';
import { S3_ROOT } from '../../consts';
import { saveUrl } from '../../utils/download';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import '../../v2-styles/Gallery.css';

const PAGE_SIZE = 30;
type GalleryFilterType = 'all' | 'photos' | 'videos';
type GallerySortBy = 'date' | 'type';
type GalleryUpload = UploadType & { participants?: { name?: string } | { name?: string }[] };

// Album sekmesi: 'all' ya da album uid'i.
const ALL_TAB = 'all';

const getUploadTypeQuery = (filter: GalleryFilterType) => {
  if (filter === 'all') return 'in.(photo,video)';
  if (filter === 'photos') return 'eq.photo';
  return 'eq.video';
};

const getOrderQuery = (sortBy: GallerySortBy, order: 'desc' | 'asc') => {
  // Tur siralamasi: photo < video; ayni tur icinde tarih.
  if (sortBy === 'type') return `order=upload_type.asc&order=created_at.${order}&order=uid.${order}`;
  return `order=created_at.${order}&order=uid.${order}`;
};

function EventGallery() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploads, setUploads] = useState<GalleryUpload[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeFilter, setActiveFilter] = useState<GalleryFilterType>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortBy, setSortBy] = useState<GallerySortBy>('date');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const moveTargetRef = useRef<HTMLSelectElement>(null);
  const requestIdRef = useRef(0);
  const stateRef = useRef({ filter: activeFilter, order: sortOrder, sortBy, tab: ALL_TAB });

  // Ne: Aktif album sekmesi URL'de (?album=<packed>) tasinir; Albums sayfasindan
  //     "Open gallery" ile gelen dogrudan o sekmeye duser, yenileme de sekmeyi korur.
  const albumParam = searchParams.get('album');
  const activeTab = albumParam ? unpackUUID(albumParam) || ALL_TAB : ALL_TAB;
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === ALL_TAB) next.delete('album'); else next.set('album', packUUID(tab));
    setSearchParams(next, { replace: true });
  };

  stateRef.current = { filter: activeFilter, order: sortOrder, sortBy, tab: activeTab };

  const showToast = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!packedUid) return;
    listAlbums(unpackUUID(packedUid)).then(setAlbums).catch(() => setAlbums([]));
  }, [packedUid]);

  const fetchUploadsPage = useCallback(async (
    filter: GalleryFilterType,
    order: 'desc' | 'asc',
    by: GallerySortBy,
    tab: string,
    pageOffset: number
  ): Promise<GalleryUpload[]> => {
    if (!packedUid) return [];
    const uid = unpackUUID(packedUid);
    const albumFilter = tab === ALL_TAB ? '' : `&album_uid=eq.${tab}`;
    return pgREST(
      `/uploads?event_uid=eq.${uid}&upload_type=${getUploadTypeQuery(filter)}&trashed_at=is.null${albumFilter}&${getOrderQuery(by, order)}&limit=${PAGE_SIZE}&offset=${pageOffset}&select=*,participants(name)`
    );
  }, [packedUid]);

  const isCurrent = (filter: GalleryFilterType, order: 'desc' | 'asc', by: GallerySortBy, tab: string) => {
    const s = stateRef.current;
    return s.filter === filter && s.order === order && s.sortBy === by && s.tab === tab;
  };

  useEffect(() => {
    if (!packedUid) return;
    (async () => {
      const requestId = ++requestIdRef.current;
      const filter = activeFilter;
      const order = sortOrder;
      const by = sortBy;
      const tab = activeTab;
      const firstPage = await fetchUploadsPage(filter, order, by, tab, 0);
      if (requestId !== requestIdRef.current || !isCurrent(filter, order, by, tab)) {
        return;
      }
      setUploads(firstPage);
      setOffset(firstPage.length);
      setHasMore(firstPage.length === PAGE_SIZE);
      setSelected(new Set());
    })();
  }, [packedUid, activeFilter, sortOrder, sortBy, activeTab, fetchUploadsPage]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      const filter = activeFilter;
      const order = sortOrder;
      const by = sortBy;
      const tab = activeTab;
      const currentOffset = offset;
      const more = await fetchUploadsPage(filter, order, by, tab, currentOffset);
      if (!isCurrent(filter, order, by, tab)) {
        return;
      }
      setUploads(prev => {
        const seen = new Set(prev.map(item => item.uid));
        const uniqueMore = more.filter(item => !seen.has(item.uid));
        return [...prev, ...uniqueMore];
      });
      setOffset(prev => prev + more.length);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const getUploaderName = (upload: GalleryUpload) => {
    const participant = Array.isArray(upload.participants) ? upload.participants[0] : upload.participants;
    const name = participant?.name?.trim() || '';
    return name || t('common.unknown');
  };

  const albumName = (albumUid?: string | null) => albums.find(a => a.uid === albumUid)?.name || '';

  const handleTrash = (uploadUid: string) => {
    const upload = uploads.find(u => u.uid === uploadUid);
    if (!upload) return;

    pgREST(`/uploads?uid=eq.${uploadUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ trashed_at: new Date().toISOString() })
    }).then(() => {
      setUploads(prev => prev.filter(u => u.uid !== uploadUid));
      photoViewerState.open = false;
      showToast(t('gallery.mediaDeleted'));
    });
  };

  const handleDownload = (uploadUid: string) => {
    const upload = uploads.find(u => u.uid === uploadUid);
    if (!upload) return;

    const url = S3_ROOT + upload.value;
    const filename = upload.value.split('/').pop() || 'download';
    saveUrl(url, filename);
  };

  // Fotografi bulundugu albumun kapagi yap (karar 6: albumden secim).
  const handleSetCover = async (uploadUid: string) => {
    const upload = uploads.find(u => u.uid === uploadUid);
    if (!upload || !upload.album_uid || upload.upload_type !== 'photo') return;
    try {
      const updated = await updateAlbum(upload.album_uid, { cover: upload.value });
      setAlbums(prev => prev.map(a => (a.uid === updated.uid ? updated : a)));
      showToast(textOr('gallery.coverSet', 'Album cover updated', 'Обкладинку альбому оновлено'));
    } catch (e) {
      console.error('[gallery] set cover failed', e);
      showToast(textOr('gallery.coverFailed', 'Could not update the cover', 'Не вдалося оновити обкладинку'), true);
    }
  };

  const toggleSelected = (uploadUid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uploadUid)) next.delete(uploadUid); else next.add(uploadUid);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleMove = async () => {
    const target = moveTargetRef.current?.value;
    if (!target || selected.size === 0 || moving) return;
    const uids = Array.from(selected);
    setMoving(true);
    try {
      await moveUploadsToAlbum(uids, target);
      const targetName = albumName(target);
      // Belirli bir album sekmesindeysek tasinanlar listeden duser; "tum albumler"de kalir.
      if (activeTab !== ALL_TAB && activeTab !== target) {
        setUploads(prev => prev.filter(u => !selected.has(u.uid)));
      } else {
        setUploads(prev => prev.map(u => (selected.has(u.uid) ? { ...u, album_uid: target } : u)));
      }
      showToast(textOr('gallery.moved', '{{count}} items moved to "{{name}}"', 'Переміщено {{count}} елементів у «{{name}}»', { count: uids.length, name: targetName }));
      exitSelectMode();
    } catch (e) {
      console.error('[gallery] move failed', e);
      showToast(textOr('gallery.moveFailed', 'Could not move the items', 'Не вдалося перемістити елементи'), true);
    } finally {
      setMoving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPhotoViewer = (uploadUid: string) => {
    const index = uploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = uploads.map(upload => {
      const name = getUploaderName(upload);
      const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
      const album = albumName(upload.album_uid);
      return {
        src: S3_ROOT + upload.value,
        title: name,
        tagline: `${type} on ${formatDate(upload.created_at)}${album ? ` · ${album}` : ''}`,
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [
      { icon: 'fa-solid fa-download', onClick: (id) => handleDownload(id) },
      { icon: 'fa-regular fa-image', onClick: (id) => handleSetCover(id) },
      { icon: 'fa-solid fa-trash', onClick: (id) => handleTrash(id) },
    ];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  const sortedAlbums = sortAlbums(albums, 'date');
  const showAlbumTabs = sortedAlbums.length > 0;
  const allLoadedSelected = uploads.length > 0 && uploads.every(u => selected.has(u.uid));

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <PhotoViewerModal />
          {toast && (
            <div className={`gallery-toast${toast.error ? ' error' : ''}`}>
              <i className={`fa-solid ${toast.error ? 'fa-triangle-exclamation' : 'fa-check-circle'}`} />
              {toast.text}
            </div>
          )}
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('gallery.breadcrumb') },
            ]}
            title={t('gallery.title')}
          />

          {showAlbumTabs && (
            <div className="gallery-album-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`gallery-album-tab${activeTab === ALL_TAB ? ' active' : ''}`}
                onClick={() => setActiveTab(ALL_TAB)}
              >
                <i className="fa-solid fa-layer-group" />
                {textOr('gallery.tabAll', 'All albums', 'Усі альбоми')}
              </button>
              {sortedAlbums.map(album => (
                <button
                  key={album.uid}
                  type="button"
                  role="tab"
                  className={`gallery-album-tab${activeTab === album.uid ? ' active' : ''}`}
                  onClick={() => setActiveTab(album.uid)}
                  title={album.name}
                >
                  {album.is_default ? <i className="fa-solid fa-star" /> : <i className="fa-regular fa-folder-open" />}
                  <span>{album.name}</span>
                </button>
              ))}
            </div>
          )}

          <GalleryFilterBar
            activeTab={activeFilter}
            onTabChange={(tab) => setActiveFilter(tab as GalleryFilterType)}
            renderSearch={false}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            extraControls={(
              <div className="gallery-extra-controls">
                <button
                  type="button"
                  className={`gallery-sort-btn${sortBy === 'type' ? ' active' : ''}`}
                  onClick={() => setSortBy(sortBy === 'type' ? 'date' : 'type')}
                  title={textOr('gallery.sortByType', 'By type', 'За типом')}
                >
                  <i className="fa-solid fa-photo-film" />
                  <span>{sortBy === 'type' ? textOr('gallery.sortByType', 'By type', 'За типом') : textOr('gallery.sortByDate', 'By date', 'За датою')}</span>
                </button>
                {showAlbumTabs && (
                  <button
                    type="button"
                    className={`gallery-sort-btn${selectMode ? ' active' : ''}`}
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                  >
                    <i className={`fa-solid ${selectMode ? 'fa-xmark' : 'fa-check-double'}`} />
                    <span>{selectMode ? textOr('gallery.cancelSelect', 'Cancel', 'Скасувати') : textOr('gallery.select', 'Select', 'Вибрати')}</span>
                  </button>
                )}
              </div>
            )}
          />

          {selectMode && (
            <div className="gallery-select-bar">
              <span className="gallery-select-count">
                {textOr('gallery.selectedCount', '{{count}} selected', 'Вибрано: {{count}}', { count: selected.size })}
              </span>
              <button
                type="button"
                className="gallery-select-link"
                onClick={() => setSelected(allLoadedSelected ? new Set() : new Set(uploads.map(u => u.uid)))}
              >
                {allLoadedSelected ? textOr('common.deselectAll', 'Deselect all', 'Зняти вибір') : textOr('gallery.selectAllLoaded', 'Select all loaded', 'Вибрати всі завантажені')}
              </button>
              <div className="gallery-select-move">
                <label htmlFor="gallery-move-target">{textOr('gallery.moveTo', 'Move to album', 'Перемістити в альбом')}</label>
                <select id="gallery-move-target" ref={moveTargetRef} defaultValue={activeTab !== ALL_TAB ? '' : (sortedAlbums[0]?.uid || '')}>
                  {sortedAlbums.filter(a => a.uid !== activeTab).map(a => (
                    <option key={a.uid} value={a.uid}>{a.name}</option>
                  ))}
                </select>
                <button type="button" className="gallery-select-move-btn" disabled={selected.size === 0 || moving} onClick={handleMove}>
                  <i className={`fa-solid ${moving ? 'fa-spinner fa-spin' : 'fa-arrow-right-arrow-left'}`} />
                  {textOr('gallery.moveTo', 'Move to album', 'Перемістити в альбом')}
                </button>
              </div>
            </div>
          )}

          {/* Gallery Grid */}
          {uploads.length > 0 ? (
            <>
              <div className="gallery-masonry">
                {uploads.map((upload) => {
                  const name = getUploaderName(upload);
                  const badge = activeTab === ALL_TAB && albums.length > 1 ? albumName(upload.album_uid) : undefined;

                  return (
                    <MediaCard
                      onFullscreen={() => openPhotoViewer(upload.uid)}
                      key={upload.uid}
                      uploaderName={name}
                      uploadEntry={upload}
                      badge={badge || undefined}
                      selectable={selectMode}
                      selected={selected.has(upload.uid)}
                      onSelectToggle={() => toggleSelected(upload.uid)}
                      actions={[
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-magnifying-glass', onClick: () => openPhotoViewer(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-download', onClick: () => handleDownload(upload.uid) },
                        ...(upload.upload_type === 'photo' && upload.album_uid
                          ? [{ variant: 'icontext' as const, text: '', icon: 'fa-regular fa-image', title: textOr('gallery.setAsCover', 'Set as album cover', 'Зробити обкладинкою альбому'), onClick: () => handleSetCover(upload.uid) }]
                          : []),
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-trash', onClick: () => handleTrash(upload.uid) },
                      ]}
                    />
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="gallery-load-more">
                  <button className="gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                    <i className={`fa-solid ${loadingMore ? 'fa-spinner fa-spin' : 'fa-refresh'}`} />
                    {t('gallery.loadMore')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="gallery-empty">
              <div className="gallery-empty-icon">
                <i className="fa-solid fa-image" />
              </div>
              <h3 className="gallery-empty-title">{t('gallery.emptyTitle')}</h3>
              <p className="gallery-empty-text">{t('gallery.emptyText')}</p>
            </div>
          )}
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventGallery;
