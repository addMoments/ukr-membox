import { useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import ThemeCustomizer from '../../v2-components/ThemeCustomizer';
import { HeadlessParticipant } from '../participant/index';
import { S3_ROOT } from '../../consts';
import { getMockEventLocation } from '../../temp-ai-logic-and-data/mockGuestHome';
import '../../v2-styles/Theme.css';
import FileInput from '../../components/FileInput';
import Button from '../../components/Button';
import { uploadEventImage } from '../../client/uploads';
import { pgREST } from '../../client/postgrest';
import { unpackUUID } from '../../packages/uuid';
import { defaultGuestTheme } from '../../types/guestTheme';
import { get_form_state } from '../../utils/form_event_parse';
import { Event } from '../../types/events';
import { GuestTheme } from '../../types/guestTheme';
import { fonts } from '../../types/fonts';
import Mockup2 from '../../components/Mockup2';
import { t } from '../../packages/i18n';


function EventThemeInner({event}: {event: Event}) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const initialColors: GuestTheme = { ...defaultGuestTheme, ...event.settings?.colors };
  const [theme, setTheme] = useState<GuestTheme>(initialColors);

  const [activeFont, setActiveFont] = useState(event.settings?.font || fonts[0].id);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const eventUid = unpackUUID(packedUid || "");
    const payload: any = {};
    const colors = get_form_state(document.getElementById('theme-palette-form') as HTMLFormElement);
    const font = activeFont;
    
    payload.settings = {
      ...event.settings,
      colors,
      font
    }
    
    if (bannerImage) {
      const urls = await uploadEventImage(bannerImage);
      payload.image = urls[0];
      setBannerImageUrl(S3_ROOT + urls[0]);
    };

    pgREST(`/events?uid=eq.${eventUid}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }).finally(() => setLoading(false));
  };

  const handleDiscard = () => {
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  

  return (
    <>
    <AdminPageHeader
      breadcrumbs={[
        { label: t('common.events'), to: '/events' },
        { label: event.name || t('common.event'), to: `/event/${packedUid}` },
        { label: t('theme.breadcrumb') },
      ]}
      title={t('theme.title')}
    />
    

    {/* Header with actions */}
    <div className="theme-header">
      <p className="theme-header-subtitle">{t('theme.subtitle')}</p>
      <div className="theme-header-actions">
        <Button text={t('theme.discard')} variant="secondary" onClick={handleDiscard} />
        <Button loading={loading} icon="fa-solid fa-check" text={t('theme.saveChanges')} onClick={handleSave} />
      </div>
    </div>

    <div className="theme-page-layout">
      {/* Left Column - Settings */}
      <div className="theme-settings-column">
        <ThemeCustomizer
          initialColors={initialColors}
          initialFont={activeFont}
          onThemeChange={setTheme}
          onFontChange={setActiveFont}
          formId="theme-palette-form"
        />

        {/* Custom Atmosphere */}
        <section className="theme-section">
          <div className="theme-section-header">
            <div className="theme-section-icon atmosphere">
              <i className="fa-solid fa-image" />
            </div>
            <h2 className="theme-section-title">{t('theme.customAtmosphere')}</h2>
          </div>
          
          <FileInput 
          onFile={(file) => {
            setBannerImage(file);
            setBannerImageUrl(URL.createObjectURL(file));
          }}
          >
          <div className="theme-upload-area">
            <div className="theme-upload-icon">
              <i className="fa-solid fa-cloud-upload-alt" />
            </div>
            <h3 className="theme-upload-title">{t('theme.uploadTitle')}</h3>
            <p className="theme-upload-subtitle">{t('theme.uploadSubtitle')}</p>
            <button className="theme-upload-btn">{t('theme.browseGallery')}</button>
          </div>
          </FileInput>
        </section>
      </div>

      {/* Right Column - Preview */}
      <div className="theme-preview-column">
        <div className="theme-preview-wrapper">
          <div className="theme-preview-badge">
            <span className="theme-preview-badge-dot"></span>
            {t('theme.livePreview')}
          </div>

          <Mockup2
          width={280}


          placement={{
            widthPercent: 91,
            heightPercent: 96,
            leftPercent: 5,
            topPercent: 2,
          }}
          mockupImage='https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui/assets/mobileMockup.png'
          >
          <HeadlessParticipant
              bannerImageUrl={bannerImageUrl || (event.image ? S3_ROOT + event.image : null)}
              eventTitle={event.name || ''}
              eventType={event.event_type || 'Event'}
              eventDate={formatDate(event.settings?.event_date || event.activation_date)}
              eventLocation={getMockEventLocation()}
              welcomeMessage={event.welcome_message || event.description || ''}
              eventInitials=""
              recentUploads={[]}
              packedUid={packedUid || ''}
              onFileSelect={() => {}}
              font={activeFont}
              theme={theme}
            />
          </Mockup2>

          
        </div>
      </div>
    </div>

  </>
  );
}

function EventTheme() {
  return (
    <EventDetailLayout>
      {(event) => (
        <EventThemeInner event={event} />
      )}
    </EventDetailLayout>
  );
}

export default EventTheme;
