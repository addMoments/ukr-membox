import i18n, { InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { get_key, set_key } from '../utils/persistence';
import { S3_ROOT } from '../consts';

declare global {
  interface Window {
    currLng?: string;
    onLng?: (lang: string) => void;
  }
}

// Define types
type Lang = {
  flag: string;
  code: string;
  display_name: string;
  translation: string; // Assuming translation is a simple key-value object
  rtl?: boolean;
};

type LangList = Lang[];

const default_lang: string = "en";

const lang_list: LangList = [
  {
    flag: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Flag_of_the_United_Kingdom.svg/80px-Flag_of_the_United_Kingdom.svg.png",
    code: "en",
    display_name: "English",
    translation: S3_ROOT + "/ui/assets/lang/en.json"
  },
  {
    flag: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Ukraine.svg/250px-Flag_of_Ukraine.svg.png",
    code: "uk",
    display_name: "Ukrainian",
    translation: S3_ROOT + "/ui/assets/lang/uk.json"
  }
];

// Function to strip locale
const strip_locale = (lang_code: string = "en-US"): string => lang_code.split(/[_-]/)[0];

// Function to get device language
const device_lang: string = (() => {
  return strip_locale(navigator.language);
})();

// Change language function
const change_lang = async (lang_code: string = default_lang): Promise<void> => {
  if (lang_list.findIndex((e) => e.code === lang_code) > -1) {
    await set_key("lang_setting", lang_code);
  } else {
    return;
  }

  window.location.reload();
};

// Translation function alias
const t = i18n.t;

// Map of URL query aliases to internal lang codes
const lang_url_aliases: Record<string, string> = {
  ua: "uk",
};

// Initialize i18n
(async () => {
  // Check for ?lang= query param (highest priority)
  const url_lang_raw = new URLSearchParams(window.location.search).get("lang");
  const normalized_url_lang_raw = url_lang_raw?.toLowerCase();
  const url_lang = normalized_url_lang_raw
    ? (lang_url_aliases[normalized_url_lang_raw] ?? normalized_url_lang_raw)
    : null;
  const url_lang_valid =
    url_lang && lang_list.findIndex((l) => l.code === url_lang) > -1
      ? url_lang
      : null;

  if (url_lang_valid) {
    // Persist and reload — identical behaviour to switching from the header
    await set_key("lang_setting", url_lang_valid);
    const nextSearchParams = new URLSearchParams(window.location.search);
    nextSearchParams.delete("lang");
    const nextSearch = nextSearchParams.toString();
    window.location.replace(
      window.location.pathname +
      (nextSearch ? `?${nextSearch}` : "") +
      window.location.hash
    );
    return;
  }

  const set_lang = await get_key("lang_setting").catch(() => null);

  const start_lang = set_lang || (
    lang_list.findIndex((l) => l.code === device_lang) === -1
      ? default_lang
      : device_lang
  );

  window.currLng = start_lang;
  window.onLng?.(start_lang);

  const resources: Record<string, { translation: Record<string, string> }> = {};

  const lang_url = lang_list.find(l => l.code === start_lang)?.translation || "";
  const lang_data = await fetch(lang_url+"?v="+Date.now()).then(res => res.json());

  resources[start_lang] = {translation: lang_data};

  const i18nOptions: InitOptions = {
    debug: true,
    compatibilityJSON: 'v3',
    lng: start_lang, // Default language
    fallbackLng: default_lang,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    resources: resources
  };

  i18n
    .use(initReactI18next) // Initializes react-i18next
    .init(i18nOptions, (e) => {
      if (e) {
        console.error("i18n init err!:", e);
        return;
      }
      // Başlangıç dili ve RTL durumu
      const currentLang = lang_list.find(l => l.code === start_lang);
      const isRtlActive = currentLang?.rtl ?? false;
    });
})();

export const isRtl = (): boolean => {
  const currentLang = lang_list.find(l => l.code === i18n.language);
  const rtlValue = currentLang?.rtl ?? false;
  return rtlValue;
};

export default i18n;
export {
  t,
  lang_list,
  device_lang,
  change_lang,
  strip_locale,
};
