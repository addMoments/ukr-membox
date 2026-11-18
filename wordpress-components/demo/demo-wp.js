/* Canli demo — WordPress ana sayfa hero'su ve header sablonu (musteri 17 Kasim 2026).
 *
 * Istek (WhatsApp, Fatih + ekip):
 *  - hero gorselindeki eski QR kaldirilsin ("2 code will confuse"), yerine demo karti: QR + "LIVE DEMO" + "Try it as a guest";
 *  - "Create Your Event" yanina "Try the live demo" dugmesi ve altinda "See what your guests will see. No registration, no app.";
 *  - header'da "Live demo" linki (lime nokta);
 *  - QR ve dugme ikisi de olsun (ziyaretci webden de acabilir), telefon ve masaustu ayni, kapatma (x) yok, sabit yerinde.
 *
 * Bu dosya Elementor HTML widget'larinin kayitli `settings.html` metnini donusturur (yalniz metin degistirme, her adim
 * bulunamazsa hata atar; ikinci kez calistirmak hata verir, cunku eski QR artik yok). Kullanim: tarayicida wp-admin
 * oturumuyla `_elementor_data` REST'ten okunur, ilgili widget'in html'i buradan gecirilip geri yazilir (README.md).
 * Node'da: require('./demo-wp.js').hero(html, 'en').
 *
 * Widget'lar: ana sayfa EN 46 / hero 1c4d882, UK 3824 / hero 00f0c81; header sablonu EN 867 / c4fae6c, UK 3938 / 43bae5f.
 */
(function (root) {
  // Fatih'in verdigi demo linki /l/q... -> /guest/... (backend linkHandler.go). Dugmeler ?lang= ile dogrudan misafir
  // sayfasina gider (yonlendirme sorguyu duser); QR kisa linki tasir, telefon kendi dilinde acar.
  var DEMO_GUEST_PATH = '/guest/dfKM38bpSv-KvP1rDjMvzA';
  // https://addmoments.com.ua/l/qdfKM38bpSv-KvP1rDjMvzA (demo-qr.svg ile ayni; qrcode npm, ECC M, kenar bosluksuz).
  var QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h33v33H0z"/><path stroke="#14141c" d="M0 0.5h7m3 0h2m2 0h2m2 0h2m2 0h2m2 0h7M0 1.5h1m5 0h1m1 0h1m2 0h3m1 0h3m1 0h2m2 0h2m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m3 0h1m5 0h1m2 0h1m2 0h2m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m2 0h1m3 0h1m1 0h1m1 0h1m3 0h2m1 0h1m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m1 0h2m5 0h1m3 0h3m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m3 0h5m2 0h2m2 0h4m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 7.5h1m2 0h1m2 0h3m1 0h4M0 8.5h1m1 0h1m1 0h1m1 0h1m2 0h5m1 0h1m1 0h5m2 0h1m3 0h1m2 0h1M0 9.5h1m1 0h1m2 0h1m1 0h1m1 0h2m5 0h1m3 0h2m2 0h4m4 0h1M1 10.5h1m1 0h1m2 0h1m1 0h1m1 0h2m1 0h1m3 0h1m7 0h3m2 0h1m1 0h1M0 11.5h1m1 0h2m1 0h1m1 0h1m2 0h2m4 0h1m4 0h1m1 0h4m1 0h1M1 12.5h2m1 0h3m1 0h1m2 0h1m3 0h1m4 0h2m1 0h1m2 0h2m1 0h1m1 0h1M0 13.5h1m1 0h1m1 0h1m2 0h5m1 0h1m1 0h1m3 0h1m1 0h1m3 0h2m2 0h1m2 0h1M0 14.5h5m1 0h1m2 0h1m1 0h4m2 0h1m6 0h2m1 0h1m1 0h1m1 0h2M0 15.5h1m2 0h1m3 0h1m1 0h1m4 0h2m1 0h1m1 0h1m1 0h3m2 0h2m1 0h1m1 0h1M3 16.5h4m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m2 0h2m2 0h3m2 0h1M2 17.5h2m1 0h1m3 0h3m2 0h1m2 0h2m1 0h1m3 0h4m3 0h1M2 18.5h1m3 0h2m2 0h1m2 0h1m2 0h1m1 0h1m1 0h3m1 0h2m4 0h3M1 19.5h1m2 0h2m3 0h4m2 0h4m1 0h2m1 0h2m2 0h2m3 0h1M0 20.5h2m1 0h1m1 0h2m1 0h3m2 0h4m1 0h3m4 0h5M1 21.5h2m9 0h1m1 0h7m2 0h3m3 0h4M0 22.5h1m1 0h2m1 0h4m2 0h3m1 0h2m3 0h2m2 0h1m1 0h1m1 0h1m1 0h3M1 23.5h2m1 0h2m4 0h3m3 0h3m2 0h1m2 0h1m2 0h1m4 0h1M0 24.5h1m1 0h3m1 0h2m3 0h1m2 0h4m1 0h3m2 0h5m3 0h1M8 25.5h2m2 0h3m1 0h1m5 0h3m3 0h2m1 0h1M0 26.5h7m2 0h2m1 0h1m4 0h1m5 0h2m1 0h1m1 0h1m1 0h3M0 27.5h1m5 0h1m7 0h1m1 0h1m4 0h2m1 0h1m3 0h1m2 0h2M0 28.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h2m1 0h1m5 0h1m2 0h6m1 0h2M0 29.5h1m1 0h3m1 0h1m3 0h3m1 0h2m1 0h1m2 0h4m4 0h2m2 0h1M0 30.5h1m1 0h3m1 0h1m1 0h2m1 0h4m3 0h1m1 0h1m2 0h2m3 0h1m3 0h1M0 31.5h1m5 0h1m5 0h2m1 0h1m1 0h2m1 0h2m2 0h3m1 0h1m2 0h1M0 32.5h7m1 0h3m1 0h2m2 0h3m2 0h1m1 0h3m2 0h2m1 0h2"/></svg>';

  var TEXT = {
    en: {
      lang: 'en',
      nav: 'Live demo',
      btn: 'Try the live demo',
      note: 'See what your guests will see. No registration, no app.',
      tag: 'Live demo',
      title: 'Try it as a guest',
      scan: 'Scan with your phone camera. No app needed.',
      tap: 'Tap to open the demo. No app needed.',
      aria: 'Open the live demo'
    },
    uk: {
      lang: 'uk',
      nav: 'Живе демо',
      btn: 'Спробувати демо',
      note: 'Подивіться, що побачать ваші гості. Без реєстрації та застосунку.',
      tag: 'Живе демо',
      title: 'Спробуйте як гість',
      scan: 'Наведіть камеру телефону. Застосунок не потрібен.',
      tap: 'Натисніть, щоб відкрити демо. Застосунок не потрібен.',
      aria: 'Відкрити живе демо'
    }
  };

  var demoHref = function (tx) { return DEMO_GUEST_PATH + '?lang=' + tx.lang; };

  var replaceRe = function (html, re, to, label) {
    var m = html.match(re);
    if (!m) throw new Error('demo-wp: bulunamadi: ' + label);
    return html.replace(re, to);
  };

  var HERO_CSS = [
    '',
    '  /* ─── CANLI DEMO (musteri 17 Kasim 2026) ─────────────────────────',
    '     Eski QR rozeti ve oklari yerine demo karti; CTA yaninda demo dugmesi. */',
    '  .am-hero-ctas { display: flex; flex-direction: column; gap: 12px; }',
    '  .am-hero-ctas-row { display: flex; flex-direction: column; gap: 12px; }',
    '  .am-hero-wrapper .am-btn-demo {',
    '    display: inline-flex; align-items: center; justify-content: center; gap: 12px;',
    '    width: 100%; height: 56px; padding: 0 24px 0 6px;',
    '    border: 1.5px solid var(--hero-dark); border-radius: var(--radius-pill); background: #fff;',
    '    font-family: var(--font-body); font-weight: 600; font-size: 16px; color: var(--hero-dark);',
    '    text-decoration: none; white-space: nowrap; transition: background .2s, transform .15s;',
    '  }',
    '  .am-hero-wrapper .am-btn-demo:hover { background: #f7fadf; transform: translateY(-1px); }',
    '  .am-btn-demo-icon {',
    '    display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
    '    width: 42px; height: 42px; border-radius: 50%; background: var(--hero-dark);',
    '  }',
    '  .am-hero-wrapper .am-btn-demo-icon svg { width: 14px; height: 14px; margin-left: 2px; }',
    '  .am-hero-demo-note { font-size: 14px; line-height: 1.5; color: #6b6b6b; text-align: center; }',
    '',
    '  .am-hero-wrapper .am-demo-card {',
    '    position: absolute; z-index: 7; top: 314px; left: 50%; transform: translateX(-50%);',
    '    display: flex; align-items: center; gap: 12px; width: 286px; padding: 10px 14px 10px 10px;',
    '    background: #fff; border: 2px solid var(--brand-primary); border-radius: 18px;',
    '    box-shadow: 0 14px 40px rgba(20,20,28,.18); text-decoration: none; color: var(--hero-dark);',
    '  }',
    '  .am-demo-qr { flex-shrink: 0; width: 78px; height: 78px; padding: 4px; background: #fff; }',
    '  .am-hero-wrapper .am-demo-qr svg { display: block; width: 100%; height: 100%; }',
    '  .am-demo-body { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; text-align: left; }',
    '  .am-demo-tag {',
    '    display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: var(--radius-pill);',
    '    background: var(--hero-dark); color: var(--brand-primary);',
    '    font-family: var(--font-body); font-size: 10px; font-weight: 900; line-height: 1.5; letter-spacing: .1em; text-transform: uppercase;',
    '  }',
    '  .am-demo-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--brand-primary); }',
    '  .am-demo-title { font-family: var(--font-body); font-weight: 900; font-size: 16px; line-height: 1.2; color: var(--hero-dark); }',
    '  .am-demo-note { font-family: var(--font-body); font-size: 12px; line-height: 1.4; color: #555; }',
    '  .am-demo-note-scan { display: none; }',
    '  .am-hero-wrapper .am-steps { top: 446px; }',
    '',
    '  @media (min-width: 769px) {',
    '    .am-hero-ctas-row { flex-direction: row; flex-wrap: wrap; align-items: center; }',
    '    .am-hero-wrapper .am-btn-demo { width: auto; }',
    '    .am-hero-demo-note { text-align: left; }',
    '    .am-hero-wrapper .am-demo-card {',
    '      top: 380px; left: 6px; transform: none; width: 300px; padding: 12px 16px 12px 12px; gap: 14px;',
    '      transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .4s cubic-bezier(0.16, 1, 0.3, 1);',
    '    }',
    '    .am-hero-wrapper .am-demo-card:hover { transform: translateY(-6px); box-shadow: 0 22px 54px rgba(20,20,28,.24); }',
    '    .am-demo-qr { width: 96px; height: 96px; }',
    '    .am-demo-title { font-size: 18px; }',
    '    .am-demo-note { font-size: 13px; }',
    '    .am-demo-note-scan { display: inline; }',
    '    .am-demo-note-tap { display: none; }',
    '    .am-hero-wrapper .am-steps { top: 572px; left: 24px; }',
    '  }',
    '  @media (min-width: 769px) and (max-width: 1100px) {',
    '    .am-hero-wrapper .am-demo-card { top: 322px; left: 0; width: 272px; }',
    '    .am-demo-qr { width: 84px; height: 84px; }',
    '    .am-hero-wrapper .am-steps { top: 486px; left: 18px; }',
    '  }',
    ''
  ].join('\n');

  var hero = function (html, lang) {
    var tx = TEXT[lang];
    if (!tx) throw new Error('demo-wp: dil yok: ' + lang);
    var href = demoHref(tx);

    // 1) Stil: hero'nun ilk <style> blogunun sonuna.
    html = replaceRe(html, /(\.am-qr-badge:hover \{[^}]*\}\s*)<\/style>/, function (_, a) { return a + HERO_CSS + '</style>'; }, 'hero style sonu');

    // 2) CTA: "Create Your Event" dugmesinin yanina demo dugmesi, altina not.
    html = replaceRe(
      html,
      /(<a href="\/events\/services-and-prices\/\?entry=get-started&(?:amp;)?lang=[a-z]+" class="am-btn">[\s\S]*?<\/a>)/,
      function (_, btn) {
        return '<div class="am-hero-ctas">\n' +
          '        <div class="am-hero-ctas-row">\n' +
          '        ' + btn + '\n' +
          '        <a href="' + href + '" class="am-btn-demo" target="_blank" rel="noopener">\n' +
          '          <span class="am-btn-demo-icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M5 3.2v9.6L12.6 8z" fill="#d2e823"/></svg></span>\n' +
          '          ' + tx.btn + '\n' +
          '        </a>\n' +
          '        </div>\n' +
          '        <p class="am-hero-demo-note">' + tx.note + '</p>\n' +
          '        </div>';
      },
      'Create Your Event dugmesi'
    );

    // 3) Eski QR rozeti + iki ok -> demo karti.
    html = replaceRe(
      html,
      /<!-- QR Code badge -->\s*<div class="am-qr-badge">[\s\S]*?<\/div>\s*<!-- Desktop QR Arrow -->\s*<img[^>]*am-qr-arrow-desktop[^>]*\/>\s*<!-- Mobile QR Arrow -->\s*<img[^>]*am-qr-arrow-mobile[^>]*\/>/,
      '<!-- Canli demo karti (eski QR rozeti yerine, musteri 17 Kasim 2026) -->\n' +
      '      <a class="am-demo-card" href="' + href + '" target="_blank" rel="noopener" aria-label="' + tx.aria + '">\n' +
      '        <span class="am-demo-qr">' + QR_SVG + '</span>\n' +
      '        <span class="am-demo-body">\n' +
      '          <span class="am-demo-tag">' + tx.tag + '</span>\n' +
      '          <span class="am-demo-title">' + tx.title + '</span>\n' +
      '          <span class="am-demo-note"><span class="am-demo-note-scan">' + tx.scan + '</span><span class="am-demo-note-tap">' + tx.tap + '</span></span>\n' +
      '        </span>\n' +
      '      </a>',
      'QR rozeti ve oklar'
    );
    return html;
  };

  // Adim listesi (Scan / Upload / Share) demo kartinin altinda, noktalar QR'in sol kenariyla ayni cizgide
  // (musteri 17 Kasim aksam: "replace the block of information (steps) to the left, so that it was aligned with the QR code
  // block"). Kart masaustunde left 6px + 2px kenar + 12px ic bosluk + 4px QR boslugu = 24px; 769-1100 px'te 0 + 18 = 18px.
  // 17 Kasim'da yayinlanan hero'ya uygulanir (hero() artik bu degerlerle yazar). Ikinci kez calistirmak hata verir.
  var heroStepsAlign = function (html) {
    html = replaceRe(
      html,
      /\.am-hero-wrapper \.am-steps \{ top: 572px; left: min\(330px, calc\(100% - 220px\)\); \}/,
      '.am-hero-wrapper .am-steps { top: 572px; left: 24px; }',
      'masaustu adim listesi'
    );
    html = replaceRe(
      html,
      /\.am-hero-wrapper \.am-steps \{ top: 486px; left: 15px; \}/,
      '.am-hero-wrapper .am-steps { top: 486px; left: 18px; }',
      'tablet adim listesi'
    );
    return html;
  };

  var HEADER_CSS = [
    '',
    '  /* "Live demo" linki (musteri 17 Kasim 2026): onunde lime nokta, digerlerinden koyu. */',
    '  .am-nav-center a.am-nav-demo, .am-mobile-nav a.am-nav-demo { display: inline-flex; align-items: center; gap: 8px; color: var(--content-high, #000); }',
    '  .am-nav-center a.am-nav-demo::before, .am-mobile-nav a.am-nav-demo::before {',
    '    content: ""; width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%;',
    '    background: #a8bf12; box-shadow: 0 0 0 3px rgba(210,232,35,.35);',
    '  }',
    '  .am-mobile-nav a.am-nav-demo { gap: 12px; }',
    '  /* Ucuncu link yuzunden dar masaustunde (UK etiketleriyle 1025-1060 px) sag linklere tasiyordu. */',
    '  @media (min-width: 1025px) and (max-width: 1180px) {',
    '    .am-nav-center { gap: 14px; margin-left: 18px; }',
    '    .am-nav-right { gap: 12px; }',
    '    .am-nav-center a, .am-nav-right a { font-size: 13px; }',
    '  }',
    ''
  ].join('\n');

  var header = function (html, lang) {
    var tx = TEXT[lang];
    if (!tx) throw new Error('demo-wp: dil yok: ' + lang);
    var link = '<a href="' + demoHref(tx) + '" class="am-nav-demo" target="_blank" rel="noopener">' + tx.nav + '</a>';

    // Stil: ilk <style> blogunun sonuna.
    var close = html.indexOf('</style>');
    if (close < 0) throw new Error('demo-wp: bulunamadi: header style');
    html = html.slice(0, close) + HEADER_CSS + html.slice(close);

    // Masaustu: "How it works" linkinin hemen ardina.
    html = replaceRe(
      html,
      /(<nav class="am-nav-center"[^>]*>[\s\S]*?)(\n\s*<\/nav>)/,
      function (_, body, end) { return body + '\n      ' + link + end; },
      'masaustu nav'
    );
    // Mobil menu: "How it works"ten sonra (ikinci link).
    html = replaceRe(
      html,
      /(<nav class="am-mobile-nav"[^>]*>\s*<a [^>]*>[^<]*<\/a>\s*<a [^>]*>[^<]*<\/a>)/,
      function (_, head) { return head + '\n    ' + link; },
      'mobil nav'
    );
    return html;
  };

  var api = { hero: hero, heroStepsAlign: heroStepsAlign, header: header, TEXT: TEXT, DEMO_GUEST_PATH: DEMO_GUEST_PATH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.amDemoWp = api;
})(typeof window !== 'undefined' ? window : this);
