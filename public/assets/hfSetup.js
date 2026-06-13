(()=>{
  const LANG_DROPDOWN_KEY = '__amLangDropdown';
  const LANG_SWAP_KEY = '__amLangSwap';

  const initLangDropdown = (select)=>{
    if (!select || select[LANG_DROPDOWN_KEY]){
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'v2-lang-dd';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'v2-lang-dd-trigger';
    trigger.setAttribute('aria-label', 'Language selector');

    const menu = document.createElement('div');
    menu.className = 'v2-lang-dd-menu';

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    select.classList.add('v2-lang-native-hidden');
    select.insertAdjacentElement('afterend', wrapper);

    const render = ()=>{
      const current = (select.value || 'en').toLowerCase();
      const currentOpt = [...select.options].find(opt => opt.value === current);
      const currentLabel = (currentOpt?.textContent || current).trim();
      trigger.innerHTML = `<span>${currentLabel}</span><i class="fa-solid fa-caret-up"></i>`;

      const options = [...select.options].filter(opt => opt.value !== current);
      menu.innerHTML = options.map(opt => (
        `<button type="button" class="v2-lang-dd-option" data-value="${opt.value}">${(opt.textContent || opt.value).trim()}</button>`
      )).join('');
    };

    trigger.addEventListener('click', (e)=>{
      e.preventDefault();
      const wasOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.v2-lang-dd.open').forEach(el => el.classList.remove('open'));
      wrapper.classList[wasOpen ? 'remove' : 'add']('open');
    });

    menu.addEventListener('click', (e)=>{
      const target = e.target;
      if (!(target instanceof HTMLElement)){
        return;
      }
      const btn = target.closest('.v2-lang-dd-option');
      if (!btn){
        return;
      }
      const value = btn.getAttribute('data-value');
      if (!value){
        return;
      }
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      wrapper.classList.remove('open');
      render();
    });

    document.addEventListener('click', (e)=>{
      if (!wrapper.contains(e.target)){
        wrapper.classList.remove('open');
      }
    });

    select.addEventListener('change', render);
    select[LANG_DROPDOWN_KEY] = { render };
    render();
  };

  const initLangSwapButton = (select)=>{
    if (!select || select[LANG_SWAP_KEY]){
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'v2-lang-swap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'v2-lang-swap-btn';
    btn.setAttribute('aria-label', 'Switch language');
    wrapper.appendChild(btn);

    select.classList.add('v2-lang-native-hidden');
    select.insertAdjacentElement('afterend', wrapper);

    const render = ()=>{
      const current = (select.value || 'en').toLowerCase();
      const target = current === 'uk' ? 'en' : 'uk';
      const targetLabel = target === 'uk' ? 'Українська' : 'English';
      const flag = target === 'uk' ? '🇺🇦' : '🇬🇧';
      btn.innerHTML = `${flag} ${targetLabel}`;
      btn.setAttribute('data-value', target);
    };

    btn.addEventListener('click', ()=>{
      const target = btn.getAttribute('data-value');
      if (!target){
        return;
      }
      select.value = target;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      render();
    });

    select.addEventListener('change', render);
    select[LANG_SWAP_KEY] = { render };
    render();
  };

  const setupLangSelectors = ()=>{
    const desktopSelect = document.querySelector('#langSel');
    initLangDropdown(desktopSelect);
    if (desktopSelect && desktopSelect[LANG_DROPDOWN_KEY]?.render){
      desktopSelect[LANG_DROPDOWN_KEY].render();
    }

    const mobileSelect = document.querySelector('#langSelMobile');
    initLangSwapButton(mobileSelect);
    if (mobileSelect && mobileSelect[LANG_SWAP_KEY]?.render){
      mobileSelect[LANG_SWAP_KEY].render();
    }

    // Note: langSel2 is now handled by the React Footer component
  };

  const withLangParam = (url, lang = "en")=>{
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}lang=${encodeURIComponent(lang || "en")}`;
  };

  const UK_WORDPRESS_LINKS = {
    home: "https://addmoments.com.ua/uk/",
    how_it_works: "https://addmoments.com.ua/uk/how-it-works-addmoments/",
    faq: "https://addmoments.com.ua/uk/faq-addmoments/",
    blog: "https://addmoments.com.ua/uk/addmoments-blog/",
    contact_us: "https://addmoments.com.ua/uk/contact-addmoments/",
  };

  const setUpHeader = (t = (k)=>k, lang = "en", isWordPress = false)=>{
    let isFirst = false;
    const shouldUseUkWordPressLinks = ()=>(
      !isWordPress && lang === "uk"
    );

    const getAuthTokenFromIDB = ()=> new Promise(resolve => {
      try {
        const req = indexedDB.open('storageDB', 1);
        req.onsuccess = ()=>{
          const db = req.result;
          const tx = db.transaction('keyValueStore', 'readonly');
          const store = tx.objectStore('keyValueStore');
          const get = store.get('lsgtkn');
          get.onsuccess = ()=> resolve((get.result && get.result.v) || null);
          get.onerror = ()=> resolve(null);
        };
        req.onerror = ()=> resolve(null);
      } catch(e){ resolve(null); }
    });

    const packUUID = (hexstring)=>{
      try {
        const noDashes = hexstring.replaceAll('-', '');
        const match = noDashes.match(/\w{2}/g);
        const rawB64 = btoa(match.map(a => String.fromCharCode(parseInt(a, 16))).join(''));
        return rawB64.slice(0, -2).replaceAll('/', '_').replaceAll('+', '-');
      } catch(e){ return ''; }
    };

    const SERV_ROOT = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8083'
      : 'https://serv.addmoments.com.ua';

    const checkIsAdmin = async (token)=>{
      try {
        const res = await window.fetch(`${SERV_ROOT}/api/admin/check`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.is_admin;
      } catch(e){ return false; }
    };

    const getMyEventUrl = async (token)=>{
      try {
        const res = await window.fetch('https://db.addmoments.com.ua/events?select=uid&limit=1', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) return null;
        const events = await res.json();
        if (!events || !events[0]) return null;
        return `/event/${packUUID(events[0].uid)}`;
      } catch(e){ return null; }
    };

    const MY_EVENT_CLASS = 'hdr-my-event-btn';

    /** When the membox SPA is already mounted (#root), avoid full page loads for in-app paths.
     *  WordPress often serves the SPA shell only for some URLs (e.g. /events); /admin/* may 404 on hard refresh/navigation. */
    const spaInAppNavigate = (href) => {
      if (!href || href.charAt(0) !== '/') return false;
      const rootEl = document.getElementById('root');
      if (!rootEl || !rootEl.firstElementChild) return false;
      window.history.pushState(window.history.state, '', href);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      return true;
    };

    const headerBtnsSetup = async (token)=>{
      const isLoggedIn = !!token;
      const guestRoute = /^\/guest\/[^/?#]+(?:\/[^?#]*)?$/.test(window.location.pathname);
      const btns = document.querySelectorAll('[data-pub]');
      btns.forEach(btn=>{
        const pub = Number(btn.getAttribute('data-pub'));
        // data-pub="1" = show when logged OUT, data-pub="0" = show when logged IN
        btn.style.display = (isLoggedIn ? pub === 1 : pub === 0) ? 'none' : 'block';
      });

      if (guestRoute){
        document.querySelectorAll('.v2-header [data-pub="1"]').forEach((btn)=>{
          btn.style.display = 'none';
        });
      }

      // Remove existing My Event / Admin buttons before re-inserting
      document.querySelectorAll('.' + MY_EVENT_CLASS).forEach(el => el.remove());

      if (isLoggedIn) {
        const isAdmin = await checkIsAdmin(token);
        const targetHref = isAdmin ? '/admin/orders' : await getMyEventUrl(token);
        if (!targetHref) return;
        const targetText = isAdmin ? (t('admin') || 'Admin') : (t('my_event') || 'My Event');

        const createMyEventBtn = ()=>{
          const btn = document.createElement('a');
          btn.className = `v2-header-cta ${MY_EVENT_CLASS}`;
          btn.setAttribute('data-discover', 'true');
          btn.href = targetHref;
          btn.textContent = targetText;
          btn.addEventListener('click', (ev) => {
            if (ev.defaultPrevented) return;
            if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
            if (spaInAppNavigate(targetHref)) ev.preventDefault();
          });
          return btn;
        };

        const actions = document.querySelector('.v2-header-actions');
        const signOutBtn = actions && actions.querySelector('[data-pub="0"]');
        if (signOutBtn) {
          actions.insertBefore(createMyEventBtn(), signOutBtn);
        }

        const mobileBottom = document.querySelector('.v2-mobile-menu-bottom');
        const mobileSignOutBtn = mobileBottom && mobileBottom.querySelector('[data-pub="0"]');
        if (mobileSignOutBtn) {
          mobileBottom.insertBefore(createMyEventBtn(), mobileSignOutBtn);
        }
      }
      setMobileGuestMenuMode();
    }
    
    const headerAssetRoot = "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui/assets/header/";
    const root = document.querySelector("nav.v2-header");
    const qs = (query)=>(root.querySelector(query));
    const addEvent = (query, event, listener)=>(qs(query).addEventListener(event, listener));
    const getHeaderLinks = ()=>{
      const useUkWordPressLinks = shouldUseUkWordPressLinks();
      return {
        left: [
          { key: "services_prices", href: withLangParam("/events/services-and-prices", lang) },
          { key: "how_it_works", href: useUkWordPressLinks ? UK_WORDPRESS_LINKS.how_it_works : "/how-it-works" }
        ],
        right: [
          { key: "faq", href: useUkWordPressLinks ? UK_WORDPRESS_LINKS.faq : "/faq" },
          { key: "blog", href: useUkWordPressLinks ? UK_WORDPRESS_LINKS.blog : "/blog" },
          { key: "contact_us", href: useUkWordPressLinks ? UK_WORDPRESS_LINKS.contact_us : "/contact-us" }
        ],
      };
    };
    const applyHomeLink = ()=>{
      const logo = qs(".v2-header-logo");
      if (!logo){
        return;
      }
      logo.setAttribute("href", shouldUseUkWordPressLinks() ? UK_WORDPRESS_LINKS.home : "/");
    };

    const appendHeaderLink = (key, href, section, includeDesktop = true, includeMobile = true)=>{
      const text = key === "faq" ? "FaQ" : t(key);
      const mobile = qs(`#mobile-links`);
      if (includeDesktop){
        const ref = qs(`.v2-header-section.${section}`);
        ref.innerHTML += `<a class="v2-header-nav-link" href="${href}" data-discover="${key}">${text}</a>`;
      }
      if (includeMobile){
        mobile.innerHTML += `<a class="v2-header-nav-link" href="${href}" data-discover="${key}">${text}</a>`;
      }
    }

    const isGuestRoute = ()=>{
      return /^\/guest\/[^/?#]+(?:\/[^?#]*)?$/.test(window.location.pathname);
    };

    const setMobileGuestMenuMode = ()=>{
      const mobileMenu = qs('.v2-header-mobile-menu');
      if (!mobileMenu){
        return;
      }
      const guestMode = isGuestRoute();
      mobileMenu.classList[guestMode ? 'add' : 'remove']('guest-mobile-minimal');
      if (!guestMode){
        return;
      }
      mobileMenu.querySelectorAll('.v2-header-cta').forEach((el)=>{
        el.style.display = 'none';
      });
    };

    const getGuestHomeUrl = ()=>{
      const match = window.location.pathname.match(/^\/guest\/([^/?#]+)/);
      if (!match){
        return null;
      }
      return `/guest/${match[1]}`;
    };

    const renderGuestMobileLinks = ()=>{
      const mobile = qs("#mobile-links");
      const guestHomeUrl = getGuestHomeUrl();
      if (!mobile || !guestHomeUrl){
        return false;
      }
      mobile.innerHTML += `<a class="v2-header-nav-link" href="${guestHomeUrl}" data-discover="guest-home">${t('home')}</a>`;
      return true;
    };

    const renderHeaderLinks = ()=>{
      const left = qs(".v2-header-section.left");
      const right = qs(".v2-header-section.right");
      const mobile = qs("#mobile-links");

      left.innerHTML = "";
      right.innerHTML = "";
      mobile.innerHTML = "";

      const headerLinks = getHeaderLinks();
      ["left", "right"].forEach(section=>{
        headerLinks[section].forEach(link=>{
          appendHeaderLink(link.key, link.href, section, true, false);
        });
      });

      if (!renderGuestMobileLinks()){
        ["left", "right"].forEach(section=>{
          headerLinks[section].forEach(link=>{
            appendHeaderLink(link.key, link.href, section, false, true);
          });
        });
      }

      applyHomeLink();
      setMobileGuestMenuMode();
    };

    getAuthTokenFromIDB().then(isLoggedIn => headerBtnsSetup(isLoggedIn));
    renderHeaderLinks();
    window.addEventListener('routechange', ()=>{
      if (!isFirst){
        isFirst = true;
        return;
      }
      getAuthTokenFromIDB().then(isLoggedIn => headerBtnsSetup(isLoggedIn));
      renderHeaderLinks();
    });

    const isMobileMenuOpen = ()=>{
      return qs('.v2-header-mobile-menu').classList.contains('open');
    }
    const closeMobileMenu = ()=>{
      qs('.v2-header-mobile-menu').classList.remove('open');
      qs('.v2-header-mobile-toggle .header-icon').src = headerAssetRoot + 'burger.svg';
      document.body.classList.remove('v2-mobile-menu-open');
    }
    const openMobileMenu = ()=>{
      qs('.v2-header-mobile-menu').classList.add('open');
      qs('.v2-header-mobile-toggle .header-icon').src = headerAssetRoot + 'cross.svg';
      document.body.classList.add('v2-mobile-menu-open');
    }
    const handleMobileToggle = ()=>{
      if (isMobileMenuOpen()) { closeMobileMenu(); } else { openMobileMenu(); }
    }
    addEvent('.v2-header-mobile-toggle', 'click', handleMobileToggle);

    const closeBtn = qs('.v2-mobile-menu-close');
    if (closeBtn) { closeBtn.addEventListener('click', closeMobileMenu); }

    const mobileLinksContainer = qs('#mobile-links');
    if (mobileLinksContainer) {
      mobileLinksContainer.addEventListener('click', (e) => {
        if (e.target.closest('.v2-header-nav-link')) { closeMobileMenu(); }
      });
    }

    const mobileSocialsContainer = qs('.v2-mobile-menu-socials');
    if (mobileSocialsContainer) {
      mobileSocialsContainer.innerHTML = [
        { href: 'https://www.instagram.com/addmoments.co', ariaLabel: 'Instagram', svg: '<svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"></path></svg>' },
        { href: 'https://t.me/addmoments', ariaLabel: 'Telegram', svg: '<svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.5 28.1-37.5 17.5L238 356.3l-50 48.1c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L116 282.3 14.3 250.5c-22.1-6.9-22.5-22.1 4.6-32.7L416.9 64.5c18.4-6.9 34.5 4.1 29.8 34.1z"></path></svg>' },
        { href: 'tel:+380732330733', ariaLabel: 'Phone', svg: '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"></path></svg>' }
      ].map(s => `<a href="${s.href}" aria-label="${s.ariaLabel}" target="_blank" rel="noopener noreferrer">${s.svg}</a>`).join('');
    }
  }

  const makeT = async (lang)=>{
    const publicUrl = document.querySelector("#grabPubUrl")?.getAttribute("href") || "";
    const langJson = `${publicUrl}/assets/lang/${lang}-headfoot.json`;
    const langData = await fetch(langJson).then(res => res.json());
    const t = k => langData[k] || k;
    return t;
  }

  const setUpAll = async (lang, isWordPress = false)=>{
    const t = await makeT(lang);
    // Footer is now handled by React component - no need to call setUpFooter
    setUpHeader(t, lang, isWordPress);

    document.querySelectorAll('[data-t]').forEach(elem => {
      const key = elem.getAttribute('data-t');
      elem.textContent = t(key);
    });

    document.querySelectorAll('[data-t-placeholder]').forEach(elem => {
      const key = elem.getAttribute('data-t-placeholder');
      elem.placeholder = t(key);
    });

    const langSelectors = [
      document.querySelector('#langSel'),
      // Note: langSel2 is now handled by the React Footer component
      document.querySelector('#langSelMobile'),
    ];

    const currLang = t("lang_code");

    langSelectors.forEach(selector => {
      if (selector) selector.value = currLang;
    });

    setupLangSelectors();

    // Footer language text is now handled by React component
  }

  const isWordPress = typeof window.wp !== 'undefined';

  if (!isWordPress){
    if (window["currLng"]){
      setUpAll(window["currLng"], isWordPress);
    } else {
      const cap = window["onLng"] || (()=>{});
      window["onLng"] = (lang)=>{
        cap(lang);
        setUpAll(lang, isWordPress);
      }
    }
    return;
  }

  setUpAll("en", isWordPress);
})()