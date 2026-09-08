import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import Button from '../../components/Button';
import { Event } from '../../types/events';
import { Album, AlbumListSort, albumCoverUrl, albumGuestUrl, albumQrImageUrl, sortAlbums } from '../../types/albums';
import { Job } from '../../types/jobs';
import { adjustAlbumQR, albumMediaCounts, deleteAlbum, ensureAlbumQRs, listAlbums } from '../../client/albums';
import { pgErr } from '../../client/postgrest';
import { dbWhoAmI } from '../../client/auth';
import { packUUID } from '../../packages/uuid';
import { S3_ROOT } from '../../consts';
import { saveUrl } from '../../utils/download';
import { copyText } from '../../utils/clipboard';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import '../../v2-styles/Albums.css';

// Ne: Host album listesi (Excel madde 3). Kart basina: kapak, ad, tarih, adet, rozetler;
//     galeriyi ac / duzenle / paylas (link + QR) / indir (zip job) / sil.
// Nasil: Albumler ve adetler PostgREST'ten; silme, QR ve zip membox-serv'den.
//        Silme modali "fotograflar cope gider" uyarisini onay kutusuyla zorlar (karar 3).

type JobsByAlbum = Record<string, Job & { input?: { album_uid?: string } }>;

function EventAlbums() {
  return (
    <EventDetailLayout>
      {(event) => <EventAlbumsInner event={event} />}
    </EventDetailLayout>
  );
}

function EventAlbumsInner({ event }: { event: Event }) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<AlbumListSort>('date');
  const [loaded, setLoaded] = useState(false);
  const [shareAlbum, setShareAlbum] = useState<Album | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrStamp, setQrStamp] = useState(Date.now());
  const [qrMissing, setQrMissing] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [jobs, setJobs] = useState<JobsByAlbum>({});
  const [exportBusy, setExportBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const selfUidRef = useRef<string | null>(null);
  const langCode = t('lang_code');

  const showToast = (text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    if (!event.uid) return;
    const [list, countMap] = await Promise.all([listAlbums(event.uid), albumMediaCounts(event.uid)]);
    setAlbums(list);
    setCounts(countMap);
    setLoaded(true);
  }, [event.uid]);

  useEffect(() => {
    load();
    dbWhoAmI().then((uid) => { selfUidRef.current = uid; }).catch(() => {});
  }, [load]);

  // QR'i olmayan albumlere (migration ile gelen General dahil) varsayilan QR uret.
  useEffect(() => {
    if (!event.uid) return;
    ensureAlbumQRs(event.uid)
      .then((generated) => { if (generated.length > 0) setQrStamp(Date.now()); })
      .catch(() => {});
  }, [event.uid]);

  // Album bazli export job'lari: album_uid tasiyanlarin en yenisi.
  const fetchJobs = useCallback(async () => {
    if (!event.uid) return {} as JobsByAlbum;
    const { res } = await pgErr(`/jobs?name=eq.s3_export&input->>event_uid=eq.${event.uid}&input->>album_uid=not.is.null&order=created_at.desc&limit=100`);
    const map: JobsByAlbum = {};
    (Array.isArray(res) ? res : []).forEach((job: Job & { input?: { album_uid?: string } }) => {
      const albumUid = job.input?.album_uid;
      if (albumUid && !map[albumUid]) map[albumUid] = job;
    });
    setJobs(map);
    return map;
  }, [event.uid]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const anyJobActive = Object.values(jobs).some(j => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!anyJobActive) return;
    const timer = window.setInterval(() => { fetchJobs(); }, 3000);
    return () => window.clearInterval(timer);
  }, [anyJobActive, fetchJobs]);

  const handleExport = async (album: Album) => {
    if (exportBusy || anyJobActive) return;
    setExportBusy(true);
    try {
      const selfUid = selfUidRef.current || await dbWhoAmI();
      const { err } = await pgErr('/jobs', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: 's3_export',
          user_uid: selfUid,
          input: { event_uid: event.uid, album_uid: album.uid },
        }),
      });
      if (err) throw err;
      await fetchJobs();
    } catch (e) {
      console.error('[albums] export failed', e);
      showToast(textOr('albums.download.failed', 'Export failed', 'Помилка експорту'), true);
    } finally {
      setExportBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !deleteAck || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteAlbum(event.uid, deleteTarget.uid);
      setDeleteTarget(null);
      setDeleteAck(false);
      showToast(textOr('albums.delete.done', 'Album deleted. {{count}} items moved to Trash.', 'Альбом видалено. Елементів переміщено в кошик: {{count}}.', { count: res.trashed_count ?? 0 }));
      await load();
    } catch (e) {
      console.error('[albums] delete failed', e);
      showToast(textOr('albums.delete.failed', 'Could not delete the album.', 'Не вдалося видалити альбом.'), true);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async (album: Album) => {
    const ok = await copyText(albumGuestUrl(album.uid));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQrError = async (album: Album) => {
    if (qrMissing[album.uid]) return;
    setQrMissing(prev => ({ ...prev, [album.uid]: true }));
    // Dosya yok (ornegin S3 gecikmesi): bir kez uretmeyi dene ve onizlemeyi tazele.
    try {
      await adjustAlbumQR(event.uid, album.uid);
      setQrMissing(prev => ({ ...prev, [album.uid]: false }));
      setQrStamp(Date.now());
    } catch {
      // Gosterilecek QR yok; yer tutucu kalir.
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(langCode, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const exportDateFormat = (dateStr: string) =>
    new Date(dateStr).toLocaleString(langCode, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const privacyLabel = (album: Album) => {
    if (album.privacy === 'private') return textOr('albums.privacyPrivate', 'Private', 'Приватний');
    if (album.privacy === 'protected') return textOr('albums.privacyProtected', 'Protected', 'З паролем');
    return textOr('albums.privacyPublic', 'Public', 'Публічний');
  };

  const guestGalleryOn = !!event.settings?.guest_gallery;
  const sorted = sortAlbums(albums, sort);

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: t('common.events'), to: '/events' },
          { label: event.name || t('common.event'), to: `/event/${packedUid}` },
          { label: textOr('albums.breadcrumb', 'Albums', 'Альбоми') },
        ]}
        title={textOr('albums.title', 'Albums', 'Альбоми')}
      />

      {toast && (
        <div className={`albums-toast${toast.error ? ' error' : ''}`}>
          <i className={`fa-solid ${toast.error ? 'fa-triangle-exclamation' : 'fa-check-circle'}`} />
          {toast.text}
        </div>
      )}

      <div className="albums-header">
        <p className="albums-header-subtitle">
          {textOr('albums.subtitle', 'Group your event’s photos into albums. Each album has its own link and QR code.', 'Згрупуйте фото події в альбоми. Кожен альбом має власне посилання та QR-код.')}
        </p>
        <div className="albums-header-actions">
          <div className="albums-sort" role="group">
            <button type="button" className={sort === 'date' ? 'active' : ''} onClick={() => setSort('date')}>
              {textOr('albums.sortByDate', 'By date', 'За датою')}
            </button>
            <button type="button" className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>
              {textOr('albums.sortByName', 'By name', 'За назвою')}
            </button>
          </div>
          <Button
            icon="fa-solid fa-plus"
            text={textOr('albums.newAlbum', 'New album', 'Новий альбом')}
            type="button"
            onClick={() => navigate(`/event/${packedUid}/albums/new`)}
          />
        </div>
      </div>

      {!guestGalleryOn && (
        <div className="albums-notice" role="status">
          <i className="fa-solid fa-eye-slash" />
          <span>{textOr('albums.galleryOffNotice', 'Guest viewing is off for the whole event. Guests can upload but not see the albums’ photos.', 'Перегляд для гостей вимкнено для всієї події. Гості можуть завантажувати, але не бачать фото в альбомах.')}</span>
          <Link to={`/event/${packedUid}/settings#privacy`}>{textOr('albums.galleryOffAction', 'Open Settings', 'Відкрити налаштування')}</Link>
        </div>
      )}

      {loaded && sorted.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon"><i className="fa-regular fa-folder-open" /></div>
          <h3 className="gallery-empty-title">{textOr('albums.empty.title', 'No albums yet', 'Ще немає альбомів')}</h3>
          <p className="gallery-empty-text">{textOr('albums.empty.text', 'Create albums like Ceremony, Reception or Party and share each one with its own QR code.', 'Створіть альбоми, наприклад «Церемонія», «Банкет» чи «Вечірка», і діліться кожним через окремий QR-код.')}</p>
        </div>
      ) : (
        <div className="albums-grid">
          {sorted.map((album) => {
            const cover = albumCoverUrl(album);
            const count = counts[album.uid] || 0;
            const job = jobs[album.uid];
            const dateText = formatDate(album.album_date);
            return (
              <div className="album-card" key={album.uid}>
                <div className="album-card-cover" onClick={() => navigate(`/event/${packedUid}/gallery?album=${packUUID(album.uid)}`)}>
                  {cover
                    ? <img src={cover} alt={album.name} loading="lazy" />
                    : <div className="album-card-cover-placeholder"><i className="fa-regular fa-images" /></div>}
                  <div className="album-card-badges">
                    {album.is_default && <span className="album-badge default"><i className="fa-solid fa-star" />{textOr('albums.defaultBadge', 'Default', 'За замовчуванням')}</span>}
                    <span className={`album-badge ${album.privacy}`}>
                      <i className={`fa-solid ${album.privacy === 'protected' ? 'fa-lock' : album.privacy === 'private' ? 'fa-link' : 'fa-globe'}`} />
                      {privacyLabel(album)}
                    </span>
                    {!album.guest_upload && <span className="album-badge closed"><i className="fa-solid fa-eye-slash" />{textOr('albums.closedBadge', 'Hidden from guests', 'Приховано від гостей')}</span>}
                    {album.guest_upload && !album.guest_view && <span className="album-badge viewoff"><i className="fa-regular fa-eye-slash" />{textOr('albums.viewOffBadge', 'View off', 'Перегляд вимкнено')}</span>}
                  </div>
                  <span className="album-card-count"><i className="fa-regular fa-images" />{count}</span>
                </div>
                <div className="album-card-body">
                  <h3 className="album-card-name">{album.name}</h3>
                  <div className="album-card-meta">
                    <span><i className="fa-regular fa-calendar" />{dateText || textOr('albums.noDate', 'No date', 'Без дати')}</span>
                    {album.location && <span><i className="fa-solid fa-location-dot" />{album.location}</span>}
                  </div>
                  {album.description && <p className="album-card-desc">{album.description}</p>}
                </div>
                {job && (
                  <div className={`album-card-export${job.status === 'failed' ? ' failed' : ''}`}>
                    {job.status === 'succeeded' && textOr('albums.download.latest', 'Latest export: {{date}}', 'Останній експорт: {{date}}', { date: exportDateFormat(job.updated_at) })}
                    {(job.status === 'queued' || job.status === 'running') && textOr('albums.download.preparing', 'Preparing…', 'Підготовка…')}
                    {job.status === 'failed' && textOr('albums.download.failed', 'Export failed', 'Помилка експорту')}
                  </div>
                )}
                <div className="album-card-actions">
                  <button type="button" className="album-card-action" onClick={() => navigate(`/event/${packedUid}/gallery?album=${packUUID(album.uid)}`)}>
                    <i className="fa-solid fa-images" />{textOr('albums.actions.open', 'Open gallery', 'Відкрити галерею')}
                  </button>
                  <button type="button" className="album-card-action" onClick={() => navigate(`/event/${packedUid}/albums/${packUUID(album.uid)}`)}>
                    <i className="fa-solid fa-pen" />{textOr('albums.actions.edit', 'Edit', 'Редагувати')}
                  </button>
                  <button type="button" className="album-card-action" onClick={() => { setCopied(false); setShareAlbum(album); }}>
                    <i className="fa-solid fa-qrcode" />{textOr('albums.actions.share', 'Share & QR', 'Поділитися та QR')}
                  </button>
                  {job && job.status === 'succeeded' ? (
                    <button type="button" className="album-card-action" onClick={() => saveUrl(S3_ROOT + String(job.output?.zip_path || ''), `${album.name}.zip`)}>
                      <i className="fa-solid fa-file-zipper" />{textOr('albums.download.ready', 'Download ZIP', 'Завантажити ZIP')}
                    </button>
                  ) : (
                    <button type="button" className="album-card-action" disabled={exportBusy || anyJobActive || count === 0} onClick={() => handleExport(album)}>
                      <i className={`fa-solid ${job && (job.status === 'queued' || job.status === 'running') ? 'fa-spinner fa-spin' : 'fa-download'}`} />
                      {textOr('albums.download.start', 'Prepare ZIP', 'Підготувати ZIP')}
                    </button>
                  )}
                  {!album.is_default && (
                    <button type="button" className="album-card-action danger" onClick={() => { setDeleteAck(false); setDeleteTarget(album); }}>
                      <i className="fa-solid fa-trash" />{textOr('albums.actions.delete', 'Delete', 'Видалити')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shareAlbum && (
        <div className="album-modal-backdrop" onClick={() => setShareAlbum(null)}>
          <div className="album-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="album-modal-title">{textOr('albums.share.title', 'Share “{{name}}”', 'Поділитися «{{name}}»', { name: shareAlbum.name })}</h3>
            <div>
              <label className="settings-field-label" style={{ display: 'block', marginBottom: 8 }}>{textOr('albums.share.link', 'Album link', 'Посилання на альбом')}</label>
              <div className="album-share-link">
                <input type="text" readOnly value={albumGuestUrl(shareAlbum.uid)} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="album-modal-btn primary" onClick={() => handleCopy(shareAlbum)}>
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                  {copied ? textOr('albums.share.copied', 'Link copied', 'Посилання скопійовано') : textOr('albums.share.copy', 'Copy link', 'Копіювати посилання')}
                </button>
              </div>
            </div>
            {shareAlbum.privacy !== 'public' && (
              <p className="album-share-hint"><i className="fa-solid fa-circle-info" />{textOr('albums.share.privateHint', 'This album is not listed on the event page. Guests need this link or QR code.', 'Цей альбом не відображається на сторінці події. Гостям потрібне це посилання або QR-код.')}</p>
            )}
            {shareAlbum.privacy === 'protected' && (
              <p className="album-share-hint">
                <i className="fa-solid fa-lock" />
                <span>{textOr('albums.share.protectedHint', 'Guests will also need the passcode: {{passcode}}', 'Гостям також потрібен пароль: {{passcode}}', { passcode: shareAlbum.passcode || '—' })}</span>
              </p>
            )}
            <div className="album-share-qr">
              <label className="settings-field-label">{textOr('albums.share.qr', 'Album QR code', 'QR-код альбому')}</label>
              {qrMissing[shareAlbum.uid]
                ? <div className="album-share-qr-placeholder"><i className="fa-solid fa-qrcode" /></div>
                : <img src={`${albumQrImageUrl(event.uid, shareAlbum.uid)}?t=${qrStamp}`} alt="QR" onError={() => handleQrError(shareAlbum)} />}
              <div className="album-share-qr-actions">
                <button
                  type="button"
                  className="album-modal-btn"
                  onClick={() => {
                    const url = `${albumQrImageUrl(event.uid, shareAlbum.uid)}?t=${Date.now()}`;
                    saveUrl(url, `qr-${shareAlbum.name}.png`).catch(() => window.open(url, '_blank'));
                  }}
                >
                  <i className="fa-solid fa-download" />{textOr('albums.share.downloadQr', 'Download QR (PNG)', 'Завантажити QR (PNG)')}
                </button>
                <button type="button" className="album-modal-btn" onClick={() => navigate(`/event/${packedUid}/qr?album=${packUUID(shareAlbum.uid)}`)}>
                  <i className="fa-solid fa-palette" />{textOr('albums.share.customizeQr', 'Customize QR', 'Налаштувати QR')}
                </button>
              </div>
            </div>
            <div className="album-modal-actions">
              <button type="button" className="album-modal-btn" onClick={() => setShareAlbum(null)}>{textOr('albums.share.close', 'Close', 'Закрити')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="album-modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="album-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="album-modal-title">{textOr('albums.delete.title', 'Delete album', 'Видалити альбом')}</h3>
            <div className="album-modal-warning">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>
                {(counts[deleteTarget.uid] || 0) > 0
                  ? textOr('albums.delete.warning', 'All {{count}} photos and videos in “{{name}}” will be moved to Trash together with the album.', 'Усі {{count}} фото та відео в альбомі «{{name}}» буде переміщено в кошик разом із альбомом.', { count: counts[deleteTarget.uid] || 0, name: deleteTarget.name })
                  : textOr('albums.delete.warningEmpty', '“{{name}}” is empty and will be removed.', 'Альбом «{{name}}» порожній і буде видалений.', { name: deleteTarget.name })}
              </span>
            </div>
            <p className="album-modal-text">{textOr('albums.delete.hint', 'You can restore items from Trash before they are permanently deleted. Restored items go to the General album.', 'Елементи можна відновити з кошика до остаточного видалення. Відновлені елементи потрапляють у альбом General.')}</p>
            <label className="album-modal-check">
              <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} disabled={deleting} />
              <span>{textOr('albums.delete.confirmCheckbox', 'I understand the photos and videos will be moved to Trash', 'Я розумію, що фото та відео буде переміщено в кошик')}</span>
            </label>
            <div className="album-modal-actions">
              <button type="button" className="album-modal-btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>{textOr('albums.delete.cancel', 'Cancel', 'Скасувати')}</button>
              <button type="button" className="album-modal-btn danger" onClick={handleDelete} disabled={!deleteAck || deleting}>
                <i className={`fa-solid ${deleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
                {textOr('albums.delete.confirmButton', 'Delete album', 'Видалити альбом')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EventAlbums;
