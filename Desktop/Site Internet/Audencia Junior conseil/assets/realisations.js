/* ============================================================
   AJC — Réalisations (index + détail)
   Charge contenu/realisations.json puis rend la page.
   ============================================================ */
(function () {
  'use strict';

  // ── Reveal on scroll (idempotent) ─────────────────────────
  function observeReveal() {
    const els = document.querySelectorAll('.real-page .reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const delay = parseInt(e.target.dataset.delay || '0', 10);
          setTimeout(() => e.target.classList.add('is-visible'), delay);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  }

  // ── Langue : renvoie la valeur "_en" si dispo en mode anglais, sinon le français
  function lang() {
    if (window.AJCI18n && window.AJCI18n.lang) return window.AJCI18n.lang();
    return localStorage.getItem('ajc-lang') === 'en' ? 'en' : 'fr';
  }
  function tr(obj, key) {
    if (!obj) return '';
    if (lang() === 'en' && obj[key + '_en'] != null && obj[key + '_en'] !== '') return obj[key + '_en'];
    return obj[key] != null ? obj[key] : '';
  }

  function imageOrPlaceholder(item) {
    if (!item.image) return `<span class="placeholder-label">${escapeHtml(item.image_alt || 'Photo')}</span>`;
    return `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.image_alt || item.client)}" onerror="this.outerHTML='<span class=&quot;placeholder-label&quot;>${escapeHtml(item.image_alt || 'Photo')}</span>'">`;
  }

  // Libellé du domaine affiché dans la bulle (bas-droite de l'image)
  var DOMAIN_LABELS = {
    fr: { marketing: 'Marketing', communication: 'Communication', rse: 'RSE', bigdata: 'Big Data', finance: 'Finance' },
    en: { marketing: 'Marketing', communication: 'Communication', rse: 'CSR', bigdata: 'Big Data', finance: 'Finance' }
  };
  function domainLabel(item) {
    var key = (item.expertise && item.expertise[0]) || '';
    return (DOMAIN_LABELS[lang()] || DOMAIN_LABELS.fr)[key] || '';
  }

  function cardHtml(item, delay) {
    const domain = domainLabel(item);
    const bubble = domain ? `<span class="case-domain">${escapeHtml(domain)}</span>` : '';
    return `
      <a href="realisation-detail.html?slug=${encodeURIComponent(item.slug)}" class="case-card reveal"
         data-year="${escapeHtml(String(item.annee || ''))}" data-client="${escapeHtml(item.client || '')}"
         data-delay="${delay}">
        <div class="case-media">
          ${imageOrPlaceholder(item)}
          <span class="case-year">${escapeHtml(String(item.annee || ''))}</span>
          ${bubble}
          <div class="case-overlay"><span class="btn-r">${lang() === 'en' ? 'View project' : 'Voir la réalisation'} <span class="arrow">→</span></span></div>
        </div>
        <div class="case-body">
          <span class="case-logo">${escapeHtml(item.client_label || item.client)}</span>
          <h3 class="case-title">${escapeHtml(tr(item, 'titre'))}</h3>
          <p class="case-desc">${escapeHtml(tr(item, 'description'))}</p>
          <span class="case-cta">${lang() === 'en' ? '→ Discover' : '→ Découvrir'}</span>
        </div>
      </a>`;
  }

  // ════════════════════════════════════════════════════════════
  // PAGE INDEX
  // ════════════════════════════════════════════════════════════
  async function initIndexPage(data) {
    // Hero
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.innerHTML = val; };
    setText('real-hero-title', tr(data.page, 'titre'));
    setText('real-hero-eyebrow-text', tr(data.page, 'eyebrow'));
    setText('real-hero-lede', tr(data.page, 'intro'));

    const statsHost = document.getElementById('real-hero-stats');
    if (statsHost && data.page.stats) {
      statsHost.innerHTML = data.page.stats.map(s =>
        `<div class="row"><span class="v">${escapeHtml(s.valeur)}</span><span class="l">${escapeHtml(tr(s, 'libelle'))}</span></div>`
      ).join('');
    }

    // Cards
    const grid = document.getElementById('case-grid');
    const cards = data.realisations.map((item, i) => cardHtml(item, (i % 3) * 60));
    if (grid) grid.innerHTML = cards.join('');

    // Témoignages
    const testGrid = document.getElementById('real-testi-grid');
    if (testGrid && data.temoignages) {
      testGrid.innerHTML = data.temoignages.map((t, i) => `
        <article class="testimonial-card reveal" data-delay="${i * 80}">
          <span class="quote-mark" aria-hidden="true">"</span>
          <p class="testimonial-quote">${escapeHtml(tr(t, 'quote'))}</p>
          <div class="testimonial-divider"></div>
          <div class="testimonial-name">${escapeHtml((t.auteur || '').toUpperCase())}</div>
          <div class="testimonial-role">${escapeHtml(tr(t, 'role'))}</div>
        </article>`).join('');
    }

    // Section "Accompagnement à l'échelle locale" (contenu éditable dans le JSON)
    const al = data.accompagnement_local;
    if (al) {
      setText('local-banner-titre', tr(al, 'banner_titre'));
      setText('local-banner-sous', tr(al, 'banner_sous_titre'));
      setText('local-eyebrow', tr(al, 'eyebrow'));
      setText('local-title', tr(al, 'titre'));
      setText('local-intro', tr(al, 'intro'));
      const ptsHost = document.getElementById('local-points');
      if (ptsHost && al.points) {
        ptsHost.innerHTML = al.points.map(p =>
          `<div class="local-point"><h3>${escapeHtml(tr(p, 'titre'))}</h3><p>${escapeHtml(tr(p, 'texte'))}</p></div>`
        ).join('');
      }
      const ctaEl = document.getElementById('local-cta');
      if (ctaEl) ctaEl.innerHTML = `${escapeHtml(tr(al, 'cta'))} <span class="arrow">→</span>`;
    }

    observeReveal();
  }

  // ════════════════════════════════════════════════════════════
  // PAGE DÉTAIL
  // ════════════════════════════════════════════════════════════
  function initDetailPage(data) {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug') || (data.realisations[0] && data.realisations[0].slug);
    const item = data.realisations.find(r => r.slug === slug) || data.realisations[0];
    if (!item) return;

    document.title = `${item.titre} — Audencia Junior Conseil`;

    // Breadcrumb
    const bc = document.getElementById('real-bc-client');
    if (bc) bc.textContent = item.client;

    // Hero
    const $ = id => document.getElementById(id);
    if ($('real-client-initiale')) $('real-client-initiale').textContent = item.client_initiale || (item.client || '?').charAt(0) + '.';
    if ($('real-client-nom')) $('real-client-nom').textContent = item.client;
    if ($('real-annee')) $('real-annee').textContent = item.annee;
    if ($('real-title')) $('real-title').innerHTML = tr(item, 'titre_detail') || tr(item, 'titre');

    const heroTagsHost = $('real-hero-tags');
    const tagsDetail = lang() === 'en' && item.tags_detail_en ? item.tags_detail_en : item.tags_detail;
    if (heroTagsHost && tagsDetail) {
      heroTagsHost.innerHTML = tagsDetail.map((t, i) =>
        `<span class="hero-tag${i === 0 ? ' solid' : ''}">${escapeHtml(t)}</span>`
      ).join('');
    }

    // Meta panel
    if (item.meta) {
      const m = item.meta;
      const setVal = (id, v) => { const el = $(id); if (el && v) el.textContent = v; };
      setVal('real-meta-duree', tr(m, 'duree'));
      setVal('real-meta-equipe', tr(m, 'equipe'));
      setVal('real-meta-livrables', tr(m, 'livrables'));
      setVal('real-meta-secteur', tr(item, 'secteur_libelle'));
    }

    // Contexte
    if (item.contexte) {
      const ctxData = item.contexte;
      if ($('real-ctx-intro')) $('real-ctx-intro').innerHTML = tr(ctxData, 'intro') || '';
      if ($('real-ctx-enjeu')) $('real-ctx-enjeu').innerHTML = tr(ctxData, 'enjeu') || '';
      if ($('real-ctx-defi')) $('real-ctx-defi').textContent = tr(ctxData, 'defi') || '';
      const objHost = $('real-objectifs');
      const objectifs = lang() === 'en' && ctxData.objectifs_en ? ctxData.objectifs_en : ctxData.objectifs;
      if (objHost && objectifs) {
        objHost.innerHTML = objectifs.map(o =>
          `<div class="objective"><div class="n">${escapeHtml(o.num)}</div><div class="t">${escapeHtml(o.texte)}</div></div>`
        ).join('');
      }
    } else {
      const ctx = document.querySelector('[data-real-section="contexte"]');
      if (ctx) ctx.style.display = 'none';
    }

    // Approche
    if (item.approche) {
      const apprData = item.approche;
      if ($('real-appr-sub')) $('real-appr-sub').textContent = tr(apprData, 'intro') || '';
      const methHost = $('real-method-grid');
      const etapes = lang() === 'en' && apprData.etapes_en ? apprData.etapes_en : apprData.etapes;
      if (methHost && etapes) {
        methHost.innerHTML = etapes.map((e, i) => `
          <article class="method-card reveal" data-delay="${i * 80}">
            <span class="badge">0${i + 1}</span>
            <div class="step">${escapeHtml(e.step)}</div>
            <h3 class="t">${escapeHtml(e.titre)}</h3>
            <p class="d">${escapeHtml(e.description)}</p>
          </article>`).join('');
      }
    } else {
      const sec = document.querySelector('[data-real-section="approche"]');
      if (sec) sec.style.display = 'none';
    }

    // Résultats
    if (item.resultats) {
      const resData = item.resultats;
      if ($('real-res-intro')) $('real-res-intro').innerHTML = tr(resData, 'intro') || '';
      const kpiHost = $('real-kpis');
      const kpis = lang() === 'en' && resData.kpis_en ? resData.kpis_en : resData.kpis;
      if (kpiHost && kpis) {
        kpiHost.innerHTML = kpis.map(k => `
          <div class="kpi${k.highlight ? ' highlight' : ''}">
            <span class="lbl">${escapeHtml(k.libelle)}</span>
            <span class="v">${escapeHtml(k.valeur)}</span>
            ${k.highlight ? '<span class="arrow-up" aria-hidden="true">↗</span>' : ''}
          </div>`).join('');
      }
      const outHost = $('real-outcomes');
      const outcomes = lang() === 'en' && resData.outcomes_en ? resData.outcomes_en : resData.outcomes;
      if (outHost && outcomes) {
        outHost.innerHTML = outcomes.map(o =>
          `<div class="outcome"><div class="t">${escapeHtml(o.titre)}</div><div class="d">${escapeHtml(o.texte)}</div></div>`
        ).join('');
      }
    } else {
      const sec = document.querySelector('[data-real-section="resultats"]');
      if (sec) sec.style.display = 'none';
    }

    // Témoignage
    if (item.temoignage) {
      const t = item.temoignage;
      if ($('real-testi-quote')) $('real-testi-quote').textContent = tr(t, 'quote');
      if ($('real-testi-name')) $('real-testi-name').textContent = (t.auteur || '').toUpperCase();
      if ($('real-testi-role')) $('real-testi-role').textContent = tr(t, 'role') || '';
    } else {
      const sec = document.querySelector('[data-real-section="temoignage"]');
      if (sec) sec.style.display = 'none';
    }

    // Cas similaires (3 autres, même expertise prioritaire)
    const others = data.realisations.filter(r => r.slug !== item.slug);
    const sameExp = others.filter(r => (r.expertise || []).some(e => (item.expertise || []).includes(e)));
    const picks = (sameExp.length >= 3 ? sameExp : sameExp.concat(others)).slice(0, 3);
    const simHost = document.getElementById('real-similar-grid');
    if (simHost) simHost.innerHTML = picks.map((p, i) => cardHtml(p, i * 80));

    observeReveal();
  }

  // ════════════════════════════════════════════════════════════
  // BOOT
  // ════════════════════════════════════════════════════════════
  async function boot() {
    let data;
    try {
      const res = await fetch('contenu/realisations.json');
      data = await res.json();
    } catch (e) {
      console.error('Impossible de charger contenu/realisations.json', e);
      return;
    }
    const mode = document.body.dataset.realPage;
    const render = () => {
      if (mode === 'index')  initIndexPage(data);
      if (mode === 'detail') initDetailPage(data);
    };
    render();
    // Re-rendu instantané quand l'utilisateur bascule FR/EN
    document.addEventListener('ajc:langchange', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
