/* ── Modale de contact rapide ──
   Injectée automatiquement sur toutes les pages.
   Ouvrir : cliquer un lien/bouton avec data-open-contact ou la classe .open-contact-modal
   Fermer : clic sur l'overlay, la croix, ou Escape.
   Bilingue : suit la langue du site (FR/EN) et se met à jour au switch. */
(function () {
  'use strict';

  function lang() {
    if (window.AJCI18n && window.AJCI18n.lang) return window.AJCI18n.lang();
    return localStorage.getItem('ajc-lang') === 'en' ? 'en' : 'fr';
  }

  var T = {
    fr: {
      aria: 'Formulaire de contact', close: 'Fermer',
      eyebrow: 'Parlons de votre projet',
      title: 'Demander un <strong>devis gratuit</strong>',
      sub: 'Réponse sous 48 h · Sans engagement · Confidentialité garantie',
      prenom: 'Prénom *', prenomPh: 'Jean',
      nom: 'Nom *', nomPh: 'Dupont',
      email: 'Email *', emailPh: 'jean.dupont@entreprise.fr',
      societe: 'Entreprise', societePh: 'Nom de votre entreprise',
      domaine: 'Type de projet', domaineSel: 'Sélectionner un domaine',
      autre: 'Autre',
      message: 'Description du projet *', messagePh: 'Décrivez votre besoin en quelques lignes...',
      submit: 'ENVOYER MA DEMANDE',
      success: '✓ Message envoyé ! Nous vous répondrons sous 48 h.',
      mailSubject: 'Demande de devis — ', mailDefault: 'Particulier'
    },
    en: {
      aria: 'Contact form', close: 'Close',
      eyebrow: "Let's talk about your project",
      title: 'Request a <strong>free quote</strong>',
      sub: 'Reply within 48h · No commitment · Confidentiality guaranteed',
      prenom: 'First name *', prenomPh: 'John',
      nom: 'Last name *', nomPh: 'Smith',
      email: 'Email *', emailPh: 'john.smith@company.com',
      societe: 'Company', societePh: 'Your company name',
      domaine: 'Project type', domaineSel: 'Select an area',
      autre: 'Other',
      message: 'Project description *', messagePh: 'Describe your need in a few lines...',
      submit: 'SEND MY REQUEST',
      success: '✓ Message sent! We will get back to you within 48h.',
      mailSubject: 'Quote request — ', mailDefault: 'Individual'
    }
  };

  var HTML = `
<div class="cmodal-overlay" id="contact-modal" role="dialog" aria-modal="true">
  <div class="cmodal-box">
    <button class="cmodal-close" type="button">&times;</button>
    <div class="cmodal-header">
      <span class="cmodal-eyebrow" data-cm="eyebrow"></span>
      <h2 class="cmodal-title" data-cm-html="title"></h2>
      <p class="cmodal-sub" data-cm="sub"></p>
    </div>
    <form id="contact-modal-form" class="cmodal-form">
      <div class="cmodal-row">
        <div class="cmodal-field">
          <label for="cm-prenom" data-cm="prenom"></label>
          <input type="text" id="cm-prenom" name="prenom" required data-cm-ph="prenomPh">
        </div>
        <div class="cmodal-field">
          <label for="cm-nom" data-cm="nom"></label>
          <input type="text" id="cm-nom" name="nom" required data-cm-ph="nomPh">
        </div>
      </div>
      <div class="cmodal-field">
        <label for="cm-email" data-cm="email"></label>
        <input type="email" id="cm-email" name="email" required data-cm-ph="emailPh">
      </div>
      <div class="cmodal-field">
        <label for="cm-societe" data-cm="societe"></label>
        <input type="text" id="cm-societe" name="societe" data-cm-ph="societePh">
      </div>
      <div class="cmodal-field">
        <label for="cm-domaine" data-cm="domaine"></label>
        <select id="cm-domaine" name="domaine">
          <option value="" data-cm-opt="domaineSel"></option>
          <option value="marketing">Marketing</option>
          <option value="communication">Communication</option>
          <option value="rse">RSE</option>
          <option value="bigdata">Big Data</option>
          <option value="finance">Finance</option>
          <option value="autre" data-cm-opt="autre"></option>
        </select>
      </div>
      <div class="cmodal-field">
        <label for="cm-message" data-cm="message"></label>
        <textarea id="cm-message" name="message" required data-cm-ph="messagePh"></textarea>
      </div>
      <button type="submit" class="cmodal-submit" data-cm="submit"></button>
      <div class="cmodal-success" id="cm-success" data-cm="success"></div>
    </form>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', HTML);

  var overlay = document.getElementById('contact-modal');
  var form = document.getElementById('contact-modal-form');
  var success = document.getElementById('cm-success');

  function applyLang() {
    var t = T[lang()] || T.fr;
    overlay.setAttribute('aria-label', t.aria);
    overlay.querySelector('.cmodal-close').setAttribute('aria-label', t.close);
    overlay.querySelectorAll('[data-cm]').forEach(function (el) {
      el.textContent = t[el.getAttribute('data-cm')] || '';
    });
    overlay.querySelectorAll('[data-cm-html]').forEach(function (el) {
      el.innerHTML = t[el.getAttribute('data-cm-html')] || '';
    });
    overlay.querySelectorAll('[data-cm-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t[el.getAttribute('data-cm-ph')] || '');
    });
    overlay.querySelectorAll('[data-cm-opt]').forEach(function (el) {
      el.textContent = t[el.getAttribute('data-cm-opt')] || '';
    });
  }
  applyLang();
  document.addEventListener('ajc:langchange', applyLang);

  function open() {
    applyLang();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    form.reset();
    success.style.display = 'none';
    overlay.querySelector('input, textarea').focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.cmodal-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open-contact], .open-contact-modal');
    if (trigger) { e.preventDefault(); open(); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = T[lang()] || T.fr;
    var fd = new FormData(form);
    var subject = encodeURIComponent(t.mailSubject + (fd.get('societe') || t.mailDefault));
    var body = encodeURIComponent(
      fd.get('prenom') + ' ' + fd.get('nom') +
      '\n' + fd.get('email') +
      '\n' + (fd.get('societe') || '—') +
      '\n' + (fd.get('domaine') || '—') +
      '\n\n' + fd.get('message')
    );
    window.open('mailto:contact@ajc-mail.com?subject=' + subject + '&body=' + body, '_blank');
    success.style.display = 'block';
    form.reset();
  });

  window.AJCContactModal = { open: open, close: close };
})();
