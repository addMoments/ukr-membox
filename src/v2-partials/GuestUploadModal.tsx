import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import FileInput from '../components/FileInput';
import ActivityIndicator from '../v2-components/activity-indicator';
import { guestUpload } from '../client/uploads';
import { unpackUUID } from '../packages/uuid';
import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';
import { whoAmI } from '../client/auth';
import { pgREST } from '../client/postgrest';
import { getUploadLimitCode, isContributorLimitReachedError, isForbiddenError, UploadLimitCode } from '../utils/guestInitError';
import { GuestAlbum } from '../types/albums';
import { getGuestAlbumErrorCode } from '../client/albums';
import '../v2-styles/GuestHome.css';

// Ne: Misafir yukleme modali. V2GuestHome icinden ayrildi ki misafir album sayfasi da
//     ayni modali kullansin (albumler, 2026-09-08).
// Nasil: Dosyalar disaridan ref.addFiles ile verilir; modal kendi kuyruk/ilerleme/hata
//        durumunu tutar. Album secici yalnizca birden fazla gorunur album varsa cikar.
// Neden: Yukleme akisi (isim guncelleme, dosya bazli hata, tamamlandi ekrani) iki sayfada
//        birebir ayni olmali; kopyalamak 2.6'daki gibi sessiz farklar dogurur.

export interface GuestUploadModalHandle {
  addFiles: (files: File[]) => void;
}

interface GuestUploadModalProps {
  packedUid: string;
  albums: GuestAlbum[];
  // Acilista secili album; verilmezse General (is_default) ya da ilk album.
  initialAlbumUid?: string | null;
  // Album sayfasinda secici kilitli: misafir baska albume yonlenmesin.
  lockAlbum?: boolean;
  participantUid?: string;
  initialUploaderName?: string;
  onUploaderNameUpdate?: (name: string) => void;
  onUploadComplete?: () => void;
}

type FileEntry = { file: File; previewUrl: string; uploaded: boolean; failed: boolean };

const pickDefaultAlbum = (albums: GuestAlbum[], preferred?: string | null) => {
  if (preferred && albums.some(a => a.uid === preferred)) return preferred;
  const def = albums.find(a => a.is_default);
  if (def) return def.uid;
  return albums[0]?.uid || '';
};

const GuestUploadModal = forwardRef<GuestUploadModalHandle, GuestUploadModalProps>(function GuestUploadModal({
  packedUid,
  albums,
  initialAlbumUid,
  lockAlbum = false,
  participantUid,
  initialUploaderName,
  onUploaderNameUpdate,
  onUploadComplete,
}, ref) {
  const elemRef = useRef({ entries: [] as FileEntry[] }).current;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const albumSelectRef = useRef<HTMLSelectElement>(null);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, totalBytes: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  // Ne: Yukleme basariyla bitince gosterilecek onay ekraninin verisi (null = gosterme).
  // Neden: 2.6 — misafir mobilden yukleyince modal 1 saniyede sessizce kapaniyordu ve
  //        hicbir onay gormuyordu.
  const [uploadDone, setUploadDone] = useState<{ count: number; bytes: number } | null>(null);

  const getLocalizedText = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const handleFileSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    elemRef.entries.push({ file, previewUrl, uploaded: false, failed: false });
    setFileEntries([...elemRef.entries]);
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({
    addFiles: (files: File[]) => {
      files.forEach(handleFileSelect);
    },
  }));

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(elemRef.entries[index].previewUrl);
    elemRef.entries.splice(index, 1);
    setFileEntries([...elemRef.entries]);
    if (elemRef.entries.length === 0) setModalOpen(false);
  };

  const handleCancel = () => {
    elemRef.entries.forEach(e => URL.revokeObjectURL(e.previewUrl));
    elemRef.entries = [];
    setFileEntries([]);
    setModalOpen(false);
    setUploadDone(null);
  };

  const handleUpload = async () => {
    const pendingEntries = elemRef.entries.filter(e => !e.uploaded);
    if (!pendingEntries.length) return;

    const eventUid = unpackUUID(packedUid);
    const uploaderName = nameInputRef.current?.value?.trim() || '';
    // Secili album: select varsa ondan, yoksa varsayilan. Bos string -> sunucu General'e yazar.
    const albumUid = albumSelectRef.current?.value || pickDefaultAlbum(albums, initialAlbumUid);
    const contributorLimitMessage = getLocalizedText(
      'errors.contributorLimitReached',
      'Etkinlik paylaşım limiti doldu. Yeni katılımcı paylaşımı kabul edilmiyor.'
    );
    const genericForbiddenMessage = getLocalizedText(
      'errors.forbidden',
      'Bu işlem şu anda yapılamıyor.'
    );
    const albumClosedMessage = textOr(
      'guest.album.uploadsClosed',
      'Uploads are closed for this album',
      'Завантаження в цей альбом закрито'
    );
    // Limit mesajlari: sunucudan gelen koda gore hangi limitin dolduğunu soyler.
    const limitMessage = (code: UploadLimitCode) => {
      switch (code) {
        case 'MEDIA_LIMIT_REACHED':
          return textOr(
            'errors.mediaLimitReached',
            'This event has reached its limit for photos and videos.',
            'Ця подія досягла ліміту фото та відео.'
          );
        case 'STORAGE_LIMIT_REACHED':
          return textOr(
            'errors.storageLimitReached',
            'This event has reached its storage limit.',
            'Ця подія досягла ліміту місця для зберігання.'
          );
        case 'GUEST_MEDIA_LIMIT_REACHED':
          return textOr(
            'errors.guestMediaLimitReached',
            'You have reached the number of files you can upload to this event.',
            'Ви досягли ліміту файлів, які можна завантажити для цієї події.'
          );
        case 'GUEST_STORAGE_LIMIT_REACHED':
          return textOr(
            'errors.guestStorageLimitReached',
            'You have reached the total upload size allowed for this event.',
            'Ви досягли ліміту загального розміру завантажень для цієї події.'
          );
      }
    };

    setUploadErrorMessage('');
    setUploadDone(null);
    setIsUploading(true);
    const totalBytes = pendingEntries.reduce((s, e) => s + e.file.size, 0);
    setUploadProgress({ done: 0, total: pendingEntries.length, totalBytes });
    pendingEntries.forEach((entry) => {
      entry.failed = false;
    });
    setFileEntries([...elemRef.entries]);

    try {
      if (uploaderName) {
        const uploaderUid = participantUid || (await whoAmI()).ui;
        try {
          await pgREST(`/participants?uid=eq.${uploaderUid}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: uploaderName }),
          });
          onUploaderNameUpdate?.(uploaderName);
        } catch {
          // Keep upload flow running even if participant name update fails.
        }
      }

      let doneCount = 0;
      let successCount = 0;
      let contributorLimitHit = false;
      let albumClosedHit = false;
      let limitHit: UploadLimitCode | null = null;

      for (const entry of pendingEntries) {
        try {
          const uploadType = entry.file.type.startsWith('video/') ? 'video' : 'photo';
          await guestUpload(eventUid, uploadType, [entry.file], albumUid);
          entry.uploaded = true;
          entry.failed = false;
          successCount += 1;
        } catch (err) {
          entry.uploaded = false;
          entry.failed = true;
          if (isContributorLimitReachedError(err)) {
            contributorLimitHit = true;
          } else if (getUploadLimitCode(err)) {
            // Limit doldu: kalan dosyalar da ayni hatayi alacagi icin dongu devam etse de
            // mesaj tek ve net kalir.
            limitHit = getUploadLimitCode(err);
          } else if (getGuestAlbumErrorCode(err)) {
            // Album bu arada kapatilmis ya da silinmis olabilir.
            albumClosedHit = true;
          } else if (isForbiddenError(err) && !contributorLimitHit) {
            setUploadErrorMessage(genericForbiddenMessage);
          }
        } finally {
          doneCount += 1;
          setUploadProgress({ done: doneCount, total: pendingEntries.length, totalBytes });
          setFileEntries([...elemRef.entries]);
        }
      }

      if (contributorLimitHit) {
        setUploadErrorMessage(contributorLimitMessage);
      } else if (limitHit) {
        setUploadErrorMessage(limitMessage(limitHit));
      } else if (albumClosedHit) {
        setUploadErrorMessage(albumClosedMessage);
      }

      setFileEntries([...elemRef.entries]);
      if (successCount > 0) {
        onUploadComplete?.();
      }

      const hasFailedEntries = pendingEntries.some(e => e.failed);
      if (!hasFailedEntries) {
        // Ne: Once "yukleme tamamlandi" ekranini goster, sonra modali kapat.
        // Nasil: Sure 1sn'den 2.6sn'ye cikarildi; 1 saniye mesaji okumaya yetmiyordu.
        //        Erken kapatmak isteyen backdrop'a dokunabilir, handleCancel devrede.
        // Neden: 2.6 — tum dosyalar yuklendiginde misafire acik bir onay verilmeli.
        setUploadDone({
          count: successCount,
          bytes: pendingEntries.reduce((sum, entry) => sum + entry.file.size, 0),
        });
        setTimeout(() => {
          elemRef.entries.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
          elemRef.entries = [];
          setFileEntries([]);
          setModalOpen(false);
          setUploadDone(null);
        }, 2600);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!modalOpen) return null;

  const totalBytes = fileEntries.reduce((s, e) => s + e.file.size, 0);
  const failedCount = fileEntries.filter(e => e.failed).length;
  const uploadedCount = fileEntries.filter(e => e.uploaded).length;
  const failedLabel = getLocalizedText('common.failed', 'Failed');
  const uploadedLabel = getLocalizedText('common.uploaded', 'Uploaded');
  const showAlbumPicker = albums.length > 1;
  const defaultAlbumUid = pickDefaultAlbum(albums, initialAlbumUid);
  const lockedAlbum = lockAlbum ? albums.find(a => a.uid === defaultAlbumUid) : undefined;

  return (
    <div className="upload-modal-backdrop" onClick={!isUploading ? handleCancel : undefined}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        {uploadDone ? (
          <div className="upload-modal-success" role="status">
            <div className="upload-modal-success-badge">
              <i className="fa-solid fa-check" />
            </div>
            <p className="upload-modal-success-title">
              {textOr('guest.uploadCompleted', 'Upload completed', 'Завантаження завершено')}
            </p>
            <p className="upload-modal-success-sub">
              {uploadDone.count} {t('common.files')} · {formatBytes(uploadDone.bytes)}
            </p>
          </div>
        ) : (
        <>
        <h3 className="upload-modal-title">{t('guest.photosAndVideos')}</h3>
        {uploadErrorMessage ? (
          <div className="upload-modal-error" role="alert">
            <i className="fa-solid fa-circle-exclamation" />
            <span>{uploadErrorMessage}</span>
          </div>
        ) : null}
        <div className="upload-modal-name-wrap">
          <input
            ref={nameInputRef}
            type="text"
            className="upload-modal-name-input"
            name="name"
            placeholder={t('guestGuestbook.yourName')}
            defaultValue={initialUploaderName || ''}
            disabled={isUploading}
          />
        </div>

        {showAlbumPicker && !lockedAlbum && (
          <div className="upload-modal-album-wrap">
            <label className="upload-modal-album-label" htmlFor="upload-modal-album">
              <i className="fa-regular fa-folder-open" />
              {textOr('guest.album.pickAlbum', 'Album', 'Альбом')}
            </label>
            <select
              id="upload-modal-album"
              ref={albumSelectRef}
              className="upload-modal-album-select"
              defaultValue={defaultAlbumUid}
              disabled={isUploading}
            >
              {albums.map(album => (
                <option key={album.uid} value={album.uid}>{album.name}</option>
              ))}
            </select>
          </div>
        )}
        {lockedAlbum && (
          <div className="upload-modal-album-wrap upload-modal-album-locked">
            <i className="fa-regular fa-folder-open" />
            <span>{lockedAlbum.name}</span>
            <select ref={albumSelectRef} defaultValue={lockedAlbum.uid} hidden>
              <option value={lockedAlbum.uid}>{lockedAlbum.name}</option>
            </select>
          </div>
        )}

        <div className="upload-modal-list-header">
          <span>{fileEntries.length} {t('common.files')}</span>
          {!isUploading && (
            <FileInput onFile={handleFileSelect} multiple accept="image/*,video/*">
              <button type="button" className="upload-modal-add-btn">
                <i className="fa-solid fa-plus" />
              </button>
            </FileInput>
          )}
        </div>

        <div className="upload-modal-list">
          {fileEntries.map((entry, index) => (
            <div
              key={index}
              className={`upload-modal-item${entry.uploaded ? ' upload-modal-item--done' : ''}${entry.failed ? ' upload-modal-item--failed' : ''}`}
            >
              <img className="upload-modal-thumb" src={entry.previewUrl} alt="" />
              <div className="upload-modal-item-info">
                <span className="upload-modal-item-name">{entry.file.name}</span>
                <span className="upload-modal-item-size">{formatBytes(entry.file.size)}</span>
                {entry.failed ? <span className="upload-modal-item-error">{failedLabel}</span> : null}
              </div>
              {entry.uploaded
                ? <i className="fa-solid fa-circle-check upload-modal-item-check" />
                : entry.failed
                  ? <i className="fa-solid fa-circle-xmark upload-modal-item-fail" />
                : !isUploading && (
                  <button type="button" className="upload-modal-item-remove" onClick={() => handleRemoveFile(index)}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                )
              }
            </div>
          ))}
        </div>

        <div className="upload-modal-status">
          {isUploading
            ? <><ActivityIndicator color="var(--text-secondary)" style={{ width: 16, height: 16 }} /><span>{t('guest.uploadingProgress', { done: uploadProgress.done, total: uploadProgress.total, size: formatBytes(totalBytes) })}</span></>
            : <><i className="fa-solid fa-circle-info" /><span>{fileEntries.length} {t('common.files')} · {formatBytes(totalBytes)} · {uploadedCount} {uploadedLabel} · {failedCount} {failedLabel}</span></>
          }
        </div>

        <div className="upload-modal-actions">
          <button className="upload-modal-cancel" onClick={handleCancel} disabled={isUploading}>
            {t('guestGuestbook.cancel')}
          </button>
          <button className="upload-modal-submit" onClick={handleUpload} disabled={isUploading || fileEntries.every(e => e.uploaded)}>
            {isUploading
              ? <ActivityIndicator color="#fff" style={{ width: 16, height: 16 }} />
              : <i className="fa-solid fa-arrow-up-from-bracket" />
            }
            {t('guest.uploadFiles')}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
});

export default GuestUploadModal;
