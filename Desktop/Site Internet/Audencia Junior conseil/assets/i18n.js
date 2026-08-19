/* ============================================================
   AJC — Bascule de langue FR / EN (one-click)
   - Le français est la version source dans le HTML.
   - Les traductions anglaises vivent dans contenu/i18n.json.
   - Marquage : data-i18n="cle" (contenu HTML) ou
                data-i18n-attr="attribut:cle;autre:cle2" (attributs).
   - Choix mémorisé dans localStorage ('ajc-lang').
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ajc-lang';
  var DICT_URL = 'contenu/i18n.json';
  var dict = null;                 // { en: { cle: "html" } }
  var htmlOriginals = new WeakMap(); // element -> innerHTML français
  var attrOriginals = new WeakMap(); // element -> { attribut: valeur fr }

  function getLang() {
    var l = localStorage.getItem(STORAGE_KEY);
    return l === 'en' ? 'en' : 'fr';
  }
  function saveLang(l) { localStorage.setItem(STORAGE_KEY, l); }

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);

    // 1) Contenus (innerHTML)
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (!htmlOriginals.has(el)) htmlOriginals.set(el, el.innerHTML);
      if (lang === 'fr') {
        el.innerHTML = htmlOriginals.get(el);
      } else {
        var key = el.getAttribute('data-i18n');
        var val = dict && dict[lang] && dict[lang][key];
        el.innerHTML = (val != null) ? val : htmlOriginals.get(el);
      }
    });

    // 2) Attributs (placeholder, aria-label, content…)
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr');
      if (!attrOriginals.has(el)) attrOriginals.set(el, {});
      var store = attrOriginals.get(el);
      spec.split(';').forEach(function (pair) {
        var bits = pair.split(':');
        var attr = (bits[0] || '').trim();
        var key = (bits[1] || '').trim();
        if (!attr || !key) return;
        if (!(attr in store)) store[attr] = el.getAttribute(attr) || '';
        if (lang === 'fr') {
          el.setAttribute(attr, store[attr]);
        } else {
          var val = dict && dict[lang] && dict[lang][key];
          el.setAttribute(attr, (val != null) ? val : store[attr]);
        }
      });
    });

    // 3) État actif des boutons FR/EN
    document.querySelectorAll('.lang-opt').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-lang') === lang);
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    // 4) Permet au contenu injecté en JS (cartes, carrousel…) de se re-traduire
    document.dispatchEvent(new CustomEvent('ajc:langchange', { detail: { lang: lang } }));
  }

  function ensureDictThen(cb) {
    if (dict) { cb(); return; }
    fetch(DICT_URL)
      .then(function (r) { return r.json(); })
      .then(function (d) { dict = d; cb(); })
      .catch(function () { cb(); }); // en cas d'échec : on garde le français
  }

  function switchTo(lang) {
    saveLang(lang);
    if (lang === 'en') ensureDictThen(function () { applyLang('en'); });
    else applyLang('fr');
  }

  function wireButtons() {
    document.querySelectorAll('.lang-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        switchTo(b.getAttribute('data-lang'));
      });
    });
  }

  function init() {
    wireButtons();
    var lang = getLang();
    if (lang === 'en') {
      ensureDictThen(function () { applyLang('en'); });
    } else {
      applyLang('fr');
      // pré-charge le dictionnaire pour une bascule instantanée ensuite
      ensureDictThen(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API publique : re-appliquer après rendu dynamique (ex : realisations.js)
  window.AJCI18n = {
    apply: function () { applyLang(getLang()); },
    lang: getLang,
    ready: function (cb) { ensureDictThen(cb); }
  };
})();
