import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import FileInput from '../components/FileInput';
import '../v2-styles/GuestHome.css';
import { UploadEntry } from '../types/uploads';
import ActivityIndicator from '../v2-components/activity-indicator';
import { guestUpload } from '../client/uploads';
import { unpackUUID } from '../packages/uuid';
// import { S3_ROOT } from '../consts';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import { fonts } from '../types/fonts';
// import { getTimeAgo } from '../temp-ai-logic-and-data/time-ago';
// import MediaCard from '../v2-components/MediaCard';
import PhotoViewerModal from '../partials/PhotoViewerModal';
import { t } from '../packages/i18n';
import { whoAmI } from '../client/auth';
import { pgREST } from '../client/postgrest';
import { isContributorLimitReachedError, isForbiddenError } from '../utils/guestInitError';
import { AdvertorialCell, AdvertorialLayout, AdvertorialResponse } from '../types/advertorial';

export interface V2GuestHomeProps {
  bannerImageUrl: string | null;
  eventTitle: string;
  eventType: string;
  eventDate: string;
  eventLocation: string;
  welcomeMessage: string;
  eventInitials: string;
  recentUploads: UploadEntry[];
  packedUid: string;
  onFileSelect: (file: File) => void;
  onUploadComplete?: () => void;
  participantUid?: string;
  initialUploaderName?: string;
  onUploaderNameUpdate?: (name: string) => void;
  theme?: GuestTheme;
  font?: string;
  advertorial?: AdvertorialResponse | null;
}

type FileEntry = { file: File; previewUrl: string; uploaded: boolean; failed: boolean };

const ADVERTORIAL_CELL_COUNT: Record<AdvertorialLayout, number> = {
  none: 0,
  single: 1,
  '1x1': 1,
  '2x1': 2,
  '1x2': 2,
  '2x2': 4,
};

// Ne: Guest sayfasinda reklam grid'inin render edilip edilmeyecegini belirler.
// Nasil: Backend enabled, layout none kontrolu, cell sayisi ve image_url dolulugu birlikte degerlendirilir.
// Neden: Reklam kapaliysa veya config eksikse DOM'da bos alan birakmadan hicbir sey gostermemek.
const getRenderableAdvertorialCells = (advertorial?: AdvertorialResponse | null): AdvertorialCell[] => {
  if (!advertorial?.enabled) return [];
  const layout = advertorial.config?.layout;
  if (!layout || layout === 'none') return [];

  const requiredCount = ADVERTORIAL_CELL_COUNT[layout];
  const cells = advertorial.config?.cells || [];
  if (!requiredCount || cells.length !== requiredCount) return [];

  return cells
    .filter((cell) => cell.index >= 0 && cell.index < requiredCount && !!cell.image_url)
    .sort((a, b) => a.index - b.index);
};

function GuestAdvertorialGrid({ advertorial }: { advertorial?: AdvertorialResponse | null }) {
  const cells = getRenderableAdvertorialCells(advertorial);
  const layout = advertorial?.config?.layout;
  if (!layout || cells.length === 0 || cells.length !== ADVERTORIAL_CELL_COUNT[layout]) return null;

  return (
    <div className={`guest-advertorial-grid guest-advertorial-grid-${layout}`}>
      {cells.map((cell) => {
        const image = <img src={cell.image_url} alt="" loading="lazy" />;
        return (
          <div key={cell.index} className="guest-advertorial-cell">
            {cell.link_url ? (
              <a href={cell.link_url} target="_blank" rel="noopener noreferrer">
                {image}
              </a>
            ) : image}
          </div>
        );
      })}
    </div>
  );
}

function V2GuestHome({
  bannerImageUrl,
  eventTitle,
  eventType,
  eventDate,
  welcomeMessage,
  recentUploads,
  packedUid,
  onUploadComplete,
  participantUid,
  initialUploaderName,
  onUploaderNameUpdate,
  theme = defaultGuestTheme,
  font,
  advertorial,
}: V2GuestHomeProps) {
  const elemRef = useRef({ entries: [] as FileEntry[] }).current;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, totalBytes: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');

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
  };

  const handleUpload = async () => {
    const pendingEntries = elemRef.entries.filter(e => !e.uploaded);
    if (!pendingEntries.length) return;

    const eventUid = unpackUUID(packedUid);
    const uploaderName = nameInputRef.current?.value?.trim() || '';
    const contributorLimitMessage = getLocalizedText(
      'errors.contributorLimitReached',
      'Etkinlik paylaşım limiti doldu. Yeni katılımcı paylaşımı kabul edilmiyor.'
    );
    const genericForbiddenMessage = getLocalizedText(
      'errors.forbidden',
      'Bu işlem şu anda yapılamıyor.'
    );

    setUploadErrorMessage('');
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

      for (const entry of pendingEntries) {
        try {
          const uploadType = entry.file.type.startsWith('video/') ? 'video' : 'photo';
          await guestUpload(eventUid, uploadType, [entry.file]);
          entry.uploaded = true;
          entry.failed = false;
          successCount += 1;
        } catch (err) {
          entry.uploaded = false;
          entry.failed = true;
          if (isContributorLimitReachedError(err)) {
            contributorLimitHit = true;
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
      }

      setFileEntries([...elemRef.entries]);
      if (successCount > 0) {
        onUploadComplete?.();
      }

      const hasFailedEntries = pendingEntries.some(e => e.failed);
      if (!hasFailedEntries) {
        setTimeout(() => {
          elemRef.entries = [];
          setFileEntries([]);
          setModalOpen(false);
        }, 1000);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalBytes = fileEntries.reduce((s, e) => s + e.file.size, 0);
  const failedCount = fileEntries.filter(e => e.failed).length;
  const uploadedCount = fileEntries.filter(e => e.uploaded).length;

  const uploadPhotosAndVideosText = t('guest.uploadPhotosAndVideos');
  const uploadAudioMessageTextRaw = t('guest.uploadAudioMessage');
  const uploadAudioMessageText = uploadAudioMessageTextRaw === 'guest.uploadAudioMessage'
    ? (t('lang_code') === 'uk' ? 'Завантажити аудіо повідомлення' : 'Upload Audio Message')
    : uploadAudioMessageTextRaw;
  const failedLabel = getLocalizedText('common.failed', 'Failed');
  const uploadedLabel = getLocalizedText('common.uploaded', 'Uploaded');

  // const openPhotoViewer = (uploadUid: string) => {
  //   const index = recentUploads.findIndex(u => u.uid === uploadUid);
  //   photoViewerState.items = recentUploads.map(upload => {
  //     const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
  //     return {
  //       src: S3_ROOT + upload.value,
  //       title: t('guest.yourUpload'),
  //       tagline: `${type} · ${getTimeAgo(upload.created_at)}`,
  //       id: upload.uid,
  //       isVideo: upload.upload_type === 'video',
  //     };
  //   });
  //   photoViewerState.actions = [];
  //   photoViewerState.currentIndex = index >= 0 ? index : 0;
  //   photoViewerState.open = true;
  // };

  return (
    <div className="guest-home" style={{ ...theme, fontFamily: fonts.find(f => f.id === font)?.fontFamily }}>
      <PhotoViewerModal />

      {/* Upload Modal */}
      {modalOpen && (
        <div className="upload-modal-backdrop" onClick={!isUploading ? handleCancel : undefined}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      <V2Header />

      <main className="guest-home-main">
        {/* Unified Hero + Upload Card */}
        <section className="guest-home-hero guest-home-main-card">
          <div className="guest-home-hero-info-band-wrap">
            <div className="guest-home-hero-info-band">
              <h1 className="guest-home-hero-title">{eventTitle}</h1>
              <div className="guest-home-hero-meta">
                <div className="guest-home-hero-meta-item">
                  <i className="fa-regular fa-calendar" />
                  <span>{eventDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="guest-home-hero-image">
            {bannerImageUrl && (
              <img src={bannerImageUrl} alt={t('guest.eventAmbiance')} />
            )}
            <div className="guest-home-hero-image-overlay" />
            <span className="guest-home-hero-badge">{eventType}</span>
            <span className="guest-home-hero-date-badge">
              <i className="fa-regular fa-calendar" />
              <span>{eventDate}</span>
            </span>
          </div>

          <div className="guest-home-main-card-content">
            <section className="guest-home-upload">
              <div className="guest-home-upload-inner" style={{position: 'relative', zIndex: 1}}>

              <FileInput onFile={handleFileSelect} multiple accept="image/*,video/*">
              <button style={{marginBottom: '10px'}} className="guest-home-upload-btn">
                <i className="fa-solid fa-camera-retro" />
                <span>{uploadPhotosAndVideosText}</span>
              </button>
              </FileInput>

              <Link style={{textDecoration: 'none'}} to={`/guest/${packedUid}/guestbook`}>
                <button style={{marginBottom: '10px'}} className="guest-home-upload-btn" >
                  <i className="fa-solid fa-microphone-lines" />
                  <span>{uploadAudioMessageText}</span>
                </button>
              </Link>

              <Link style={{textDecoration: 'none'}} to={`/guest/${packedUid}/guestbook`}>
                <button className="guest-home-upload-btn" >
                  <i className="fa-solid fa-book" />
                  <span>{t('guest.signTheGuestbook')}</span>
                </button>
              </Link>

              <GuestAdvertorialGrid advertorial={advertorial} />

              {/* Welcome Message */}
              {welcomeMessage && (
                <div className="guest-home-welcome">
                  <span className="guest-home-welcome-icon">
                    <i className="fa-solid fa-quote-left" />
                  </span>
                  <p className="guest-home-welcome-text">"{welcomeMessage}"</p>
                </div>
              )}

              <div className="guest-home-upload-secure">
                <i className="fa-solid fa-lock" />
                <span>{t('guest.privateSecure')}</span>
              </div>
              </div>
            </section>
          </div>
        </section>

        {/* Latest Memories Section (disabled intentionally)
        <section className="guest-home-gallery">
          <div className="guest-home-gallery-header">
            <h3 className="guest-home-gallery-title">
              {t('guest.latestMemories')}
              <span className="guest-home-gallery-live-badge">
                <span className="guest-home-gallery-live-dot" />
                {t('guest.liveFeed')}
              </span>
            </h3>
            <Link to={`/guest/${packedUid}/uploads`} className="guest-home-gallery-view-all">
              {t('guest.viewAll')}
            </Link>
          </div>

          <div className="guest-home-gallery-grid">
            {recentUploads.length > 0 ? (
              <>
                {recentUploads.map((upload) => (
                  <MediaCard
                    key={upload.uid}
                    uploaderName={t('guest.you')}
                    uploadEntry={upload}
                    onFullscreen={() => openPhotoViewer(upload.uid)}
                  />
                ))}
                {recentUploads.length < 3 && (
                  <div className="guest-home-gallery-placeholder">
                    <div className="guest-home-gallery-placeholder-icon">
                      <i className="fa-solid fa-hourglass-half" />
                    </div>
                    <p className="guest-home-gallery-placeholder-text">
                      {t('guest.waitForMoments')}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="guest-home-gallery-empty">
                <div className="guest-home-gallery-empty-icon">
                  <i className="fa-regular fa-images" />
                </div>
                <p className="guest-home-gallery-empty-text">
                  {t('guest.noMemoriesYet')}
                </p>
              </div>
            )}
          </div>
        </section>
        */}
      </main>

      <V2Footer />
    </div>
  );
}

export default V2GuestHome;
