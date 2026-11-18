/* Free paket — WordPress header sablonu (Fatih 18 Kasim 2026).
 *
 * Istek (WhatsApp 18 Kasim 11:31 + taslak gorsel):
 *  1) header'da "Get started" -> "Get Started Free" ve yaninda "Sign in" (bugun WordPress header'inda Sign in yok, yalniz
 *     footer'da; React header'inda var);
 *  2) "Get started free" kayit sayfasini acar (/signup, React; free paket etkinligi tek adimda acilir).
 *
 * Bu dosya Elementor HTML widget'inin kayitli `settings.html` metnini donusturur (yalniz metin degistirme; her adim yerini
 * bulamazsa hata atar, ikinci kez calistirmak hata verir cunku eski "Get started" artik yok). Kullanim demo-wp.js ile ayni:
 * tarayicida wp-admin oturumuyla `_elementor_data` REST'ten okunur, header widget'inin html'i buradan gecirilip geri
 * yazilir (../demo/README.md). Node'da: require('./free-wp.js').header(html, 'en').
 *
 * Widget'lar: header sablonu EN 867 / c4fae6c, UK 3938 / 43bae5f.
 */
(function (root) {
  var TEXT = {
    // WordPress linkleri dil parametresini en / ua olarak tasiyor (React i18n ua'yi uk sayar).
    en: { lang: 'en', signIn: 'Sign in', cta: 'Get started free' },
    uk: { lang: 'ua', signIn: 'Увійти', cta: 'Почати безкоштовно' }
  };

  var replaceRe = function (html, re, to, label) {
    if (!re.test(html)) throw new Error('free-wp: bulunamadi: ' + label);
    return html.replace(re, to);
  };

  var HEADER_CSS = [
    '',
    '  /* Free paket (musteri 18 Kasim 2026): "Sign in" her zaman gorunur, CTA "Get started free". */',
    '  .am-nav-right a.am-nav-signin { color: var(--content-high, #000); }',
    '  .am-menu-footer a.am-menu-signin {',
    '    display: block; text-align: center; font-family: var(--font-body); font-weight: 600; font-size: 18px;',
    '    color: var(--content-high, #000); text-decoration: none; padding: 4px 0;',
    '  }',
    '  /* Iki ek ogeyle dar masaustunde (1025-1260 px) sag grup orta linklere yapisiyordu: bosluklar daralir, 1180 px altinda CTA ikonu kuculur. */',
    '  @media (min-width: 1181px) and (max-width: 1260px) {',
    '    .am-header-inner { padding: 0 32px; }',
    '    .am-nav-center { gap: 22px; margin-left: 32px; }',
    '    .am-nav-right { gap: 16px; }',
    '  }',
    '  @media (min-width: 1025px) and (max-width: 1180px) {',
    '    .am-nav-right { gap: 10px; }',
    '    .am-nav-right .am-btn { padding-left: 14px; gap: 6px; }',
    '    .am-nav-right .am-btn svg { width: 22px; height: 22px; }',
    '  }',
    ''
  ].join('\n');

  // UK etiketleri (Послуги та ціни, Питання та відповіді, Почати безкоштовно) daha uzun: 1025-1420 px'te sag grup
  // "Живе демо"nun ustune biniyor ve sayfa yatay tasiyordu. Yalniz UK sablonunda: kenar boslugu ve araliklar daralir,
  // 1260 px'e kadar CTA'nin ok ikonu gizlenir (Playwright ile 1025-1440 px olculdu).
  var HEADER_CSS_UK = [
    '  @media (min-width: 1261px) and (max-width: 1420px) {',
    '    .am-header-inner { padding: 0 32px; }',
    '    .am-nav-center { gap: 22px; margin-left: 32px; }',
    '    .am-nav-right { gap: 16px; }',
    '  }',
    '  @media (min-width: 1025px) and (max-width: 1260px) {',
    '    .am-header-inner { padding: 0 20px; }',
    '    .am-nav-center { gap: 12px; margin-left: 16px; }',
    '    .am-nav-right { gap: 9px; }',
    '    .am-nav-center a, .am-nav-right a { font-size: 12.5px; }',
    '    .am-nav-right .am-lang { padding: 6px 10px; }',
    '    .am-nav-right .am-btn { padding: 9px 16px; }',
    '    .am-nav-right .am-btn svg { display: none; }',
    '  }',
    '  @media (min-width: 1025px) and (max-width: 1100px) {',
    '    .am-header-inner { padding: 0 16px; }',
    '    .am-nav-center { gap: 10px; margin-left: 12px; }',
    '    .am-nav-right { gap: 8px; }',
    '    .am-nav-center a, .am-nav-right a { font-size: 12px; }',
    '    .am-nav-right .am-btn { padding: 9px 14px; font-size: 13px; }',
    '  }',
    ''
  ].join('\n');

  // "Get started" CTA'sinin href'i: /events/services-and-prices/?lang=en&entry=get-started (masaustu) ya da
  // ?entry=get-started&lang=en (mobil menu). Kayitli html'de & ya da &amp; olabilir.
  var ctaHref = '/events/services-and-prices/\\?(?:lang=(?:en|ua)&(?:amp;)?entry=get-started|entry=get-started&(?:amp;)?lang=(?:en|ua))';

  var header = function (html, lang) {
    var tx = TEXT[lang];
    if (!tx) throw new Error('free-wp: dil yok: ' + lang);
    var signupHref = '/signup?lang=' + tx.lang;
    var signinHref = '/signin?lang=' + tx.lang;
    var oldLabel = lang === 'uk' ? 'Почати' : 'Get started';

    // Stil: .am-nav-right kurallarinin bulundugu <style> blogunun sonuna (widget'ta ilk blok).
    var navRule = html.indexOf('.am-nav-right {');
    if (navRule < 0) throw new Error('free-wp: bulunamadi: header style');
    var close = html.indexOf('</style>', navRule);
    if (close < 0) throw new Error('free-wp: bulunamadi: header style sonu');
    html = html.slice(0, close) + HEADER_CSS + (lang === 'uk' ? HEADER_CSS_UK : '') + html.slice(close);

    // Masaustu: dil seciciden sonraki CTA; onune Sign in, kendisi kayit sayfasina.
    html = replaceRe(
      html,
      new RegExp('<a href="' + ctaHref + '" class="am-btn" aria-label="Get started">(\\s*)' + oldLabel + '(\\s*<svg)'),
      function (_, sp, svg) {
        return '<a href="' + signinHref + '" class="am-nav-signin">' + tx.signIn + '</a>\n      ' +
          '<a href="' + signupHref + '" class="am-btn" aria-label="' + TEXT.en.cta + '">' + sp + tx.cta + svg;
      },
      'masaustu CTA'
    );
    // Mobil menu altindaki CTA; ustune Sign in.
    html = replaceRe(
      html,
      new RegExp('(<div class="am-menu-footer">\\s*)<a href="' + ctaHref + '" class="am-btn">(\\s*)' + oldLabel + '(\\s*<span class="am-btn-icon">)'),
      function (_, head, sp, icon) {
        return head + '<a href="' + signinHref + '" class="am-menu-signin">' + tx.signIn + '</a>\n    ' +
          '<a href="' + signupHref + '" class="am-btn">' + sp + tx.cta + icon;
      },
      'mobil menu CTA'
    );
    return html;
  };

  var api = { header: header, TEXT: TEXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.amFreeWp = api;
})(typeof window !== 'undefined' ? window : this);
