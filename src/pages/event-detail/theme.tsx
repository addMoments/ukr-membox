import { useEffect, useState } from 'react';
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
import SettingsFieldNote from '../../v2-components/SettingsFieldNote';
import { showToast } from '../../v2-components/V2Toast';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { getAdvertorialConfig } from '../../client/advertorial';
import { AdvertorialResponse } from '../../types/advertorial';
import { albumMediaCounts, albumsListedForNewGuest, listAlbums } from '../../client/albums';
import { GuestAlbum } from '../../types/albums';

// Etkinlik gorseli her yerde (misafir hero'su, misafir defteri, host ana sayfasi) 20:9 kutuda;
// kirpma da ayni oranda, boylece misafir tam kirpilan alani gorur (AM-14). 20:9, onayli
// tasarimdaki 347x156 hero'dan geliyor (2026-10-16; oncesinde 3:1).
const EVENT_IMAGE_ASPECT = 20 / 9;
const EVENT_IMAGE_MAX_WIDTH = 1800;
const EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;


function EventThemeInner({event}: {event: Event}) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  // Son kaydedilen renk ve yazi tipi; Discard bunlara doner, Save bunlari gunceller.
  const [saved, setSaved] = useState<{ colors: GuestTheme; font: string }>(() => ({
    colors: { ...defaultGuestTheme, ...event.settings?.colors },
    font: event.settings?.font || fonts[0].id,
  }));
  const [theme, setTheme] = useState<GuestTheme>(saved.colors);
  const [activeFont, setActiveFont] = useState(saved.font);
  // ThemeCustomizer form alanlarini kendi tutuyor; Discard'da anahtar degisip yeniden kurulur.
  const [customizerKey, setCustomizerKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Etkinlik gorseli album kapagi gibi: secilip kirpilinca hemen yuklenir ve kaydedilir, yaninda
  // "kaydedildi" yazar; Save Changes'i beklemez (musteri 2 Kasim: onizleme aninda degistigi icin
  // kaydedilmis saniliyordu).
  const [savedImage, setSavedImage] = useState<string | null>(event.image || null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  // Ne: Onizlemedeki reklamlar ve albumler, misafir sayfasindakiyle ayni veriden.
  // Neden: Onizleme yalnizca ust kismi gosteriyordu; Solomiia ekranin birebir yansimasini
  //        istedi: paketteyse Promotions, altinda albumler (20 Ekim).
  const [advertorial, setAdvertorial] = useState<AdvertorialResponse | null>(null);
  const [albums, setAlbums] = useState<GuestAlbum[]>([]);
  const [albumsLoaded, setAlbumsLoaded] = useState(false);
  const [mediaCounts, setMediaCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!packedUid) return;
    const eventUid = unpackUUID(packedUid);
    let active = true;
    Promise.all([
      getAdvertorialConfig(packedUid).catch(() => null),
      listAlbums(eventUid).then((list) => ({ ok: true, list })).catch(() => ({ ok: false, list: [] })),
      albumMediaCounts(eventUid).catch(() => null),
    ]).then(([advertorialData, albumsData, counts]) => {
      if (!active) return;
      setAdvertorial(advertorialData);
      setAlbums(albumsListedForNewGuest(albumsData.list));
      setAlbumsLoaded(albumsData.ok);
      setMediaCounts(counts);
    });
    return () => { active = false; };
  }, [packedUid]);

  const eventUid = unpackUUID(packedUid || "");

  const flashImageStatus = (text: string) => {
    setImageStatus(text);
    window.setTimeout(() => setImageStatus(''), 3000);
  };

  const imageSaveFailed = () => setImageError(textOr('theme.imageSaveFailed', 'Could not save the image. Please try again.', 'Не вдалося зберегти зображення. Спробуйте ще раз.'));

  // Kirpilmis ya da orijinal dosya; "Maks. 10 MB" yaziyordu ama hic kontrol edilmiyordu.
  const handleImageReady = async (file: File) => {
    setCropFile(null);
    setImageStatus('');
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setImageError(textOr('theme.fileTooLarge', 'This image is larger than 10 MB. Crop it or choose a smaller file.', 'Зображення більше за 10 МБ. Обріжте його або виберіть менший файл.'));
      return;
    }
    setImageError('');
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const [path] = await uploadEventImage(file);
      await pgREST(`/events?uid=eq.${eventUid}`, {
        method: 'PATCH',
        body: JSON.stringify({ image: path }),
      });
      setSavedImage(path);
      flashImageStatus(textOr('theme.imageSaved', 'Image saved', 'Зображення збережено'));
    } catch (e) {
      console.error('[theme] event image save failed', e);
      imageSaveFailed();
    } finally {
      setImagePreview(null);
      setImageUploading(false);
    }
  };

  const handleImageRemove = async () => {
    setImageError('');
    setImageStatus('');
    setImageUploading(true);
    try {
      await pgREST(`/events?uid=eq.${eventUid}`, {
        method: 'PATCH',
        body: JSON.stringify({ image: null }),
      });
      setSavedImage(null);
      flashImageStatus(textOr('theme.imageRemoved', 'Image removed', 'Зображення прибрано'));
    } catch (e) {
      console.error('[theme] event image remove failed', e);
      imageSaveFailed();
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const colors = get_form_state(document.getElementById('theme-palette-form') as HTMLFormElement) as GuestTheme;
    const font = activeFont;
    try {
      await pgREST(`/events?uid=eq.${eventUid}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: { ...event.settings, colors, font } }),
      });
      setSaved({ colors, font });
      setTheme(colors);
      showToast(textOr('theme.changesSaved', 'Changes saved', 'Зміни збережено'));
    } catch (e) {
      console.error('[theme] save failed', e);
      showToast(textOr('theme.saveFailed', 'Could not save the changes. Please try again.', 'Не вдалося зберегти зміни. Спробуйте ще раз.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Kaydedilmemis renk ve yazi tipi degisikliklerini son kaydedilen hale dondurur (bos bir fonksiyondu).
  const handleDiscard = () => {
    setTheme(saved.colors);
    setActiveFont(saved.font);
    setCustomizerKey((k) => k + 1);
    showToast(textOr('theme.changesDiscarded', 'Unsaved changes discarded', 'Незбережені зміни скасовано'), 'info');
  };

  const imageSrc = imagePreview || (savedImage ? S3_ROOT + savedImage : null);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // Misafir hero'sunda tarih gg.aa.yyyy (2026-10-13 tasarimi); tarih-only deger yerel gun olarak okunur.
    const date = new Date(dateString.length <= 10 ? dateString + 'T00:00:00' : dateString);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
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
          <div className="theme-image-field">
            <div className="theme-image-preview">
              {imageSrc ? <img src={imageSrc} alt="" /> : <i className="fa-regular fa-image" />}
            </div>
            <div className="theme-image-actions">
              <FileInput onFile={setCropFile} mimeTypes={['image/png', 'image/jpeg', 'image/webp']} multiple={false}>
                <Button
                  type="button"
                  variant="secondary"
                  icon="fa-solid fa-upload"
                  loading={imageUploading}
                  text={savedImage ? textOr('theme.imageChange', 'Change image', 'Змінити зображення') : textOr('theme.imageUpload', 'Upload image', 'Завантажити зображення')}
                />
              </FileInput>
              {savedImage && (
                <Button
                  type="button"
                  variant="secondary"
                  icon="fa-solid fa-xmark"
                  text={textOr('theme.imageRemove', 'Remove image', 'Прибрати зображення')}
                  onClick={handleImageRemove}
                  disabled={imageUploading}
                />
              )}
              {imageStatus && <span className="theme-image-status" role="status">✓ {imageStatus}</span>}
              {imageError && <p className="theme-upload-error" role="alert">{imageError}</p>}
              <SettingsFieldNote>
                <p>{textOr('theme.uploadSpecs', 'Recommended 1800×810 px (20:9). JPG, PNG or WEBP, up to 10 MB. Guests see exactly the area you crop, on phones and computers alike.', 'Рекомендовано 1800×810 px (20:9). JPG, PNG або WEBP, до 10 МБ. Гості бачать саме ту частину, яку ви обрізали, — і на телефоні, і на комп’ютері.')}</p>
                <p>{textOr('theme.imageSavedOnUpload', 'The image is saved as soon as you upload it; Save Changes is only for colours and fonts.', 'Зображення зберігається одразу після завантаження; «Зберегти зміни» — лише для кольорів і шрифтів.')}</p>
              </SettingsFieldNote>
            </div>
          </div>
        </section>

        <ThemeCustomizer
          key={customizerKey}
          initialColors={saved.colors}
          initialFont={saved.font}
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
              bannerImageUrl={imageSrc}
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
              advertorial={advertorial}
              albums={albums}
              albumsLoaded={albumsLoaded}
              albumMediaCounts={mediaCounts}
              preview
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
