import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { whoAmI } from '../client/auth';

interface RequireAuthProps {
  children: ReactNode;
}

type AuthState = 'loading' | 'authed' | 'unauthed';

// Ne: Korumali route'larin children'ini render etmeden once kullanicinin login olup olmadigini dogrular.
// Nasil: mount oldugunda whoAmI() cagirir; basariliysa 'authed', exception firlatirsa 'unauthed' state'i set edilir;
//        unauthed durumda /signin?next=<encoded path+search+hash>'e Navigate ile yonlendirilir.
// Neden: /event/:uid gibi host'a ozel sayfalarin direkt acilmasini onler; mail link'iyle gelen logoff kullanicilar
//        once signin'e gider, login sonrasi orijinal URL'e (query string dahil) geri doner.
function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await whoAmI();
        if (!cancelled) setState('authed');
      } catch {
        if (!cancelled) setState('unauthed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') return null;

  if (state === 'unauthed') {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const target = `/signin?next=${encodeURIComponent(next)}`;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

export default RequireAuth;
