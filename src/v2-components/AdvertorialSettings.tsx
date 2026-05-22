import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Button from '../components/Button';
import FileInput from '../components/FileInput';
import {
  getAdvertorialConfig,
  getAdvertorialUploadUrl,
  saveAdvertorialConfig,
  uploadAdvertorialImage,
} from '../client/advertorial';
import { AdvertorialCell, AdvertorialLayout } from '../types/advertorial';
import { parse_submit_event } from '../utils/form_event_parse';
import { t } from '../packages/i18n';
import '../v2-styles/AdvertorialSettings.css';

interface AdvertorialSettingsProps {
  packedUid: string;
}

interface StatusState {
  state: 'loading' | 'saving' | 'success' | 'error';
  message?: string;
}

const LAYOUT_OPTIONS: { labelKey: string; value: AdvertorialLayout }[] = [
  { labelKey: 'settings.advertorial.layouts.none', value: 'none' },
  { labelKey: 'settings.advertorial.layouts.single', value: 'single' },
  { labelKey: 'settings.advertorial.layouts.1x1', value: '1x1' },
  { labelKey: 'settings.advertorial.layouts.2x1', value: '2x1' },
  { labelKey: 'settings.advertorial.layouts.1x2', value: '1x2' },
  { labelKey: 'settings.advertorial.layouts.2x2', value: '2x2' },
];

const LAYOUT_CELL_COUNT: Record<AdvertorialLayout, number> = {
  none: 0,
  single: 1,
  '1x1': 1,
  '2x1': 2,
  '1x2': 2,
  '2x2': 4,
};

const LAYOUT_IMAGE_GUIDANCE_KEY: Record<AdvertorialLayout, string> = {
  none: 'settings.advertorial.imageGuidance.none',
  single: 'settings.advertorial.imageGuidance.single',
  '1x1': 'settings.advertorial.imageGuidance.1x1',
  '2x1': 'settings.advertorial.imageGuidance.2x1',
  '1x2': 'settings.advertorial.imageGuidance.1x2',
  '2x2': 'settings.advertorial.imageGuidance.2x2',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ADVERTORIAL_TEXT: Record<string, { en: string; uk: string }> = {
  'settings.advertorial.title': {
    en: 'Advertising Area',
    uk: 'Рекламний блок',
  },
  'settings.advertorial.description': {
    en: 'Choose a layout, upload ad images, and optionally add external links.',
    uk: 'Виберіть макет, завантажте рекламні зображення та за потреби додайте зовнішні посилання.',
  },
  'settings.advertorial.loading': {
    en: 'Loading advertising settings...',
    uk: 'Завантаження налаштувань реклами...',
  },
  'settings.advertorial.layoutLabel': {
    en: 'Layout',
    uk: 'Макет',
  },
  'settings.advertorial.layoutHint': {
    en: 'Select No advertising to hide the advertising area on the guest page.',
    uk: 'Виберіть Без реклами, щоб приховати рекламний блок на сторінці гостя.',
  },
  'settings.advertorial.imageGuidance.none': {
    en: 'No image is needed when advertising is hidden.',
    uk: 'Коли рекламний блок приховано, зображення не потрібне.',
  },
  'settings.advertorial.imageGuidance.single': {
    en: 'Upload 1 landscape image in 16:9 ratio, for example 1600x900 px.',
    uk: 'Завантажте 1 горизонтальне зображення у співвідношенні 16:9, наприклад 1600x900 px.',
  },
  'settings.advertorial.imageGuidance.1x1': {
    en: 'Upload 1 landscape image in 16:9 ratio, for example 1600x900 px.',
    uk: 'Завантажте 1 горизонтальне зображення у співвідношенні 16:9, наприклад 1600x900 px.',
  },
  'settings.advertorial.imageGuidance.2x1': {
    en: 'Upload 2 landscape images side by side. Each image should be 16:9, for example 1600x900 px.',
    uk: 'Завантажте 2 горизонтальні зображення поруч. Кожне має бути у співвідношенні 16:9, наприклад 1600x900 px.',
  },
  'settings.advertorial.imageGuidance.1x2': {
    en: 'Upload 2 landscape images stacked vertically. Each image should be 16:9, for example 1600x900 px.',
    uk: 'Завантажте 2 горизонтальні зображення одне під одним. Кожне має бути у співвідношенні 16:9, наприклад 1600x900 px.',
  },
  'settings.advertorial.imageGuidance.2x2': {
    en: 'Upload 4 landscape images in a 2x2 grid. Each image should be 16:9, for example 1600x900 px.',
    uk: 'Завантажте 4 горизонтальні зображення у сітці 2x2. Кожне має бути у співвідношенні 16:9, наприклад 1600x900 px.',
  },
  'settings.advertorial.uploadingImage': {
    en: 'Uploading image {{index}}...',
    uk: 'Завантаження зображення {{index}}...',
  },
  'settings.advertorial.imageUploaded': {
    en: 'Image uploaded.',
    uk: 'Зображення завантажено.',
  },
  'settings.advertorial.saved': {
    en: 'Advertising area saved.',
    uk: 'Рекламний блок збережено.',
  },
  'settings.advertorial.imageLabel': {
    en: 'Image {{index}}',
    uk: 'Зображення {{index}}',
  },
  'settings.advertorial.cellImageAlt': {
    en: 'Advertising cell {{index}}',
    uk: 'Рекламна комірка {{index}}',
  },
  'settings.advertorial.uploading': {
    en: 'Uploading...',
    uk: 'Завантаження...',
  },
  'settings.advertorial.uploadImage': {
    en: 'Upload image',
    uk: 'Завантажити зображення',
  },
  'settings.advertorial.changeImage': {
    en: 'Change image',
    uk: 'Змінити зображення',
  },
  'settings.advertorial.removeImage': {
    en: 'Remove',
    uk: 'Видалити',
  },
  'settings.advertorial.optionalLink': {
    en: 'Optional link',
    uk: "Необов'язкове посилання",
  },
  'settings.advertorial.linkPlaceholder': {
    en: 'https://example.com',
    uk: 'https://example.com',
  },
  'settings.advertorial.saveButton': {
    en: 'Save advertising area',
    uk: 'Зберегти рекламний блок',
  },
  'settings.advertorial.layouts.none': {
    en: 'No advertising',
    uk: 'Без реклами',
  },
  'settings.advertorial.layouts.single': {
    en: 'Single',
    uk: 'Один блок',
  },
  'settings.advertorial.layouts.1x1': {
    en: '1x1',
    uk: '1x1',
  },
  'settings.advertorial.layouts.2x1': {
    en: '2x1',
    uk: '2x1',
  },
  'settings.advertorial.layouts.1x2': {
    en: '1x2',
    uk: '1x2',
  },
  'settings.advertorial.layouts.2x2': {
    en: '2x2',
    uk: '2x2',
  },
  'settings.advertorial.errors.loadFailed': {
    en: 'Failed to load advertising settings.',
    uk: 'Не вдалося завантажити налаштування реклами.',
  },
  'settings.advertorial.errors.saveFailed': {
    en: 'Failed to save advertising area.',
    uk: 'Не вдалося зберегти рекламний блок.',
  },
  'settings.advertorial.errors.uploadFailed': {
    en: 'Image upload failed.',
    uk: 'Не вдалося завантажити зображення.',
  },
  'settings.advertorial.errors.invalidImageType': {
    en: 'Please upload a JPEG, PNG, or WEBP image.',
    uk: 'Будь ласка, завантажте зображення JPEG, PNG або WEBP.',
  },
  'settings.advertorial.errors.imageTooLarge': {
    en: 'Image must be smaller than 5MB.',
    uk: 'Зображення має бути менше 5 МБ.',
  },
  'settings.advertorial.errors.missingImages': {
    en: 'Please upload an image for every advertising cell.',
    uk: 'Будь ласка, завантажте зображення для кожної рекламної комірки.',
  },
};

// Ne: S3'teki dil dosyasi henuz yeni advertorial key'lerini tasimiyorsa lokal fallback metin dondurur.
// Nasil: Once i18n.t sonucu denenir; sonuc key'in kendisiyse en/uk fallback metni ve basit {{var}} interpolasyonu kullanilir.
// Neden: Deploy edilmemis ceviri JSON'u yuzunden kullaniciya settings.advertorial.* key'leri gorunmesin.
const advertorialText = (key: string, vars: Record<string, string | number> = {}): string => {
  const translated = t(key, vars);
  if (translated && translated !== key) return translated;

  const lang = t('lang_code') === 'uk' ? 'uk' : 'en';
  let fallback = ADVERTORIAL_TEXT[key]?.[lang] || key;
  Object.entries(vars).forEach(([name, value]) => {
    fallback = fallback.replaceAll(`{{${name}}}`, String(value));
  });
  return fallback;
};

// Ne: Layout'a gore cell listesini backend'in bekledigi index araligina indirger/genisletir.
// Nasil: Mevcut cell'leri index ile eslestirir, eksik index'ler icin bos image/link degeri uretir.
// Neden: Layout degistiginde UI ile PATCH payload'u ayni cell sayisi uzerinde kalsin.
const normalizeCellsForLayout = (
  layout: AdvertorialLayout,
  currentCells: AdvertorialCell[]
): AdvertorialCell[] => {
  const count = LAYOUT_CELL_COUNT[layout];
  if (count === 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const existing = currentCells.find((cell) => cell.index === index);
    return {
      index,
      image_url: existing?.image_url || '',
      link_url: existing?.link_url || '',
    };
  });
};

// Ne: Secilen reklam gorseli dosyasini frontend kurallariyla dogrular.
// Nasil: Backend sozlesmesindeki MIME whitelist ve 5MB limitini upload oncesi kontrol eder.
// Neden: Kullaniciya S3/endpoint hatasindan once hizli ve okunur bir hata mesaji gostermek.
const validateAdvertorialImage = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'settings.advertorial.errors.invalidImageType';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'settings.advertorial.errors.imageTooLarge';
  }
  return null;
};

function AdvertorialSettings({ packedUid }: AdvertorialSettingsProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [layout, setLayout] = useState<AdvertorialLayout>('none');
  const [cells, setCells] = useState<AdvertorialCell[]>([]);
  const [status, setStatus] = useState<StatusState>({ state: 'loading' });
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!packedUid) return;

    // Ne: Settings acilisinda backend advertorial config'ini yukler.
    // Nasil: enabled/config response'u okunur, layout state'i ve cell preview listesi hydrate edilir.
    // Neden: Event'in reklama hakki yoksa formu kilitlemek, hakki varsa son kayitli reklamlari gostermek.
    const loadConfig = async () => {
      setStatus({ state: 'loading' });
      try {
        const data = await getAdvertorialConfig(packedUid);
        const nextLayout = data.config?.layout || 'none';
        const nextCells = normalizeCellsForLayout(nextLayout, data.config?.cells || []);
        setEnabled(data.enabled);
        setLayout(nextLayout);
        setCells(nextCells);
        setFormKey((key) => key + 1);
        setStatus({ state: 'success' });
      } catch (err) {
        setEnabled(false);
        setStatus({ state: 'error', message: advertorialText('settings.advertorial.errors.loadFailed') });
      }
    };

    loadConfig();
  }, [packedUid]);

  const handleLayoutChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextLayout = e.target.value as AdvertorialLayout;
    setLayout(nextLayout);
    setCells((currentCells) => normalizeCellsForLayout(nextLayout, currentCells));
  };

  // Ne: Tek cell icin secilen gorseli upload eder ve preview URL'ini gunceller.
  // Nasil: Dosya dogrulanir, upload-url alinir, native PUT yapilir ve public_url cell state'ine yazilir.
  // Neden: Save aninda backend'e sadece backend'in urettigi S3 public_url gonderilsin.
  const handleImageFile = async (index: number, file: File) => {
    if (uploadingIndex !== null) return;

    const validationError = validateAdvertorialImage(file);
    if (validationError) {
      setStatus({ state: 'error', message: advertorialText(validationError) });
      return;
    }

    setUploadingIndex(index);
    setStatus({ state: 'saving', message: advertorialText('settings.advertorial.uploadingImage', { index: index + 1 }) });
    try {
      const uploadData = await getAdvertorialUploadUrl(packedUid, {
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      await uploadAdvertorialImage(uploadData.upload_url, file, uploadData.required_headers);
      setCells((currentCells) => currentCells.map((cell) => (
        cell.index === index ? { ...cell, image_url: uploadData.public_url } : cell
      )));
      const uploadedMessage = advertorialText('settings.advertorial.imageUploaded');
      setStatus({ state: 'success', message: uploadedMessage });
      setTimeout(() => setStatus((prev) => prev.message === uploadedMessage ? { state: 'success' } : prev), 2500);
    } catch (err) {
      setStatus({ state: 'error', message: advertorialText('settings.advertorial.errors.uploadFailed') });
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveImage = (index: number) => {
    setCells((currentCells) => currentCells.map((cell) => (
      cell.index === index ? { ...cell, image_url: '' } : cell
    )));
  };

  // Ne: Reklam ayar formunu backend'e kaydeder.
  // Nasil: Uncontrolled formdan layout/link_url degerlerini okur, image_url'leri upload state'inden alir ve PATCH payload'u kurar.
  // Neden: Ayrica aktif/pasif toggle tutmadan "no advertising" secimini layout=none olarak kalici hale getirmek.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    const form = parse_submit_event(e);
    const selectedLayout = (form.layout || 'none') as AdvertorialLayout;

    const nextCells = selectedLayout === 'none'
      ? []
      : normalizeCellsForLayout(selectedLayout, cells).map((cell) => ({
          ...cell,
          link_url: String(form[`link_url_${cell.index}`] || '').trim(),
        }));

    if (selectedLayout !== 'none' && nextCells.some((cell) => !cell.image_url)) {
      setStatus({ state: 'error', message: advertorialText('settings.advertorial.errors.missingImages') });
      return;
    }

    setStatus({ state: 'saving' });
    try {
      const saved = await saveAdvertorialConfig(packedUid, {
        layout: selectedLayout,
        cells: nextCells,
      });
      const nextLayout = saved.config?.layout || selectedLayout;
      setLayout(nextLayout);
      setCells(normalizeCellsForLayout(nextLayout, saved.config?.cells || nextCells));
      setFormKey((key) => key + 1);
      const savedMessage = advertorialText('settings.advertorial.saved');
      setStatus({ state: 'success', message: savedMessage });
      setTimeout(() => setStatus((prev) => prev.message === savedMessage ? { state: 'success' } : prev), 3000);
    } catch (err) {
      setStatus({ state: 'error', message: advertorialText('settings.advertorial.errors.saveFailed') });
    }
  };

  if (status.state === 'loading') {
    return (
      <section className="settings-section advertorial-settings">
        <div className="settings-section-header">
          <h2 className="settings-section-title">{advertorialText('settings.advertorial.title')}</h2>
          <p className="settings-section-description">{advertorialText('settings.advertorial.loading')}</p>
        </div>
      </section>
    );
  }

  if (!enabled) {
    return null;
  }

  return (
    <form key={formKey} className="settings-section advertorial-settings" onSubmit={handleSubmit}>
      <div className="settings-section-header">
        <h2 className="settings-section-title">{advertorialText('settings.advertorial.title')}</h2>
        <p className="settings-section-description">
          {advertorialText('settings.advertorial.description')}
        </p>
      </div>

      <div className="settings-field advertorial-layout-field">
        <label className="settings-field-label">{advertorialText('settings.advertorial.layoutLabel')}</label>
        <select
          name="layout"
          className="settings-field-input"
          defaultValue={layout}
          onChange={handleLayoutChange}
        >
          {LAYOUT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{advertorialText(option.labelKey)}</option>
          ))}
        </select>
        <p className="settings-field-hint">{advertorialText('settings.advertorial.layoutHint')}</p>
        <p className="advertorial-image-guidance">{advertorialText(LAYOUT_IMAGE_GUIDANCE_KEY[layout])}</p>
      </div>

      {layout !== 'none' && (
        <div className={`advertorial-cell-list advertorial-cell-list-${layout}`}>
          {cells.map((cell) => (
            <div key={cell.index} className="advertorial-cell-card">
              <div className="advertorial-cell-preview">
                {cell.image_url ? (
                  <img src={cell.image_url} alt={advertorialText('settings.advertorial.cellImageAlt', { index: cell.index + 1 })} />
                ) : (
                  <div className="advertorial-cell-placeholder">
                    <i className="fa-regular fa-image" />
                    <span>{advertorialText('settings.advertorial.imageLabel', { index: cell.index + 1 })}</span>
                  </div>
                )}
              </div>

              <div className="advertorial-cell-actions">
                <FileInput
                  onFile={(file) => handleImageFile(cell.index, file)}
                  mimeTypes={ALLOWED_IMAGE_TYPES}
                >
                  <button type="button" className="advertorial-upload-btn" disabled={uploadingIndex !== null}>
                    {uploadingIndex === cell.index
                      ? advertorialText('settings.advertorial.uploading')
                      : cell.image_url
                        ? advertorialText('settings.advertorial.changeImage')
                        : advertorialText('settings.advertorial.uploadImage')}
                  </button>
                </FileInput>
                {cell.image_url && (
                  <button type="button" className="advertorial-remove-btn" onClick={() => handleRemoveImage(cell.index)}>
                    {advertorialText('settings.advertorial.removeImage')}
                  </button>
                )}
              </div>

              <label className="settings-field advertorial-link-field">
                <span className="settings-field-label">{advertorialText('settings.advertorial.optionalLink')}</span>
                <input
                  type="url"
                  name={`link_url_${cell.index}`}
                  className="settings-field-input"
                  defaultValue={cell.link_url || ''}
                  placeholder={advertorialText('settings.advertorial.linkPlaceholder')}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="advertorial-form-footer">
        <Button text={advertorialText('settings.advertorial.saveButton')} type="submit" loading={status.state === 'saving' && uploadingIndex === null} />
        {status.state === 'success' && status.message && (
          <span className="advertorial-status advertorial-status-success">✓ {status.message}</span>
        )}
        {status.state === 'error' && (
          <span className="advertorial-status advertorial-status-error">✗ {status.message}</span>
        )}
        {status.state === 'saving' && status.message && (
          <span className="advertorial-status">{status.message}</span>
        )}
      </div>
    </form>
  );
}

export default AdvertorialSettings;
