import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import ColoredSettingsBox from '../../v2-components/ColoredSettingsBox';
import AdvertorialSettings from '../../v2-components/AdvertorialSettings';
import Button from '../../components/Button';
import '../../v2-styles/Settings.css';
import { parse_submit_event } from '../../utils/form_event_parse';
import { unpackUUID } from '../../packages/uuid';
import { pgErr } from '../../client/postgrest';
import { Event } from '../../types/events';
import { Job } from '../../types/jobs';
import { saveUrl } from '../../utils/download';
import { S3_ROOT, SERV_ROOT } from '../../consts';
import { dbWhoAmI } from '../../client/auth';
import { t } from '../../packages/i18n';
import { sendToMsg } from '../../types/mesage-screen';
import { fetch } from '../../client/core';
import { rm_key } from '../../utils/persistence';

const SettingsToggle = ({name, description, checked, formName}: {name: string, description: string, checked: boolean, formName: string})=>{


  return(<div className="settings-toggle-item">
    <div className="settings-toggle-content">
      <h3 className="settings-toggle-title">{name}</h3>
      <p className="settings-toggle-description">{description}</p>
    </div>
    <label className="settings-toggle-switch">
      <input 
        type="checkbox" 
        name={formName}
        defaultChecked={checked}
      />
      <span className="settings-toggle-slider"></span>
    </label>
  </div>);
}

const EventSettings = ()=>{
  return <EventDetailLayout>
    {(event) => <EventSettingsInner event={event} />}
  </EventDetailLayout>
}

interface FormStatus { state: 'saving' | 'success' | 'error'; message?: string }

function EventSettingsInner({event}: {event: Event}) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [generalStatus, setGeneralStatus] = useState<FormStatus | null>(null);
  const [dateStatus, setDateStatus] = useState<FormStatus | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<FormStatus | null>(null);
  const [generalFormKey, setGeneralFormKey] = useState(0);
  const [exportJob, setExportJob] = useState<Job | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const navigate = useNavigate();
  const langCode = t('lang_code');
  const isUkrainian = langCode === 'uk';
  const eventDeleteTitle = isUkrainian ? 'Видалити подію' : 'Delete event';
  const eventDeleteDescription = isUkrainian
    ? 'Це закриє подію та зупинить доступ гостей.'
    : 'This closes the event and stops guest access.';
  const eventDeleteConfirmMessage = isUkrainian
    ? 'Подію буде закрито, і гості більше не матимуть доступу. Продовжити?'
    : 'This event will be closed and guests will lose access. Continue?';
  const eventDeleteFailedTitle = isUkrainian ? 'Не вдалося видалити подію' : 'Failed to delete event';
  const eventDeleteFailedMessage = isUkrainian ? 'Спробуйте ще раз.' : 'Please try again.';
  const backText = isUkrainian ? 'Назад' : 'Back';

  const handleSaveGeneralDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    const form = parse_submit_event(e);
    const eventUid = unpackUUID(packedUid || "");

    const { activation_date, ...rest } = form;

    setGeneralStatus({ state: 'saving' });
    setDateStatus(null);

    // Always fire the main fields request
    const mainReq = pgErr(`/events?uid=eq.${eventUid}`, {
      method: 'PATCH',
      body: JSON.stringify(rest),
    });

    const alreadyStarted = event.activation_date && new Date(event.activation_date + (event.activation_date.includes('Z') || event.activation_date.includes('+') ? '' : 'Z')).getTime() <= Date.now();

    // date input is disabled when alreadyStarted — skip it entirely
    const dateReq = !alreadyStarted && activation_date
      ? pgErr(`/events?uid=eq.${eventUid}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({ activation_date }),
        })
      : Promise.resolve({ res: null, err: null });

    const [{ err: mainErr }, { res: dateRes, err: dateErr }] = await Promise.all([mainReq, dateReq]);

    if (mainErr) {
      setGeneralStatus({ state: 'error', message: (mainErr as Error).message });
      setGeneralFormKey(k => k + 1);
    } else {
      setGeneralStatus({ state: 'success' });
      setTimeout(() => setGeneralStatus(null), 3000);
    }

    if (!alreadyStarted && activation_date) {
      if (dateErr) {
        setDateStatus({ state: 'error', message: (dateErr as Error).message });
        setGeneralFormKey(k => k + 1);
      } else {
        const dateUpdated = Array.isArray(dateRes) ? dateRes.length > 0 : dateRes !== null;
        if (dateUpdated) {
          setDateStatus({ state: 'success' });
          setTimeout(() => setDateStatus(null), 3000);
        } else {
          setDateStatus({ state: 'error', message: t('settings.generalDetails.dateRejected') });
          setGeneralFormKey(k => k + 1);
        }
      }
    }
  };

  const settings = event.settings || {};

  const handleSavePrivacySettings = async (e: React.FormEvent<HTMLFormElement>) => {
    const form = parse_submit_event(e);
    const eventUid = unpackUUID(packedUid || "");

    setPrivacyStatus({ state: 'saving' });
    const { err } = await pgErr(`/events?uid=eq.${eventUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings: { ...settings, ...form } })
    });
    if (err) {
      setPrivacyStatus({ state: 'error', message: (err as Error).message });
    } else {
      setPrivacyStatus({ state: 'success' });
      setTimeout(() => setPrivacyStatus(null), 3000);
    }
  }

  const fetchLatestExportJob = async () => {
    const {res, err} = await pgErr(`/jobs?name=eq.s3_export&input->>event_uid=eq.${event.uid}&order=created_at.desc&limit=1`, {
      method: 'GET',
    });
    if (err) {
      console.error(err);
      throw err;
    }
    return res;
  }

  const elemRef = useRef({
    selfUid: null as string | null,
  }).current;

  useEffect(() => {
    setExportJob(null);
    fetchLatestExportJob().then((res) => {
      setExportJob(res[0] as Job);
    });

    dbWhoAmI().then((selfUid) => {
      elemRef.selfUid = selfUid;
    });
  }, [event.uid]);

  useEffect(() => {
    if (!exportJob || !['queued', 'running'].includes(exportJob.status)) return;
    const interval = setInterval(() => {
      fetchLatestExportJob().then((res) => {
        const updated = res[0] as Job;
        setExportJob(updated);
        if (!updated || !['queued', 'running'].includes(updated.status)) {
          clearInterval(interval);
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [exportJob?.status]);

  const exoprtDateFormat = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(t('lang_code'), { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  const handleExportEvent = async ()=>{
    setExportJob(null);
    const {res, err} = await pgErr(`/jobs`, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ 
        name: 's3_export',  
        user_uid: elemRef.selfUid,
        input: {
          event_uid: event.uid,
        }
      })
    });
    if (err) {
      console.error(err);
      throw err;
    }
    setExportJob(res[0] as Job);
  }

  const onDelClick = ()=>{
    sendToMsg({
      title: t('settings.removeData.title'),
      message: t('settings.removeData.description'),
      buttons: [
        { text: t('settings.removeData.cancelButton'), href:  `/event/${packedUid}/settings`},
        { text: t('settings.removeData.removeButton'), href: `/event/${packedUid}/settings?r=1` },
      ],
    })
  };

  const onDeleteEventClick = () => {
    sendToMsg({
      title: eventDeleteTitle,
      message: eventDeleteConfirmMessage,
      buttons: [
        { text: t('settings.removeData.cancelButton'), href: `/event/${packedUid}/settings` },
        { text: eventDeleteTitle, href: `/event/${packedUid}/settings?er=1` },
      ],
    });
  };

  useEffect(()=>{
    const remove = new URLSearchParams(window.location.search).get('r');
    if (remove) {
      const rm = window.confirm(t('settings.removeData.confirmMessage'));
      if (rm) {
        (async ()=>{
          const res = await fetch(`${SERV_ROOT}/auth/account`, {
            method: 'DELETE',
          });

          if (!res.ok) {
            throw new Error('Failed to remove user data');
          }

          await rm_key("tkn");
  
          sendToMsg({
            title: t('settings.removeData.completeTitle'),
            message: t('settings.removeData.completeMessage'),
            buttons: [
              { text: t('settings.removeData.backHome'), href:  `/`},
            ],
          })
        })()
      }
    }
  }, [packedUid]);

  useEffect(() => {
    const removeEvent = new URLSearchParams(window.location.search).get('er');
    if (!removeEvent || !packedUid) {
      return;
    }
    (async () => {
      const res = await fetch(`${SERV_ROOT}/auth/event/${packedUid}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to remove event');
      }
      navigate('/events');
    })().catch((err) => {
      console.error('Event delete failed:', err);
      sendToMsg({
        title: eventDeleteFailedTitle,
        message: eventDeleteFailedMessage,
        buttons: [
          { text: backText, href: `/event/${packedUid}/settings` },
        ],
      });
    });
  }, [backText, eventDeleteFailedMessage, eventDeleteFailedTitle, navigate, packedUid]);

  return (
    <><AdminPageHeader
    breadcrumbs={[
      { label: t('common.events'), to: '/events' },
      { label: event.name || t('common.event'), to: `/event/${packedUid}` },
      { label: t('settings.breadcrumb') },
    ]}
    title={t('settings.title')}
  />

  {/* Header with actions */}
  <div className="settings-header">
    <p className="settings-header-subtitle">{t('settings.subtitle')}</p>
  </div>

  <div className="settings-main-content">
      {/* General Details Section */}
      <form key={generalFormKey} id="general" className="settings-section" onSubmit={handleSaveGeneralDetails}>
        <div className="settings-section-header">
          <h2 className="settings-section-title">{t('settings.generalDetails.title')}</h2>
          <p className="settings-section-description">{t('settings.generalDetails.description')}</p>
        </div>
        <div className="settings-form-grid" >
          {/* names are from db colnames */}
          <div className="settings-field">
            <label className="settings-field-label">{t('settings.generalDetails.nameLabel')}</label>
            <input 
              type="text" 
              name="name"
              className="settings-field-input" 
              defaultValue={event.name || ''}
              placeholder={t('settings.generalDetails.namePlaceholder')}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">{t('settings.generalDetails.dateLabel')}</label>
            <input
              type="date"
              name="activation_date"
              className="settings-field-input"
              defaultValue={event.activation_date?.split('T')[0] || ''}
              disabled={!!(event.activation_date && new Date(event.activation_date + (event.activation_date.includes('Z') || event.activation_date.includes('+') ? '' : 'Z')).getTime() <= Date.now())}
            />
            {dateStatus?.state === 'error' && <span style={{color: '#dc2626', fontSize: '0.8rem'}}>✗ {dateStatus.message}</span>}
            {dateStatus?.state === 'success' && <span style={{color: '#16a34a', fontSize: '0.8rem'}}>✓ {t('settings.saved')}</span>}
          </div>
          <div className="settings-field full-width">
            <label className="settings-field-label">{t('settings.generalDetails.welcomeMessageLabel')}</label>
            <textarea 
              name="welcome_message"
              className="settings-field-input"
              defaultValue={event.welcome_message || ''}
              placeholder={t('settings.generalDetails.welcomeMessagePlaceholder')}
              rows={4}
            />
          </div>
        </div>
        <div style={{marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
          <Button text={t('settings.saveChanges')} type="submit" loading={generalStatus?.state === 'saving'} />
          {generalStatus?.state === 'success' && <span style={{color: '#16a34a', fontSize: '0.875rem'}}>✓ {t('settings.saved')}</span>}
          {generalStatus?.state === 'error' && <span style={{color: '#dc2626', fontSize: '0.875rem'}}>✗ {generalStatus.message}</span>}
        </div>
      </form>

      {/* Privacy & Access Section */}
      <form id="privacy" className="settings-section" onSubmit={handleSavePrivacySettings}>
        <div className="settings-section-header">
          <h2 className="settings-section-title">{t('settings.privacy.title')}</h2>
          <p className="settings-section-description">{t('settings.privacy.description')}</p>
        </div>
        <div className="settings-toggle-list">
          <SettingsToggle
            name={t('settings.privacy.multipleGuestbook')}
            description={t('settings.privacy.multipleGuestbookDesc')}
            checked={!!settings.multiple_guestbook}
            formName="multiple_guestbook"
          />
          <SettingsToggle
            name={t('settings.privacy.publicTextGuestbook')}
            description={t('settings.privacy.publicTextGuestbookDesc')}
            checked={settings.public_text_guestbook === undefined ? true : !!settings.public_text_guestbook}
            formName="public_text_guestbook"
          />
          {/* <SettingsToggle
            name={t('settings.privacy.publicAudioGuestbook')}
            description={t('settings.privacy.publicAudioGuestbookDesc')}
            checked={!!settings.public_audio_guestbook}
            formName="public_audio_guestbook"
          /> */}
        </div>
        <div style={{marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
          <Button text={t('settings.saveChanges')} type="submit" loading={privacyStatus?.state === 'saving'} />
          {privacyStatus?.state === 'success' && <span style={{color: '#16a34a', fontSize: '0.875rem'}}>✓ {t('settings.saved')}</span>}
          {privacyStatus?.state === 'error' && <span style={{color: '#dc2626', fontSize: '0.875rem'}}>✗ {privacyStatus.message}</span>}
        </div>
      </form>

      <AdvertorialSettings packedUid={packedUid || ''} />

      {/* Content Moderation Section */}
      {/* <section id="moderation" className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">Content Moderation</h2>
          <p className="settings-section-description">Choose how guest uploads are handled.</p>
        </div>
        <div className="settings-radio-list">
          <label className="settings-radio-card">
            <input 
              type="radio" 
              name="moderationMode" 
              value="auto"
              defaultChecked={settings.moderation_mode !== 'manual'}
            />
            <div className="settings-radio-card-content">
              <span className="settings-radio-card-icon bolt">
                <i className="fa-solid fa-bolt" />
              </span>
              <div className="settings-radio-card-text">
                <h4 className="settings-radio-card-title">Auto-Approve</h4>
                <p className="settings-radio-card-description">Photos go live instantly. Ideal for live slideshows.</p>
              </div>
            </div>
          </label>
          <label className="settings-radio-card">
            <input 
              type="radio" 
              name="moderationMode" 
              value="manual"
              defaultChecked={settings.moderation_mode === 'manual'}
            />
            <div className="settings-radio-card-content">
              <span className="settings-radio-card-icon pending">
                <i className="fa-solid fa-clock" />
              </span>
              <div className="settings-radio-card-text">
                <h4 className="settings-radio-card-title">Manual Review</h4>
                <p className="settings-radio-card-description">Organizers must approve photos before they appear.</p>
              </div>
            </div>
          </label>
        </div>
      </section> */}

      <ColoredSettingsBox
        title={t('settings.removeData.title')}
        descriptionS={[t('settings.removeData.description')]}
        color="#DC2626"
        buttonPropsS={[{ text: t('settings.removeData.deleteButton'), onClick: onDelClick }]}
      />

      <ColoredSettingsBox
        title={eventDeleteTitle}
        descriptionS={[eventDeleteDescription]}
        color="#B91C1C"
        buttonPropsS={[{ text: eventDeleteTitle, onClick: onDeleteEventClick }]}
      />

      <ColoredSettingsBox
        title={t('settings.export.title')}
        descriptionS={[
          t('settings.export.description'), 
          exportJob && exportJob.status === 'succeeded' ? `${t('settings.export.latestExport')} ${exoprtDateFormat(exportJob.updated_at)}` : '',
          exportJob && exportJob.status === 'failed' ? `${t('settings.export.latestExportFailed')} ${exportJob.output["err"] || JSON.stringify(exportJob.output)}` : '',
          exportJob && exportJob.status === 'running' ? `${t('settings.export.exportStarted')} ${exoprtDateFormat(exportJob.locked_at || exportJob.created_at)}` : '',
          exportJob && exportJob.status === 'queued' ? t('settings.export.exportQueued') : '',
        ]}
        color="#664d00"
        buttonPropsS={[
          { 
            text: t('settings.export.exportButton'), 
            onClick: handleExportEvent, 
            loading: ["running", "queued"].includes(exportJob?.status || '') 
          }, 
          (exportJob && exportJob.status === 'succeeded') ? { 
            text: t('settings.export.downloadButton'), 
            loading: downloadLoading,
            onClick: ()=>{
              setDownloadLoading(true);
              saveUrl(S3_ROOT + exportJob.output["zip_path"], "export.zip").finally(() => {
                setDownloadLoading(false);
              });
            } } : null,
        ]}
      />
  </div>
</>
  );
}

export default EventSettings;
