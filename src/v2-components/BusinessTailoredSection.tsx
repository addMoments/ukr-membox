import { useState } from 'react';
import { textOr } from '../utils/admin_i18n';
import '../v2-styles/BusinessTailored.css';

// Services & Prices'in alt bolumu: isletmeler icin ozel cozumler (Solomiia'nin 28 Ekim tasarimi,
// "Tailored Services — redesigned"; ayni gun gorselle soldaki etiketler tek satira indi). Eski hero'nun
// ("Tailored Services for Every Event" + dugun gorseli) yerinde. Musteri 28 Ekim 12:10: bu bolum ozel
// paketler sayfasina yonlendirir.

interface BusinessTailoredSectionProps {
  // Ana buton: ozel paket aciksa /special-packages/, degilse iletisim (ziyaretci bos sayfaya dusmesin).
  quoteHref: string;
  // "Get a quote" (farkli ihtiyac): iletisim sayfasi.
  contactHref: string;
  // "Compare standard packages": sayfanin ustundeki paket kartlarina kaydirir.
  onComparePackages: () => void;
}

type SceneId = 'corporate' | 'sports';

const SCENE_ORDER: SceneId[] = ['corporate', 'sports'];

const scenes = (): Record<SceneId, {
  label: string;
  headline: string;
  rows: { title: string; text: string }[];
}> => ({
  corporate: {
    label: textOr('paywall.business.corporate', 'Corporate & Conferences', 'Корпоративи та конференції'),
    headline: textOr('paywall.business.corporateHeadline', 'Your brand, front and centre.', 'Ваш бренд — у центрі уваги.'),
    rows: [
      {
        title: textOr('paywall.business.corporateR1t', 'Co-branded gallery', 'Галерея з вашим брендом'),
        text: textOr('paywall.business.corporateR1d', 'Your logo, palette and event hashtag across the whole guest experience.', 'Ваш логотип, кольори та хештег події — у всьому, що бачать гості.'),
      },
      {
        title: textOr('paywall.business.corporateR2t', 'Branded on-site assets', 'Брендовані матеріали на місці'),
        text: textOr('paywall.business.corporateR2d', 'QR stands, banners, badges and conference signage produced to your venue and format.', 'QR-стійки, банери, бейджі та навігація для конференцій — під вашу локацію та формат.'),
      },
      {
        title: textOr('paywall.business.corporateR3t', 'Dedicated manager', 'Персональний менеджер'),
        text: textOr('paywall.business.corporateR3d', 'One contact to plan access, moderation and content delivery.', 'Один контакт для планування доступу, модерації та передачі контенту.'),
      },
    ],
  },
  sports: {
    label: textOr('paywall.business.sports', 'Sports & Arenas', 'Спорт і арени'),
    headline: textOr('paywall.business.sportsHeadline', 'Matchday moments, owned by your brand.', 'Моменти матчу — під вашим брендом.'),
    rows: [
      {
        title: textOr('paywall.business.sportsR1t', 'Sponsor-ready gallery', 'Галерея, готова для спонсорів'),
        text: textOr('paywall.business.sportsR1d', 'Club, league and partner branding built into the fan experience.', 'Брендинг клубу, ліги та партнерів — у кожній взаємодії з уболівальниками.'),
      },
      {
        title: textOr('paywall.business.sportsR2t', 'Stadium-wide assets', 'Матеріали для всього стадіону'),
        text: textOr('paywall.business.sportsR2d', 'QR codes on screens, seats and concourses, produced to your venue spec.', 'QR-коди на екранах, сидіннях і в проходах — за специфікацією вашої арени.'),
      },
      {
        title: textOr('paywall.business.sportsR3t', 'Matchday support', 'Підтримка в день матчу'),
        text: textOr('paywall.business.sportsR3d', 'A team on call before and during the event.', 'Команда на зв’язку до і під час події.'),
      },
    ],
  },
});

const ArrowIcon = ({ size, color }: { size: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Satir simgeleri tasarimdaki sirayla: palet, QR, kulaklik.
const ROW_ICONS = [
  <>
    <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="10.5" cy="7" r="1" />
    <circle cx="15" cy="7.5" r="1" />
  </>,
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
  </>,
  <>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="2.5" y="14" width="4.5" height="6" rx="2" />
    <rect x="17" y="14" width="4.5" height="6" rx="2" />
    <path d="M19 20c0 1.2-1.5 2-4 2" />
  </>,
];

function BusinessTailoredSection({ quoteHref, contactHref, onComparePackages }: BusinessTailoredSectionProps) {
  const [active, setActive] = useState<SceneId>('corporate');
  const allScenes = scenes();
  const scene = allScenes[active];

  const chips = [
    textOr('paywall.business.chipCorporate', 'Corporate & Conferences', 'Корпоративи та конференції'),
    textOr('paywall.business.chipSports', 'Sports & Arenas', 'Спорт і арени'),
    textOr('paywall.business.chipBrand', 'Brand activations', 'Бренд-активації'),
    textOr('paywall.business.chipArenas', 'Arenas', 'Арени'),
  ];
  const steps = [
    textOr('paywall.business.step1', 'Share your brief', 'Опишіть задачу'),
    textOr('paywall.business.step2', 'We build the plan for you', 'Складемо план для вас'),
    textOr('paywall.business.step3', 'We support', 'Супроводжуємо'),
  ];

  return (
    <section className="business-tailored">
      <div className="business-tailored-inner">
        <div className="business-tailored-message">
          <span className="business-tailored-badge">{textOr('paywall.business.badge', 'For businesses', 'Для бізнесу')}</span>
          {/* Belgenin h1'i: eski hero basligi gibi. */}
          <h1 className="business-tailored-title">
            {textOr('paywall.business.title', 'Tailor-made Solutions for Your Business Events', 'Індивідуальні рішення для ваших бізнес-подій')}
          </h1>
          <p className="business-tailored-text">
            {textOr(
              'paywall.business.text',
              'We work with businesses, venues and organisers on a tailor-made basis. Tell us about your event and we\'ll shape the digital gallery, branding and on-site assets around your demand.',
              'Ми працюємо з бізнесом, локаціями та організаторами індивідуально. Розкажіть про вашу подію — і ми підлаштуємо цифрову галерею, брендинг і матеріали на місці під ваші потреби.',
            )}
          </p>
          <div className="business-tailored-chips">
            {chips.map((chip) => <span key={chip} className="business-tailored-chip">{chip}</span>)}
          </div>
          <ol className="business-tailored-steps">
            {steps.map((step, index) => (
              <li key={step} className="business-tailored-step">
                <span className="business-tailored-step-num">{index + 1}</span>
                <span className="business-tailored-step-text">{step}</span>
              </li>
            ))}
          </ol>
          <div className="business-tailored-actions">
            <a href={quoteHref} className="business-tailored-btn business-tailored-btn-primary">
              {textOr('paywall.business.requestQuote', 'Request a custom quote', 'Запросити пропозицію')}
              <ArrowIcon size={18} color="#d9ec8b" />
            </a>
            <a
              href="#packages"
              className="business-tailored-btn business-tailored-btn-outline"
              onClick={(e) => {
                e.preventDefault();
                onComparePackages();
              }}
            >
              {textOr('paywall.business.comparePackages', 'Compare standard packages', 'Порівняти стандартні пакети')}
            </a>
          </div>
        </div>

        <div className="business-tailored-panel-wrap">
          <div className="business-tailored-panel-shape" aria-hidden="true" />
          <div className="business-tailored-panel">
            <div className="business-tailored-panel-head">
              <span className="business-tailored-panel-label">{textOr('paywall.business.tailoredFor', 'Tailored for', 'Рішення для')}</span>
              <div className="business-tailored-tabs">
                {SCENE_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={id === active}
                    className={`business-tailored-tab${id === active ? ' is-active' : ''}`}
                    onClick={() => setActive(id)}
                  >
                    {allScenes[id].label}
                  </button>
                ))}
              </div>
            </div>

            <h2 className="business-tailored-headline">{scene.headline}</h2>

            <div className="business-tailored-rows">
              {scene.rows.map((row, index) => (
                <div key={row.title} className="business-tailored-row">
                  <div className="business-tailored-row-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b4608" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ROW_ICONS[index]}
                    </svg>
                  </div>
                  <div className="business-tailored-row-body">
                    <span className="business-tailored-row-title">{row.title}</span>
                    <span className="business-tailored-row-text">{row.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="business-tailored-brief">
              <div className="business-tailored-brief-text">
                <span className="business-tailored-brief-title">{textOr('paywall.business.briefTitle', 'Have a different brief?', 'Інша задача?')}</span>
                <span className="business-tailored-brief-sub">{textOr('paywall.business.briefText', 'Let\'s shape it together, at your scale.', 'Сформуємо рішення разом — під ваш масштаб.')}</span>
              </div>
              <a href={contactHref} className="business-tailored-brief-btn">
                {textOr('paywall.business.getQuote', 'Get a quote', 'Отримати пропозицію')}
                <ArrowIcon size={16} color="#1f2328" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BusinessTailoredSection;
