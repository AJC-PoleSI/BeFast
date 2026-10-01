"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireActionPermission } from "@/lib/auth/action-guards"
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { PARAMETRES_TAG, MARGES_TAG } from "@/lib/cache-tags"
import type { ParametresMap, MargesMap } from "@/lib/proposals-constants"

export type { ParametresMap, MargesMap }

// Lecture des paramètres mise en cache (données publiques, invalidée sur écriture).
// Évite une requête DB à chaque navigation → pages plus fluides, charge serveur réduite.
const _readParametres = unstable_cache(
  async (): Promise<ParametresMap> => {
    const admin = createAdminClient()
    const { data } = await admin.from("parametres").select("key, value")
    const map: ParametresMap = {}
    for (const row of data ?? []) map[row.key] = row.value
    return map
  },
  ["parametres-all"],
  { tags: [PARAMETRES_TAG] }
)

// Lecture de tous les paramètres globaux (clé -> valeur).
// Accessible à tout membre authentifié (RLS public read).
export async function getParametres(): Promise<{ data: ParametresMap | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  try {
    return { data: await _readParametres(), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Erreur de lecture des paramètres" }
  }
}

// Clés du pilotage des prix (app/(dashboard)/tresorerie/PilotagePrix.tsx).
const CLES_PILOTAGE_PRIX = new Set(["prix_jeh_moyen", "prix_suivi_jeh_moyen", "frais_dossier_moyen", "marge_je_moyenne_pct"])

// Écriture en lot des paramètres.
export async function saveParametres(values: ParametresMap): Promise<{ success: boolean; error?: string }> {
  // Paramètres globaux de la structure : permission `parametres_structure`
  // (Présidente, Pôle Trésorerie…) en plus des administrateurs. Deux
  // sous-ensembles ont leurs propres portes, celles des écrans qui les
  // éditent : le pilotage des prix (onglet Trésorerie, `voir_factures`) et
  // les textes par défaut des propositions (page Phases, `gerer_parametres`
  // / `administration`). Sans cela, ces écrans affichaient un formulaire que
  // l'enregistrement refusait.
  const cles = Object.keys(values)
  const message = "Seuls les responsables des paramètres de la structure peuvent les modifier."
  const guard =
    cles.length > 0 && cles.every((k) => CLES_PILOTAGE_PRIX.has(k))
      ? await requireActionPermission(["parametres_structure", "gerer_parametres", "voir_factures"], message)
      : cles.length > 0 && cles.every((k) => /^propale_.*_default$/.test(k))
        ? await requireActionPermission(["parametres_structure", "gerer_parametres", "administration"], message)
        : await requireActionPermission("parametres_structure", message)
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()

  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value ?? "",
    updated_at: new Date().toISOString(),
  }))
  const { error } = await admin.from("parametres").upsert(rows)
  if (error) return { success: false, error: error.message }

  revalidateTag(PARAMETRES_TAG)
  return { success: true }
}

// ---- Marges recommandées par taille d'entreprise ----

const _readMarges = unstable_cache(
  async (): Promise<MargesMap> => {
    const admin = createAdminClient()
    const { data } = await admin.from("marges_recommandees").select("taille_entreprise, marge_pct")
    const map: MargesMap = {}
    for (const row of data ?? []) map[row.taille_entreprise] = Number(row.marge_pct)
    return map
  },
  ["marges-all"],
  { tags: [MARGES_TAG] }
)

// Map taille -> marge_pct.
export async function getMargesRecommandees(): Promise<{ data: MargesMap | null; error: string | null }> {
  // Lecture en client admin (hors RLS « interne ») : réservée aux écrans qui
  // s'en servent — pilotage des prix, prospection, paramétrage avancé.
  const acces = await requireActionPermission(["voir_factures", "gerer_parametres", "prospection"])
  if (!acces.ok) return { data: null, error: acces.error }

  try {
    return { data: await _readMarges(), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Erreur de lecture des marges" }
  }
}

// Écriture en lot des marges — administrateur uniquement.
export async function saveMargesRecommandees(values: MargesMap): Promise<{ success: boolean; error?: string }> {
  // Pilotage des prix : trésorerie (`voir_factures`) ou paramétrage avancé.
  const guard = await requireActionPermission(
    ["gerer_parametres", "voir_factures"],
    "Seule la trésorerie ou un gestionnaire des paramètres peut modifier les marges."
  )
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()

  const rows = Object.entries(values).map(([taille_entreprise, marge_pct]) => ({
    taille_entreprise,
    marge_pct: Number(marge_pct) || 0,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await admin.from("marges_recommandees").upsert(rows)
  if (error) return { success: false, error: error.message }

  revalidateTag(MARGES_TAG)
  return { success: true }
}
