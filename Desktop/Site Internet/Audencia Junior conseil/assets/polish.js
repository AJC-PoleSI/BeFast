/* ──────────────────────────────────────────────────────────────────
 *  AJC — Améliorations visuelles partagées
 *  Inclus sur toutes les pages via :  <script src="assets/polish.js" defer></script>
 *  1. Révélation au scroll (cartes, sections) avec décalage en cascade
 *  2. Bouton « retour en haut »
 *  Respecte prefers-reduced-motion.
 *  ────────────────────────────────────────────────────────────────── */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Révélation au scroll ──────────────────────────────────── */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const SELECTORS = [
      '.expertise-card', '.pourquoi-item', '.step-item', '.va-item', '.chiffre-item',
      '.bureau-card', '.cdp-card', '.je-card', '.stat-card', '.cnje-item',
      '.example-card', '.info-item',
    ].join(', ');

    const els = document.querySelectorAll(SELECTORS);
    els.forEach((el) => el.classList.add('reveal'));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // Décalage en cascade selon la position parmi les frères révélés
        const siblings = [...el.parentElement.children].filter((s) => s.classList.contains('reveal'));
        const delay = Math.min(siblings.indexOf(el), 6) * 90;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('visible');
        io.unobserve(el);
        // Nettoyage : rendre la main aux transitions propres de l'élément (hover, etc.)
        setTimeout(() => {
          el.classList.remove('reveal', 'visible');
          el.style.transitionDelay = '';
        }, delay + 750);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach((el) => io.observe(el));
  }

  /* ── 2. Bouton retour en haut ─────────────────────────────────── */
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'Retour en haut de page');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
})();
