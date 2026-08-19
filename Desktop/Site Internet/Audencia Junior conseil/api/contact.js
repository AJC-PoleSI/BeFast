/**
 * Vercel Serverless Function — Envoi du formulaire de contact via Resend
 *
 * Variables d'environnement requises (Vercel → Settings → Environment Variables) :
 *   RESEND_API_KEY   → clé API Resend (ex: re_xxxxxxxxxxxx)
 *
 * Le domaine expéditeur doit être vérifié dans le compte Resend.
 *
 * Mesures de sécurité en place :
 *   - CORS restreint aux domaines du site (plus de joker « * »)
 *   - Échappement HTML de toutes les valeurs saisies avant insertion dans l'email
 *   - Validation du format email et plafonnement de la longueur de chaque champ
 *   - Champ piège (honeypot) invisible pour bloquer les robots
 *   - Limitation de débit par adresse IP
 *   - La clé API reste côté serveur, jamais exposée au navigateur
 *   - Aucune donnée n'est stockée : le message est transmis par email puis oublié
 */

// ── CORS : liste blanche des origines autorisées ──────────────────────────
const ORIGINES_EXACTES = [
  'https://project-y2gxy.vercel.app',
  'https://audenciajuniorconseil.com',
  'https://www.audenciajuniorconseil.com',
];

const ORIGINES_MOTIFS = [
  /^https:\/\/project-y2gxy-[a-z0-9-]+\.vercel\.app$/, // déploiements de préversion
  /^http:\/\/localhost(:\d+)?$/,                       // développement local
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function origineAutorisee(origine) {
  if (!origine) return null;
  if (ORIGINES_EXACTES.includes(origine)) return origine;
  if (ORIGINES_MOTIFS.some((re) => re.test(origine))) return origine;
  return null;
}

// ── Limitation de débit (en mémoire, par instance) ────────────────────────
const FENETRE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PAR_FENETRE = 5;         // 5 envois par IP et par fenêtre
const envois = new Map();

function debitDepasse(ip) {
  const maintenant = Date.now();
  const recents = (envois.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);

  if (recents.length >= MAX_PAR_FENETRE) {
    envois.set(ip, recents);
    return true;
  }

  recents.push(maintenant);
  envois.set(ip, recents);

  // Garde-fou mémoire : purge les IP dont la fenêtre est expirée
  if (envois.size > 5000) {
    for (const [cle, dates] of envois) {
      if (!dates.some((t) => maintenant - t < FENETRE_MS)) envois.delete(cle);
    }
  }
  return false;
}

// ── Assainissement des entrées ───────────────────────────────────────────
const LIMITES = { prenom: 80, nom: 80, email: 200, societe: 120, domaine: 40, message: 5000 };

// Caractères de contrôle : tous, et tous sauf le saut de ligne (\x0A)
const CTRL = /[\x00-\x1F\x7F]/g;
const CTRL_SAUF_SAUT_LIGNE = /[\x00-\x09\x0B-\x1F\x7F]/g;

/** Échappe les caractères HTML pour empêcher toute injection dans l'email. */
function echapperHtml(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Retire les caractères de contrôle et coupe à la longueur maximale. */
function nettoyer(valeur, max) {
  if (valeur === undefined || valeur === null) return '';
  return String(valeur).replace(CTRL, '').trim().slice(0, max);
}

/** Comme nettoyer(), mais conserve les sauts de ligne (pour le message). */
function nettoyerMultiligne(valeur, max) {
  if (valeur === undefined || valeur === null) return '';
  return String(valeur)
    .replace(/\r\n/g, '\n')
    .replace(CTRL_SAUF_SAUT_LIGNE, '')
    .trim()
    .slice(0, max);
}

const EMAIL_VALIDE = /^[^\s@,;:<>()[\]\\]+@[^\s@,;:<>()[\]\\]+\.[A-Za-z]{2,}$/;

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const origine = origineAutorisee(req.headers.origin);
  if (origine) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Une origine présente mais hors liste blanche = appel depuis un site tiers
  if (req.headers.origin && !origine) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  const corps = req.body || {};

  // Champ piège : rempli uniquement par les robots. On répond « ok » sans rien envoyer.
  if (nettoyer(corps.website, 200) !== '') {
    return res.status(200).json({ success: true });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  if (debitDepasse(ip)) {
    res.setHeader('Retry-After', '600');
    return res.status(429).json({
      error: 'Trop de messages envoyés. Merci de réessayer dans quelques minutes.',
    });
  }

  const prenom = nettoyer(corps.prenom, LIMITES.prenom);
  const nom = nettoyer(corps.nom, LIMITES.nom);
  const email = nettoyer(corps.email, LIMITES.email);
  const societe = nettoyer(corps.societe, LIMITES.societe);
  const domaine = nettoyer(corps.domaine, LIMITES.domaine);
  const message = nettoyerMultiligne(corps.message, LIMITES.message);

  if (!prenom || !nom || !email || !message) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  if (!EMAIL_VALIDE.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY manquant dans les variables d\'environnement');
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  // Labels lisibles pour le type de projet
  const domaineLabels = {
    marketing: 'Marketing',
    communication: 'Communication',
    rse: 'RSE',
    bigdata: 'Big Data',
    finance: 'Finance',
    autre: 'Autre',
  };
  const domaineLabel = domaineLabels[domaine] || 'Non précisé';

  // Valeurs échappées, prêtes à être insérées dans l'email HTML
  const ePrenom = echapperHtml(prenom);
  const eNom = echapperHtml(nom);
  const eEmail = echapperHtml(email);
  const eSociete = echapperHtml(societe);
  const eDomaine = echapperHtml(domaineLabel);
  const eMessage = echapperHtml(message).replace(/\n/g, '<br>');
  const lienMailto = encodeURIComponent(email);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 24px;">

      <!-- En-tête -->
      <div style="background: #1A2744; border-radius: 8px 8px 0 0; padding: 28px 32px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
          Nouveau message via le site
        </h1>
        <p style="color: rgba(255,255,255,0.55); margin: 6px 0 0; font-size: 13px;">
          Audencia Junior Conseil — Formulaire de contact
        </p>
      </div>

      <!-- Corps -->
      <div style="background: #ffffff; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; padding: 32px;">

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; width: 32%;">Nom complet</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1A2744; font-weight: 600;">${ePrenom} ${eNom}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              <a href="mailto:${lienMailto}" style="color: #BE315B; text-decoration: none;">${eEmail}</a>
            </td>
          </tr>
          ${eSociete ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Entreprise</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1A2744;">${eSociete}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 0; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Type de projet</td>
            <td style="padding: 12px 0; font-size: 14px; color: #1A2744;">
              <span style="display: inline-block; background: #f0f4ff; color: #1A2744; border-radius: 4px; padding: 3px 10px; font-size: 12px; font-weight: 700;">${eDomaine}</span>
            </td>
          </tr>
        </table>

        <!-- Message -->
        <div style="margin-top: 28px;">
          <div style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Message</div>
          <div style="background: #f8f9fa; border-left: 3px solid #BE315B; border-radius: 0 6px 6px 0; padding: 16px 20px; font-size: 14px; color: #374151; line-height: 1.75;">
            ${eMessage}
          </div>
        </div>

        <!-- CTA réponse -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="mailto:${lienMailto}?subject=Re: Votre demande AJC" style="display: inline-block; background: #1A2744; color: white; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 13px; font-weight: 700; letter-spacing: 1px;">
            Répondre à ${ePrenom}
          </a>
        </div>

        <!-- Pied de page -->
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #d1d5db; text-align: center; line-height: 1.6;">
          Ce message a été envoyé via le formulaire de contact du site web d'Audencia Junior Conseil.<br>
          Utilisez le bouton ci-dessus ou répondez directement à cet email pour contacter ${ePrenom}.
        </div>
      </div>

    </div>
  `;

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Audencia Junior Conseil <noreply@audenciajuniorconseil.com>',
        to: ['contact@ajc-mail.com'],
        reply_to: email,
        subject: `[AJC] ${domaineLabel} — ${prenom} ${nom}`,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errBody);
      return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Erreur serveur:', err);
    return res.status(500).json({ error: 'Erreur serveur inattendue' });
  }
}
