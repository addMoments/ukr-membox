/* Free paket WP header yayini (18 Kasim 2026). free-wp.js + yayin; wp-admin sekmesinde Console'a yapistir. */
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

/* ---- Yayin (wp-admin oturumu acik sekmede, DevTools Console'a yapistir) ---- */
(async function amFreePublish() {
  var T = window.amFreeWp;
  var TARGETS = [{ id: 867, widget: 'c4fae6c', lang: 'en' }, { id: 3938, widget: '43bae5f', lang: 'uk' }];
  var stamp = '20261118free';
  var nonce = (await (await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'same-origin' })).text()).trim();
  if (!/^[a-f0-9]{6,}$/.test(nonce)) throw new Error('REST nonce alinamadi (wp-admin oturumu acik mi?): ' + nonce.slice(0, 60));
  var api = function (id, opts) {
    return fetch('/?rest_route=/wp/v2/elementor_library/' + id + (opts ? '' : '&context=edit'), Object.assign({
      credentials: 'same-origin', redirect: 'manual', headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' }
    }, opts || {})).then(function (r) { if (!r.ok) throw new Error('REST ' + id + ' ' + r.status); return r.json(); });
  };
  var findWidget = function (els, wid) {
    for (var i = 0; i < els.length; i++) {
      if (els[i].id === wid) return els[i];
      var hit = els[i].elements && findWidget(els[i].elements, wid);
      if (hit) return hit;
    }
    return null;
  };
  var plans = [];
  for (var t of TARGETS) {
    var post = await api(t.id);
    var raw = post.meta && post.meta._elementor_data;
    if (!raw) throw new Error(t.id + ': _elementor_data yok');
    var data = JSON.parse(raw);
    var w = findWidget(data, t.widget);
    if (!w || !w.settings || typeof w.settings.html !== 'string') throw new Error(t.id + ': widget ' + t.widget + ' bulunamadi');
    var before = w.settings.html;
    w.settings.html = T.header(before, t.lang); // bulamazsa ya da zaten yapildiysa hata atar, hicbir sey yazilmaz
    plans.push({ t: t, raw: raw, data: data, delta: w.settings.html.length - before.length });
  }
  for (var p of plans) {
    localStorage.setItem('amWpBackup-' + p.t.id + '-' + stamp, p.raw);
    await api(p.t.id, { method: 'POST', body: JSON.stringify({ meta: { _elementor_data: JSON.stringify(p.data) } }) });
    var check = await api(p.t.id);
    if (check.meta._elementor_data.indexOf('am-nav-signin') < 0) throw new Error(p.t.id + ': yazildi ama dogrulanamadi');
    console.log('[amFree] ' + p.t.id + ' (' + p.t.lang + ') yazildi, +' + p.delta + ' karakter, yedek localStorage amWpBackup-' + p.t.id + '-' + stamp);
  }
  var tools = await (await fetch('/wp-admin/admin.php?page=elementor-tools', { credentials: 'same-origin' })).text();
  var m = tools.match(/id="elementor-clear-cache-button"[^>]*data-nonce="([^"]+)"/) || tools.match(/data-nonce="([^"]+)"[^>]*id="elementor-clear-cache-button"/);
  if (!m) { console.warn('[amFree] onbellek nonce bulunamadi: Elementor > Tools > Clear Files & Data elle'); return; }
  var body = new URLSearchParams({ action: 'elementor_clear_cache', _nonce: m[1] });
  var res = await (await fetch('/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'same-origin', body: body })).text();
  console.log('[amFree] elementor_clear_cache: ' + res + '  -- TAMAM');
})().catch(function (e) { console.error('[amFree] DURDU, hicbir sey yazilmadiysa guvenli: ' + e.message); });
