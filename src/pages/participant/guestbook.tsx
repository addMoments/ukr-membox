import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { unpackUUID, uuidv5 } from '../../packages/uuid';
import { pgREST } from '../../client/postgrest';
import { Event } from '../../types/events';
import V2GuestGuestbook, { GuestbookEntry2 } from '../../v2-partials/V2GuestGuestbook';
import { S3_ROOT } from '../../consts';
import { defaultGuestTheme } from '../../types/guestTheme';
import { parse_submit_event } from '../../utils/form_event_parse';
import { whoAmI } from '../../client/auth';
import { getTimeAgo } from '../../temp-ai-logic-and-data/time-ago';
import { guestUpload } from '../../client/uploads';
import { applyGuestFont } from '../../utils/applyGuestFont';
import { getEventPublicFeatures } from '../../client/features';
import { FEATURE_VOICE } from '../../utils/features';
import { t } from '../../packages/i18n';
import V2GuestGate from '../../v2-partials/V2GuestGate';
import GuestAccessErrorScreen from '../../v2-partials/GuestAccessErrorScreen';
import {
  getEventClosedMessage,
  isContributorLimitReachedError,
  isEventClosedError,
  isForbiddenError,
  isPackageLimitExceededError
} from '../../utils/guestInitError';

function ParticipantGuestbook() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const uid = unpackUUID(packedUid || "a");

  const [event, setEvent] = useState<Event>({} as Event);
  const [features, setFeatures] = useState<number[]>([]);
  const [myName, setMyName] = useState('');
  const [myLatestMessage, setMyLatestMessage] = useState('');
  const [entries, setEntries] = useState<GuestbookEntry2[]>([]);
  const [newEntryId, setNewEntryId] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<string[]>([]);
  const [showPackageLimitError, setShowPackageLimitError] = useState(false);
  const [eventClosedMessage, setEventClosedMessage] = useState('');
  const langCode = t('lang_code');
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

  const PAGE_SIZE = 10;

  useEffect(() => {
    (async () => {
      try {
        if (!packedUid) {
          return;
        }

        const user = await whoAmI();
        const participantUid = user.ui;

        const [eventData, participantData, myLatestUpload, featData] = await Promise.all([
          pgREST(`/events_public?uid=eq.${uid}`),
          pgREST(`/participants?uid=eq.${participantUid}&select=name`),
          pgREST(`/uploads?client_uid=eq.${participantUid}&event_uid=eq.${uid}&upload_type=eq.text&trashed_at=is.null&order=created_at.desc&limit=1`),
          getEventPublicFeatures(packedUid),
        ]);

        const eventSettings = eventData[0]?.settings || {};
        const canSeeText = eventSettings.public_text_guestbook === undefined ? true : !!eventSettings.public_text_guestbook;
        const canSeeAudio = !!eventSettings.public_audio_guestbook;

        // Build the type filter based on what the organizer allows guests to see
        const visibleTypes: string[] = [];
        if (canSeeText) visibleTypes.push('text');
        if (canSeeAudio) visibleTypes.push('voice');
        setVisibleTypes(visibleTypes);

        const latestEntries = visibleTypes.length > 0
          ? await pgREST(`/uploads?event_uid=eq.${uid}&upload_type=in.(${visibleTypes.join(',')})&trashed_at=is.null&order=created_at.desc&limit=${PAGE_SIZE + 1}&select=*,participants(name)`)
          : [];

        setEvent(eventData[0]);
        setFeatures(featData || []);
        applyGuestFont(eventData[0].settings?.font);

        // Set user's name from participants table, ignore auto-generated guest-* names
        const savedName = participantData[0]?.name;
        if (savedName && !savedName.startsWith('guest-')) {
          setMyName(savedName);
        }

        // Set user's latest text message
        if (myLatestUpload[0]?.value) {
          setMyLatestMessage(myLatestUpload[0].value);
        }

        // Convert uploads to GuestbookEntry2 format
        const hasMorePages = latestEntries.length > PAGE_SIZE;
        const pageEntries = hasMorePages ? latestEntries.slice(0, PAGE_SIZE) : latestEntries;
        const mappedEntries: GuestbookEntry2[] = pageEntries.map((upload: { uid: string; value: string; upload_type: 'text' | 'voice'; created_at: string; participants?: { name: string } }) => ({
          id: upload.uid,
          authorName: upload.participants?.name || 'Guest',
          message: upload.upload_type === 'text' ? upload.value : undefined,
          audioUrl: upload.upload_type === 'voice' ? S3_ROOT + upload.value : undefined,
          timeAgo: getTimeAgo(upload.created_at),
          likes: 0,
          uploadType: upload.upload_type,
        }));
        setEntries(mappedEntries);
        setHasMore(hasMorePages);
      } catch (err) {
        if (isPackageLimitExceededError(err)) {
          setShowPackageLimitError(true);
          return;
        }
        if (isEventClosedError(err)) {
          setEventClosedMessage(getEventClosedMessage(err) || eventClosedDefaultMessage);
        }
      }
    })();
  }, [eventClosedDefaultMessage, packedUid, uid]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = parse_submit_event(e);

    const name = formData.name;
    const message = formData.message;

    const user = await whoAmI();
    const participantUid = user.ui;

    if (!!name){
      // Update participant name
      await pgREST(`/participants?uid=eq.${participantUid}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setMyName(name);
    }

    // Insert guestbook message as text upload
    const multipleAllowed = !!event.settings?.multiple_guestbook;
    if (!!message && myLatestMessage && !multipleAllowed) {
      alert('You have already submitted a guestbook entry.');
      return;
    }
    if (!!message){
      const inserted = await pgREST('/uploads', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          upload_type: 'text',
          client_uid: participantUid,
          event_uid: uid,
          value: message,
        }),
      });
      setMyLatestMessage(message);
      const newId = inserted[0].uid;
      setNewEntryId(newId);
      setTimeout(() => setNewEntryId(undefined), 3000);
      setEntries([{
        id: newId,
        authorName: name || myName,
        message: message,
        timeAgo: getTimeAgo(inserted[0].created_at),
        likes: 0,
        uploadType: 'text',
      }, ...entries]);

      const messageInput = form.elements.namedItem('message') as HTMLTextAreaElement | null;
      if (messageInput) {
        messageInput.value = '';
      }
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || visibleTypes.length === 0) return;
    setLoadingMore(true);
    const offset = entries.length;
    const moreEntries = await pgREST(
      `/uploads?event_uid=eq.${uid}&upload_type=in.(${visibleTypes.join(',')})&trashed_at=is.null&order=created_at.desc&limit=${PAGE_SIZE + 1}&offset=${offset}&select=*,participants(name)`
    );
    const hasMorePages = moreEntries.length > PAGE_SIZE;
    const pageEntries = hasMorePages ? moreEntries.slice(0, PAGE_SIZE) : moreEntries;
    const mapped: GuestbookEntry2[] = pageEntries.map((upload: { uid: string; value: string; upload_type: 'text' | 'voice'; created_at: string; participants?: { name: string } }) => ({
      id: upload.uid,
      authorName: upload.participants?.name || 'Guest',
      message: upload.upload_type === 'text' ? upload.value : undefined,
      audioUrl: upload.upload_type === 'voice' ? S3_ROOT + upload.value : undefined,
      timeAgo: getTimeAgo(upload.created_at),
      likes: 0,
      uploadType: upload.upload_type,
    }));
    setEntries(prev => [...prev, ...mapped]);
    setHasMore(hasMorePages);
    setLoadingMore(false);
  };

  const handleSubmitAudio = async (file: File, name: string, message: string): Promise<boolean> => {
    const contributorLimitMessageRaw = t('errors.contributorLimitReached');
    const contributorLimitMessage = contributorLimitMessageRaw === 'errors.contributorLimitReached'
      ? 'Etkinlik paylaşım limiti doldu. Yeni katılımcı paylaşımı kabul edilmiyor.'
      : contributorLimitMessageRaw;
    const forbiddenMessageRaw = t('errors.forbidden');
    const forbiddenMessage = forbiddenMessageRaw === 'errors.forbidden'
      ? 'Bu işlem şu anda yapılamıyor.'
      : forbiddenMessageRaw;

    try {
      const user = await whoAmI();
      const participantUid = user.ui;

      // Run name update, voice upload, and optional text upload in parallel
      const tasks: Promise<unknown>[] = [
        guestUpload(uid, 'voice', [file]),
      ];

      if (name) {
        tasks.push(pgREST(`/participants?uid=eq.${participantUid}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }));
      }

      const multipleAllowed = !!event.settings?.multiple_guestbook;
      const saveText = !!message && (!myLatestMessage || multipleAllowed);
      if (saveText) {
        tasks.push(pgREST('/uploads', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            upload_type: 'text',
            client_uid: participantUid,
            event_uid: uid,
            value: message,
          }),
        }));
      }

      const [uploaded, ...rest] = await Promise.all(tasks) as [string[], ...unknown[]];
      const resolvedName = name || myName;
      if (name) setMyName(name);

      const newEntries: GuestbookEntry2[] = [];

      if (uploaded && uploaded[0]) {
        const voiceId = uuidv5(uid);
        newEntries.push({
          id: voiceId,
          authorName: resolvedName || 'Guest',
          audioUrl: S3_ROOT + uploaded[0],
          timeAgo: 'Just now',
          likes: 0,
          uploadType: 'voice',
        });
        setNewEntryId(voiceId);
        setTimeout(() => setNewEntryId(undefined), 3000);
      }

      if (saveText) {
        // text upload result is the last resolved task
        const inserted = rest[rest.length - 1] as { uid: string; created_at: string }[];
        if (inserted?.[0]) {
          setMyLatestMessage(message);
          newEntries.push({
            id: inserted[0].uid,
            authorName: resolvedName || 'Guest',
            message,
            timeAgo: getTimeAgo(inserted[0].created_at),
            likes: 0,
            uploadType: 'text',
          });
        }
      }

      if (newEntries.length > 0) {
        setEntries([...newEntries, ...entries]);
      }
      return true;
    } catch (err) {
      if (isContributorLimitReachedError(err)) {
        alert(contributorLimitMessage);
        return false;
      }
      if (isForbiddenError(err)) {
        alert(forbiddenMessage);
        return false;
      }
      alert(forbiddenMessage);
      return false;
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
        title="Package limit exceeded"
        message="You have exceeded your package limit. Please contact help center."
        actionText="Contact help center"
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
    <V2GuestGuestbook
      eventTitle={event.name || ''}
      welcomeMessage={event.description || 'Leave a note, share a memory, or just say hello. We cherish every message from our loved ones.'}
      entries={entries}
      decorativeImageUrl={event.image ? S3_ROOT + event.image : ""}
      onSubmit={handleSubmit}
      initialName={myName}
      audioEnabled={features.includes(FEATURE_VOICE)}
      onSubmitAudio={handleSubmitAudio}
      theme={event.settings?.colors || defaultGuestTheme}
      newEntryId={newEntryId}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
    />
  );
}

export default ParticipantGuestbook;
