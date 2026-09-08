/**
 * Pagination PostgREST partagée, indépendante du client Supabase utilisé.
 *
 * Utilisée par les exports comptables et les server actions de trésorerie,
 * qui doivent toutes deux lire des tables potentiellement volumineuses
 * (factures, retributions, missions, candidatures) sans jamais tronquer
 * silencieusement le résultat.
 */

/** Taille de page PostgREST (`db-max-rows`, 1000 par défaut sur Supabase). */
const TAILLE_PAGE = 1000

/**
 * Lit TOUTES les lignes d'une requête en la paginant via `.range()`.
 *
 * PostgREST plafonne silencieusement le nombre de lignes renvoyées : au-delà
 * du plafond la réponse est tronquée SANS erreur. Sur un export comptable ou
 * un suivi de rétributions, c'est un contresens financier, pas un détail
 * d'affichage — une page tronquée fait disparaître de vrais paiements ou
 * réapparaître comme impayées des personnes déjà réglées. On boucle donc
 * jusqu'à recevoir une page incomplète.
 *
 * L'appelant DOIT fournir un tri déterministe (une colonne unique en dernier
 * critère, typiquement `.order("id")`), sinon deux pages peuvent se
 * recouvrir (doublons) ou s'oublier (lignes perdues).
 */
export async function chargerToutesLesPages(
  requete: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<{ data: any[]; error: any }> {
  const lignes: any[] = []
  for (let page = 0; ; page++) {
    const from = page * TAILLE_PAGE
    const { data, error } = await requete(from, from + TAILLE_PAGE - 1)
    if (error) return { data: [], error }
    const lot = data ?? []
    lignes.push(...lot)
    if (lot.length < TAILLE_PAGE) return { data: lignes, error: null }
  }
}

/**
 * Table `retributions` absente : 42P01 vient de Postgres, PGRST205 du cache de
 * schéma PostgREST (même cause, deux codes selon la couche qui refuse). Tant
 * que la migration 067 n'est pas appliquée, les appelants doivent pouvoir
 * continuer en mode dégradé plutôt que de renvoyer une erreur.
 */
export function tableRetributionsAbsente(error: any): boolean {
  const code = error?.code
  return code === "42P01" || code === "PGRST205"
}
