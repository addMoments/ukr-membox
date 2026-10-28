import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2EventNew from '../v2-partials/V2EventNew';
import { useEffect } from 'react';
import i18n from '../packages/i18n';
import { ensureCanonicalLink, ensureMetaTag } from '../utils/seo';

// Ozel paketler sayfasi (Excel madde 6; musteri 28 Ekim): Class, Grade, School ve Hero burada satilir,
// Services & Prices'ta degil. Services & Prices'in hero bolumu buraya baglanacak (tasarimi Solomiia'dan).
// Kartlar ve sepet Services & Prices'la ayni bilesen; admin'de kapali paket burada da gorunmez.
const seoByLanguage = {
  en: {
    title: 'Special Packages - AddMoments',
    description:
      'AddMoments special packages: one-time payment, unlimited guests and co-hosts, QR templates and voice messages.',
  },
  uk: {
    title: 'Спеціальні пакети - AddMoments',
    description:
      'Спеціальні пакети AddMoments: одноразовий платіж, необмежена кількість гостей і співорганізаторів, QR-шаблони та голосові повідомлення.',
  },
} as const;

const canonicalPath = '/special-packages/';

function updateSeoTags(language: keyof typeof seoByLanguage) {
  const seo = seoByLanguage[language] ?? seoByLanguage.en;
  const canonicalHref = new URL(canonicalPath, window.location.origin).toString();

  document.title = seo.title;
  ensureMetaTag('name', 'description').setAttribute('content', seo.description);
  ensureMetaTag('property', 'og:title').setAttribute('content', seo.title);
  ensureMetaTag('property', 'og:description').setAttribute('content', seo.description);
  ensureMetaTag('property', 'og:url').setAttribute('content', canonicalHref);
  ensureCanonicalLink(canonicalHref);
}

function SpecialPackages() {
  const currentLanguage = (i18n.language || 'en') as keyof typeof seoByLanguage;

  useEffect(() => {
    updateSeoTags(currentLanguage);
  }, [currentLanguage]);

  return (
    <>
      <V2Header />
      <V2EventNew variant="special" />
      <V2Footer />
    </>
  );
}

export default SpecialPackages;
