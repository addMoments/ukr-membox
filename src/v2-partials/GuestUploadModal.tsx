import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import FileInput from '../components/FileInput';
import ActivityIndicator from '../v2-components/activity-indicator';
import { guestUpload, GuestUploadError, GuestUploadPhase, isAbortError } from '../client/uploads';
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

// Ne: Dosya satirinin durumu (AM-01): queued -> uploading -> processing -> uploaded | duplicate.
//     Ag hatasinda retrying, baglanti yoksa offline (gelince devam eder), vazgecilince failed + reason.
// Neden: Musteri her dosyanin acik bir durumu olsun, basarisiz olan basarili gibi gorunmesin,
//        nedeni ve tekrar dene secenegi olsun istedi; eskiden yalnizca yuklendi / basarisiz vardi.
type FileStatus = 'queued' | 'uploading' | 'processing' | 'retrying' | 'offline' | 'uploaded' | 'duplicate' | 'failed';
// network tekrar denenebilir (baglanti gelince kendiliginden); digerleri tekrar denemekle duzelmez.
type FailReason = 'network' | 'unreadable' | 'limit' | 'album_closed' | 'not_allowed';
// duplicate: dosya bu albumde zaten vardi, sunucu ikinci kopyayi eklemedi (AM-07).
type FileEntry = {
  file: File;
  previewUrl: string;
  status: FileStatus;
  progress: number;
  attempt?: { n: number; of: number };
  reason?: FailReason;
};

const isFinished = (entry: FileEntry) => entry.status === 'uploaded' || entry.status === 'duplicate';
const isNetworkFailed = (entry: FileEntry) => entry.status === 'failed' && entry.reason === 'network';

// Ne: Ag yuzunden kalan dosyalar bu araliklarla kendiliginden yeniden denenir; baglanti geri
//     gelince ('online' olayi) beklemeden.
// Neden: AM-04 — misafir gecici bir kopma yuzunden yuzlerce dosyayi yeniden secmek zorunda kalmasin.
const AUTO_RETRY_DELAYS_MS = [15000, 30000, 60000, 120000, 300000];

// TS 4.9'un lib.dom'unda Screen Wake Lock API tipi yok; kullandigimiz kadarini tanimliyoruz.
type ScreenWakeLock = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<ScreenWakeLock> } };

// Ne: Yukleme surerken ekranin kendiliginden kararmasini engeller (destekleyen tarayicilarda).
// Neden: Ekran kilitlenince telefon tarayiciyi askiya aliyor ve PUT yarida kaliyor; otobusteki
//        misafirler yuklemeyi baslatip telefonu birakti (25 Eylul). Desteklenmiyorsa ya da
//        reddedilirse yukleme yine calisir.
const requestScreenWakeLock = async (): Promise<ScreenWakeLock | null> => {
  try {
    return (await (navigator as WakeLockNavigator).wakeLock?.request('screen')) ?? null;
  } catch {
    return null;
  }
};

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
  // Kuyrugun calisma durumu: ayni anda tek kuyruk (elle "Tekrar dene", otomatik tekrar ve
  // 'online' olayi carpismasin), "Durdur" icin AbortController, otomatik tekrar zamanlayicisi.
  const runtime = useRef({
    running: false,
    abort: null as AbortController | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
    retryRound: 0,
    renderPending: false,
  }).current;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const albumSelectRef = useRef<HTMLSelectElement>(null);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // done = gercekten yuklenen; failed ayri sayilir (eskiden basarisizlar da "yuklendi" sayiliyordu).
  const [uploadProgress, setUploadProgress] = useState({ done: 0, failed: 0, total: 0, totalBytes: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  // Ne: Yukleme basariyla bitince gosterilecek onay ekraninin verisi (null = gosterme).
  // Neden: 2.6 — misafir mobilden yukleyince modal 1 saniyede sessizce kapaniyordu ve
  //        hicbir onay gormuyordu.
  const [uploadDone, setUploadDone] = useState<{ count: number; bytes: number; duplicates: number } | null>(null);

  const getLocalizedText = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const render = () => setFileEntries([...elemRef.entries]);

  // Ilerleme olaylari sik gelir; cizimi kare basina bire indirir.
  const renderSoon = () => {
    if (runtime.renderPending) return;
    runtime.renderPending = true;
    requestAnimationFrame(() => {
      runtime.renderPending = false;
      render();
    });
  };

  const clearAutoRetry = () => {
    if (runtime.retryTimer) clearTimeout(runtime.retryTimer);
    runtime.retryTimer = null;
  };

  const handleFileSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    elemRef.entries.push({ file, previewUrl, status: 'queued', progress: 0 });
    render();
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
    render();
    if (elemRef.entries.length === 0) setModalOpen(false);
  };

  const handleCancel = () => {
    clearAutoRetry();
    runtime.retryRound = 0;
    elemRef.entries.forEach(e => URL.revokeObjectURL(e.previewUrl));
    elemRef.entries = [];
    setFileEntries([]);
    setModalOpen(false);
    setUploadDone(null);
    setUploadErrorMessage('');
  };

  // "Durdur": suren dosya kesilir ve sirada kalir; misafir sonra devam ettirebilir ya da vazgecer.
  const handleStop = () => {
    clearAutoRetry();
    runtime.abort?.abort();
  };

  const applyPhase = (entry: FileEntry, phase: GuestUploadPhase) => {
    switch (phase.phase) {
      case 'uploading':
        entry.status = 'uploading';
        entry.progress = phase.progress;
        break;
      case 'processing':
        entry.status = 'processing';
        entry.progress = 1;
        break;
      case 'retrying':
        entry.status = 'retrying';
        entry.attempt = { n: phase.attempt, of: phase.of };
        break;
      case 'offline':
        entry.status = 'offline';
        break;
    }
  };

  // Ne: Bitmemis dosyalari (ya da verilenleri) sirayla yukler.
  // Nasil: Dosya basina guestUpload; asamalar satira yansir. Ag yuzunden kalanlar icin otomatik
  //        tekrar kurulur, "Durdur" suren dosyayi siraya geri koyar.
  const runQueue = async (only?: FileEntry[]) => {
    if (runtime.running) return;
    const targets = (only || elemRef.entries).filter(e => !isFinished(e) && elemRef.entries.includes(e));
    if (!targets.length) return;
    runtime.running = true;
    clearAutoRetry();

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
    const unreadableMessage = textOr(
      'guest.uploadUnreadable',
      "Some files couldn't be read from your device. Remove them, add them again and retry.",
      'Деякі файли не вдалося прочитати з пристрою. Видаліть їх, додайте знову й повторіть спробу.'
    );

    setUploadErrorMessage('');
    setUploadDone(null);
    setIsUploading(true);
    const controller = new AbortController();
    runtime.abort = controller;
    const totalBytes = targets.reduce((s, e) => s + e.file.size, 0);
    setUploadProgress({ done: 0, failed: 0, total: targets.length, totalBytes });
    targets.forEach((entry) => {
      entry.status = 'queued';
      entry.progress = 0;
      entry.attempt = undefined;
      entry.reason = undefined;
    });
    render();

    const wakeLock = await requestScreenWakeLock();
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
      let networkFailures = 0;
      let stopped = false;
      let contributorLimitHit = false;
      let albumClosedHit = false;
      let forbiddenHit = false;
      let limitHit: UploadLimitCode | null = null;
      let unreadableHit = false;

      for (const entry of targets) {
        if (controller.signal.aborted) {
          stopped = true;
          break;
        }
        entry.status = 'uploading';
        entry.progress = 0;
        render();
        try {
          const uploadType = entry.file.type.startsWith('video/') ? 'video' : 'photo';
          const [result] = await guestUpload(eventUid, uploadType, [entry.file], albumUid, {
            signal: controller.signal,
            onPhase: (phase) => {
              applyPhase(entry, phase);
              renderSoon();
            },
          });
          entry.status = result?.duplicate ? 'duplicate' : 'uploaded';
          entry.progress = 1;
          successCount += 1;
        } catch (err) {
          if (isAbortError(err)) {
            entry.status = 'queued';
            entry.progress = 0;
            stopped = true;
          } else {
            entry.status = 'failed';
            if (isContributorLimitReachedError(err)) {
              entry.reason = 'not_allowed';
              contributorLimitHit = true;
            } else if (getUploadLimitCode(err)) {
              // Limit doldu: kalan dosyalar da ayni hatayi alacagi icin mesaj tek ve net kalir.
              entry.reason = 'limit';
              limitHit = getUploadLimitCode(err);
            } else if (getGuestAlbumErrorCode(err)) {
              // Album bu arada kapatilmis ya da silinmis olabilir.
              entry.reason = 'album_closed';
              albumClosedHit = true;
            } else if (isForbiddenError(err)) {
              entry.reason = 'not_allowed';
              forbiddenHit = true;
            } else if (err instanceof GuestUploadError && err.reason === 'unreadable') {
              entry.reason = 'unreadable';
              unreadableHit = true;
            } else {
              // guestUpload iki kez tekrar denedi; kalan hata agdir.
              entry.reason = 'network';
              networkFailures += 1;
            }
          }
        }
        if (stopped) {
          render();
          break;
        }
        doneCount += 1;
        setUploadProgress({ done: successCount, failed: doneCount - successCount, total: targets.length, totalBytes });
        render();
      }

      if (contributorLimitHit) {
        setUploadErrorMessage(contributorLimitMessage);
      } else if (limitHit) {
        setUploadErrorMessage(limitMessage(limitHit));
      } else if (albumClosedHit) {
        setUploadErrorMessage(albumClosedMessage);
      } else if (forbiddenHit) {
        setUploadErrorMessage(genericForbiddenMessage);
      } else if (unreadableHit) {
        setUploadErrorMessage(unreadableMessage);
      }

      render();
      if (successCount > 0) {
        onUploadComplete?.();
      }

      if (!stopped && elemRef.entries.length > 0 && elemRef.entries.every(isFinished)) {
        runtime.retryRound = 0;
        // Ne: Once "yukleme tamamlandi" ekranini goster, sonra modali kapat.
        // Nasil: Sure 1sn'den 2.6sn'ye cikarildi; 1 saniye mesaji okumaya yetmiyordu.
        //        Erken kapatmak isteyen backdrop'a dokunabilir, handleCancel devrede.
        // Neden: 2.6 — tum dosyalar yuklendiginde misafire acik bir onay verilmeli.
        const duplicates = elemRef.entries.filter(e => e.status === 'duplicate').length;
        setUploadDone({
          count: elemRef.entries.length,
          bytes: elemRef.entries.reduce((sum, entry) => sum + entry.file.size, 0),
          duplicates,
        });
        // "Zaten albumde" satiri da okunsun diye o durumda biraz daha uzun.
        setTimeout(() => {
          elemRef.entries.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
          elemRef.entries = [];
          setFileEntries([]);
          setModalOpen(false);
          setUploadDone(null);
        }, duplicates > 0 ? 4000 : 2600);
      } else if (!stopped && networkFailures > 0) {
        scheduleAutoRetry();
      }
    } finally {
      wakeLock?.release().catch(() => undefined);
      runtime.abort = null;
      runtime.running = false;
      setIsUploading(false);
    }
  };

  // Zamanlayici ve 'online' olayi her zaman en guncel runQueue'yu cagirsin (props degisebilir).
  const runQueueRef = useRef(runQueue);
  runQueueRef.current = runQueue;

  const scheduleAutoRetry = () => {
    clearAutoRetry();
    const round = runtime.retryRound;
    if (round >= AUTO_RETRY_DELAYS_MS.length) return;
    runtime.retryTimer = setTimeout(() => {
      runtime.retryTimer = null;
      runtime.retryRound = round + 1;
      void runQueueRef.current(elemRef.entries.filter(isNetworkFailed));
    }, AUTO_RETRY_DELAYS_MS[round]);
  };

  const handleUploadClick = () => {
    runtime.retryRound = 0;
    void runQueue();
  };

  const handleRetryOne = (entry: FileEntry) => {
    runtime.retryRound = 0;
    void runQueue([entry]);
  };

  // Baglanti geri gelince ag yuzunden kalanlari beklemeden yeniden dene.
  useEffect(() => {
    const onOnline = () => {
      const targets = elemRef.entries.filter(isNetworkFailed);
      if (runtime.running || !targets.length) return;
      runtime.retryRound = 0;
      void runQueueRef.current(targets);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [elemRef, runtime]);

  // Sayfadan cikilinca suren yukleme ve zamanlayici birakilir.
  useEffect(() => () => {
    if (runtime.retryTimer) clearTimeout(runtime.retryTimer);
    runtime.abort?.abort();
  }, [runtime]);

  // Ne: Bitmemis dosya varken sayfayi kapatmak tarayicinin "ayrilmak istiyor musunuz" uyarisini acar.
  // Neden: AM-04 — misafir yuzlerce dosyayi secme emegini yanlislikla kaybetmesin.
  const hasUnfinished = fileEntries.some(e => !isFinished(e));
  useEffect(() => {
    if (!modalOpen || !hasUnfinished) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [modalOpen, hasUnfinished]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!modalOpen) return null;

  const totalBytes = fileEntries.reduce((s, e) => s + e.file.size, 0);
  const finishedCount = fileEntries.filter(isFinished).length;
  const failedCount = fileEntries.filter(e => e.status === 'failed').length;
  const networkFailedCount = fileEntries.filter(isNetworkFailed).length;
  const offlineNow = fileEntries.some(e => e.status === 'offline');
  // Tum bitmemisler basarisizsa ana dugme "Tekrar dene (N)" olur.
  const retryAll = !isUploading && failedCount > 0 && fileEntries.every(e => isFinished(e) || e.status === 'failed');
  const autoRetryLeft = runtime.retryRound < AUTO_RETRY_DELAYS_MS.length;
  const failedLabel = getLocalizedText('common.failed', 'Failed');
  const uploadedLabel = getLocalizedText('common.uploaded', 'Uploaded');
  const removeLabel = textOr('guest.removeFile', 'Remove', 'Прибрати');
  const retryLabel = textOr('guest.upload.retry', 'Retry', 'Повторити');
  const alreadyInAlbumLabel = textOr('guest.alreadyInAlbum', 'Already in the album', 'Вже є в альбомі');
  const showAlbumPicker = albums.length > 1;
  const defaultAlbumUid = pickDefaultAlbum(albums, initialAlbumUid);
  const lockedAlbum = lockAlbum ? albums.find(a => a.uid === defaultAlbumUid) : undefined;

  const reasonLabel = (reason?: FailReason) => {
    switch (reason) {
      case 'network':
        return textOr('guest.upload.reasonNetwork', "Didn't upload: connection problem", "Не завантажено: проблема зі з'єднанням");
      case 'unreadable':
        return textOr('guest.upload.reasonUnreadable', "Can't read this file", 'Не вдалося прочитати файл');
      case 'limit':
        return textOr('guest.upload.reasonLimit', 'Upload limit reached', 'Ліміт завантажень вичерпано');
      case 'album_closed':
        return textOr('guest.upload.reasonAlbumClosed', 'Uploads to this album are closed', 'Завантаження в альбом закрито');
      default:
        return failedLabel;
    }
  };

  // Satirin altindaki durum metni ve tonu (error kirmizi, note notr-koyu, state gri).
  const itemState = (entry: FileEntry): { text: string; className: string } | null => {
    switch (entry.status) {
      case 'queued':
        return isUploading ? { text: textOr('guest.upload.inQueue', 'In queue', 'У черзі'), className: 'upload-modal-item-state' } : null;
      case 'uploading':
        return { text: textOr('guest.upload.uploadingPercent', 'Uploading {{percent}}%', 'Завантаження {{percent}}%', { percent: Math.round(entry.progress * 100) }), className: 'upload-modal-item-state' };
      case 'processing':
        return { text: textOr('guest.upload.processing', 'Processing…', 'Обробка…'), className: 'upload-modal-item-state' };
      case 'retrying':
        return { text: textOr('guest.upload.retrying', 'Retrying ({{n}}/{{of}})…', 'Повторна спроба ({{n}}/{{of}})…', { n: entry.attempt?.n ?? 2, of: entry.attempt?.of ?? 3 }), className: 'upload-modal-item-state' };
      case 'offline':
        return { text: textOr('guest.upload.waitingConnection', 'Waiting for connection', "Очікує з'єднання"), className: 'upload-modal-item-state' };
      case 'duplicate':
        return { text: alreadyInAlbumLabel, className: 'upload-modal-item-note' };
      case 'failed':
        return { text: reasonLabel(entry.reason), className: 'upload-modal-item-error' };
      default:
        return null;
    }
  };

  return (
    // Bitmemis dosya varken backdrop'a dokunmak secimi silmesin; vazgecmek icin "Iptal" var.
    <div className="upload-modal-backdrop" onClick={!isUploading && !hasUnfinished ? handleCancel : undefined}>
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
            {uploadDone.duplicates > 0 && (
              <p className="upload-modal-success-sub">
                {textOr('guest.alreadyInAlbumCount', 'Already in the album, not added again: {{count}}', 'Вже були в альбомі, повторно не додано: {{count}}', { count: uploadDone.duplicates })}
              </p>
            )}
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
        {/* AM-04: kesintide ne oldugu ve ne olacagi. */}
        {isUploading && offlineNow ? (
          <div className="upload-modal-notice" role="status">
            <i className="fa-solid fa-wifi" />
            <span>{textOr('guest.upload.offlineNotice', "No connection. {{done}} of {{total}} uploaded; the rest will continue when you're back online. Keep this page open.", "Немає з'єднання. Завантажено {{done}} з {{total}}; решта продовжиться, щойно з'явиться з'єднання. Не закривайте цю сторінку.", { done: finishedCount, total: fileEntries.length })}</span>
          </div>
        ) : !isUploading && networkFailedCount > 0 ? (
          <div className="upload-modal-notice" role="status">
            <i className="fa-solid fa-rotate" />
            <span>{autoRetryLeft
              ? textOr('guest.upload.interruptedNotice', 'Upload interrupted: {{done}} of {{total}} uploaded, {{waiting}} waiting. We will try again automatically, so keep this page open, or tap “Retry”.', 'Завантаження перервано: {{done}} з {{total}} завантажено, {{waiting}} очікують. Ми спробуємо ще раз автоматично, тож не закривайте цю сторінку, або натисніть «Повторити».', { done: finishedCount, total: fileEntries.length, waiting: networkFailedCount })
              : textOr('guest.upload.interruptedManual', "Upload interrupted: {{done}} of {{total}} uploaded, {{waiting}} didn't upload. Check your connection and tap “Retry”.", "Завантаження перервано: {{done}} з {{total}} завантажено, {{waiting}} не завантажилися. Перевірте з'єднання й натисніть «Повторити».", { done: finishedCount, total: fileEntries.length, waiting: networkFailedCount })}</span>
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
          {fileEntries.map((entry, index) => {
            const state = itemState(entry);
            const busy = entry.status === 'uploading' || entry.status === 'processing' || entry.status === 'retrying';
            return (
              <div
                key={index}
                className={`upload-modal-item${isFinished(entry) ? ' upload-modal-item--done' : ''}${entry.status === 'failed' ? ' upload-modal-item--failed' : ''}${busy || entry.status === 'offline' ? ' upload-modal-item--active' : ''}`}
              >
                <img className="upload-modal-thumb" src={entry.previewUrl} alt="" />
                <div className="upload-modal-item-info">
                  <span className="upload-modal-item-name">{entry.file.name}</span>
                  <span className="upload-modal-item-size">{formatBytes(entry.file.size)}</span>
                  {state ? <span className={state.className}>{state.text}</span> : null}
                  {entry.status === 'uploading' && (
                    <span className="upload-modal-item-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round(entry.progress * 100)}%` }} />
                    </span>
                  )}
                </div>
                {isFinished(entry) && <i className="fa-solid fa-circle-check upload-modal-item-check" />}
                {busy && <ActivityIndicator color="var(--text-secondary)" style={{ width: 16, height: 16, flexShrink: 0 }} />}
                {entry.status === 'offline' && <i className="fa-solid fa-wifi upload-modal-item-offline" />}
                {entry.status === 'failed' && !isNetworkFailed(entry) && <i className="fa-solid fa-circle-xmark upload-modal-item-fail" />}
                {isNetworkFailed(entry) && !isUploading && (
                  <button
                    type="button"
                    className="upload-modal-item-retry"
                    onClick={() => handleRetryOne(entry)}
                    aria-label={retryLabel}
                    title={retryLabel}
                  >
                    <i className="fa-solid fa-rotate-right" />
                  </button>
                )}
                {/* Basarisiz dosya da cikarilabilir; "okunamadi" mesaji misafirden bunu istiyor. */}
                {!isFinished(entry) && !isUploading && (
                  <button
                    type="button"
                    className="upload-modal-item-remove"
                    onClick={() => handleRemoveFile(index)}
                    aria-label={removeLabel}
                    title={removeLabel}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="upload-modal-status">
          {isUploading
            ? <><ActivityIndicator color="var(--text-secondary)" style={{ width: 16, height: 16 }} /><span>{t('guest.uploadingProgress', { done: uploadProgress.done, total: uploadProgress.total, size: formatBytes(totalBytes) })}{uploadProgress.failed > 0 ? ` · ${uploadProgress.failed} ${failedLabel}` : ''}</span></>
            : <><i className="fa-solid fa-circle-info" /><span>{fileEntries.length} {t('common.files')} · {formatBytes(totalBytes)} · {finishedCount} {uploadedLabel} · {failedCount} {failedLabel}</span></>
          }
        </div>

        <div className="upload-modal-actions">
          {isUploading ? (
            <button className="upload-modal-cancel" onClick={handleStop}>
              {textOr('guest.upload.stop', 'Stop', 'Зупинити')}
            </button>
          ) : (
            <button className="upload-modal-cancel" onClick={handleCancel}>
              {t('guestGuestbook.cancel')}
            </button>
          )}
          <button className="upload-modal-submit" onClick={handleUploadClick} disabled={isUploading || fileEntries.every(isFinished)}>
            {isUploading
              ? <ActivityIndicator color="#fff" style={{ width: 16, height: 16 }} />
              : <i className={`fa-solid ${retryAll ? 'fa-rotate-right' : 'fa-arrow-up-from-bracket'}`} />
            }
            {retryAll
              ? textOr('guest.upload.retryCount', 'Retry ({{count}})', 'Повторити ({{count}})', { count: failedCount })
              : t('guest.uploadFiles')}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
});

export default GuestUploadModal;
