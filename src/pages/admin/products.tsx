import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAddonUploadUrl,
  getAdminProducts,
  removeAddonImage,
  removeAddonMobileImage,
  setAddonEnabled,
  setAddonImage,
  setAddonMobileImage,
  updateAdminProduct,
  uploadFileToS3,
  validateAddonImageFile,
} from '../../client/admin-products';
import { AdminProduct, UpdateAdminProductPayload } from '../../types/admin-products';
import { t } from '../../packages/i18n';
import { FEATURE_VOICE } from '../../utils/features';
import { adminText } from '../../utils/admin_i18n';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminProducts.css';

const PREMIUM_PACKAGE_ID = 'premium';
const at = adminText;

const isVoiceIncluded = (product: AdminProduct) => {
  return product.voice_included === true
    || (product.voice_included === undefined && Array.isArray(product.granted_features) && product.granted_features.includes(FEATURE_VOICE));
};

function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savingByUid, setSavingByUid] = useState<Record<string, boolean>>({});
  const [resultByUid, setResultByUid] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [imageUploadingByUid, setImageUploadingByUid] = useState<Record<string, boolean>>({});
  const [imageResultByUid, setImageResultByUid] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [enabledTogglingByUid, setEnabledTogglingByUid] = useState<Record<string, boolean>>({});
  const [enabledResultByUid, setEnabledResultByUid] = useState<Record<string, { ok: boolean; message: string }>>({});
  const currentLang = String(t('lang_code') || 'en');

  useEffect(() => {
    getAdminProducts()
      .then((data) => setProducts(data || []))
      .catch((err: Error) => {
        const msg = err?.message || '';
        if (msg.includes('Access denied') || msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
          setDenied(true);
          return;
        }
        setErrorMessage(msg || at('admin.products.errors.load', 'Failed to load products.', 'Не вдалося завантажити продукти.'));
      })
      .finally(() => setLoading(false));
  }, []);

  const packageProducts = products.filter((p) => !p.is_add_on);
  const addOnProducts = products.filter((p) => p.is_add_on);

  const readNumber = (value: FormDataEntryValue | null): number | null => {
    if (typeof value !== 'string') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Ne: Admin kartinda aktif dile gore gorunen isim/aciklama degerini secer.
  // Nasil: Dil kodu 'uk' ise once UK alanini, diger durumlarda EN alanini dener; bos ise karsi dil fallback'ine gecer.
  // Neden: Admin, guncelledigi display_* alanlarini kendi aktif dilinde dogrudan dogrulayabilsin.
  const resolveLocalizedField = (enValue?: string, ukValue?: string) => {
    if (currentLang === 'uk') {
      return ukValue || enValue || '';
    }
    return enValue || ukValue || '';
  };

  const renderName = (product: AdminProduct) => {
    return resolveLocalizedField(product.display_name_en, product.display_name_uk) || product.id;
  };

  const renderDescription = (product: AdminProduct) => {
    return resolveLocalizedField(product.display_description_en, product.display_description_uk);
  };

  // Ne: Formdan gelen degerleri backend kontratina uygun payload'a donusturup dogrular.
  // Nasil: Uncontrolled inputlardan FormData ile okur; paketlerde display_description ve display_bullets alanlarini da payload'a ekler.
  // Neden: product_id degismeden admin/products ekraninda isim/aciklama/bullet ve limit alanlari guvenli sekilde guncellensin.
  const buildPayload = (formData: FormData, product: AdminProduct): { payload?: UpdateAdminProductPayload; errors: string[] } => {
    const errors: string[] = [];
    const price = readNumber(formData.get('price'));
    const displayNameEn = (formData.get('display_name_en') || '').toString().trim();
    const displayNameUk = (formData.get('display_name_uk') || '').toString().trim();
    const displayDescriptionEn = (formData.get('display_description_en') || '').toString().trim();
    const displayDescriptionUk = (formData.get('display_description_uk') || '').toString().trim();

    if (price === null || price < 0) {
      errors.push(at('admin.products.errors.priceMin', 'Price must be greater than or equal to 0.', 'Ціна має бути більшою або дорівнювати 0.'));
    }

    const basePayload: UpdateAdminProductPayload = {
      ...(displayNameEn ? { display_name_en: displayNameEn } : {}),
      ...(displayNameUk ? { display_name_uk: displayNameUk } : {}),
      ...(displayDescriptionEn ? { display_description_en: displayDescriptionEn } : {}),
      ...(displayDescriptionUk ? { display_description_uk: displayDescriptionUk } : {}),
      price: price ?? undefined,
    };

    if (product.is_add_on) {
      return { payload: errors.length ? undefined : basePayload, errors };
    }

    const displayBulletsEn = (formData.get('display_bullets_en') || '').toString().trim();
    const displayBulletsUk = (formData.get('display_bullets_uk') || '').toString().trim();
    const guestCount = readNumber(formData.get('guest_count'));
    const mediaCount = readNumber(formData.get('media_count'));
    const activationPeriod = readNumber(formData.get('activation_period_days'));
    const storagePeriod = readNumber(formData.get('storage_period_days'));
    const voiceIncluded = formData.get('voice_included') === 'on';
    const sponsoredIncluded = formData.get('sponsored_included') === 'on';

    if (guestCount === null || guestCount < -1) errors.push(at('admin.products.errors.guestMin', 'Guest count must be greater than or equal to -1.', 'Кількість гостей має бути більшою або дорівнювати -1.'));
    if (mediaCount === null || mediaCount < -1) errors.push(at('admin.products.errors.mediaMin', 'Media count must be greater than or equal to -1.', 'Кількість фото/відео має бути більшою або дорівнювати -1.'));
    if (activationPeriod === null || activationPeriod <= 0) errors.push(at('admin.products.errors.activationPositive', 'Activation period must be greater than 0.', 'Період активації має бути більше 0.'));
    if (storagePeriod === null || storagePeriod <= 0) errors.push(at('admin.products.errors.storagePositive', 'Storage period must be greater than 0.', 'Період зберігання має бути більше 0.'));

    return {
      payload: errors.length
        ? undefined
        : {
            ...basePayload,
            ...(displayDescriptionEn ? { display_description_en: displayDescriptionEn } : {}),
            ...(displayDescriptionUk ? { display_description_uk: displayDescriptionUk } : {}),
            ...(displayBulletsEn ? { display_bullets_en: displayBulletsEn } : {}),
            ...(displayBulletsUk ? { display_bullets_uk: displayBulletsUk } : {}),
            guest_count: guestCount ?? undefined,
            media_count: mediaCount ?? undefined,
            activation_period_days: activationPeriod ?? undefined,
            storage_period_days: storagePeriod ?? undefined,
            voice_included: voiceIncluded,
            ...(product.id === PREMIUM_PACKAGE_ID ? { sponsored_included: sponsoredIncluded } : {}),
          },
      errors,
    };
  };

  // Ne: Tek urun formunu kaydeder ve kart bazli sonuc mesaji gosterir.
  // Nasil: Payload olusturup PATCH atar, basariyla donerse sadece ilgili urunu local state'te gunceller.
  // Neden: Admin ayni ekranda birden cok urunu bagimsiz duzenleyebilsin ve geribildirim net olsun.
  const onSubmitProduct = async (event: React.FormEvent<HTMLFormElement>, product: AdminProduct) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const { payload, errors } = buildPayload(formData, product);

    if (errors.length || !payload) {
      setResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message: errors[0] || at('admin.products.errors.validation', 'Validation failed.', 'Перевірка не пройдена.') } }));
      return;
    }

    setSavingByUid((prev) => ({ ...prev, [product.uid]: true }));
    setResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: at('admin.common.saving', 'Saving...', 'Збереження...') } }));
    try {
      const updated = await updateAdminProduct(product.uid, payload);
      setProducts((prev) => prev.map((x) => (x.uid === product.uid ? updated : x)));
      setResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: at('admin.products.saved', 'Saved successfully.', 'Успішно збережено.') } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : at('admin.products.errors.save', 'Failed to save product.', 'Не вдалося зберегти продукт.');
      setResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message } }));
    } finally {
      setSavingByUid((prev) => ({ ...prev, [product.uid]: false }));
    }
  };

  const renderResult = (uid: string) => {
    const res = resultByUid[uid];
    if (!res) return null;
    return <span className={res.ok ? 'admin-product-save-ok' : 'admin-product-save-error'}>{res.message}</span>;
  };

  // Ne: Add-on icin secilen desktop veya mobil gorseli S3'e yukleyip ilgili options alanini gunceller.
  // Nasil: Once dosyayi validate eder; sonra upload-url alir, S3'e PUT eder ve target'a gore image/mobile_image PATCH atar.
  // Neden: Desktop gorsel davranisi bozulmadan mobilde farkli gorsel yonetimi ayni upload zincirini kullanabilsin.
  const onAddonImageSelect = async (product: AdminProduct, file: File | undefined | null, target: 'desktop' | 'mobile' = 'desktop') => {
    if (!file) return;
    setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: '' } }));

    const validationError = validateAddonImageFile(file);
    if (validationError) {
      setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message: validationError } }));
      return;
    }

    setImageUploadingByUid((prev) => ({ ...prev, [product.uid]: true }));
    setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: at('admin.products.uploading', 'Uploading...', 'Завантаження...') } }));
    try {
      const presign = await getAddonUploadUrl({
        product_uid: product.uid,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      await uploadFileToS3(presign.upload_url, file, presign.required_headers || { 'Content-Type': file.type });
      const updated = target === 'mobile'
        ? await setAddonMobileImage(product.uid, presign.public_url)
        : await setAddonImage(product.uid, presign.public_url);
      setProducts((prev) => prev.map((x) => (x.uid === product.uid ? updated : x)));
      setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: target === 'mobile' ? at('admin.products.mobileImageUpdated', 'Mobile image updated.', 'Мобільне зображення оновлено.') : at('admin.products.imageUpdated', 'Image updated.', 'Зображення оновлено.') } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : at('admin.products.errors.imageUpload', 'Image upload failed.', 'Не вдалося завантажити зображення.');
      setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message } }));
    } finally {
      setImageUploadingByUid((prev) => ({ ...prev, [product.uid]: false }));
    }
  };

  // Ne: Add-on urununun desktop veya mobil gorselini kaldirir.
  // Nasil: Target'a gore options.image ya da options.mobile_image alanina bos string PATCH eder.
  // Neden: Mobil gorsel temizlenince public tarafta desktop image fallback'i calissin, desktop remove davranisi ise aynen korunsun.
  const onAddonImageRemove = async (product: AdminProduct, target: 'desktop' | 'mobile' = 'desktop') => {
    setImageUploadingByUid((prev) => ({ ...prev, [product.uid]: true }));
    setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: target === 'mobile' ? at('admin.products.removingMobileImage', 'Removing mobile image...', 'Видалення мобільного зображення...') : at('admin.common.remove', 'Remove', 'Прибрати') + '...' } }));
    try {
      const updated = target === 'mobile'
        ? await removeAddonMobileImage(product.uid)
        : await removeAddonImage(product.uid);
      setProducts((prev) => prev.map((x) => (x.uid === product.uid ? updated : x)));
      setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: target === 'mobile' ? at('admin.products.mobileImageRemoved', 'Mobile image removed.', 'Мобільне зображення видалено.') : at('admin.products.imageRemoved', 'Image removed.', 'Зображення видалено.') } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : at('admin.products.errors.removeImage', 'Failed to remove image.', 'Не вдалося видалити зображення.');
      setImageResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message } }));
    } finally {
      setImageUploadingByUid((prev) => ({ ...prev, [product.uid]: false }));
    }
  };

  // Ne: Add-on urununun is_enabled bayragini optimistic UI ile guncelleyip backend cevabina gore dogrular.
  // Nasil: Once lokal state'i nextEnabled ile flipler; PATCH /api/admin/products/:uid'a sadece { is_enabled } gonderir; response is_enabled tasimazsa nextEnabled'i koruyup backend onayini bekler, fail olursa eski degere geri alir.
  // Neden: Admin tek tikta gorsel donus alsin; backend response'unda alani tasimasa bile kullanici takipte kalmasin, hata olursa state guvenle restore edilsin.
  const onToggleAddonEnabled = async (product: AdminProduct, nextEnabled: boolean) => {
    if (enabledTogglingByUid[product.uid]) return;
    const previousEnabled = product.is_enabled;

    setProducts((prev) => prev.map((x) => (x.uid === product.uid ? { ...x, is_enabled: nextEnabled } : x)));
    setEnabledTogglingByUid((prev) => ({ ...prev, [product.uid]: true }));
    setEnabledResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: nextEnabled ? at('admin.products.enabling', 'Enabling...', 'Активація...') : at('admin.products.disabling', 'Disabling...', 'Деактивація...') } }));

    try {
      const updated = await setAddonEnabled(product.uid, nextEnabled);
      setProducts((prev) => prev.map((x) => {
        if (x.uid !== product.uid) return x;
        const backendEnabled = typeof updated.is_enabled === 'boolean' ? updated.is_enabled : nextEnabled;
        return { ...updated, is_enabled: backendEnabled };
      }));
      setEnabledResultByUid((prev) => ({ ...prev, [product.uid]: { ok: true, message: nextEnabled ? at('admin.products.enabled', 'Enabled.', 'Активовано.') : at('admin.products.disabled', 'Disabled.', 'Деактивовано.') } }));
    } catch (err) {
      setProducts((prev) => prev.map((x) => (x.uid === product.uid ? { ...x, is_enabled: previousEnabled } : x)));
      const message = err instanceof Error ? err.message : at('admin.products.errors.status', 'Failed to update status.', 'Не вдалося оновити статус.');
      setEnabledResultByUid((prev) => ({ ...prev, [product.uid]: { ok: false, message } }));
    } finally {
      setEnabledTogglingByUid((prev) => ({ ...prev, [product.uid]: false }));
    }
  };

  // Ne: Add-on kartinin ust kismina aktif/pasif toggle anahtari render eder.
  // Nasil: Native checkbox uzerine custom CSS slider sarar; tiklamada onToggleAddonEnabled cagirilir, durum etiketi yanindaki rozet ile senkron tutulur.
  // Neden: Admin tek tikla add-on'u acip kapatabilsin; toggle yalnizca add-on satirlarinda gorunsun cunku core paket icin backend 422 doner.
  const renderAddonEnabledToggle = (product: AdminProduct) => {
    const toggling = Boolean(enabledTogglingByUid[product.uid]);
    const result = enabledResultByUid[product.uid];
    return (
      <div className="admin-addon-enabled-block">
        <div className="admin-addon-enabled-row">
          <span className={`admin-addon-status-pill${product.is_enabled ? ' admin-addon-status-pill-on' : ' admin-addon-status-pill-off'}`}>
            {product.is_enabled ? at('admin.common.active', 'Active', 'Активний') : at('admin.products.disabledShort', 'Disabled', 'Вимкнено')}
          </span>
          <label className={`admin-addon-toggle${toggling ? ' admin-addon-toggle-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={product.is_enabled}
              disabled={toggling}
              onChange={(e) => onToggleAddonEnabled(product, e.target.checked)}
            />
            <span className="admin-addon-toggle-slider" />
          </label>
        </div>
        {result?.message && (
          <span className={result.ok ? 'admin-product-save-ok' : 'admin-product-save-error'}>
            {result.message}
          </span>
        )}
        <p className="admin-product-field-hint">
          {at('admin.products.disabledHint', 'When disabled, the add-on is hidden from public Services and Prices and Checkout.', 'Коли вимкнено, додаток приховано з публічних Послуг і цін та Checkout.')}
        </p>
      </div>
    );
  };

  // Ne: Add-on kartinin ust kismina desktop ve mobil gorsel onizleme/upload alanlarini render eder.
  // Nasil: options.image ve options.mobile_image alanlarini ayri preview/action bloklari olarak gosterir.
  // Neden: Admin ayni add-on icin web ve mobil fiyat karti gorsellerini bagimsiz yonetebilsin.
  const renderAddonImageBlock = (product: AdminProduct) => {
    const uploading = Boolean(imageUploadingByUid[product.uid]);
    const result = imageResultByUid[product.uid];
    const renderImageSlot = (target: 'desktop' | 'mobile', label: string, currentImage?: string) => (
      <div className="admin-addon-image-slot">
        <span className="admin-product-field-label">{label}</span>
        <div className="admin-addon-image-row">
          {currentImage ? (
            <img src={currentImage} alt={`${product.id} ${target}`} className="admin-addon-image-preview" />
          ) : (
            <div className="admin-addon-image-empty">{target === 'mobile' ? at('admin.products.noMobileImage', 'No mobile image', 'Немає мобільного зображення') : at('admin.products.noImage', 'No image', 'Немає зображення')}</div>
          )}
          <div className="admin-addon-image-actions">
            <label className={`admin-addon-image-btn${uploading ? ' admin-addon-image-btn-disabled' : ''}`}>
              {uploading ? at('admin.products.uploading', 'Uploading...', 'Завантаження...') : currentImage ? at('admin.products.replaceImage', 'Replace image', 'Замінити зображення') : at('admin.products.chooseImage', 'Choose image', 'Обрати зображення')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  onAddonImageSelect(product, file, target);
                }}
              />
            </label>
            {currentImage && (
              <button
                type="button"
                className="admin-addon-image-remove-btn"
                disabled={uploading}
                onClick={() => onAddonImageRemove(product, target)}
              >
                {at('admin.common.remove', 'Remove', 'Прибрати')}
              </button>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div className="admin-addon-image-block">
        {renderImageSlot('desktop', at('admin.products.addonImage', 'Add-On Image', 'Зображення додатка'), product.options.image)}
        {renderImageSlot('mobile', at('admin.products.mobileImage', 'Mobile Image', 'Мобільне зображення'), product.options.mobile_image)}
        {result?.message && (
          <span className={result.ok ? 'admin-product-save-ok' : 'admin-product-save-error'}>
            {result.message}
          </span>
        )}
        <p className="admin-product-field-hint">
          {at('admin.products.imageHint', 'JPG, PNG or WebP. Max 5MB. Mobile image falls back to Add-On Image when empty. Saved automatically when uploaded.', 'JPG, PNG або WebP. Максимум 5MB. Якщо мобільне зображення порожнє, використовується зображення додатка. Зберігається автоматично після завантаження.')}
        </p>
      </div>
    );
  };

  const packageForm = (product: AdminProduct) => (
    <form className="admin-product-form" onSubmit={(e) => onSubmitProduct(e, product)}>
      <div className="admin-product-card-top">
        <div>
          <span className="admin-product-kind-badge">{at('admin.products.corePackage', 'Core package', 'Основний пакет')}</span>
          <p className="admin-product-name">{renderName(product)}</p>
          {!!renderDescription(product) && <p className="admin-product-desc">{renderDescription(product)}</p>}
          <p className="admin-product-tech-id">ID: {product.id}</p>
        </div>
        <p className="admin-product-price">₴{product.price.toFixed(2)}</p>
      </div>

      <div className="admin-product-fields">
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageNameEn', 'Package Name (EN)', 'Назва пакета (EN)')}</span>
          <input name="display_name_en" className="admin-product-input" defaultValue={product.display_name_en || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageNameUk', 'Package Name (UK)', 'Назва пакета (UK)')}</span>
          <input name="display_name_uk" className="admin-product-input" defaultValue={product.display_name_uk || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageDescriptionEn', 'Package Description (EN)', 'Опис пакета (EN)')}</span>
          <textarea name="display_description_en" className="admin-product-input admin-product-textarea" defaultValue={product.display_description_en || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageDescriptionUk', 'Package Description (UK)', 'Опис пакета (UK)')}</span>
          <textarea name="display_description_uk" className="admin-product-input admin-product-textarea" defaultValue={product.display_description_uk || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageBulletsEn', 'Package Bullets (EN, one line per item)', 'Пункти пакета (EN, один пункт на рядок)')}</span>
          <textarea name="display_bullets_en" className="admin-product-input admin-product-textarea" defaultValue={product.display_bullets_en || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packageBulletsUk', 'Package Bullets (UK, one line per item)', 'Пункти пакета (UK, один пункт на рядок)')}</span>
          <textarea name="display_bullets_uk" className="admin-product-input admin-product-textarea" defaultValue={product.display_bullets_uk || ''} />
        </label>
        <p className="admin-product-field-hint">
          {at('admin.products.bulletsHint', 'Enter one bullet item per line. These lines are shown with green check marks on Services and Prices.', 'Вводьте один пункт на рядок. Ці рядки показуються із зеленими позначками в Послугах і цінах.')}
        </p>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.packagePrice', 'Package Price', 'Ціна пакета')}</span>
          <input name="price" type="number" min={0} step="0.01" className="admin-product-input" defaultValue={product.price} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.numberOfGuests', 'Number of Guests', 'Кількість гостей')}</span>
          <input name="guest_count" type="number" min={-1} step="1" className="admin-product-input" defaultValue={product.options.guest_count} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.numberOfMedia', 'Number of Pictures / Videos', 'Кількість фото / відео')}</span>
          <input name="media_count" type="number" min={-1} step="1" className="admin-product-input" defaultValue={product.options.media_count} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.activationPeriod', 'Activation Period', 'Період активації')}</span>
          <input name="activation_period_days" type="number" min={1} step="1" className="admin-product-input" defaultValue={product.options.activation_days} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.storagePeriod', 'Storage Period', 'Період зберігання')}</span>
          <input name="storage_period_days" type="number" min={1} step="1" className="admin-product-input" defaultValue={product.options.storage_days} />
        </label>
      </div>

      {/* Ne: Voice feature durumunu backend boolean'indan, yoksa eski granted_features fallback'inden gosterir.
          Nasil: voice_included varsa onu kullanir; response eski formatta gelirse FEATURE_VOICE id'sine bakar.
          Neden: Save sonrasi backend response formati farkli gelse bile checkbox son durumu dogru yansitsin. */}
      <label className="admin-product-checkbox-label">
        <input
          name="voice_included"
          type="checkbox"
          defaultChecked={isVoiceIncluded(product)}
        />
        <span>{at('admin.products.voiceIncluded', 'Voice message included', 'Голосове повідомлення включено')}</span>
      </label>

      {product.id === PREMIUM_PACKAGE_ID && (
        <label className="admin-product-checkbox-label">
          <input
            name="sponsored_included"
            type="checkbox"
            defaultChecked={product.sponsored_included === true}
          />
          <span>{at('admin.products.sponsoredIncluded', 'Sponsored included', 'Sponsored включено')}</span>
        </label>
      )}

      <div className="admin-product-form-footer">
        <button type="submit" className="admin-product-save-btn" disabled={Boolean(savingByUid[product.uid])}>
          {savingByUid[product.uid] ? at('admin.common.saving', 'Saving...', 'Збереження...') : at('admin.common.save', 'Save', 'Зберегти')}
        </button>
        {renderResult(product.uid)}
      </div>
    </form>
  );

  const addOnForm = (product: AdminProduct) => (
    <form className="admin-product-form" onSubmit={(e) => onSubmitProduct(e, product)}>
      <div className="admin-product-card-top">
        <div>
          <span className="admin-product-kind-badge admin-product-kind-badge-addon">{at('admin.products.addon', 'Add-on', 'Додаток')}</span>
          <p className="admin-product-name">{renderName(product)}</p>
          {!!renderDescription(product) && <p className="admin-product-desc">{renderDescription(product)}</p>}
          <p className="admin-product-tech-id">ID: {product.id}</p>
        </div>
        <p className="admin-product-price">₴{product.price.toFixed(2)}</p>
      </div>

      {renderAddonEnabledToggle(product)}

      {renderAddonImageBlock(product)}

      <div className="admin-product-fields">
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.addonNameEn', 'Add-On Package Name (EN)', 'Назва додатка (EN)')}</span>
          <input name="display_name_en" className="admin-product-input" defaultValue={product.display_name_en || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.addonNameUk', 'Add-On Package Name (UK)', 'Назва додатка (UK)')}</span>
          <input name="display_name_uk" className="admin-product-input" defaultValue={product.display_name_uk || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.addonDescriptionEn', 'Add-On Description (EN)', 'Опис додатка (EN)')}</span>
          <textarea name="display_description_en" className="admin-product-input admin-product-textarea" defaultValue={product.display_description_en || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.addonDescriptionUk', 'Add-On Description (UK)', 'Опис додатка (UK)')}</span>
          <textarea name="display_description_uk" className="admin-product-input admin-product-textarea" defaultValue={product.display_description_uk || ''} />
        </label>
        <label className="admin-product-field">
          <span className="admin-product-field-label">{at('admin.products.addonPrice', 'Add-On Package Price', 'Ціна додатка')}</span>
          <input name="price" type="number" min={0} step="0.01" className="admin-product-input" defaultValue={product.price} />
        </label>
      </div>

      <div className="admin-product-form-footer">
        <button type="submit" className="admin-product-save-btn" disabled={Boolean(savingByUid[product.uid])}>
          {savingByUid[product.uid] ? at('admin.common.saving', 'Saving...', 'Збереження...') : at('admin.common.save', 'Save', 'Зберегти')}
        </button>
        {renderResult(product.uid)}
      </div>
    </form>
  );

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.nav.products', 'Products', 'Продукти') }]}
          title={at('admin.nav.products', 'Products', 'Продукти')}
          actions={
            <>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
              <Link to="/admin/panel-admins" className="admin-page-header-link">
                <i className="fa-solid fa-user-shield" />
                {at('admin.nav.panelAdmins', 'Panel Admins', 'Адміністратори панелі')}
              </Link>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                {at('admin.nav.promos', 'Promos', 'Промокоди')}
              </Link>
              <Link to="/admin/partnerships" className="admin-page-header-link">
                <i className="fa-solid fa-handshake" />
                {at('admin.nav.partnerships', 'Partnerships', 'Партнерства')}
              </Link>
            </>
          }
        />

        {loading && <div className="admin-empty">{at('admin.products.loading', 'Loading products...', 'Завантаження продуктів...')}</div>}
        {!loading && denied && <div className="admin-empty">{at('admin.orders.accessDenied', 'Access denied. You are not a super-admin.', 'Доступ заборонено. Ви не супер-адміністратор.')}</div>}
        {!loading && !denied && !!errorMessage && <div className="admin-empty">{errorMessage}</div>}

        {!loading && !denied && !errorMessage && (
          <div className="admin-products-grid">
            <section className="admin-products-panel">
              <div className="admin-products-panel-head">
                <div>
                  <h2>{at('admin.products.corePackages', 'Core Packages', 'Основні пакети')}</h2>
                  <p>{at('admin.products.corePackagesDesc', 'Main plans with limits, periods and voice option.', 'Основні плани з лімітами, періодами та опцією голосу.')}</p>
                </div>
                <span className="admin-products-panel-count">{packageProducts.length}</span>
              </div>
              {packageProducts.map((product) => (
                <article key={product.uid} className="admin-product-card">
                  {packageForm(product)}
                </article>
              ))}
            </section>

            <section className="admin-products-panel">
              <div className="admin-products-panel-head">
                <div> 
                  <h2>{at('admin.products.addons', 'Add-ons', 'Додатки')}</h2> 
                  <p>{at('admin.products.addonsDesc', 'Optional products shown after core package selection.', 'Додаткові продукти, що показуються після вибору основного пакета.')}</p>
                </div>
                <span className="admin-products-panel-count">{addOnProducts.length}</span>
              </div>
              {addOnProducts.map((product) => (
                <article
                  key={product.uid}
                  className={`admin-product-card admin-product-card-addon${product.is_enabled ? '' : ' admin-product-card-disabled'}`}
                >
                  {addOnForm(product)}
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminProducts;
