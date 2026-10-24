import { useEffect, useState } from 'react';
import { t } from '../packages/i18n';
import { formatUah } from '../utils/money';
import { FEATURE_ADVERTORIAL, FEATURE_VOICE } from '../utils/features';
import {
  fetchUpgradeOptions,
  PackageInfo,
  startUpgradePayment,
  upgradeErrorCode,
  UpgradeOption,
  UpgradeOptionsResponse,
} from '../client/upgrades';
import '../v2-styles/UpgradeCard.css';

// Etkinlik panosundaki yukseltme karti (Excel 2.18; yapi Solomiia'nin 23 Ekim taslagi).
// Mini ve Classic'te paket secenekleri, Premium'da adetli +ay / +yukleme ayi / +GB. Her varyantta
// tek odeme dugmesi "Upgrade · tutar" (musteri: "everywhere the payment button should say upgrade").
// Kart QR ile Activity Overview arasinda; musteri 23 Ekim 11:41 kompakt istedi: aciklama metni ve
// "One-time payment" kutusu yok, paketin kazandirdiklari "Learn more" ile acilir. 15:15 daha da
// sikistirdi: ilk satir "Upgrade your plan: [paket]", "Learn more" fiyat satirinda, tik ustte.
// Odeme sonrasi bekleme sayfasi hostu ?upgrade=done ile buraya geri yollar.

const MAX_BENEFITS = 6;

// Paket kartinin rengi mevcut pakete gore; bilinmeyen paket varsayilana duser.
const VARIANT_BY_PACKAGE: Record<string, string> = {
  standard: 'mini',
  plus: 'classic',
  premium: 'premium',
};

const isUk = () => t('lang_code') === 'uk';

// Premium eklerinin sirasi ve simgeleri. Taslakta once +ay, sonra +GB; +yukleme ayi (23 Ekim)
// ikisinin arasinda. Backend fiyata gore siraliyor, ayni turde o sira korunur.
const EXTRA_KIND_ORDER = ['time', 'upload', 'storage'];
const EXTRA_ICON: Record<string, string> = {
  time: 'fa-solid fa-database',
  upload: 'fa-solid fa-calendar-plus',
  storage: 'fa-solid fa-cloud',
};

// "CLASSIC" / "КЛАСИЧНИЙ" -> "Classic" / "Класичний" (urun adlari veride buyuk harfle duruyor).
const titleCase = (name: string) => (name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : '');

const packageName = (info?: PackageInfo) => {
  if (!info) return '';
  return titleCase((isUk() && info.display_name_uk) || info.display_name_en || info.id);
};

// products.options'taki bir limit: yoksa null (backend'de "tanimsiz = sinirsiz"), -1 sinirsiz.
const limit = (options: Record<string, unknown>, key: string): number | null => {
  const raw = options?.[key];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

// Hedef limit mevcuttan iyi mi: sinirsiza gecis ya da daha buyuk sayi. Mevcut tanimsizsa zaten
// sinirsizdir, kazanc yok.
const unlocks = (to: number | null, from: number | null) => to === -1 && from !== null && from !== -1;
const raises = (to: number | null, from: number | null): to is number =>
  to !== null && to >= 0 && from !== null && from !== -1 && to > from;

// Gun sayisi kartta 60 gun ve ustunde ay (30 gun = 1 ay), altinda gun olarak yazilir. Fark ancak
// yuvarlanmis ay sayisi artiyorsa gosterilir: 30 -> 31 gun ("1 ay" -> "1 ay") kazanc degil.
const longerPeriod = (to: number | null, from: number | null): to is number =>
  raises(to, from) && Math.round(to / 30) > Math.round(from! / 30);
const periodText = (days: number, monthsKey: string, daysKey: string) => (days >= 60
  ? t(monthsKey, { count: Math.round(days / 30) })
  : t(daysKey, { count: days }));

// Ne: Paket yukseltmesinde hostun kazanacaklarini, mevcut ve hedef paketi karsilastirarak yazar.
// Neden: Taslaktaki maddeler ornek metindi; limitler admin panelinden degisebildigi icin metin
//        veriden uretilir, yoksa kart bir gun yanlis vaat eder.
const packageBenefits = (current: PackageInfo, target: PackageInfo): string[] => {
  const from = current.options || {};
  const to = target.options || {};
  const out: string[] = [];

  const storageTo = limit(to, 'storage_gb');
  const storageFrom = limit(from, 'storage_gb');
  if (unlocks(storageTo, storageFrom)) out.push(t('eventHome.upgrade.benefits.unlimitedStorage'));
  else if (raises(storageTo, storageFrom)) out.push(t('eventHome.upgrade.benefits.storage', { count: storageTo }));

  const mediaTo = limit(to, 'media_count');
  const mediaFrom = limit(from, 'media_count');
  if (unlocks(mediaTo, mediaFrom)) out.push(t('eventHome.upgrade.benefits.unlimitedMedia'));
  else if (raises(mediaTo, mediaFrom)) out.push(t('eventHome.upgrade.benefits.media', { count: mediaTo }));

  // Musteri 23 Ekim: yukleme suresi paketlere gore 1 / 2 / 3 ay olacak.
  const uploadTo = limit(to, 'activation_days');
  const uploadFrom = limit(from, 'activation_days');
  if (longerPeriod(uploadTo, uploadFrom)) {
    out.push(periodText(uploadTo, 'eventHome.upgrade.benefits.uploadMonths', 'eventHome.upgrade.benefits.uploadDays'));
  }

  const daysTo = limit(to, 'storage_days');
  const daysFrom = limit(from, 'storage_days');
  if (longerPeriod(daysTo, daysFrom)) {
    out.push(periodText(daysTo, 'eventHome.upgrade.benefits.months', 'eventHome.upgrade.benefits.days'));
  }

  const featuresFrom = current.granted_features || [];
  const featuresTo = target.granted_features || [];
  if (featuresTo.includes(FEATURE_ADVERTORIAL) && !featuresFrom.includes(FEATURE_ADVERTORIAL)) {
    out.push(t('eventHome.upgrade.benefits.ads'));
  }

  const guestsTo = limit(to, 'guest_count');
  const guestsFrom = limit(from, 'guest_count');
  if (unlocks(guestsTo, guestsFrom)) out.push(t('eventHome.upgrade.benefits.unlimitedGuests'));
  else if (raises(guestsTo, guestsFrom)) out.push(t('eventHome.upgrade.benefits.guests', { count: guestsTo }));

  if (unlocks(limit(to, 'guest_media_count'), limit(from, 'guest_media_count'))) {
    out.push(t('eventHome.upgrade.benefits.guestLimit'));
  }
  if (featuresTo.includes(FEATURE_VOICE) && !featuresFrom.includes(FEATURE_VOICE)) {
    out.push(t('eventHome.upgrade.benefits.voice'));
  }

  return out.slice(0, MAX_BENEFITS);
};

const errorMessage = (err: unknown) => {
  switch (upgradeErrorCode(err)) {
    case 'UPGRADE_WINDOW_CLOSED':
      return t('eventHome.upgrade.errors.windowClosed');
    case 'UPGRADE_NOT_OFFERED':
      return t('eventHome.upgrade.errors.notOffered');
    default:
      return t('eventHome.upgrade.errors.generic');
  }
};

interface UpgradeCardProps {
  packedUid: string;
}

function UpgradeCard({ packedUid }: UpgradeCardProps) {
  const [data, setData] = useState<UpgradeOptionsResponse | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Odemeden donus: bildirimi goster, adresi temizle (yenilemede tekrar cikmasin). Router'in
  // history.state'i korunur, geri/ileri bozulmaz.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('upgrade') !== 'done') return;
    setDone(true);
    url.searchParams.delete('upgrade');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!packedUid) return;
    let cancelled = false;
    fetchUpgradeOptions(packedUid)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const firstPackage = res.options.find((o) => o.kind === 'package');
        setSelectedPackage(firstPackage ? firstPackage.id : null);
      })
      // Yetki yoksa (403), etkinlik kapaliysa (410) ya da baska bir hatada kart hic gorunmez.
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [packedUid]);

  if (!data) return null;
  const { current_package: current, options, window_open: windowOpen } = data;
  const maxQuantity = data.max_quantity || 10;
  // Galeri suresi bittiyse etkinlik silinmek uzere; satis yok, kart da yok.
  if (!windowOpen || options.length === 0) {
    return done ? (
      <div className="upgrade-card upgrade-card-default">
        <div className="upgrade-card-done" role="status">
          <i className="fa-solid fa-circle-check" />
          {t('eventHome.upgrade.done')}
        </div>
      </div>
    ) : null;
  }

  const packageOptions = options.filter((o) => o.kind === 'package');
  const extraOptions = options
    .filter((o) => EXTRA_KIND_ORDER.includes(o.kind))
    .sort((a, b) => EXTRA_KIND_ORDER.indexOf(a.kind) - EXTRA_KIND_ORDER.indexOf(b.kind));

  const variant = VARIANT_BY_PACKAGE[current.id] || 'default';

  const total = selectedPackage
    ? Number(packageOptions.find((o) => o.id === selectedPackage)?.price || 0)
    : extraOptions.reduce((sum, o) => sum + Number(o.price || 0) * (quantities[o.id] || 0), 0);

  const setQuantity = (id: string, next: number) => {
    setError('');
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(maxQuantity, next)) }));
  };

  const pay = async () => {
    if (busy || total <= 0) return;
    const items = selectedPackage
      ? [{ product_id: selectedPackage, quantity: 1 }]
      : extraOptions
        .filter((o) => (quantities[o.id] || 0) > 0)
        .map((o) => ({ product_id: o.id, quantity: quantities[o.id] }));
    setBusy(true);
    setError('');
    try {
      await startUpgradePayment(packedUid, items);
      // Tarayici LiqPay'e gidiyor; dugme "aciliyor" durumunda kalir.
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  };

  const renderPackageOption = (option: UpgradeOption) => {
    const selected = option.id === selectedPackage;
    const open = Boolean(expanded[option.id]);
    const target = option.to_package_info;
    const benefits = target ? packageBenefits(current, target) : [];
    const targetVariant = VARIANT_BY_PACKAGE[target?.id || ''] || 'default';
    return (
      <div
        key={option.id}
        className={`upgrade-option upgrade-option-package upgrade-option-to-${targetVariant}${selected ? ' is-selected' : ''}`}
      >
        {/* "Learn more" fiyat satirinda ama secim dugmesinin icinde olamaz (ic ice dugme); bu
            sarmalayicinin icinde secim dugmesinin ustune konumlanir. */}
        <div className="upgrade-option-head">
          <button
            type="button"
            className="upgrade-option-select"
            aria-pressed={selected}
            onClick={() => {
              setError('');
              setSelectedPackage(option.id);
            }}
          >
            <span className="upgrade-option-icon">
              <i className="fa-solid fa-crown" />
            </span>
            <span className="upgrade-option-body">
              <span className="upgrade-option-name">{t('eventHome.upgrade.upgradeTo', { name: packageName(target) })}</span>
              <span className="upgrade-option-price">+{formatUah(option.price)}</span>
            </span>
            <span className="upgrade-option-check" aria-hidden="true">
              <i className={selected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'} />
            </span>
          </button>
          {benefits.length > 0 && (
            <button
              type="button"
              className={`upgrade-option-more${open ? ' is-open' : ''}`}
              aria-expanded={open}
              aria-controls={`upgrade-benefits-${option.id}`}
              onClick={() => setExpanded((prev) => ({ ...prev, [option.id]: !open }))}
            >
              {t('eventHome.upgrade.learnMore')}
              <i className="fa-solid fa-chevron-down" />
            </button>
          )}
        </div>
        {benefits.length > 0 && open && (
          <ul className="upgrade-option-benefits" id={`upgrade-benefits-${option.id}`}>
            {benefits.map((benefit) => (
              <li key={benefit} className="upgrade-option-benefit">
                <i className="fa-solid fa-check" />
                {benefit}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const extraName = (option: UpgradeOption) => {
    if (option.kind === 'time') return t('eventHome.upgrade.extraMonths', { count: option.extra_storage_months });
    if (option.kind === 'upload') {
      const months = option.extra_upload_months || 1;
      return t(months === 1 ? 'eventHome.upgrade.extraUploadOne' : 'eventHome.upgrade.extraUpload', { count: months });
    }
    return t('eventHome.upgrade.extraGb', { count: option.extra_storage_gb });
  };

  const renderExtraOption = (option: UpgradeOption) => {
    const quantity = quantities[option.id] || 0;
    return (
      <div key={option.id} className={`upgrade-option upgrade-option-extra upgrade-option-${option.kind}${quantity > 0 ? ' is-selected' : ''}`}>
        <span className="upgrade-option-icon">
          <i className={EXTRA_ICON[option.kind]} />
        </span>
        <span className="upgrade-option-body">
          <span className="upgrade-option-name">{extraName(option)}</span>
          <span className="upgrade-option-foot">
            <span className="upgrade-option-price">+{formatUah(option.price)}</span>
            <span className="upgrade-stepper">
              <button
                type="button"
                className="upgrade-stepper-btn"
                aria-label={t('eventHome.upgrade.decrease')}
                disabled={quantity <= 0 || busy}
                onClick={() => setQuantity(option.id, quantity - 1)}
              >
                <i className="fa-solid fa-minus" />
              </button>
              <span className="upgrade-stepper-value" aria-live="polite">{quantity}</span>
              <button
                type="button"
                className="upgrade-stepper-btn"
                aria-label={t('eventHome.upgrade.increase')}
                disabled={quantity >= maxQuantity || busy}
                onClick={() => setQuantity(option.id, quantity + 1)}
              >
                <i className="fa-solid fa-plus" />
              </button>
            </span>
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className={`upgrade-card upgrade-card-${variant}`} id="upgrade">
      <h3 className="upgrade-card-title">
        {t('eventHome.upgrade.title')}
        <span className="upgrade-card-plan">
          {variant === 'premium' && <i className="fa-solid fa-crown" />}
          {packageName(current)}
        </span>
      </h3>

      {done && (
        <div className="upgrade-card-done" role="status">
          <i className="fa-solid fa-circle-check" />
          {t('eventHome.upgrade.done')}
        </div>
      )}

      <div className="upgrade-card-options">
        {packageOptions.map(renderPackageOption)}
        {packageOptions.length === 0 && extraOptions.map(renderExtraOption)}
      </div>

      <button type="button" className="upgrade-card-pay" disabled={busy || total <= 0} onClick={pay}>
        {busy ? (
          <>
            <i className="fa-solid fa-spinner fa-spin" />
            {t('eventHome.upgrade.redirecting')}
          </>
        ) : (
          <>
            <i className="fa-solid fa-circle-arrow-up" />
            {total > 0 ? t('eventHome.upgrade.pay', { price: formatUah(total) }) : t('eventHome.upgrade.payEmpty')}
          </>
        )}
      </button>
      {error && <p className="upgrade-card-error" role="alert">{error}</p>}
    </div>
  );
}

export default UpgradeCard;
