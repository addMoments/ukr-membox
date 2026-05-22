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
  };

  const withLangParam = (url, lang = "en")=>{
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}lang=${encodeURIComponent(lang || "en")}`;
  };

  const setUpFooter = (t = (k)=>k, lang = "en")=>{
    const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const SITE_ROOT = "https://addmoments.com.ua";
    const isUkLang = lang === "uk";
    const toHref = (path)=>{
      return isLocalHost ? path : `${SITE_ROOT}${path}`;
    };
    const UK_FOOTER_LINKS = {
      home: "https://addmoments.com.ua/uk/",
      how_it_works: "https://addmoments.com.ua/uk/how-it-works-addmoments/",
      faq: "https://addmoments.com.ua/uk/faq-addmoments/",
      blog: "https://addmoments.com.ua/uk/addmoments-blog/",
      contact: "https://addmoments.com.ua/uk/contact-addmoments/",
      privacy: "https://addmoments.com.ua/uk/privacy-policy-addmoments/",
      terms: "https://addmoments.com.ua/uk/terms-of-service-uk/",
    };
    const labels = isUkLang ? {
      companyTitle: "Компанія",
      productTitle: "Продукт",
      privacy: "Політика конфіденційності",
      terms: "Умови обслуговування",
      contact: "Контакт",
      services: "Послуги та ціни",
      howItWorks: "Як це працює",
      faq: "FAQ",
      blog: "Блог",
      signIn: "Увійти",
      getStarted: "Почати",
    } : {
      companyTitle: "Company",
      productTitle: "Product",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      contact: "Contact",
      services: "Services & Prices",
      howItWorks: "How it works",
      faq: "FaQ",
      blog: "Blog",
      signIn: "Sign in",
      getStarted: "Get started",
    };
    const footerColumns = [
      {
        titleSelector: ".v2-footer-title-company",
        titleLabel: labels.companyTitle,
        listSelector: ".v2-footer-links-company",
        links: [
          { label: labels.privacy, href: isUkLang ? UK_FOOTER_LINKS.privacy : toHref("/privacy-policy/") },
          { label: labels.terms, href: isUkLang ? UK_FOOTER_LINKS.terms : toHref("/terms-of-service/") },
          { label: labels.contact, href: isUkLang ? UK_FOOTER_LINKS.contact : toHref("/contact-us") }
        ]
      },
      {
        titleSelector: ".v2-footer-title-product",
        titleLabel: labels.productTitle,
        listSelector: ".v2-footer-links-product",
        links: [
          { label: labels.services, href: toHref(withLangParam("/events/services-and-prices", lang)) },
          { label: labels.howItWorks, href: isUkLang ? UK_FOOTER_LINKS.how_it_works : toHref("/how-it-works") },
          { label: labels.faq, href: isUkLang ? UK_FOOTER_LINKS.faq : toHref("/faq") }
        ]
      },
      {
        listSelector: ".v2-footer-links-more",
        links: [
          { label: labels.blog, href: isUkLang ? UK_FOOTER_LINKS.blog : toHref("/blog") },
          { label: labels.signIn, href: toHref("/signin") },
          { label: labels.getStarted, href: toHref("/events/services-and-prices?entry=get-started") }
        ]
      }
    ];

    const footerSocials = [
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

    const root = document.querySelector("footer.v2-footer");
    if (!root){
      return;
    }
    const qs = (query) => root.querySelector(query);
    const footerLogo = qs(".v2-footer-logo");
    if (footerLogo){
      footerLogo.setAttribute("href", isUkLang ? UK_FOOTER_LINKS.home : `${SITE_ROOT}/`);
    }
  
    footerColumns.forEach(column => {
      if (column.titleSelector){
        const titleNode = qs(column.titleSelector);
        if (titleNode){
          titleNode.textContent = column.titleLabel;
        }
      }

      const linksContainer = qs(column.listSelector);
      if (!linksContainer){
        return;
      }

      linksContainer.innerHTML = "";
      column.links.forEach(link => {
        linksContainer.innerHTML += `<li><a class="v2-footer-link" href="${link.href}">${link.label}</a></li>`;
      });
    });
  
    const socialsContainer = qs(".v2-footer-social");
    if (socialsContainer){
      socialsContainer.innerHTML = "";
      footerSocials.forEach(social => {
        const iconMarkup = social.iconSvg || `<i class="${social.iconClass}" aria-hidden="true"></i>`;
        socialsContainer.innerHTML += `<a href="${social.href}" class="v2-footer-social-link ${social.styleClass}" aria-label="${social.ariaLabel}" target="_blank" rel="noopener noreferrer">${iconMarkup}</a>`;
      });
    }
  
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

        const mobileMenu = document.querySelector('.v2-header-mobile-menu');
        const mobileSignOutBtn = mobileMenu && mobileMenu.querySelector('[data-pub="0"]');
        if (mobileSignOutBtn) {
          mobileMenu.insertBefore(createMyEventBtn(), mobileSignOutBtn);
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
    const handleMobileToggle = ()=>{
      const menuOpen = isMobileMenuOpen();
      qs('.v2-header-mobile-menu').classList[menuOpen ? 'remove' : 'add']('open');
      qs('.v2-header-mobile-toggle .header-icon').src = headerAssetRoot + (!menuOpen ? 'cross.svg' : 'burger.svg');
    }
    addEvent('.v2-header-mobile-toggle', 'click', handleMobileToggle);
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
    setUpFooter(t, lang);
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
      document.querySelector('#langSel2'),
      document.querySelector('#langSelMobile'),
    ];

    const currLang = t("lang_code");

    langSelectors.forEach(selector => {
      selector.value = currLang;
    });

    setupLangSelectors();

    const footerLangText = document.querySelector('.v2-footer-lang-text');
    if (footerLangText){
      footerLangText.textContent = currLang === "uk" ? "Українська (UA)" : "English (US)";
    }
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