/**
 * Vercel Serverless Function — Envoi du formulaire de contact via Resend
 *
 * Variables d'environnement requises (dans Vercel → Settings → Environment Variables) :
 *   RESEND_API_KEY   → Votre clé API Resend (ex: re_xxxxxxxxxxxx)
 *
 * Le domaine expéditeur (ajc-mail.com) doit être vérifié dans votre compte Resend.
 */

export default async function handler(req, res) {
  // CORS — autorise uniquement les requêtes POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { prenom, nom, email, societe, domaine, message } = req.body || {};

  // Validation des champs obligatoires
  if (!prenom || !nom || !email || !message) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
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
  const domaineLabel = domaineLabels[domaine] || domaine || 'Non précisé';

  // Corps de l'email HTML
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
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1A2744; font-weight: 600;">${prenom} ${nom}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              <a href="mailto:${email}" style="color: #BE315B; text-decoration: none;">${email}</a>
            </td>
          </tr>
          ${societe ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Entreprise</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1A2744;">${societe}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 0; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Type de projet</td>
            <td style="padding: 12px 0; font-size: 14px; color: #1A2744;">
              <span style="display: inline-block; background: #f0f4ff; color: #1A2744; border-radius: 4px; padding: 3px 10px; font-size: 12px; font-weight: 700;">${domaineLabel}</span>
            </td>
          </tr>
        </table>

        <!-- Message -->
        <div style="margin-top: 28px;">
          <div style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Message</div>
          <div style="background: #f8f9fa; border-left: 3px solid #BE315B; border-radius: 0 6px 6px 0; padding: 16px 20px; font-size: 14px; color: #374151; line-height: 1.75;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>

        <!-- CTA réponse -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="mailto:${email}?subject=Re: Votre demande AJC" style="display: inline-block; background: #1A2744; color: white; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 13px; font-weight: 700; letter-spacing: 1px;">
            Répondre à ${prenom}
          </a>
        </div>

        <!-- Pied de page -->
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #d1d5db; text-align: center; line-height: 1.6;">
          Ce message a été envoyé via le formulaire de contact du site web d'Audencia Junior Conseil.<br>
          Utilisez le bouton ci-dessus ou répondez directement à cet email pour contacter ${prenom}.
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
        from: 'Audencia Junior Conseil <noreply@ajc-mail.com>',
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
