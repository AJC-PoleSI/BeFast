// Contrôle d'un Bulletin de Versement avant génération : la CNJE exige les
// informations de l'intervenant (identité, adresse, n° de sécurité sociale),
// la référence de son RM, la rétribution brute et les JEH convenus au RM.
// Un BV incomplet n'est pas généré : on dit quoi compléter.

type Contexte = {
  intervenant?: Record<string, unknown> | null
  mission?: Record<string, unknown> | null
}

const rempli = (v: unknown) => v != null && String(v).trim() !== ""

const CHAMPS_INTERVENANT: [cle: string, libelle: string][] = [
  ["nom", "nom"],
  ["prenom", "prénom"],
  ["adresse", "adresse"],
  ["code_postal", "code postal"],
  ["ville", "ville"],
  ["num_secu", "numéro de sécurité sociale"],
]

/** Libellés de ce qui manque pour remplir le BV (vide si tout est présent). */
export function champsManquantsBv(ctx: Contexte): string[] {
  const intervenant = ctx.intervenant ?? {}
  const mission = ctx.mission ?? {}
  if (!rempli(intervenant.id)) return ["l'étudiant concerné (aucun intervenant sélectionné)"]
  const manquants = CHAMPS_INTERVENANT.filter(([cle]) => !rempli(intervenant[cle])).map(([, libelle]) => libelle)
  if (!rempli(mission.reference_recap_mission)) manquants.push("la référence de son RDM")
  if (!(Number(mission.nombre_jeh) >= 1)) manquants.push("le nombre de JEH de la mission")
  if (!(Number(mission.montant_remuneration) > 0)) manquants.push("la rétribution de la mission")
  return manquants
}

/** Message affiché quand le BV ne peut pas être généré. */
export function messageBvIncomplet(manquants: string[]): string {
  return (
    `BV non généré, il manque : ${manquants.join(", ")}. ` +
    "Complétez la fiche de l'étudiant (profil), générez son RDM ou corrigez la mission, puis relancez."
  )
}
