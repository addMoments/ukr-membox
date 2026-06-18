import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { change_lang } from '../packages/i18n';

const SITE_ROOT = 'https://addmoments.com.ua';

const isLocalHost = ["localhost", "127.0.0.1"].includes(typeof window !== 'undefined' ? window.location.hostname : '');

const toHref = (path: string) => {
  return isLocalHost ? path : `${SITE_ROOT}${path}`;
};

const withLangParam = (url: string, lang = "en") => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}lang=${encodeURIComponent(lang || "en")}`;
};

const UK_FOOTER_LINKS: Record<string, string> = {
  home: "https://addmoments.com.ua/uk/",
  how_it_works: "https://addmoments.com.ua/uk/how-it-works-addmoments/",
  faq: "https://addmoments.com.ua/uk/faq-addmoments/",
  blog: "https://addmoments.com.ua/uk/addmoments-blog/",
  contact: "https://addmoments.com.ua/uk/contact-addmoments/",
  privacy: "https://addmoments.com.ua/uk/privacy-policy-addmoments/",
  terms: "https://addmoments.com.ua/uk/terms-of-service-uk/",
};

const socialLinks = [
  {
    href: "https://www.instagram.com/addmoments.co",
    ariaLabel: "Instagram",
    styleClass: "instagram",
    iconSvg: `<svg aria-hidden="true" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"></path></svg>`
  },
  {
    href: "https://t.me/addmoments",
    ariaLabel: "Telegram",
    styleClass: "telegram",
    iconSvg: `<svg aria-hidden="true" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="#DCE3FF" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.5 28.1-37.5 17.5L238 356.3l-50 48.1c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L116 282.3 14.3 250.5c-22.1-6.9-22.5-22.1 4.6-32.7L416.9 64.5c18.4-6.9 34.5 4.1 29.8 34.1z"></path></svg>`
  },
  {
    href: "tel:+380732330733",
    ariaLabel: "Phone",
    styleClass: "phone",
    iconSvg: `<svg aria-hidden="true" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48zm-16.39 307.37l-15 65A15 15 0 0 1 354 416C194 416 64 286.29 64 126a15.7 15.7 0 0 1 11.63-14.61l65-15A18.23 18.23 0 0 1 144 96a16.27 16.27 0 0 1 13.79 9.09l30 70A17.9 17.9 0 0 1 189 181a17 17 0 0 1-5.5 11.61l-37.89 31a231.91 231.91 0 0 0 110.78 110.78l31-37.89A17 17 0 0 1 299 291a17.85 17.85 0 0 1 5.91 1.21l70 30A16.25 16.25 0 0 1 384 336a17.41 17.41 0 0 1-.39 3.37z"></path></svg>`
  }
];

const Footer = () => {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language || 'en');
  const isUkLang = lang === "uk";

  useEffect(() => {
    setLang(i18n.language || 'en');
  }, [i18n.language]);

  const PUBLIC_URL = process.env.PUBLIC_URL || '';

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLang(newLang);
    change_lang(newLang);
  };

  const footerColumns = [
    {
      title: isUkLang ? "Компанія" : "Company",
      links: [
        { label: isUkLang ? "Політика конфіденційності" : "Privacy Policy", href: isUkLang ? UK_FOOTER_LINKS.privacy : toHref("/privacy-policy/") },
        { label: isUkLang ? "Умови обслуговування" : "Terms of Service", href: isUkLang ? UK_FOOTER_LINKS.terms : toHref("/terms-of-service/") },
        { label: isUkLang ? "Контакт" : "Contact", href: isUkLang ? UK_FOOTER_LINKS.contact : toHref("/contact-us") }
      ]
    },
    {
      title: isUkLang ? "Продукт" : "Product",
      links: [
        { label: isUkLang ? "Послуги та ціни" : "Services & Prices", href: toHref(withLangParam("/events/services-and-prices", lang)) },
        { label: isUkLang ? "Як це працює" : "How it works", href: isUkLang ? UK_FOOTER_LINKS.how_it_works : toHref("/how-it-works") },
        { label: t('faq'), href: isUkLang ? UK_FOOTER_LINKS.faq : toHref("/faq") }
      ]
    },
    {
      title: "",
      links: [
        { label: t('blog'), href: isUkLang ? UK_FOOTER_LINKS.blog : toHref("/blog") },
        { label: t('sign_in'), href: toHref("/signin") },
        { label: t('get_started'), href: toHref("/events/services-and-prices?entry=get-started") }
      ]
    }
  ];

  return (
    <footer className="v2-footer">
      <div className="v2-footer-content">
        {/* Brand Column */}
        <div className="v2-footer-brand">
          <a className="v2-footer-logo" href={isUkLang ? UK_FOOTER_LINKS.home : SITE_ROOT + "/"} data-discover="true">
            <div className="v2-footer-logo-icon">
              <img className="footer-brand-logo" src={`${PUBLIC_URL}/assets/header/addmoments_logo.svg`} alt="addmoments" />
            </div>
          </a>
          <p className="v2-footer-description">{t('footer_description')}</p>
          <div className="v2-footer-social">
            {socialLinks.map((social) => (
              <a
                key={social.href}
                href={social.href}
                className={`v2-footer-social-link ${social.styleClass}`}
                aria-label={social.ariaLabel}
                target="_blank"
                rel="noopener noreferrer"
                dangerouslySetInnerHTML={{ __html: social.iconSvg }}
              />
            ))}
          </div>
        </div>

        {/* Link Columns */}
        {footerColumns.map((column, idx) => (
          <div key={idx} className="v2-footer-column">
            {column.title && (
              <h4 className="v2-footer-column-title">{column.title}</h4>
            )}
            {!column.title && (
              <h4 className="v2-footer-column-title v2-footer-column-title-empty">&nbsp;</h4>
            )}
            <ul className="v2-footer-links">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a className="v2-footer-link" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="v2-footer-bottom">
        <p className="v2-footer-copyright">
          © 2026 <a className="v2-footer-copyright-link" href={SITE_ROOT + "/"}>addmoments</a>. All rights reserved.
        </p>
        <button className="v2-footer-lang-selector">
          <svg className="v2-footer-lang-globe" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
            <path d="M3 12H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M12 3C14.7 5.6 16.2 8.8 16.2 12C16.2 15.2 14.7 18.4 12 21" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" />
            <path d="M12 3C9.3 5.6 7.8 8.8 7.8 12C7.8 15.2 9.3 18.4 12 21" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" />
          </svg>
          <span className="v2-footer-lang-text">
            {isUkLang ? "Українська (UA)" : "English (US)"}
          </span>
          <select id="langSel2" value={lang} onChange={handleLangChange}>
            <option value="en">English (US)</option>
            <option value="uk">Українська (UA)</option>
          </select>
        </button>
      </div>
    </footer>
  );
};

export default Footer;

