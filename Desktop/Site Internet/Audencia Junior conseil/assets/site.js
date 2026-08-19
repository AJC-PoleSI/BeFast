/* ──────────────────────────────────────────────────────────────────
 *  AJC — Script partagé (header, drawer, footer socials, pages légales)
 *  Inclus sur toutes les pages via :  <script src="assets/site.js"></script>
 *  ────────────────────────────────────────────────────────────────── */

/* ── Header scroll + hamburger drawer (utilisé par les pages légales uniquement) ── */
(function initChrome() {
  const header = document.getElementById('main-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    });
  }
  const burger = document.getElementById('hamburger');
  const drawer = document.getElementById('mobile-drawer');
  if (burger && drawer) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      drawer.classList.toggle('open');
      document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
    });
  }
})();

/* ──────────────────────────────────────────────────────────────────
 *  Pages légales : politique de confidentialité & mentions légales
 *  Usage :  loadLegalPage('politique_confidentialite')
 *           loadLegalPage('mentions_legales')
 *  Bilingue : suit la langue du site (FR/EN) et se met à jour au switch.
 *  ────────────────────────────────────────────────────────────────── */
function ajcLang() {
  if (window.AJCI18n && window.AJCI18n.lang) return window.AJCI18n.lang();
  return localStorage.getItem('ajc-lang') === 'en' ? 'en' : 'fr';
}
function ajcTr(obj, key) {
  if (!obj) return '';
  if (ajcLang() === 'en' && obj[key + '_en'] != null && obj[key + '_en'] !== '') return obj[key + '_en'];
  return obj[key] != null ? obj[key] : '';
}

async function loadLegalPage(key) {
  let legalPageData = null;
  try {
    const res = await fetch('contenu/legal.json');
    legalPageData = await res.json();
  } catch (e) {
    console.warn('Impossible de charger contenu/legal.json', e);
    return;
  }

  function render() {
    const page = legalPageData[key];
    if (!page) return;
    const L = ajcLang() === 'en';

    // Hero
    const $ = (id) => document.getElementById(id);
    if ($('legal-title'))    $('legal-title').textContent    = ajcTr(page, 'page_titre');
    if ($('legal-eyebrow'))  $('legal-eyebrow').textContent  = ajcTr(page, 'page_eyebrow');
    if ($('legal-sub'))      $('legal-sub').textContent      = ajcTr(page, 'page_sous_titre');
    if ($('legal-maj'))      $('legal-maj').textContent      = (L ? 'Last updated: ' : 'Dernière mise à jour : ') + ajcTr(page, 'derniere_maj');
    document.title = ajcTr(page, 'page_titre') + ' — Audencia Junior Conseil';

    // Table des matières
    const toc = $('legal-toc-list');
    if (toc) {
      toc.innerHTML = page.sections.map((s, i) =>
        `<li><a href="#sec-${i+1}">${escapeHtml(ajcTr(s, 'titre'))}</a></li>`
      ).join('');
    }

    // Sections
    const container = $('legal-sections');
    if (container) {
      container.innerHTML = page.sections.map((s, i) => {
        const parasBefore = (ajcTr(s, 'paragraphes') || []).map(p => `<p>${p}</p>`).join('');
        const liste = L && s.liste_en ? s.liste_en : s.liste;
        const list = liste && liste.length
          ? `<ul>${liste.map(li => `<li>${li}</li>`).join('')}</ul>`
          : '';
        const parasAfter = (ajcTr(s, 'paragraphes_apres') || []).map(p => `<p>${p}</p>`).join('');
        return `<section class="legal-section" id="sec-${i+1}">
                  <h2>${escapeHtml(ajcTr(s, 'titre'))}</h2>
                  ${parasBefore}${list}${parasAfter}
                </section>`;
      }).join('');
    }
  }

  render();
  document.addEventListener('ajc:langchange', render);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
  }[c]));
}
