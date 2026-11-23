import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import V2Header from '../../v2-components/V2Header';
import V2Footer from '../../v2-components/V2Footer';
import AddonsCheckout from '../../v2-components/AddonsCheckout';
import { AddonOptionsResponse, fetchAddonOptions, startAddonPayment } from '../../client/addons';
import { upgradeErrorCode } from '../../client/upgrades';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { formatUah } from '../../utils/money';
import '../../v2-styles/Checkout.css';
import '../../v2-styles/EventAddons.css';

// Etkinlige sonradan ek urun (Fatih 20 Kasim 2026: "every event ... digital and physical"; Premium'un reklam
// alani zaten var, gosterilmez; free alamaz, yukseltince alabilir). Panodaki "Add-ons" kartindan gelinir.
// Secenekler sunucudan (event-addons.go: etkinlikte zaten olan dijital ekler listede yok). Secme, ayar, adres ve
// odeme AddonsCheckout'ta (free yukseltmesinin 2. adimi da ayni blogu kullanir). Odeme LiqPay; dogrulaninca host
// /event/<uid>?addons=done'a doner, ekler "Your add-ons" kutusunda gorunur.

export const addonErrorMessage = (err: unknown) => {
  switch (upgradeErrorCode(err)) {
    case 'UPGRADE_WINDOW_CLOSED':
      return t('eventHome.upgrade.errors.windowClosed');
    case 'UPGRADE_NOT_OFFERED':
      return t('eventHome.upgrade.errors.notOffered');
    case 'ADDON_NOT_OFFERED':
      return textOr('eventHome.addons.errors.notOffered', 'This add-on is no longer available for your event. Please reload the page.', 'Ця послуга більше недоступна для вашої події. Оновіть сторінку.');
    case 'ADDONS_FREE_PACKAGE':
      return textOr('eventHome.addons.errors.free', 'Add-ons are available after you upgrade your free package.', 'Додаткові послуги доступні після покращення безкоштовного пакета.');
    case 'SHIPPING_ADDRESS_REQUIRED':
      return textOr('checkout.shipping.addressRequired', 'Please add a shipping address for physical items.', 'Будь ласка, додайте адресу доставки для фізичних товарів.');
    case 'INVALID_PHONE':
      return textOr('checkout.phoneInvalid', 'Please enter a valid phone number, e.g. +380 99 123 45 67.', 'Введіть коректний номер телефону, наприклад +380 99 123 45 67.');
    default:
      return t('eventHome.upgrade.errors.generic');
  }
};

function EventAddons() {
  const { uid: packedUid = '' } = useParams<{ uid: string }>();
  const [data, setData] = useState<AddonOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = textOr('eventHome.addons.pageTitle', 'Add-ons for your event - AddMoments', 'Додаткові послуги - AddMoments');
  }, []);

  useEffect(() => {
    if (!packedUid) return;
    let cancelled = false;
    fetchAddonOptions(packedUid)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [packedUid]);

  const options = useMemo(() => data?.options || [], [data]);
  const eventHref = `/event/${packedUid}`;

  const backLink = (
    <Link to={eventHref} className="event-addons-back">
      <i className="fa-solid fa-arrow-left" />
      {textOr('eventHome.freeUpgrade.back', 'Back to your event', 'Назад до події')}
    </Link>
  );

  let body;
  if (loading) {
    body = <p className="event-addons-empty">{textOr('eventHome.addons.loading', 'Loading add-ons…', 'Завантаження послуг…')}</p>;
  } else if (data && !data.can_buy) {
    body = (
      <p className="event-addons-empty">
        {textOr('eventHome.addons.errors.free', 'Add-ons are available after you upgrade your free package.', 'Додаткові послуги доступні після покращення безкоштовного пакета.')}
        {' '}
        <Link to={`/event/${packedUid}/upgrade`}>{textOr('eventHome.addons.upgradeLink', 'Upgrade your package', 'Покращити пакет')}</Link>
      </p>
    );
  } else if (!data || !data.window_open || options.length === 0) {
    body = (
      <p className="event-addons-empty">
        {textOr('eventHome.addons.unavailable', 'There are no add-ons for this event right now.', 'Для цієї події зараз немає додаткових послуг.')}
      </p>
    );
  } else {
    body = (
      <AddonsCheckout
        options={options}
        payLabel={(total) => textOr('eventHome.addons.pay', 'Pay {{price}}', 'Сплатити {{price}}', { price: formatUah(total) })}
        onPay={(payload) => startAddonPayment(packedUid, payload)}
        errorMessage={addonErrorMessage}
      />
    );
  }

  return (
    <div className="checkout-page event-addons-page">
      <V2Header />
      <main className="checkout-main">
        {backLink}
        <header className="event-addons-head">
          <h1 className="event-addons-title">{textOr('eventHome.addons.title', 'Add-ons for your event', 'Додаткові послуги для вашої події')}</h1>
          <p className="event-addons-subtitle">
            {textOr('eventHome.addons.subtitle', 'Add extras to your event at any time.', 'Додайте послуги до своєї події будь-коли.')}
          </p>
        </header>
        {body}
      </main>
      <V2Footer />
    </div>
  );
}

export default EventAddons;
