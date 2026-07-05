import "server-only"

/**
 * Templates d'emails transactionnels Be Fast — HTML inline (compatible clients
 * mail), aux couleurs de la charte (navy #00236f, or #C9A84C).
 * Tous les envois sont best-effort : voir lib/email/send.ts.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

/** Échappe les valeurs contrôlées par l'utilisateur (nom, email) injectées en HTML. */
function esc(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function brandedEmail(opts: {
  title: string
  intro: string
  details?: string[]
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const details = (opts.details ?? [])
    .map(
      (d) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#3f4a63;border-bottom:1px solid #eef1f6;">${d}</td></tr>`
    )
    .join("")

  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr><td style="border-radius:8px;background:#00236f;">
           <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${opts.ctaLabel}</a>
         </td></tr></table>`
      : ""

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#f4f1ea;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #ece7dc;overflow:hidden;">
        <tr><td style="background:#00236f;padding:20px 32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;">BeFast</span>
          <span style="font-size:12px;color:#C9A84C;display:block;margin-top:2px;">Audencia Junior Conseil</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0f1b3d;">${opts.title}</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#3f4a63;">${opts.intro}</p>
          ${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">${details}</table>` : ""}
          ${cta}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eef1f6;">
          <p style="margin:0;font-size:12px;color:#8a93a8;">Email automatique envoyé par la plateforme BeFast — merci de ne pas y répondre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function accountValidatedEmail(prenom: string | null) {
  return {
    subject: "Votre compte BeFast est validé 🎉",
    html: brandedEmail({
      title: `Bienvenue${prenom ? ` ${prenom}` : ""} !`,
      intro:
        "Un administrateur vient de valider votre compte. Vous avez désormais accès à l'ensemble des fonctionnalités correspondant à votre rôle : missions, documents, études…",
      ctaLabel: "Accéder à BeFast",
      ctaUrl: `${SITE_URL}/dashboard`,
    }),
  }
}

export function accountCreatedUserEmail(prenom: string | null) {
  return {
    subject: "Votre compte BeFast a bien été créé",
    html: brandedEmail({
      title: `Bienvenue${prenom ? ` ${esc(prenom)}` : ""} !`,
      intro:
        "Votre compte vient d'être créé sur BeFast. Après vérification de votre adresse email, il devra être validé par un administrateur avant que vous puissiez accéder à la plateforme. Vous recevrez un email dès son activation.",
    }),
  }
}

export function newAccountStaffNotificationEmail(opts: {
  prenom: string | null
  nom: string | null
  email: string
}) {
  const fullName = `${esc(opts.prenom)} ${esc(opts.nom)}`.trim() || esc(opts.email)
  return {
    subject: "Nouveau compte créé — validation requise",
    html: brandedEmail({
      title: "Nouveau compte en attente de validation",
      intro:
        "Un nouveau compte vient d'être créé sur BeFast. Il est en attente de validation par un administrateur.",
      details: [
        `Nom : <strong>${fullName}</strong>`,
        `Email : <strong>${esc(opts.email)}</strong>`,
      ],
      ctaLabel: "Gérer les membres",
      ctaUrl: `${SITE_URL}/administration/membres`,
    }),
  }
}

export function passwordSetupEmail(opts: { prenom: string | null; link: string }) {
  return {
    subject: "Activez votre accès BeFast — réinitialisez votre mot de passe",
    html: brandedEmail({
      title: `Bienvenue sur BeFast${opts.prenom ? ` ${esc(opts.prenom)}` : ""} !`,
      intro:
        "Votre compte a été migré depuis l'ancienne plateforme. Pour y accéder, réinitialisez votre mot de passe en cliquant sur le bouton ci-dessous. Ce lien est personnel et temporaire.",
      ctaLabel: "Réinitialiser mon mot de passe",
      ctaUrl: opts.link,
    }),
  }
}

export function missionAssignedEmail(prenom: string | null) {
  return {
    subject: "Votre candidature a été acceptée — mission attribuée",
    html: brandedEmail({
      title: `Félicitations${prenom ? ` ${prenom}` : ""} !`,
      intro:
        "Votre candidature vient d'être acceptée : la mission vous est attribuée. Retrouvez tous les détails (étude, rémunération, documents à fournir) dans votre espace.",
      ctaLabel: "Voir mes missions",
      ctaUrl: `${SITE_URL}/missions`,
    }),
  }
}

export function documentToSignEmail(opts: {
  recipientName: string | null
  documentName: string
  requestName: string
}) {
  return {
    subject: `Document à signer — ${opts.requestName}`,
    html: brandedEmail({
      title: "Un document attend votre signature",
      intro: `${opts.recipientName ? `Bonjour ${opts.recipientName}, ` : ""}le document « ${opts.documentName} » vous a été envoyé pour signature électronique via LiveConsent. Vous allez recevoir (ou avez reçu) un email de LiveConsent contenant le lien de signature sécurisé.`,
      details: [`Demande : <strong>${opts.requestName}</strong>`, `Document : <strong>${opts.documentName}</strong>`],
    }),
  }
}

export function bulletinAdhesionEmail(prenom: string | null) {
  return {
    subject: "Votre bulletin d'adhésion à signer",
    html: brandedEmail({
      title: `Bulletin d'adhésion${prenom ? ` — ${prenom}` : ""}`,
      intro:
        "Votre profil est complet : votre bulletin d'adhésion à Audencia Junior Conseil vous a été envoyé en signature électronique via LiveConsent. Vous allez recevoir un email de LiveConsent avec le lien de signature sécurisé (un code de sécurité vous sera demandé). La signature ne prend qu'une minute.",
      details: ["Document : <strong>Bulletin d'adhésion</strong>"],
      ctaLabel: "Voir dans BeFast",
      ctaUrl: `${SITE_URL}/dashboard`,
    }),
  }
}

export function signatureReminderEmail(opts: {
  prenom: string | null
  requestName: string
  daysLeft: number
}) {
  const j = opts.daysLeft
  return {
    subject: `Rappel — il vous reste ${j} jour${j > 1 ? "s" : ""} pour signer`,
    html: brandedEmail({
      title: "Signature en attente",
      intro: `${opts.prenom ? `Bonjour ${opts.prenom}, ` : ""}le document « ${opts.requestName} » attend toujours votre signature. Sans action de votre part, la demande de signature expirera dans <strong>${j} jour${j > 1 ? "s" : ""}</strong>. Merci de signer via le lien LiveConsent reçu par email.`,
      details: [`Demande : <strong>${opts.requestName}</strong>`, `Expiration dans : <strong>${j} jour${j > 1 ? "s" : ""}</strong>`],
      ctaLabel: "Voir dans BeFast",
      ctaUrl: `${SITE_URL}/dashboard`,
    }),
  }
}
