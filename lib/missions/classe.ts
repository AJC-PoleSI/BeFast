/**
 * Classe (niveau d'études) d'une mission ou d'une candidature.
 *
 * Les colonnes missions.classe et candidatures.classe n'acceptent que ces
 * trois codes (CHECK de la migration 005). Les libellés saisis ailleurs
 * — scolarité du profil ("Pré-Master", "Master 1"…), niveau de propale
 * ("L3", "M1"…) — doivent TOUJOURS passer par normaliserClasse avant écriture.
 */
export const CLASSES_MISSION = ["premaster", "m1", "m2"] as const
export type ClasseMission = (typeof CLASSES_MISSION)[number]

/** Libellé → code, renvoie null si vide ou inconnu (colonne nullable). */
export function normaliserClasse(raw?: string | null): ClasseMission | null {
  const cle = (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
  switch (cle) {
    case "premaster":
    case "l3":
      return "premaster"
    case "m1":
    case "master1":
      return "m1"
    case "m2":
    case "master2":
      return "m2"
    default:
      return null
  }
}
