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
// Mini ve Classic'te paket secenekleri, Premium'da adetli +ay / +GB. Her varyantta tek odeme
// dugmesi "Upgrade · tutar" (musteri: "everywhere the payment button should say upgrade").
// Odeme sonrasi bekleme sayfasi hostu ?upgrade=done ile buraya geri yollar.

const MAX_BENEFITS = 4;

// Paket kartinin rengi ve basligi mevcut pakete gore; bilinmeyen paket varsayilana duser.
const VARIANT_BY_PACKAGE: Record<string, string> = {
  standard: 'mini',
  plus: 'classic',
  premium: 'premium',
};

const isUk = () => t('lang_code') === 'uk';

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

// Ne: Paket yukseltmesinde hostun kazanacaklarini, mevcut ve hedef paketi karsilastirarak yazar.
// Neden: Taslaktaki maddeler ornek metindi; limitler admin panelinden degisebildigi icin metin
//        veriden uretilir, yoksa kart bir gun yanlis vaat eder. En onemli dort madde gosterilir.
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

  const daysTo = limit(to, 'storage_days');
  const daysFrom = limit(from, 'storage_days');
  if (raises(daysTo, daysFrom)) {
    out.push(daysTo >= 60
      ? t('eventHome.upgrade.benefits.months', { count: Math.round(daysTo / 30) })
      : t('eventHome.upgrade.benefits.days', { count: daysTo }));
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
  // Taslaktaki sira: once +ay, sonra +GB.
  const extraOptions = options
    .filter((o) => o.kind === 'time' || o.kind === 'storage')
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'time' ? -1 : 1));

  const variant = VARIANT_BY_PACKAGE[current.id] || 'default';
  const textKey = VARIANT_BY_PACKAGE[current.id] ? current.id : 'default';

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
    const target = option.to_package_info;
    const benefits = target ? packageBenefits(current, target) : [];
    const targetVariant = VARIANT_BY_PACKAGE[target?.id || ''] || 'default';
    return (
      <button
        key={option.id}
        type="button"
        className={`upgrade-option upgrade-option-package upgrade-option-to-${targetVariant}${selected ? ' is-selected' : ''}`}
        aria-pressed={selected}
        onClick={() => {
          setError('');
          setSelectedPackage(option.id);
        }}
      >
        <span className="upgrade-option-head">
          <span className="upgrade-option-icon">
            <i className="fa-solid fa-crown" />
          </span>
          <span className="upgrade-option-body">
            <span className="upgrade-option-name">{t('eventHome.upgrade.upgradeTo', { name: packageName(target) })}</span>
            <span className="upgrade-option-price">+{formatUah(option.price)}</span>
          </span>
        </span>
        {benefits.length > 0 && (
          <span className="upgrade-option-benefits">
            {benefits.map((benefit) => (
              <span key={benefit} className="upgrade-option-benefit">
                <i className="fa-solid fa-check" />
                {benefit}
              </span>
            ))}
          </span>
        )}
        <span className="upgrade-option-check" aria-hidden="true">
          <i className={selected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'} />
        </span>
      </button>
    );
  };

  const renderExtraOption = (option: UpgradeOption) => {
    const quantity = quantities[option.id] || 0;
    const isTime = option.kind === 'time';
    const name = isTime
      ? t('eventHome.upgrade.extraMonths', { count: option.extra_storage_months })
      : t('eventHome.upgrade.extraGb', { count: option.extra_storage_gb });
    const desc = isTime
      ? t('eventHome.upgrade.extraMonthsDesc', { count: option.extra_storage_months })
      : t('eventHome.upgrade.extraGbDesc', { count: option.extra_storage_gb });
    return (
      <div key={option.id} className={`upgrade-option upgrade-option-extra upgrade-option-${option.kind}${quantity > 0 ? ' is-selected' : ''}`}>
        <span className="upgrade-option-head">
          <span className="upgrade-option-icon">
            <i className={isTime ? 'fa-solid fa-database' : 'fa-solid fa-cloud'} />
          </span>
          <span className="upgrade-option-body">
            <span className="upgrade-option-name">{name}</span>
          </span>
        </span>
        <span className="upgrade-option-desc">{desc}</span>
        <span className="upgrade-option-foot">
          <span className="upgrade-option-price">{t('eventHome.upgrade.each', { price: `+${formatUah(option.price)}` })}</span>
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
      </div>
    );
  };

  return (
    <div className={`upgrade-card upgrade-card-${variant}`} id="upgrade">
      <div className="upgrade-card-head">
        <span className="upgrade-card-label">
          <i className="fa-solid fa-circle-arrow-up" />
          {t('eventHome.upgrade.label')}
        </span>
        <span className="upgrade-card-plan">
          {variant === 'premium' && <i className="fa-solid fa-crown" />}
          {t('eventHome.upgrade.yourPlan')} <b>{packageName(current)}</b>
        </span>
      </div>

      {done && (
        <div className="upgrade-card-done" role="status">
          <i className="fa-solid fa-circle-check" />
          {t('eventHome.upgrade.done')}
        </div>
      )}

      <h3 className="upgrade-card-title">{t(`eventHome.upgrade.titles.${textKey}`)}</h3>
      <p className="upgrade-card-subtitle">{t(`eventHome.upgrade.subtitles.${textKey}`)}</p>

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

      <div className="upgrade-card-note">
        <i className="fa-solid fa-gift" />
        <span>
          <b>{t('eventHome.upgrade.note')}</b>
          <span>{t('eventHome.upgrade.noteDetail')}</span>
        </span>
      </div>
    </div>
  );
}

export default UpgradeCard;
