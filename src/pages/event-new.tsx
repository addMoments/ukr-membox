import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2EventNew from '../v2-partials/V2EventNew';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

function EventNew() {
  const [searchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const isGetStartedEntry = searchParams.get('entry') === 'get-started';
  const shouldShowSignInSection = isGetStartedEntry && authResolved && !isLoggedIn;

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

  return (
    <>
      <V2Header />
      <V2EventNew showSignInSection={shouldShowSignInSection} />
      <V2Footer />
    </>
  );
}

export default EventNew;




