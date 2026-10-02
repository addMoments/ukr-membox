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
import ImageCropModal from '../../v2-components/ImageCropModal';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';

// Misafir sayfasindaki etkinlik gorseli masaustunde ~848x280 (3:1), telefonda ~2.2:1 kutuda
// cover ile gosteriliyor; kirpma 3:1'e gore, telefon yanlardan biraz keser (AM-14).
const EVENT_IMAGE_ASPECT = 3;
const EVENT_IMAGE_MAX_WIDTH = 1800;
const EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;


function EventThemeInner({event}: {event: Event}) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const initialColors: GuestTheme = { ...defaultGuestTheme, ...event.settings?.colors };
  const [theme, setTheme] = useState<GuestTheme>(initialColors);

  const [activeFont, setActiveFont] = useState(event.settings?.font || fonts[0].id);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');

  // Kirpilmis ya da orijinal dosya; "Maks. 10 MB" yaziyordu ama hic kontrol edilmiyordu.
  const handleImageReady = (file: File) => {
    setCropFile(null);
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setImageError(textOr('theme.fileTooLarge', 'This image is larger than 10 MB. Crop it or choose a smaller file.', 'Зображення більше за 10 МБ. Обріжте його або виберіть менший файл.'));
      return;
    }
    setImageError('');
    setBannerImage(file);
    setBannerImageUrl(URL.createObjectURL(file));
  };

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
    return date.toLocaleDateString(t('lang_code'), { 
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
    </div>

    <div className="theme-page-layout">
      {/* Left Column - Settings */}
      <div className="theme-settings-column">
        {/* Custom Atmosphere */}
        <section className="theme-section">
          <div className="theme-section-header">
            <div className="theme-section-icon atmosphere">
              <i className="fa-solid fa-image" />
            </div>
            <h2 className="theme-section-title">{t('theme.customAtmosphere')}</h2>
          </div>
          
          <ImageCropModal
            file={cropFile}
            aspect={EVENT_IMAGE_ASPECT}
            maxOutputWidth={EVENT_IMAGE_MAX_WIDTH}
            onCancel={() => setCropFile(null)}
            onDone={handleImageReady}
          />
          <FileInput
          onFile={setCropFile}
          mimeTypes={['image/png', 'image/jpeg', 'image/webp']}
          >
          <div className="theme-upload-area">
            <div className="theme-upload-icon">
              <i className="fa-solid fa-cloud-upload-alt" />
            </div>
            <h3 className="theme-upload-title">{t('theme.uploadTitle')}</h3>
            <p className="theme-upload-subtitle">{t('theme.uploadSubtitle')}</p>
            <p className="theme-upload-specs">{textOr('theme.uploadSpecs', 'Recommended 1800×600 px (3:1). JPG, PNG or WEBP, up to 10 MB. Guests see exactly the area you crop, on phones and computers alike.', 'Рекомендовано 1800×600 px (3:1). JPG, PNG або WEBP, до 10 МБ. Гості бачать саме ту частину, яку ви обрізали, — і на телефоні, і на комп’ютері.')}</p>
            <button className="theme-upload-btn">{t('theme.browseGallery')}</button>
          </div>
          </FileInput>
          {imageError && <p className="theme-upload-error" role="alert">{imageError}</p>}
        </section>

        <ThemeCustomizer
          initialColors={initialColors}
          initialFont={activeFont}
          onThemeChange={setTheme}
          onFontChange={setActiveFont}
          formId="theme-palette-form"
        />

        <div className="theme-header-actions theme-sticky-actions theme-sticky-actions-desktop">
          <Button text={t('theme.discard')} variant="secondary" onClick={handleDiscard} />
          <Button loading={loading} icon="fa-solid fa-check" text={t('theme.saveChanges')} onClick={handleSave} />
        </div>
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
              eventDate={formatDate(event.settings?.event_date || event.activation_date) || t('eventHome.heroCard.dateNotSet')}
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

      <div className="theme-header-actions theme-sticky-actions theme-sticky-actions-mobile">
        <Button text={t('theme.discard')} variant="secondary" onClick={handleDiscard} />
        <Button loading={loading} icon="fa-solid fa-check" text={t('theme.saveChanges')} onClick={handleSave} />
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
