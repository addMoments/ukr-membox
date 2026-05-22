import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { unpackUUID } from '../../packages/uuid';
import { pgREST } from '../../client/postgrest';
import { Event } from '../../types/events';
import { UploadEntry } from '../../types/uploads';
import { whoAmI } from '../../client/auth';
import { S3_ROOT } from '../../consts';
import { defaultGuestTheme } from '../../types/guestTheme';
import V2GuestHome, { V2GuestHomeProps } from '../../v2-partials/V2GuestHome';

import { applyGuestFont } from '../../utils/applyGuestFont';
import { t } from '../../packages/i18n';
import V2GuestGate from '../../v2-partials/V2GuestGate';
import GuestAccessErrorScreen from '../../v2-partials/GuestAccessErrorScreen';
import { getEventClosedMessage, isEventClosedError, isPackageLimitExceededError } from '../../utils/guestInitError';
import { getPublicAdvertorialConfig } from '../../client/advertorial';
import { AdvertorialResponse } from '../../types/advertorial';


const HeadlessParticipant = (props: V2GuestHomeProps) => {
  return <V2GuestHome {...props} />;
};

function Participant() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const uid = unpackUUID(packedUid || "a");

  const [event, setEvent] = useState<Event>({} as Event);
  const [recentUploads, setRecentUploads] = useState<UploadEntry[]>([]);
  const [participantUid, setParticipantUid] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [showPackageLimitError, setShowPackageLimitError] = useState(false);
  const [eventClosedMessage, setEventClosedMessage] = useState('');
  const [advertorial, setAdvertorial] = useState<AdvertorialResponse | null>(null);
  const langCode = t('lang_code');
  const resolveFallback = (rawValue: string, key: string, enText: string, ukText: string) => {
    if (rawValue !== key) return rawValue;
    if (langCode === 'uk') return ukText;
    return enText;
  };
  const eventClosedTitleRaw = t('guestAccessError.eventClosedTitle');
  const eventClosedActionRaw = t('guestAccessError.eventClosedAction');
  const eventClosedDefaultMessageRaw = t('guestAccessError.eventClosedDefaultMessage');
  const eventClosedTitle = eventClosedTitleRaw === 'guestAccessError.eventClosedTitle'
    ? (langCode === 'uk' ? 'Цю подію закрито' : 'This event is closed')
    : eventClosedTitleRaw;
  const eventClosedAction = eventClosedActionRaw === 'guestAccessError.eventClosedAction'
    ? (langCode === 'uk' ? 'На головну' : 'Go to home')
    : eventClosedActionRaw;
  const eventClosedDefaultMessage = eventClosedDefaultMessageRaw === 'guestAccessError.eventClosedDefaultMessage'
    ? (langCode === 'uk' ? 'Цю подію закрито.' : 'This event is closed.')
    : eventClosedDefaultMessageRaw;
  const packageLimitTitle = resolveFallback(
    t('guest.limitReachedTitle'),
    'guest.limitReachedTitle',
    'Participant limit reached',
    'Ліміт учасників вичерпано'
  );
  const packageLimitDescription = resolveFallback(
    t('guest.limitReachedDescription'),
    'guest.limitReachedDescription',
    'This event has reached the new participant limit.',
    'Для цієї події вичерпано ліміт нових учасників.'
  );
  const packageLimitActionText = langCode === 'uk' ? 'Звʼязатися з підтримкою' : 'Contact help center';

  const navigate = useNavigate();

  const runBootstrap = useCallback(async () => {
      setShowPackageLimitError(false);
      setEventClosedMessage('');

      try {
        if (!packedUid) {
          return;
        }
        const user = await whoAmI();
        setParticipantUid(user.ui);

        const [eventData, uploadsData, participantData, advertorialData] = await Promise.all([
          pgREST(`/events_public?uid=eq.${uid}`),
          pgREST(`/uploads?event_uid=eq.${uid}&client_uid=eq.${user.ui}&upload_type=in.(photo,video)&trashed_at=is.null&order=created_at.desc&limit=3`),
          pgREST(`/participants?uid=eq.${user.ui}&select=name`),
          getPublicAdvertorialConfig(packedUid).catch(() => null),
        ]);

        setEvent(eventData[0]);
        applyGuestFont(eventData[0].settings?.font);
        setRecentUploads(uploadsData as UploadEntry[]);
        setAdvertorial(advertorialData);
        const currentName = participantData?.[0]?.name || '';
        if (currentName && !currentName.startsWith('guest-')) {
          setParticipantName(currentName);
        }
      } catch (err) {
        if (isPackageLimitExceededError(err)) {
          setShowPackageLimitError(true);
          return;
        }
        if (isEventClosedError(err)) {
          setEventClosedMessage(getEventClosedMessage(err) || eventClosedDefaultMessage);
          return;
        }
        navigate("/404");
      }
    }, [eventClosedDefaultMessage, navigate, packedUid, uid]);

  useEffect(() => {
    runBootstrap();
  }, [runBootstrap]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(t('lang_code'), { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Generate initials from event name (e.g., "Sarah & Michael's Wedding" -> "S+M")
  const getEventInitials = (name: string) => {
    if (!name) return '';
    const words = name.split(/[\s&]+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return words[0][0].toUpperCase() + '+' + words[1][0].toUpperCase();
    }
    return words[0]?.[0]?.toUpperCase() || '';
  };

  const refreshUploads = async () => {
    try {
      const user = await whoAmI();
      const uploadsData = await pgREST(`/uploads?event_uid=eq.${uid}&client_uid=eq.${user.ui}&upload_type=in.(photo,video)&trashed_at=is.null&order=created_at.desc&limit=3`);
      setRecentUploads(uploadsData as UploadEntry[]);
    } catch (err) {
      console.error('Failed to refresh uploads:', err);
    }
  };

  if (event.uid && event.activation_date && event.active_until) {
    const now = Date.now();
    const start = new Date(event.activation_date + (event.activation_date.includes('Z') || event.activation_date.includes('+') ? '' : 'Z')).getTime();
    const end   = new Date(event.active_until   + (event.active_until.includes('Z')   || event.active_until.includes('+')   ? '' : 'Z')).getTime();
    const theme = event.settings?.colors;
    if (now < start) return <V2GuestGate state="not-started" event={event} theme={theme} />;
    if (now >= end)  return <V2GuestGate state="ended"       event={event} theme={theme} />;
  }

  if (showPackageLimitError) {
    return (
      <GuestAccessErrorScreen
        title={packageLimitTitle}
        message={packageLimitDescription}
        actionText={packageLimitActionText}
        actionHref="/contact"
        theme={event.settings?.colors || defaultGuestTheme}
      />
    );
  }

  if (eventClosedMessage) {
    return (
      <GuestAccessErrorScreen
        title={eventClosedTitle}
        message={eventClosedMessage}
        actionText={eventClosedAction}
        actionHref="/"
        theme={event.settings?.colors || defaultGuestTheme}
      />
    );
  }

  return (
    <HeadlessParticipant
      bannerImageUrl={event.image ? S3_ROOT + event.image : null}
      eventTitle={event.name || ''}
      eventType={event.event_type || 'Event'}
      eventDate={formatDate(event.activation_date)}
      eventLocation={""}
      welcomeMessage={event.welcome_message || event.description || ''}
      eventInitials={getEventInitials(event.name)}
      recentUploads={recentUploads}
      packedUid={packedUid || ''}
      onFileSelect={() => {}}
      onUploadComplete={refreshUploads}
      participantUid={participantUid}
      initialUploaderName={participantName}
      onUploaderNameUpdate={setParticipantName}
      theme={event.settings?.colors || defaultGuestTheme}
      advertorial={advertorial}
    />
  );
}

export default Participant;
export { HeadlessParticipant };

