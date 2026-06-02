// Constantes partagées (non "use server") — importables côté client et serveur.

export const TAILLES_ENTREPRISE = [
  "microentreprise",
  "petite entreprise",
  "PME",
  "ETI",
  "grand groupe",
] as const

export type TailleEntreprise = (typeof TAILLES_ENTREPRISE)[number]

export type MargesMap = Record<string, number>
export type ParametresMap = Record<string, string>
