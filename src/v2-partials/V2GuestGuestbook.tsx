import { useRef, useState } from 'react';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import '../v2-styles/GuestGuestbook.css';
import { startRecording } from '../packages/audio';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import { t } from '../packages/i18n';

type GuestbookMode = 'message' | 'recording' | 'audioPreview';

export interface GuestbookEntry2 {
    id: string;
    authorName: string;
    message?: string;
    imageUrl?: string;
    timeAgo: string;
    likes: number;
    audioUrl?: string;
    uploadType: 'text' | 'voice';
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function TextEntry({ entry, isNew }: { entry: GuestbookEntry2; isNew?: boolean }) {
  return (
    <div className={`guest-guestbook-message${isNew ? ' guest-guestbook-message--new' : ''}`}>
      <div className="guest-guestbook-message-header">
        <h4 className="guest-guestbook-message-author">{entry.authorName}</h4>
        <span className="guest-guestbook-message-time">{entry.timeAgo}</span>
      </div>
      <p className="guest-guestbook-message-text">{entry.message}</p>
      {entry.imageUrl && (
        <div className="guest-guestbook-message-image">
          <img src={entry.imageUrl} alt={t('guestGuestbook.guestPhoto')} />
        </div>
      )}
      {entry.likes > 0 && (
        <div className="guest-guestbook-message-likes">
          <i className="fa-solid fa-heart" />
          <span>{t('guestGuestbook.likedBy', { count: entry.likes })}</span>
        </div>
      )}
    </div>
  );
}

function AudioEntry({ entry, isNew }: { entry: GuestbookEntry2; isNew?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const secRef = useRef<HTMLSpanElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setTimeout(() => {
        const sec = secRef.current;
        if(!sec) return;
        sec.innerText = t('guestGuestbook.voiceMessage');
      }, 200);
    } else {
      audio.play();
      setIsPlaying(true);

      audio.ontimeupdate = ()=>{
        const sec = secRef.current;
        if(!sec) return;
        sec.innerText = formatTime(Math.floor(audio.currentTime));
      }

      audio.onended = ()=>{
        const sec = secRef.current;
        if(!sec) return;
        sec.innerText = t('guestGuestbook.voiceMessage');
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className={`guest-guestbook-message guest-guestbook-message--audio${isNew ? ' guest-guestbook-message--new' : ''}`}>
      <div className="guest-guestbook-message-header">
        <h4 className="guest-guestbook-message-author">{entry.authorName}</h4>
        <span className="guest-guestbook-message-time">{entry.timeAgo}</span>
      </div>
      <div className="guest-guestbook-audio-player">
        <audio ref={audioRef} src={entry.audioUrl} onEnded={handleEnded} />
        <button 
          type="button" 
          className="guest-guestbook-audio-play-btn"
          onClick={handlePlayPause}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
        </button>
        <div className="guest-guestbook-audio-wave">
          <i className="fa-solid fa-waveform-lines" />
          <span ref={secRef}>{t('guestGuestbook.voiceMessage')}</span>
        </div>
      </div>
      {entry.likes > 0 && (
        <div className="guest-guestbook-message-likes">
          <i className="fa-solid fa-heart" />
          <span>{t('guestGuestbook.likedBy', { count: entry.likes })}</span>
        </div>
      )}
    </div>
  );
}

export interface V2GuestGuestbookProps {
  eventTitle: string;
  welcomeMessage: string;
  entries: GuestbookEntry2[];
  decorativeImageUrl?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initialName?: string;
  initialMessage?: string;
  audioEnabled?: boolean;
  onSubmitAudio?: (file: File, name: string, message: string) => Promise<boolean> | boolean;
  theme?: GuestTheme;
  newEntryId?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

function V2GuestGuestbook({
  eventTitle,
  welcomeMessage,
  entries,
  decorativeImageUrl,
  onSubmit,
  initialName,
  initialMessage,
  audioEnabled,
  onSubmitAudio,
  theme = defaultGuestTheme,
  newEntryId,
  hasMore,
  onLoadMore,
}: V2GuestGuestbookProps) {

  const [mode, setMode] = useState<GuestbookMode>('message');
  const [toast, setToast] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const elemRef = useRef({
    onRecStop: ()=>{},
    timer: null as number | null,
    audioFile: null as File | null,
    isStarting: false,
    startedAt: 0,
  }).current;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMicClick = async () => {
    if (mode === 'recording') {
      elemRef.onRecStop();
      return;
    }
    if (mode === 'audioPreview') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      elemRef.audioFile = null;
      setMode('message');
      return;
    }

    // Prevent double-tap from starting multiple recordings
    if (elemRef.isStarting) return;
    elemRef.isStarting = true;

    if (typeof MediaRecorder === 'undefined') {
      elemRef.isStarting = false;
      alert('Audio recording is not supported on this browser.');
      return;
    }

    let stop: () => void;
    try {
      stop = await startRecording((file, _mimeType) => {
        if (elemRef.timer) {
          clearInterval(elemRef.timer);
          elemRef.timer = null;
        }
        setRecordingSeconds(0);
        elemRef.audioFile = file;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setIsPreviewPlaying(false);
        setMode('audioPreview');
      });
    } catch {
      elemRef.isStarting = false;
      alert('Could not access microphone.');
      return;
    }

    elemRef.isStarting = false;
    elemRef.startedAt = Date.now();
    setRecordingSeconds(0);
    setMode('recording');

    elemRef.timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - elemRef.startedAt) / 1000);
      setRecordingSeconds(elapsed);
    }, 500);

    elemRef.onRecStop = () => {
      if (elemRef.timer) {
        clearInterval(elemRef.timer);
        elemRef.timer = null;
      }
      setRecordingSeconds(0);
      stop();
    };
  };

  const getNameValue = () => (formRef.current?.elements.namedItem('name') as HTMLInputElement)?.value?.trim() || '';

  const handleAudioSubmit = async () => {
    if (elemRef.audioFile) {
      const form = formRef.current;
      const name = getNameValue();
      if (!name && !initialName) {
        setNameError(true);
        return;
      }
      setNameError(false);
      const message = (form?.elements.namedItem('message') as HTMLTextAreaElement)?.value || '';
      const submitOk = (await onSubmitAudio?.(elemRef.audioFile, name, message)) !== false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      elemRef.audioFile = null;
      setMode('message');
      if (submitOk) {
        showToast(t('guestGuestbook.audioSent'));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = getNameValue();
    if (!name && !initialName) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onSubmit(e);
    showToast(t('guestGuestbook.messageSent'));
  };

  const handlePreviewClick = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
      return;
    }

    audio.ontimeupdate = null;
    audio.onended = () => setIsPreviewPlaying(false);

    try {
      await audio.play();
      setIsPreviewPlaying(true);
    } catch {
      setIsPreviewPlaying(false);
    }
  };

  return (
    <div className="guest-guestbook" style={theme}>
      {toast && (
        <div className="guest-guestbook-toast">
          <i className="fa-solid fa-circle-check" />
          {toast}
        </div>
      )}
      <V2Header />

      <header className="guest-guestbook-header">
        <p className="guest-guestbook-header-label">{t('guestGuestbook.theEventOf')}</p>
        <h1 className="guest-guestbook-header-title">{eventTitle}</h1>
        <p className="guest-guestbook-header-desc">{welcomeMessage}</p>
      </header>

      <main className="guest-guestbook-main">
        <div className="guest-guestbook-grid">
          {/* Left Column - Form */}
          <div className="guest-guestbook-left">
            <div className="guest-guestbook-form-card">
              <h2 className="guest-guestbook-form-title">
                <i className="fa-solid fa-pen-to-square" />
                {t('guestGuestbook.signTheGuestbook')}
              </h2>
              <form ref={formRef} className="guest-guestbook-form" onSubmit={handleSubmit}>
                <input
                  type="text"
                  name="name"
                  className={`guest-guestbook-input${nameError ? ' guest-guestbook-input--error' : ''}`}
                  placeholder={t('guestGuestbook.yourName')}
                  defaultValue={initialName}
                  onChange={() => nameError && setNameError(false)}
                />
                {nameError && (
                  <span className="guest-guestbook-field-error">
                    <i className="fa-solid fa-circle-exclamation" />
                    {t('guestGuestbook.nameRequired')}
                  </span>
                )}
                <textarea
                  name="message"
                  className="guest-guestbook-textarea"
                  placeholder={t('guestGuestbook.writeSomethingSweet')}
                  rows={5}
                  defaultValue={initialMessage}
                  
                />
                <div className="guest-guestbook-actions">
                  {mode === 'message' && (
                    <button type="submit" className="guest-guestbook-submit guest-guestbook-submit--split">
                      {t('guestGuestbook.postMessage')}
                    </button>
                  )}
                  {mode === 'recording' && (
                    <button type="button" className="guest-guestbook-submit guest-guestbook-submit--split recording" disabled>
                      <i className="fa-solid fa-circle recording-dot" />
                      <span>{formatTime(recordingSeconds)}</span>
                    </button>
                  )}
                  {mode === 'audioPreview' && (
                    <>
                      <audio ref={audioRef} src={previewUrl ?? undefined} style={{display: 'none'}} />

                      <div onClick={handlePreviewClick} style={{textAlign: 'center'}} className="guest-guestbook-submit audio-preview">
                        {isPreviewPlaying ? <i className="fa-solid fa-pause" /> : t('guestGuestbook.playback')}
                      </div>
                      <button
                        type="button"
                        className="guest-guestbook-mic-btn"
                        onClick={handleMicClick}
                        title={t('guestGuestbook.cancel')}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                      <button
                        type="button"
                        className="guest-guestbook-mic-btn"
                        onClick={handleAudioSubmit}
                        title={t('guestGuestbook.sendAudio')}
                      >
                        <i className="fa-solid fa-paper-plane" />
                      </button>
                    </>
                  )}
                  {audioEnabled && mode !== 'audioPreview' && (
                    <button 
                      type="button" 
                      className={`guest-guestbook-mic-btn guest-guestbook-mic-btn--split${mode === 'recording' ? ' recording' : ''}`}
                      onClick={handleMicClick}
                      title={mode === 'recording' ? t('guestGuestbook.stopRecording') : t('guestGuestbook.recordAudio')}
                    >
                      <i className={`fa-solid ${mode === 'message' ? 'fa-microphone' : 'fa-stop'}`} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {decorativeImageUrl && (
              <div className="guest-guestbook-decorative">
                <img src={decorativeImageUrl} alt={t('guestGuestbook.memory')} />
                <div className="guest-guestbook-decorative-overlay" />
                <p className="guest-guestbook-decorative-text">
                  "{t('guestGuestbook.capturingMoments')}"
                </p>
              </div>
            )}
          </div>

          <div className="guest-guestbook-right">
            <div className="guest-guestbook-messages-header">
              <h3 className="guest-guestbook-messages-title">
                <i className="fa-solid fa-heart" />
                {t('guestGuestbook.latestWishes')}
              </h3>
              <div className="guest-guestbook-messages-activity">
                <span>{t('guestGuestbook.recentActivity')}</span>
                <i className="fa-solid fa-chevron-down" />
              </div>
            </div>

            {entries.length > 0 ? (
              <>
                <div className="guest-guestbook-messages">
                  {entries.map((entry) => (
                    entry.uploadType === 'voice'
                      ? <AudioEntry key={entry.id} entry={entry} isNew={entry.id === newEntryId} />
                      : <TextEntry key={entry.id} entry={entry} isNew={entry.id === newEntryId} />
                  ))}
                </div>

                {hasMore && (
                  <div className="guest-guestbook-load-more">
                    <button className="guest-guestbook-load-more-btn" onClick={onLoadMore}>
                      {t('guestGuestbook.viewMoreMessages')}
                      <i className="fa-solid fa-arrow-down" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="guest-guestbook-empty">
                <div className="guest-guestbook-empty-icon">
                  <i className="fa-regular fa-comments" />
                </div>
                <p className="guest-guestbook-empty-text">
                  {t('guestGuestbook.noMessagesYet')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <V2Footer />
    </div>
  );
}

export default V2GuestGuestbook;
