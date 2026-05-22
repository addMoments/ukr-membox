import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import { pgREST } from '../../client/postgrest';
import { unpackUUID } from '../../packages/uuid';
import { t } from '../../packages/i18n';
import '../../v2-styles/Guestbook.css';
import { S3_ROOT } from '../../consts';

type FilterType = 'all' | 'visible' | 'hidden';

interface GuestbookUpload {
  uid: string;
  upload_type: 'text' | 'voice';
  client_uid: string;
  event_uid: string;
  created_at: string;
  value: string;
  trashed_at: string | null;
  participants?: { name: string };
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const audioTypeFromUrl = (url: string): string => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.mp4')) return 'audio/mp4';
  if (cleanUrl.endsWith('.mp3')) return 'audio/mpeg';
  if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.oga')) return 'audio/ogg';
  if (cleanUrl.endsWith('.webm')) return 'audio/webm';
  return '';
};

function formatTimeAgo(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  const date = new Date(normalized);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return t('guestbook.justNow');
  if (diffHours < 24) return t(diffHours === 1 ? 'guestbook.hoursAgo' : 'guestbook.hoursAgo_plural', { count: diffHours });
  if (diffDays === 1) return t('guestbook.yesterday');
  if (diffDays < 7) return t('guestbook.daysAgo', { count: diffDays });
  return date.toLocaleDateString(t('lang_code'), { month: 'short', day: 'numeric' });
}

function EventGuestbook() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [uploads, setUploads] = useState<GuestbookUpload[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const uid = unpackUUID(packedUid || '');

  const fetchUploads = async () => {
    if (!packedUid) return;
    const data = await pgREST(`/uploads?event_uid=eq.${uid}&upload_type=in.(voice,text)&order=created_at.desc&select=*,participants(name)`);
    setUploads(data);
  };

  useEffect(() => {
    fetchUploads();
  }, [packedUid]);

  // Stats derived from data
  const visibleCount = uploads.filter(u => !u.trashed_at).length;
  const hiddenCount = uploads.filter(u => !!u.trashed_at).length;

  // Filter messages
  const filteredUploads = uploads.filter(upload => {
    const isHidden = !!upload.trashed_at;
    const name = upload.participants?.name?.toLowerCase() || '';
    const message = upload.value?.toLowerCase() || '';
    
    // Search filter
    if (searchQuery && !name.includes(searchQuery.toLowerCase()) && !message.includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (activeFilter === 'all') return true;
    if (activeFilter === 'visible') return !isHidden;
    if (activeFilter === 'hidden') return isHidden;
    return true;
  });

  const filterTabs: { key: FilterType; labelKey: string }[] = [
    { key: 'all', labelKey: 'guestbook.filterAll' },
    { key: 'visible', labelKey: 'guestbook.filterVisible' },
    { key: 'hidden', labelKey: 'guestbook.filterHidden' },
  ];

  const handleHide = async (uploadUid: string) => {
    await pgREST(`/uploads?uid=eq.${uploadUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ trashed_at: new Date().toISOString() }),
    });
    fetchUploads();
  };

  const handleRestore = async (uploadUid: string) => {
    await pgREST(`/uploads?uid=eq.${uploadUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ trashed_at: null }),
    });
    fetchUploads();
  };

  const elemref = useRef({
    isPlaying: false,
    currentAudioUrl: '',
    stopPlay: ()=>{},
  });

  const handlePlayAudio = (audioUrl: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (elemref.current.isPlaying){
      const isSame = audioUrl == elemref.current.currentAudioUrl;
      elemref.current.stopPlay();
      if (isSame){
        return;
      }
    }
    
    elemref.current.isPlaying = true;
    elemref.current.currentAudioUrl = audioUrl;
    const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
    if(!audioPlayer) return;
    const source = audioPlayer.querySelector('source') as HTMLSourceElement;
    if(!source) return;
    const playSec = e.currentTarget.querySelector('.play-sec') as HTMLSpanElement;
    if(!playSec) return;

    const safePlay = () => {
      audioPlayer.play().catch(() => {
        // Safari can reject immediate play if media isn't ready yet.
        const onCanPlay = () => {
          audioPlayer.play().catch(() => {});
        };
        audioPlayer.addEventListener('canplay', onCanPlay, { once: true });
      });
    };

    audioPlayer.ontimeupdate = () => {
      playSec.innerText = formatTime(audioPlayer.currentTime);
    }

    audioPlayer.onended = () => {
      elemref.current.isPlaying = false;
      playSec.innerText = t('guestbook.voiceMessage');
    }

    elemref.current.stopPlay = () => {
      audioPlayer.pause();
      elemref.current.isPlaying = false;
      elemref.current.currentAudioUrl = '';
      setTimeout(() => {
        playSec.innerText = t('guestbook.voiceMessage');
      }, 200);
    }

    source.setAttribute('src', audioUrl);
    const audioType = audioTypeFromUrl(audioUrl);
    if (audioType) {
      source.setAttribute('type', audioType);
    } else {
      source.removeAttribute('type');
    }
    audioPlayer.load();
    safePlay();
  }

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('guestbook.breadcrumb') },
            ]}
            title={t('guestbook.title')}
          />

          {/* Stats Cards */}
          <div className="guestbook-stats-grid">
            <div className="guestbook-stat-card">
              <p className="guestbook-stat-label">{t('guestbook.totalMessages')}</p>
              <h3 className="guestbook-stat-value">{uploads.length}</h3>
            </div>
            <div className="guestbook-stat-card">
              <p className="guestbook-stat-label">{t('guestbook.visible')}</p>
              <h3 className="guestbook-stat-value">{visibleCount}</h3>
            </div>
            <div className="guestbook-stat-card">
              <p className="guestbook-stat-label">{t('guestbook.hidden')}</p>
              <h3 className="guestbook-stat-value">{hiddenCount}</h3>
            </div>
          </div>

          <audio style={{display: 'none'}} id="audioPlayer">
            <source src='' type="audio/mp3"/>
          </audio>

          {/* Messages Container */}
          <div className="guestbook-container">
            {/* Filter Header */}
            <div className="guestbook-filter-header">
              <div className="guestbook-search-wrapper">
                <i className="fa-solid fa-search guestbook-search-icon" />
                <input
                  type="text"
                  className="guestbook-search-input"
                  placeholder={t('guestbook.searchPlaceholder')}
                  defaultValue={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="guestbook-filter-tabs">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`guestbook-filter-tab ${activeFilter === tab.key ? 'active' : 'inactive'}`}
                    onClick={() => setActiveFilter(tab.key)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Table or Empty State */}
            {filteredUploads.length > 0 ? (
              <>
                <div className="guestbook-table-wrapper">
                  <table className="guestbook-table">
                    <thead>
                      <tr>
                        <th>{t('guestbook.tableGuest')}</th>
                        <th>{t('guestbook.tableMessage')}</th>
                        <th>{t('guestbook.tableStatus')}</th>
                        <th>{t('guestbook.tableActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUploads.map((upload) => {
                        const name = upload.participants?.name || t('guestbook.unknownGuest');
                        const isHidden = !!upload.trashed_at;
                        
                        return (
                          <tr key={upload.uid}>
                            <td>
                              <p className="guestbook-guest-name">{name}</p>
                              <p className="guestbook-guest-time">{formatTimeAgo(upload.created_at)}</p>
                            </td>
                            <td className="guestbook-message-cell">
                              {upload.upload_type === 'text' ? (
                                <p className="guestbook-message-text">{upload.value}</p>
                              ) : (
                                <div style={{cursor: 'pointer'}} onClick={(e) => handlePlayAudio( S3_ROOT + upload.value, e)} className="guestbook-voice-indicator">
                                  <i className="fa-solid fa-microphone" />
                                  <span className='play-sec'>{t('guestbook.voiceMessage')}</span>
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`guestbook-status-pill ${isHidden ? 'hidden' : 'visible'}`}>
                                {isHidden ? t('guestbook.statusHidden') : t('guestbook.statusVisible')}
                              </span>
                            </td>
                            <td>
                              <div className="guestbook-actions">
                                {isHidden ? (
                                  <button
                                    className="guestbook-action-btn approve"
                                    onClick={() => handleRestore(upload.uid)}
                                  >
                                    {t('guestbook.restore')}
                                  </button>
                                ) : (
                                  <button
                                    className="guestbook-action-btn secondary"
                                    onClick={() => handleHide(upload.uid)}
                                  >
                                    {t('guestbook.hide')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="guestbook-pagination">
                  <p className="guestbook-pagination-info">
                    {t('guestbook.showing')} <strong>1-{filteredUploads.length}</strong> {t('guestbook.of')} {uploads.length} {t('guestbook.messages')}
                  </p>
                  <div className="guestbook-pagination-buttons">
                    <button className="guestbook-pagination-btn" disabled>
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <button className="guestbook-pagination-btn" disabled>
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="guestbook-empty">
                <div className="guestbook-empty-icon">
                  <i className="fa-solid fa-comments" />
                </div>
                <h3 className="guestbook-empty-title">{t('guestbook.emptyTitle')}</h3>
                <p className="guestbook-empty-text">{t('guestbook.emptyText')}</p>
              </div>
            )}
          </div>
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventGuestbook;
