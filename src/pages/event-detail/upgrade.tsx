import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import V2Header from '../../v2-components/V2Header';
import V2Footer from '../../v2-components/V2Footer';
import { PackageCard } from '../../v2-partials/V2EventNew';
import { getPaywallProducts } from '../../client/cart';
import {
  fetchUpgradeOptions,
  startUpgradePayment,
  upgradeErrorCode,
  UpgradeOption,
  UpgradeOptionsResponse,
} from '../../client/upgrades';
import { Product } from '../../types/products';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { localizedTagText } from '../../utils/product_i18n';
import { formatUah } from '../../utils/money';
import '../../v2-styles/EventNew.css';
import '../../v2-styles/FreeUpgrade.css';

// Free paketten yukseltme sayfasi (Fatih 18 Kasim 2026, taslak "after click CTA, upgrade options").
// Panodaki "Upgrade your free package" dugmesi buraya gelir. Baslik "Upgrade your package", Events /
// School / Hero sekmeleri, kartlar Services & Prices'takiyle ayni ve normal fiyatlarla (free'den
// yukseltme = hedef paketin fiyati; backend 24-free-upgrades.sql). Bir kart secilir, alttaki
// "Upgrade" dugmesi LiqPay'i acar; odeme dogrulaninca etkinlik ayni link, QR ve dosyalarla yeni pakete
// gecer ve bekleme sayfasi hostu /event/<uid>?upgrade=done'a geri yollar.
// Secenekler sunucudan (yalniz gecerli paketi free olan etkinlige); kart metinleri /api/products'tan
// (yalniz acik urunler, yani admin'in kapattigi paket burada da gorunmez).

type TabKey = 'events' | 'school' | 'hero';
const TAB_ORDER: TabKey[] = ['events', 'school', 'hero'];
const EVENTS_ORDER = ['standard', 'plus', 'premium'];

const tabOf = (product: Product): TabKey => {
  if (product.options?.special_package !== true) return 'events';
  return product.options?.special_section === 'hero' ? 'hero' : 'school';
};

const tabTexts = (key: TabKey) => {
  switch (key) {
    case 'school':
      return {
        title: textOr('eventHome.freeUpgrade.tabs.school', 'School', 'Школа'),
        subtitle: textOr('eventHome.freeUpgrade.tabs.schoolSubtitle', 'School events, trips and memories', 'Шкільні події, поїздки та спогади'),
      };
    case 'hero':
      return {
        title: textOr('eventHome.freeUpgrade.tabs.hero', 'Hero', 'Герої'),
        subtitle: textOr('eventHome.freeUpgrade.tabs.heroSubtitle', 'Only for military members and their families', 'Лише для військових та їхніх родин'),
      };
    default:
      return {
        title: textOr('eventHome.freeUpgrade.tabs.events', 'Events', 'Події'),
        subtitle: textOr('eventHome.freeUpgrade.tabs.eventsSubtitle', 'All event types', 'Усі типи подій'),
      };
  }
};

const isUk = () => t('lang_code') === 'uk';
const displayName = (p: Product) => (isUk() ? p.display_name_uk || p.display_name_en : p.display_name_en || p.display_name_uk) || p.id;
const displayDescription = (p: Product) => (isUk()
  ? p.display_description_uk || p.display_description_en
  : p.display_description_en || p.display_description_uk) || '';
const displayBullets = (p: Product) => ((isUk() ? p.display_bullets_uk || p.display_bullets_en : p.display_bullets_en || p.display_bullets_uk) || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

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

interface Choice {
  option: UpgradeOption;
  product: Product;
}

function EventUpgrade() {
  const { uid: packedUid = '' } = useParams<{ uid: string }>();
  const [data, setData] = useState<UpgradeOptionsResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = textOr('eventHome.freeUpgrade.pageTitle', 'Upgrade your package - AddMoments', 'Покращити пакет - AddMoments');
  }, []);

  useEffect(() => {
    if (!packedUid) return;
    let cancelled = false;
    Promise.all([fetchUpgradeOptions(packedUid), getPaywallProducts()])
      .then(([options, list]) => {
        if (cancelled) return;
        setData(options);
        setProducts(list);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packedUid]);

  const choicesByTab = useMemo(() => {
    const out: Record<TabKey, Choice[]> = { events: [], school: [], hero: [] };
    if (!data) return out;
    data.options
      .filter((o) => o.kind === 'package' && o.to_package)
      .forEach((option) => {
        const product = products.find((p) => p.id === option.to_package && !p.is_add_on);
        if (product) out[tabOf(product)].push({ option, product });
      });
    out.events.sort((a, b) => {
      const ai = EVENTS_ORDER.indexOf(a.product.id);
      const bi = EVENTS_ORDER.indexOf(b.product.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || Number(a.option.price) - Number(b.option.price);
    });
    // Ozel paketler sayfasindaki gibi admin'in sirasi (buyuk priority once).
    out.school.sort((a, b) => b.product.priority - a.product.priority);
    out.hero.sort((a, b) => b.product.priority - a.product.priority);
    return out;
  }, [data, products]);

  const tabs = TAB_ORDER.filter((key) => choicesByTab[key].length > 0);
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0];
  const shown = activeTab ? choicesByTab[activeTab] : [];
  const selectedChoice = tabs.flatMap((key) => choicesByTab[key]).find((c) => c.option.id === selected) || null;
  const eventHref = `/event/${packedUid}`;
  const isFree = data?.current_package?.id === 'free';

  const pay = async () => {
    if (!selectedChoice || busy) return;
    setBusy(true);
    setError('');
    try {
      await startUpgradePayment(packedUid, [{ product_id: selectedChoice.option.id, quantity: 1 }]);
      // Tarayici LiqPay'e gidiyor; dugme kilitli kalir.
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  };

  const backLink = (
    <Link to={eventHref} className="free-upgrade-back">
      <i className="fa-solid fa-arrow-left" />
      {textOr('eventHome.freeUpgrade.back', 'Back to your event', 'Назад до події')}
    </Link>
  );

  let body;
  if (loading) {
    body = <p className="free-upgrade-empty">{textOr('eventHome.freeUpgrade.loading', 'Loading packages…', 'Завантаження пакетів…')}</p>;
  } else if (!data || !data.window_open || tabs.length === 0 || !isFree) {
    // Etkinlik free degil (zaten yukseltilmis), galeri suresi bitmis ya da secenek yok: panoya don.
    body = (
      <p className="free-upgrade-empty">
        {textOr('eventHome.freeUpgrade.unavailable', 'There are no package upgrades for this event right now.', 'Для цієї події зараз немає покращень пакета.')}
      </p>
    );
  } else {
    body = (
      <>
        {tabs.length > 1 && (
          <div className="free-upgrade-tabs" role="tablist">
            {tabs.map((key) => {
              const texts = tabTexts(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === activeTab}
                  className={`free-upgrade-tab${key === activeTab ? ' is-active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  <span className="free-upgrade-tab-title">{texts.title}</span>
                  <span className="free-upgrade-tab-subtitle">{texts.subtitle}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="event-new-packages-grid free-upgrade-grid">
          {shown.map(({ option, product }) => (
            <PackageCard
              key={option.id}
              id={product.id}
              displayName={displayName(product)}
              displayDescription={displayDescription(product)}
              displayBullets={displayBullets(product)}
              price={Number(option.price)}
              tagText={localizedTagText(product.options)}
              isSelected={option.id === selected}
              onSelect={() => {
                setError('');
                setSelected(option.id === selected ? null : option.id);
              }}
            />
          ))}
        </div>
        <div className={`free-upgrade-bar${selectedChoice ? ' is-visible' : ''}`}>
          <div className="free-upgrade-bar-inner">
            <div className="free-upgrade-bar-text">
              {selectedChoice
                ? textOr('eventHome.freeUpgrade.selected', '{{name}} for your event', '{{name}} для вашої події', { name: displayName(selectedChoice.product) })
                : textOr('eventHome.freeUpgrade.choose', 'Choose a package', 'Оберіть пакет')}
              <span className="free-upgrade-bar-note">
                {textOr('eventHome.freeUpgrade.keeps', 'Same event, link, QR code and photos.', 'Та сама подія, посилання, QR-код і фото.')}
              </span>
            </div>
            <button type="button" className="free-upgrade-pay" disabled={!selectedChoice || busy} onClick={pay}>
              {busy
                ? textOr('eventHome.freeUpgrade.opening', 'Opening payment…', 'Відкриваємо оплату…')
                : textOr('eventHome.freeUpgrade.pay', 'Upgrade · {{price}}', 'Покращити · {{price}}', {
                  price: formatUah(selectedChoice ? selectedChoice.option.price : 0),
                })}
            </button>
          </div>
          {error && <p className="free-upgrade-error" role="alert">{error}</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <V2Header />
      <div className="event-new-page free-upgrade-page">
        <main className="event-new-main">
          {backLink}
          <header className="free-upgrade-head">
            <h1 className="free-upgrade-title">{textOr('eventHome.freeUpgrade.title', 'Upgrade your package', 'Покращіть свій пакет')}</h1>
            <p className="free-upgrade-subtitle">
              {textOr('eventHome.freeUpgrade.subtitle', 'Choose the right package for your event.', 'Оберіть пакет, що підходить вашій події.')}
            </p>
          </header>
          {body}
        </main>
      </div>
      <V2Footer />
    </>
  );
}

export default EventUpgrade;
