import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2EventNew from '../v2-partials/V2EventNew';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useState, useLayoutEffect } from 'react';
import i18n from '../packages/i18n';
import { ensureCanonicalLink, ensureMetaTag } from '../utils/seo';
import { useLoading } from '../contexts/LoadingContext';

const seoByLanguage = {
  en: {
    title: 'Pricing - AddMoments | Choose a plan for your event',
    description:
      'Check out AddMoments pricing for weddings, birthdays, and corporate events. Collect photos from guests via a QR code—fast, convenient, and affordable.',
  },
  uk: {
    title: 'Тарифи та Ціни - AddMoments | Оберіть план для вашої події',
    description:
      'Перегляньте тарифи AddMoments для весілля, днів народження та корпоративних заходів. Збирайте фото від гостей через QR-код — швидко, зручно та доступно.',
  },
} as const;

const canonicalPath = '/events/services-and-prices/';

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

function EventNew() {
  const [searchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const [componentReady, setComponentReady] = useState<boolean>(false);
  const currentLanguage = (i18n.language || 'en') as keyof typeof seoByLanguage;
  const isGetStartedEntry = searchParams.get('entry') === 'get-started';
  const shouldShowSignInSection = isGetStartedEntry && authResolved && !isLoggedIn;
  const { setLoadingTrue, setLoadingFalse } = useLoading();

  // Set loading to true immediately when component mounts (before paint)
  useLayoutEffect(() => {
    console.log('[EventNew] Setting loading to true');
    setLoadingTrue();
  }, []); // Empty deps - run only once

  useEffect(() => {
    let active = true;
    let resolved = false;

    const resolveAuth = (loggedIn: boolean) => {
      if (!active || resolved) return;
      resolved = true;
      setIsLoggedIn(loggedIn);
      setAuthResolved(true);
    };

    const isHeaderLoggedIn = () => {
      const signOutBtn = document.querySelector('.v2-header [href="/signout"]') as HTMLElement | null;
      const myEventBtn = document.querySelector('.v2-header .hdr-my-event-btn') as HTMLElement | null;
      const isVisible = (el: HTMLElement | null) => !!el && getComputedStyle(el).display !== 'none';
      return isVisible(signOutBtn) || isVisible(myEventBtn);
    };

    const observer = new MutationObserver(() => {
      if (isHeaderLoggedIn()) {
        resolveAuth(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const checkLoginFromIDB = async () => {
      try {
        const req = indexedDB.open('storageDB', 1);
        const token = await new Promise<string | null>((resolve) => {
          req.onsuccess = () => {
            try {
              const db = req.result;
              const tx = db.transaction('keyValueStore', 'readonly');
              const store = tx.objectStore('keyValueStore');
              const get = store.get('lsgtkn');
              get.onsuccess = () => resolve((get.result && get.result.v) || null);
              get.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });

        if (!!token) {
          resolveAuth(true);
          return;
        }

        setTimeout(() => {
          resolveAuth(isHeaderLoggedIn());
        }, 800);
      } catch {
        setTimeout(() => {
          resolveAuth(isHeaderLoggedIn());
        }, 800);
      }
    };

    checkLoginFromIDB();

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  // Hide loader when both auth is resolved AND component (cart) is ready
  useEffect(() => {
    if (authResolved && componentReady) {
      // Both auth check and cart init are complete - safe to hide loader
      // If shouldShowSignInSection is true, the form will be visible
      if (shouldShowSignInSection) {
        // Form is shown - wait a moment for it to render before hiding loader
        const timer = setTimeout(() => {
          setLoadingFalse();
        }, 150);
        return () => clearTimeout(timer);
      } else {
        // No form to show, hide loader immediately
        setLoadingFalse();
      }
    }
  }, [authResolved, componentReady, shouldShowSignInSection, setLoadingFalse]);

  useEffect(() => {
    updateSeoTags(currentLanguage);
  }, [currentLanguage]);

  return (
    <>
      <V2Header />
      <V2EventNew showSignInSection={shouldShowSignInSection} onLoadingComplete={() => setComponentReady(true)} />
      <V2Footer />
    </>
  );
}

export default EventNew;




