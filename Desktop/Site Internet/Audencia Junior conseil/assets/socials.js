/* AJC — Met à jour les liens LinkedIn / Instagram depuis contenu/config.json.
   Sûr à inclure sur n'importe quelle page : ne fait rien de plus. */
(async function () {
  try {
    const res = await fetch('contenu/config.json');
    const cfg = await res.json();
    if (!cfg.reseaux_sociaux) return;
    const byKey = {};
    cfg.reseaux_sociaux.forEach(r => { byKey[(r.nom || '').toLowerCase()] = r.lien; });
    document.querySelectorAll('.social-btn[data-social]').forEach(a => {
      const k = a.dataset.social.toLowerCase();
      if (byKey[k] && byKey[k] !== '#') a.href = byKey[k];
    });
  } catch (e) { /* config absente : on garde les href par défaut */ }
})();
