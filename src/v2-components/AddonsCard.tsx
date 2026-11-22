import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AddonOptionsResponse, fetchAddonOptions } from '../client/addons';
import { Product } from '../types/products';
import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';
import { formatUah } from '../utils/money';
import '../v2-styles/EventAddons.css';

// Panoda ucretli etkinlige sonradan ek urun karti (Fatih 20 Kasim 2026). Satilabilen ekleri ve fiyatlarini
// listeler, "Choose add-ons" ek urun sayfasina (/event/<uid>/addons) gider. Free etkinlikte, galeri suresi
// bittiyse ya da satilacak ek kalmadiysa gorunmez (odemeden donus bildirimi haric).

const isUk = () => t('lang_code') === 'uk';
const displayName = (p: Product) => (isUk() ? p.display_name_uk || p.display_name_en : p.display_name_en || p.display_name_uk) || p.id;

function AddonsCard({ packedUid }: { packedUid: string }) {
  const [data, setData] = useState<AddonOptionsResponse | null>(null);
  const [done, setDone] = useState(false);

  // Odemeden donus (?addons=done): bildirimi goster, adresi temizle (yenilemede tekrar cikmasin).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('addons') !== 'done') return;
    setDone(true);
    url.searchParams.delete('addons');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!packedUid) return;
    let cancelled = false;
    fetchAddonOptions(packedUid)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [packedUid]);

  const doneNotice = done ? (
    <div className="addons-card-done" role="status">
      <i className="fa-solid fa-circle-check" />
      {textOr('eventHome.addons.done', 'Thank you! Your add-ons are added to your event. Printed items will be shipped by Nova Poshta.', 'Дякуємо! Послуги додано до вашої події. Друковані товари надішлемо Новою Поштою.')}
    </div>
  ) : null;

  const sellable = data && data.can_buy && data.window_open && data.options.length > 0;
  if (!sellable) {
    return doneNotice ? <div className="addons-card">{doneNotice}</div> : null;
  }

  return (
    <div className="addons-card">
      {doneNotice}
      <h3 className="addons-card-title">{textOr('eventHome.addons.cardTitle', 'Add-ons', 'Додаткові послуги')}</h3>
      <p className="addons-card-text">
        {textOr('eventHome.addons.cardText', 'Add extras to your event at any time.', 'Додайте послуги до своєї події будь-коли.')}
      </p>
      <ul className="addons-card-list">
        {data!.options.map((product) => (
          <li key={product.id} className="addons-card-item">
            <span>{displayName(product)}</span>
            <span className="addons-card-item-price">{formatUah(product.price)}</span>
          </li>
        ))}
      </ul>
      <Link to={`/event/${packedUid}/addons`} className="addons-card-btn">
        {textOr('eventHome.addons.cardButton', 'Choose add-ons', 'Обрати послуги')}
        <i className="fa-solid fa-arrow-right" />
      </Link>
    </div>
  );
}

export default AddonsCard;
