import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { t } from '../packages/i18n';
import { FEATURE_POSTER } from '../utils/features';
import { Event as MemboxEvent } from '../types/events';
import { packUUID } from '../packages/uuid';
import { S3_ROOT } from '../consts';
import '../v2-styles/EventNavigator.css';

interface EventNavigatorProps {
  eventUid: string;
  eventTitle: string;
  eventDate: string;
  eventImageUrl?: string;
  packedUid: string;
  features: number[];
  allEvents: MemboxEvent[];
}

function EventNavigator({
  eventUid,
  eventTitle,
  eventDate,
  eventImageUrl,
  packedUid,
  features,
  allEvents,
}: EventNavigatorProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [hasImageError, setHasImageError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');
  const fallbackLogo = `${process.env.PUBLIC_URL || ''}/assets/header/addmoments_favicon.svg`;
  const thumbSrc = !eventImageUrl || hasImageError ? fallbackLogo : eventImageUrl;
  const hasMultipleEvents = allEvents.length > 1;
  useEffect(() => {
    setHasImageError(false);
  }, [eventImageUrl]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const navItems: { path: string; icon: string; labelKey: string; exact?: boolean; featureId?: number }[] = [
    { path: `/event/${packedUid}`, icon: 'fa-solid fa-home', labelKey: 'sidebar.dashboard', exact: true },
    { path: `/event/${packedUid}/gallery`, icon: 'fa-solid fa-images', labelKey: 'sidebar.gallery' },
    { path: `/event/${packedUid}/guestbook`, icon: 'fa-solid fa-book', labelKey: 'sidebar.guestbook' },
    { path: `/event/${packedUid}/theme`, icon: 'fa-solid fa-palette', labelKey: 'sidebar.theme' },
    { path: `/event/${packedUid}/qr`, icon: 'fa-solid fa-qrcode', labelKey: 'sidebar.qrCode' },
    { path: `/event/${packedUid}/poster`, icon: 'fa-solid fa-image', labelKey: 'sidebar.poster', featureId: FEATURE_POSTER },
    { path: `/event/${packedUid}/settings`, icon: 'fa-solid fa-cog', labelKey: 'sidebar.settings' },
    { path: `/event/${packedUid}/collaborators`, icon: 'fa-solid fa-users', labelKey: 'sidebar.collaborators' },
    { path: `/event/${packedUid}/trash`, icon: 'fa-solid fa-trash', labelKey: 'sidebar.trash' },
  ].filter(item => !item.featureId || features.includes(item.featureId));

  const closeMobileMenu = () => {
    window.dispatchEvent(new Event('event-nav-close'));
  };

  const handleEventSwitch = (ev: MemboxEvent) => {
    setDropdownOpen(false);
    closeMobileMenu();
    navigate(`/event/${packUUID(ev.uid)}`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <aside className="event-navigator">
      <div className="event-navigator-sticky">
        <div className="event-navigator-card">
          <button
            type="button"
            className="event-navigator-mobile-close"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-xmark" />
          </button>

          {/* Event info — clickable only when there are multiple events */}
          <div className="event-navigator-event-info-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`event-navigator-event-info${hasMultipleEvents ? ' event-navigator-event-info--switchable' : ''}`}
              onClick={() => hasMultipleEvents && setDropdownOpen(o => !o)}
              disabled={!hasMultipleEvents}
            >
              <div className="event-navigator-event-thumb">
                <img
                  src={thumbSrc}
                  alt={eventTitle}
                  className={!eventImageUrl || hasImageError ? 'event-navigator-event-thumb-logo' : 'event-navigator-event-thumb-image'}
                  onError={(e) => {
                    if (e.currentTarget.src.includes(fallbackLogo)) return;
                    setHasImageError(true);
                  }}
                />
              </div>
              <div className="event-navigator-event-meta">
                <h3 className="event-navigator-event-title">{eventTitle}</h3>
                <p className="event-navigator-event-date">{eventDate}</p>
                {hasMultipleEvents && (
                  <p className="event-navigator-event-switch">
                    <i className="fa-solid fa-repeat" />
                    {t('sidebar.changeEvent')}
                  </p>
                )}
              </div>
              {hasMultipleEvents && (
                <i className={`fa-solid fa-chevron-down event-navigator-chevron${dropdownOpen ? ' open' : ''}`} />
              )}
            </button>

            {dropdownOpen && (
              <div className="event-navigator-dropdown">
                {allEvents.map((ev, i) => {
                  const isCurrentEvent = ev.uid === eventUid;
                  const evThumb = ev.image ? `${S3_ROOT}${ev.image}` : fallbackLogo;
                  return (
                    <div key={ev.uid}>
                      {i > 0 && <div className="event-navigator-dropdown-divider" />}
                      <button
                        type="button"
                        className={`event-navigator-dropdown-item${isCurrentEvent ? ' event-navigator-dropdown-item--active' : ''}`}
                        onClick={() => handleEventSwitch(ev)}
                      >
                        <div className="event-navigator-event-thumb event-navigator-event-thumb--sm">
                          <img
                            src={evThumb}
                            alt={ev.name || t('sidebar.untitled')}
                            className="event-navigator-event-thumb-image"
                            onError={(e) => { e.currentTarget.src = fallbackLogo; }}
                          />
                        </div>
                        <div className="event-navigator-event-meta">
                          <span className="event-navigator-event-title">{ev.name || t('sidebar.untitled')}</span>
                          <span className="event-navigator-event-date">{formatDate(ev.activation_date)}</span>
                        </div>
                        {isCurrentEvent && (
                          <i className="fa-solid fa-circle-check event-navigator-dropdown-check" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <nav className="event-navigator-nav">
            {navItems.map((item) => {
              const active = item.exact
                ? currentPath === item.path
                : isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`event-navigator-link ${active ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <i className={item.icon}></i>
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default EventNavigator;
