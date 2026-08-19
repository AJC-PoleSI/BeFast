# Site vitrine Audencia Junior Conseil

Site public de la Junior-Entreprise d'Audencia Business School (Nantes) : présentation de la structure, de l'équipe, des prestations et réalisations, formulaire de contact. Site **statique** (HTML/CSS/JS vanilla), déployé sur **Vercel**.

## Lancer en local

```bash
npx serve .
```

Ne jamais ouvrir les fichiers HTML en `file://` : les JSON de `contenu/` ne se chargent pas sans serveur HTTP.

## Architecture — le contenu est séparé du code

Le principe central : les textes et données vivent dans `contenu/*.json` et les photos dans `photos/` ; les pages HTML les chargent dynamiquement. **Pour une modification de contenu, éditer le JSON, pas le HTML.**

- Pages : `index.html`, `la-je.html`, `qu-est-ce-une-je.html`, `notre-equipe.html`, `notre-junior.html`, `prestations.html`, `realisations.html` (+ `realisation-detail.html`, `service-detail.html`), `contact.html`, mentions légales et politique de confidentialité
- `contenu/` — `equipe.json`, `prestations.json`, `services.json`, `realisations.json`, `temoignages.json`, `clients.json`, `config.json`, `i18n.json`, `legal.json` (voir les README du dossier)
- `photos/` — convention de nommage stricte (voir `photos/README.md`) : remplacer une photo = même nom de fichier exactement
- `style.css` — CSS partagé par toutes les pages ; `logo-config.css` pour les logos. Ne pas modifier sans raison, tester toutes les pages après changement
- `api/contact.js` — fonction serverless Vercel pour le formulaire de contact
- `docs/GUIDE-MODIFICATION-SITE.md` — guide de modification destiné aux membres non techniques : le tenir à jour si la structure du contenu change

## Règles importantes

- Pas de framework, pas de build : garder le site en HTML/CSS/JS simple, compréhensible par les futurs mandats AJC
- Toute nouvelle donnée affichée doit passer par un fichier `contenu/*.json`, jamais en dur dans le HTML
- Vérifier le rendu sur mobile (le site est consulté surtout par des étudiants et clients sur téléphone)
- Contenu et réponses en **français** ; attention à l'orthographe, c'est la vitrine commerciale de la structure
