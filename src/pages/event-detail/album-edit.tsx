import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import SettingsFieldNote from '../../v2-components/SettingsFieldNote';
import FileInput from '../../components/FileInput';
import Button from '../../components/Button';
import { Event } from '../../types/events';
import { Album, AlbumInput, AlbumPrivacy, albumCoverUrl } from '../../types/albums';
import { adjustAlbumQR, createAlbum, getAlbum, updateAlbum } from '../../client/albums';
import { uploadAlbumCover } from '../../client/uploads';
import { unpackUUID } from '../../packages/uuid';
import { parse_submit_event } from '../../utils/form_event_parse';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import '../../v2-styles/Settings.css';
import '../../v2-styles/Albums.css';

// Ne: Album olusturma/duzenleme formu. Route: /event/:uid/albums/new | /event/:uid/albums/<packedAlbum>.
// Nasil: Alanlar uncontrolled (proje kurali), submit'te parse_submit_event. Tarih alani
//        parser'in disinda (name yok) cunku parser bos tarihte toISOString ile patliyor.
//        Kapak: dosya yukle (/api/upload/album_cover) ya da galeriden "kapak yap".
// Neden: GENERAL + PRIVACY alanlari musterinin listesindeki gibi tek ekranda.

const PASSCODE_MIN = 4;
const PASSCODE_MAX = 8;

const SettingsToggle = ({ name, description, checked, formName }: { name: string; description: string; checked: boolean; formName: string }) => (
  <div className="settings-toggle-item">
    <div className="settings-toggle-content">
      <h3 className="settings-toggle-title">{name}</h3>
      <p className="settings-toggle-description">{description}</p>
    </div>
    <label className="settings-toggle-switch">
      <input type="checkbox" name={formName} defaultChecked={checked} />
      <span className="settings-toggle-slider"></span>
    </label>
  </div>
);

function EventAlbumEdit() {
  return (
    <EventDetailLayout>
      {(event) => <EventAlbumEditInner event={event} />}
    </EventDetailLayout>
  );
}

function EventAlbumEditInner({ event }: { event: Event }) {
  const { uid: packedUid, albumUid: packedAlbumUid } = useParams<{ uid: string; albumUid: string }>();
  const navigate = useNavigate();
  const isNew = !packedAlbumUid || packedAlbumUid === 'new';
  const albumUid = isNew ? '' : unpackUUID(packedAlbumUid || '');

  const [album, setAlbum] = useState<Album | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [privacy, setPrivacy] = useState<AlbumPrivacy>('public');
  const [cover, setCover] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    if (!albumUid) { navigate(`/event/${packedUid}/albums`); return; }
    getAlbum(albumUid).then((found) => {
      if (!found || found.event_uid !== event.uid) {
        navigate(`/event/${packedUid}/albums`);
        return;
      }
      setAlbum(found);
      setPrivacy(found.privacy);
      setCover(found.cover);
      setLoaded(true);
    }).catch(() => navigate(`/event/${packedUid}/albums`));
  }, [albumUid, event.uid, isNew, navigate, packedUid]);

  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);

  const handleCoverFile = async (file: File) => {
    setCoverUploading(true);
    setError('');
    try {
      const preview = URL.createObjectURL(file);
      setCoverPreview(preview);
      const [path] = await uploadAlbumCover(file);
      setCover(path);
    } catch (e) {
      console.error('[album-edit] cover upload failed', e);
      setCoverPreview(null);
      setError(textOr('albums.form.saveFailed', 'Could not save the album', 'Не вдалося зберегти альбом'));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    const form = parse_submit_event(e);
    setError('');
    setSuccess(false);

    const name = String(form.name || '').trim();
    if (!name) {
      setError(textOr('albums.form.nameRequired', 'Please enter an album name.', 'Введіть назву альбому.'));
      return;
    }
    const passcodeRaw = String(form.passcode || '').trim();
    if (privacy === 'protected') {
      if (!passcodeRaw) {
        setError(textOr('albums.form.passcodeRequired', 'Protected albums need a passcode.', 'Для альбому з паролем потрібен пароль.'));
        return;
      }
      if (passcodeRaw.length < PASSCODE_MIN || passcodeRaw.length > PASSCODE_MAX) {
        setError(textOr('albums.form.passcodeTooShort', 'Passcode must be 4–8 characters.', 'Пароль має містити 4–8 символів.'));
        return;
      }
    }

    const dateValue = dateRef.current?.value || '';
    const input: AlbumInput = {
      name,
      album_date: dateValue ? dateValue.slice(0, 10) : null,
      location: String(form.location || '').trim() || null,
      description: String(form.description || '').trim() || null,
      cover,
      privacy,
      passcode: privacy === 'protected' ? passcodeRaw : null,
      guest_upload: !!form.guest_upload,
      guest_view: !!form.guest_view,
      guest_download_all: !!form.guest_download_all,
    };

    setSaving(true);
    try {
      if (isNew) {
        const created = await createAlbum(event.uid, input);
        // Varsayilan QR hemen uretilsin ki paylasim modali bos gelmesin; hata sayfayi durdurmaz.
        adjustAlbumQR(event.uid, created.uid).catch(() => {});
        navigate(`/event/${packedUid}/albums`);
        return;
      }
      const updated = await updateAlbum(albumUid, input);
      setAlbum(updated);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[album-edit] save failed', err);
      setError((err as Error)?.message || textOr('albums.form.saveFailed', 'Could not save the album', 'Не вдалося зберегти альбом'));
    } finally {
      setSaving(false);
    }
  };

  const title = isNew
    ? textOr('albums.form.createTitle', 'New album', 'Новий альбом')
    : textOr('albums.form.editTitle', 'Edit album', 'Редагувати альбом');

  if (!loaded) {
    return (
      <AdminPageHeader
        breadcrumbs={[
          { label: t('common.events'), to: '/events' },
          { label: event.name || t('common.event'), to: `/event/${packedUid}` },
          { label: textOr('albums.breadcrumb', 'Albums', 'Альбоми'), to: `/event/${packedUid}/albums` },
          { label: title },
        ]}
        title={title}
      />
    );
  }

  const coverSrc = coverPreview || (cover ? albumCoverUrl({ cover }) : null);
  const guestGalleryOn = !!event.settings?.guest_gallery;

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: t('common.events'), to: '/events' },
          { label: event.name || t('common.event'), to: `/event/${packedUid}` },
          { label: textOr('albums.breadcrumb', 'Albums', 'Альбоми'), to: `/event/${packedUid}/albums` },
          { label: album?.name || title },
        ]}
        title={title}
      />

      <form className="settings-main-content" onSubmit={handleSubmit} key={album?.uid || 'new'}>
        {album?.is_default && (
          <div className="album-form-default-note">
            <i className="fa-solid fa-star" />
            <span>{textOr('albums.form.defaultNote', 'This is the default album. Uploads without an album go here, and it cannot be deleted.', 'Це альбом за замовчуванням. Завантаження без альбому потрапляють сюди, його не можна видалити.')}</span>
          </div>
        )}

        {/* GENERAL */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">{textOr('albums.form.general', 'General', 'Загальне')}</h2>
            <p className="settings-section-description">{textOr('albums.form.generalDesc', 'What guests see when they open this album.', 'Що бачать гості, коли відкривають цей альбом.')}</p>
          </div>
          <div className="settings-form-grid">
            <div className="settings-field full-width">
              <label className="settings-field-label">{textOr('albums.form.nameLabel', 'Album name', 'Назва альбому')}</label>
              <input
                type="text"
                name="name"
                className="settings-field-input"
                defaultValue={album?.name || ''}
                placeholder={textOr('albums.form.namePlaceholder', 'Ceremony, Reception, Party…', 'Церемонія, Банкет, Вечірка…')}
                maxLength={120}
                required
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">{textOr('albums.form.dateLabel', 'Album date', 'Дата альбому')}</label>
              <input
                ref={dateRef}
                type="date"
                className="settings-field-input"
                defaultValue={album?.album_date?.slice(0, 10) || ''}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">{textOr('albums.form.locationLabel', 'Location', 'Місце')}</label>
              <input
                type="text"
                name="location"
                className="settings-field-input"
                defaultValue={album?.location || ''}
                placeholder={textOr('albums.form.locationPlaceholder', 'Venue or city', 'Локація або місто')}
                maxLength={255}
              />
            </div>
            <div className="settings-field full-width">
              <label className="settings-field-label">{textOr('albums.form.descriptionLabel', 'Description', 'Опис')}</label>
              <textarea
                name="description"
                className="settings-field-input"
                defaultValue={album?.description || ''}
                placeholder={textOr('albums.form.descriptionPlaceholder', 'Share your best photos from the dance floor!', 'Поділіться найкращими фото з танцполу!')}
                rows={3}
              />
            </div>
            <div className="settings-field full-width">
              <label className="settings-field-label">{textOr('albums.form.coverLabel', 'Album cover', 'Обкладинка альбому')}</label>
              <div className="album-cover-field">
                <div className="album-cover-preview">
                  {coverSrc ? <img src={coverSrc} alt="" /> : <i className="fa-regular fa-images" />}
                </div>
                <div className="album-cover-actions">
                  <FileInput onFile={handleCoverFile} mimeTypes={['image/png', 'image/jpeg', 'image/webp']} multiple={false}>
                    <Button
                      type="button"
                      variant="secondary"
                      icon="fa-solid fa-upload"
                      loading={coverUploading}
                      text={cover ? textOr('albums.form.coverChange', 'Change cover', 'Змінити обкладинку') : textOr('albums.form.coverUpload', 'Upload cover', 'Завантажити обкладинку')}
                    />
                  </FileInput>
                  {cover && (
                    <Button
                      type="button"
                      variant="secondary"
                      icon="fa-solid fa-xmark"
                      text={textOr('albums.form.coverRemove', 'Remove cover', 'Прибрати обкладинку')}
                      onClick={() => { setCover(null); setCoverPreview(null); }}
                    />
                  )}
                  <SettingsFieldNote>
                    <p>{textOr('albums.form.coverHint', 'JPG or PNG. You can also open the gallery and use “Set as album cover” on any photo.', 'JPG або PNG. Також можна відкрити галерею й обрати «Зробити обкладинкою альбому» для будь-якого фото.')}</p>
                  </SettingsFieldNote>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRIVACY */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">{textOr('albums.form.privacy', 'Privacy', 'Конфіденційність')}</h2>
            <p className="settings-section-description">{textOr('albums.form.privacyDesc', 'Decide who can open this album.', 'Вирішіть, хто може відкрити цей альбом.')}</p>
          </div>
          <div className="settings-radio-list">
            {([
              { value: 'public', icon: 'fa-solid fa-globe', title: textOr('albums.privacyPublic', 'Public', 'Публічний'), desc: textOr('albums.form.privacyPublicDesc', 'Listed on the event page. Available via the main QR code or the album’s own link.', 'Відображається на сторінці події. Доступний через основний QR-код або власне посилання альбому.') },
              { value: 'private', icon: 'fa-solid fa-link', title: textOr('albums.privacyPrivate', 'Private', 'Приватний'), desc: textOr('albums.form.privacyPrivateDesc', 'Not listed on the event page. Only guests with this album’s link or QR code can open it.', 'Не відображається на сторінці події. Відкрити можуть лише гості з посиланням або QR-кодом цього альбому.') },
              { value: 'protected', icon: 'fa-solid fa-lock', title: textOr('albums.privacyProtected', 'Protected', 'З паролем'), desc: textOr('albums.form.privacyProtectedDesc', 'Only guests who enter the passcode can open it.', 'Відкрити можуть лише гості, які введуть пароль.') },
            ] as { value: AlbumPrivacy; icon: string; title: string; desc: string }[]).map((opt) => (
              <label className="settings-radio-card" key={opt.value}>
                <input
                  type="radio"
                  name="privacy"
                  value={opt.value}
                  checked={privacy === opt.value}
                  onChange={() => setPrivacy(opt.value)}
                />
                <div className="settings-radio-card-content">
                  <span className="settings-radio-card-icon bolt"><i className={opt.icon} /></span>
                  <div className="settings-radio-card-text">
                    <h4 className="settings-radio-card-title">{opt.title}</h4>
                    <p className="settings-radio-card-description">{opt.desc}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
          {privacy === 'protected' && (
            <div className="settings-form-grid" style={{ marginTop: 24 }}>
              <div className="settings-field">
                <label className="settings-field-label">{textOr('albums.form.passcodeLabel', 'Passcode', 'Пароль')}</label>
                <input
                  type="text"
                  name="passcode"
                  className="settings-field-input"
                  defaultValue={album?.passcode || ''}
                  placeholder={textOr('albums.form.passcodePlaceholder', '4–8 characters', '4–8 символів')}
                  minLength={PASSCODE_MIN}
                  maxLength={PASSCODE_MAX}
                  autoComplete="off"
                />
                <SettingsFieldNote>
                  <p>{textOr('albums.form.passcodeHint', 'Shown here in plain text so you can share it with your guests.', 'Показано відкритим текстом, щоб ви могли поділитися ним із гостями.')}</p>
                </SettingsFieldNote>
              </div>
            </div>
          )}
        </section>

        {/* GUEST ACCESS */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">{textOr('albums.form.guestAccess', 'Guest access', 'Доступ гостей')}</h2>
            <p className="settings-section-description">{textOr('albums.form.guestAccessDesc', 'What guests can do in this album.', 'Що гості можуть робити в цьому альбомі.')}</p>
          </div>
          <div className="settings-toggle-list">
            <SettingsToggle
              name={textOr('albums.form.guestUpload', 'Guest uploads', 'Завантаження гостей')}
              description={textOr('albums.form.guestUploadDesc', 'Guests can add photos and videos. When off, the album is hidden from guests entirely.', 'Гості можуть додавати фото та відео. Якщо вимкнено, альбом повністю прихований від гостей.')}
              checked={album ? album.guest_upload : true}
              formName="guest_upload"
            />
            <SettingsToggle
              name={textOr('albums.form.guestView', 'Guests can view this album', 'Гості можуть переглядати цей альбом')}
              description={textOr('albums.form.guestViewDesc', 'Guests see the photos and videos in this album. Also needs “Guests can view the gallery” in Settings.', 'Гості бачать фото та відео в цьому альбомі. Також потрібно увімкнути «Гості можуть переглядати галерею» у налаштуваннях.')}
              checked={album ? album.guest_view : true}
              formName="guest_view"
            />
            <SettingsToggle
              name={textOr('albums.form.guestDownloadAll', 'Guests can download the whole album', 'Гості можуть завантажити весь альбом')}
              description={textOr('albums.form.guestDownloadAllDesc', 'Shows a “Download all” button on the guest album page.', 'Показує кнопку «Завантажити все» на сторінці альбому для гостей.')}
              checked={album ? album.guest_download_all : false}
              formName="guest_download_all"
            />
          </div>
          {!guestGalleryOn && (
            <div className="albums-notice" style={{ marginTop: 20, marginBottom: 0 }}>
              <i className="fa-solid fa-eye-slash" />
              <span>{textOr('albums.galleryOffNotice', 'Guest viewing is off for the whole event. Guests can upload but not see the albums’ photos.', 'Перегляд для гостей вимкнено для всієї події. Гості можуть завантажувати, але не бачать фото в альбомах.')}</span>
            </div>
          )}
        </section>

        <div className="album-form-footer">
          <Button
            type="submit"
            icon={isNew ? 'fa-solid fa-plus' : 'fa-solid fa-check'}
            text={isNew ? textOr('albums.form.create', 'Create album', 'Створити альбом') : textOr('albums.form.save', 'Save album', 'Зберегти альбом')}
            loading={saving || coverUploading}
          />
          <Button
            type="button"
            variant="secondary"
            text={textOr('albums.form.cancel', 'Cancel', 'Скасувати')}
            onClick={() => navigate(`/event/${packedUid}/albums`)}
          />
          {success && <span className="album-form-success">✓ {textOr('albums.form.saved', 'Album saved', 'Альбом збережено')}</span>}
          {error && <span className="album-form-error">✗ {error}</span>}
        </div>
      </form>
    </>
  );
}

export default EventAlbumEdit;
