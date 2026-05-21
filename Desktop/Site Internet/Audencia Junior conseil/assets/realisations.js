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

  function imageOrPlaceholder(item) {
    if (!item.image) return `<span class="placeholder-label">${escapeHtml(item.image_alt || 'Photo')}</span>`;
    return `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.image_alt || item.client)}" onerror="this.outerHTML='<span class=&quot;placeholder-label&quot;>${escapeHtml(item.image_alt || 'Photo')}</span>'">`;
  }

  function cardHtml(item, delay) {
    const tags = (item.tags || []).map(t => `<span class="case-tag">${escapeHtml(t)}</span>`).join('');
    const expertise = (item.expertise || []).join(',');
    return `
      <a href="realisation-detail.html?slug=${encodeURIComponent(item.slug)}" class="case-card reveal"
         data-expertise="${escapeHtml(expertise)}" data-sector="${escapeHtml(item.secteur || '')}"
         data-year="${escapeHtml(String(item.annee || ''))}" data-client="${escapeHtml(item.client || '')}"
         data-delay="${delay}">
        <div class="case-media">
          ${imageOrPlaceholder(item)}
          <span class="case-year">${escapeHtml(String(item.annee || ''))}</span>
          <div class="case-overlay"><span class="btn-r">Voir la réalisation <span class="arrow">→</span></span></div>
        </div>
        <div class="case-body">
          <span class="case-logo">${escapeHtml(item.client_label || item.client)}</span>
          <div class="case-tags">${tags}</div>
          <h3 class="case-title">${escapeHtml(item.titre)}</h3>
          <p class="case-desc">${escapeHtml(item.description || '')}</p>
          <span class="case-cta">→ Découvrir</span>
        </div>
      </a>`;
  }

  // ════════════════════════════════════════════════════════════
  // PAGE INDEX
  // ════════════════════════════════════════════════════════════
  async function initIndexPage(data) {
    // Hero
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.innerHTML = val; };
    setText('real-hero-title', data.page.titre);
    setText('real-hero-eyebrow-text', data.page.eyebrow);
    setText('real-hero-lede', data.page.intro);

    const statsHost = document.getElementById('real-hero-stats');
    if (statsHost && data.page.stats) {
      statsHost.innerHTML = data.page.stats.map(s =>
        `<div class="row"><span class="v">${escapeHtml(s.valeur)}</span><span class="l">${escapeHtml(s.libelle)}</span></div>`
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
          <p class="testimonial-quote">${escapeHtml(t.quote)}</p>
          <div class="testimonial-divider"></div>
          <div class="testimonial-name">${escapeHtml((t.auteur || '').toUpperCase())}</div>
          <div class="testimonial-role">${escapeHtml(t.role || '')}</div>
        </article>`).join('');
    }

    // Count
    const countEl = document.getElementById('result-count');
    if (countEl) countEl.textContent = data.realisations.length;

    setupFilters(data);
    observeReveal();
  }

  function setupFilters(data) {
    const pills = document.querySelectorAll('.real-page .pill[data-filter]');
    const sectorSelect = document.getElementById('filter-sector');
    const sortSelect = document.getElementById('filter-sort');
    const countEl = document.getElementById('result-count');
    const grid = document.getElementById('case-grid');
    if (!grid) return;

    function apply() {
      const cards = Array.from(grid.querySelectorAll('.case-card'));
      const activePill = document.querySelector('.real-page .pill.is-active');
      const expertise = activePill ? activePill.dataset.filter : 'all';
      const sector = sectorSelect ? sectorSelect.value : 'all';
      const sort = sortSelect ? sortSelect.value : 'recent';

      let visible = cards.filter(c => {
        const tags = (c.dataset.expertise || '').split(',');
        const okE = expertise === 'all' || tags.includes(expertise);
        const okS = sector === 'all' || c.dataset.sector === sector;
        return okE && okS;
      });

      visible.sort((a, b) => {
        if (sort === 'recent') return (+b.dataset.year || 0) - (+a.dataset.year || 0);
        if (sort === 'oldest') return (+a.dataset.year || 0) - (+b.dataset.year || 0);
        if (sort === 'alpha')  return (a.dataset.client || '').localeCompare(b.dataset.client || '');
        return 0;
      });

      cards.forEach(c => { c.style.transition = 'opacity .2s'; c.style.opacity = '0'; });
      setTimeout(() => {
        cards.forEach(c => c.style.display = 'none');
        visible.forEach((c, i) => {
          c.style.display = '';
          c.style.transitionDelay = (i * 40) + 'ms';
          grid.appendChild(c);
        });
        requestAnimationFrame(() => visible.forEach(c => c.style.opacity = '1'));
        setTimeout(() => cards.forEach(c => c.style.transitionDelay = ''), 600);
      }, 180);

      if (countEl) countEl.textContent = visible.length;
    }

    pills.forEach(p => p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('is-active'));
      p.classList.add('is-active');
      apply();
    }));
    if (sectorSelect) sectorSelect.addEventListener('change', apply);
    if (sortSelect) sortSelect.addEventListener('change', apply);
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
    if ($('real-title')) $('real-title').innerHTML = item.titre_detail || item.titre;

    const heroTagsHost = $('real-hero-tags');
    if (heroTagsHost && item.tags_detail) {
      heroTagsHost.innerHTML = item.tags_detail.map((t, i) =>
        `<span class="hero-tag${i === 0 ? ' solid' : ''}">${escapeHtml(t)}</span>`
      ).join('');
    }

    // Meta panel
    if (item.meta) {
      const m = item.meta;
      const setVal = (id, v) => { const el = $(id); if (el && v) el.textContent = v; };
      setVal('real-meta-duree', m.duree);
      setVal('real-meta-equipe', m.equipe);
      setVal('real-meta-livrables', m.livrables);
      setVal('real-meta-secteur', item.secteur_libelle);
    }

    // Contexte
    if (item.contexte) {
      if ($('real-ctx-intro')) $('real-ctx-intro').innerHTML = item.contexte.intro || '';
      if ($('real-ctx-enjeu')) $('real-ctx-enjeu').innerHTML = item.contexte.enjeu || '';
      if ($('real-ctx-defi')) $('real-ctx-defi').textContent = item.contexte.defi || '';
      const objHost = $('real-objectifs');
      if (objHost && item.contexte.objectifs) {
        objHost.innerHTML = item.contexte.objectifs.map(o =>
          `<div class="objective"><div class="n">${escapeHtml(o.num)}</div><div class="t">${escapeHtml(o.texte)}</div></div>`
        ).join('');
      }
    } else {
      const ctx = document.querySelector('[data-real-section="contexte"]');
      if (ctx) ctx.style.display = 'none';
    }

    // Approche
    if (item.approche) {
      if ($('real-appr-sub')) $('real-appr-sub').textContent = item.approche.intro || '';
      const methHost = $('real-method-grid');
      if (methHost && item.approche.etapes) {
        methHost.innerHTML = item.approche.etapes.map((e, i) => `
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
      if ($('real-res-intro')) $('real-res-intro').innerHTML = item.resultats.intro || '';
      const kpiHost = $('real-kpis');
      if (kpiHost && item.resultats.kpis) {
        kpiHost.innerHTML = item.resultats.kpis.map(k => `
          <div class="kpi${k.highlight ? ' highlight' : ''}">
            <span class="lbl">${escapeHtml(k.libelle)}</span>
            <span class="v">${escapeHtml(k.valeur)}</span>
            ${k.highlight ? '<span class="arrow-up" aria-hidden="true">↗</span>' : ''}
          </div>`).join('');
      }
      const outHost = $('real-outcomes');
      if (outHost && item.resultats.outcomes) {
        outHost.innerHTML = item.resultats.outcomes.map(o =>
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
      if ($('real-testi-quote')) $('real-testi-quote').textContent = t.quote;
      if ($('real-testi-name')) $('real-testi-name').textContent = (t.auteur || '').toUpperCase();
      if ($('real-testi-role')) $('real-testi-role').textContent = t.role || '';
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
    if (mode === 'index')  initIndexPage(data);
    if (mode === 'detail') initDetailPage(data);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
