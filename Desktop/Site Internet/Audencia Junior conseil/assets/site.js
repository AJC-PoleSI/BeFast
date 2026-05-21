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
 *  ────────────────────────────────────────────────────────────────── */
async function loadLegalPage(key) {
  try {
    const res = await fetch('contenu/legal.json');
    const data = await res.json();
    const page = data[key];
    if (!page) return;

    // Hero
    const $ = (id) => document.getElementById(id);
    if ($('legal-title'))    $('legal-title').textContent    = page.page_titre;
    if ($('legal-eyebrow'))  $('legal-eyebrow').textContent  = page.page_eyebrow;
    if ($('legal-sub'))      $('legal-sub').textContent      = page.page_sous_titre;
    if ($('legal-maj'))      $('legal-maj').textContent      = 'Dernière mise à jour : ' + page.derniere_maj;
    document.title = page.page_titre + ' — Audencia Junior Conseil';

    // Table des matières
    const toc = $('legal-toc-list');
    if (toc) {
      toc.innerHTML = page.sections.map((s, i) =>
        `<li><a href="#sec-${i+1}">${escapeHtml(s.titre)}</a></li>`
      ).join('');
    }

    // Sections
    const container = $('legal-sections');
    if (container) {
      container.innerHTML = page.sections.map((s, i) => {
        const parasBefore = (s.paragraphes || []).map(p => `<p>${p}</p>`).join('');
        const list = s.liste && s.liste.length
          ? `<ul>${s.liste.map(li => `<li>${li}</li>`).join('')}</ul>`
          : '';
        const parasAfter = (s.paragraphes_apres || []).map(p => `<p>${p}</p>`).join('');
        return `<section class="legal-section" id="sec-${i+1}">
                  <h2>${escapeHtml(s.titre)}</h2>
                  ${parasBefore}${list}${parasAfter}
                </section>`;
      }).join('');
    }
  } catch (e) {
    console.warn('Impossible de charger contenu/legal.json', e);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
  }[c]));
}
