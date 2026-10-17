import type { Digest } from "./digest"

/** Échappe les valeurs saisies par les utilisateurs (noms) injectées en HTML. */
function esc(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const fmtJour = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso))
const fmtCourt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso))

const accord = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`

function compteur(valeur: number, libelle: string): string {
  return `<td align="center" style="padding:14px 6px;background:#f4f1ea;border-radius:10px;">
    <span style="display:block;font-size:26px;font-weight:700;color:#00236f;">${valeur}</span>
    <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">${libelle}</span>
  </td>`
}

function titreSection(texte: string): string {
  return `<h2 style="margin:28px 0 8px;font-size:15px;color:#0f1b3d;border-bottom:2px solid #C9A84C;padding-bottom:6px;">${texte}</h2>`
}

function ligne(gauche: string, droite: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:13px;color:#0f1b3d;border-bottom:1px solid #eef1f6;">${gauche}</td>
    <td align="right" style="padding:7px 0 7px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #eef1f6;white-space:nowrap;">${droite}</td>
  </tr>`
}

function tableau(lignes: string[], vide: string): string {
  if (lignes.length === 0) return `<p style="margin:0;font-size:13px;color:#8a93a8;">${vide}</p>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes.join("")}</table>`
}

export function rhDigestEmail(opts: { prenom: string | null; digest: Digest; siteUrl: string }) {
  const { digest: d, siteUrl } = opts
  const periode = `du ${fmtJour(d.debut)} au ${fmtJour(d.fin)}`

  const depots = d.depots.parPersonne.map((p) =>
    ligne(`<strong>${esc(p.personne)}</strong><br><span style="color:#6b7280;">${p.documents.map(esc).join(", ")}</span>`, fmtCourt(p.dernierDepot))
  )

  const attente = d.attente.liste.map((p) =>
    ligne(
      `<strong>${esc(p.personne)}</strong> <span style="color:#6b7280;">· ${accord(p.nbDocuments, "pièce", "pièces")}</span>`,
      p.joursAttente === 0 ? "aujourd'hui" : `depuis ${accord(p.joursAttente, "jour", "jours")}`
    )
  )
  const masquees =
    d.attente.masquees > 0
      ? `<p style="margin:10px 0 0;font-size:12px;color:#6b7280;">… et ${accord(d.attente.masquees, "autre personne", "autres personnes")} dans l'espace Membres.</p>`
      : ""

  const nomsListe = (noms: string[], total: number) =>
    noms.length === 0
      ? ""
      : `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">${noms.map(esc).join(", ")}${total > noms.length ? `, … (+${total - noms.length})` : ""}</p>`

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#f4f1ea;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #ece7dc;overflow:hidden;">
        <tr><td style="background:#00236f;padding:20px 32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;">BeFast</span>
          <span style="font-size:12px;color:#C9A84C;display:block;margin-top:2px;">Audencia Junior Conseil · Pôle RH</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#0f1b3d;">Point RH de la semaine</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f4a63;">Bonjour ${esc(opts.prenom) || ""}, voici l'activité ${periode}.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
            ${compteur(d.comptesCrees.total, "nouveaux comptes")}
            ${compteur(d.comptesValides.total, "comptes validés")}
            ${compteur(d.depots.total, "pièces déposées")}
            ${compteur(d.attente.totalDocuments, "pièces en attente")}
          </tr></table>

          ${titreSection(`Comptes à valider (${d.comptesEnAttente})`)}
          <p style="margin:0;font-size:13px;color:#3f4a63;">${
            d.comptesEnAttente === 0
              ? "Aucun compte en attente de validation."
              : `${accord(d.comptesEnAttente, "compte attend", "comptes attendent")} une validation.`
          }</p>

          ${titreSection(`Nouveaux comptes (${d.comptesCrees.total})`)}
          ${d.comptesCrees.total === 0 ? `<p style="margin:0;font-size:13px;color:#8a93a8;">Aucun nouveau compte cette semaine.</p>` : nomsListe(d.comptesCrees.personnes, d.comptesCrees.total)}

          ${titreSection(`Comptes validés (${d.comptesValides.total})`)}
          ${d.comptesValides.total === 0 ? `<p style="margin:0;font-size:13px;color:#8a93a8;">Aucun compte validé cette semaine.</p>` : nomsListe(d.comptesValides.personnes, d.comptesValides.total)}

          ${titreSection(`Pièces déposées cette semaine (${d.depots.total})`)}
          ${tableau(depots, "Aucune pièce déposée cette semaine.")}

          ${titreSection(`Pièces en attente de validation (${d.attente.totalDocuments} · ${accord(d.attente.totalPersonnes, "personne", "personnes")})`)}
          ${tableau(attente, "Aucune pièce en attente. Bravo !")}
          ${masquees}

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr><td style="border-radius:8px;background:#00236f;">
            <a href="${siteUrl}/administration/membres" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Ouvrir l'espace Membres</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eef1f6;">
          <p style="margin:0;font-size:12px;color:#8a93a8;">Email automatique envoyé chaque lundi au Pôle RH par la plateforme BeFast — merci de ne pas y répondre. Les comptes validés ne sont comptés que depuis la mise en place du suivi.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject: `Point RH BeFast — semaine du ${fmtJour(d.debut)}`, html }
}
