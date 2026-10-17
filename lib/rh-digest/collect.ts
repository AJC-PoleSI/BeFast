import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type Digest,
  type DocumentLigne,
  nomComplet,
  periodeDuDigest,
  regrouperAttente,
  regrouperDepots,
} from "./digest"

export const SLUGS_DESTINATAIRES = ["responsable_rh", "pole_rh"]

export type Destinataire = { id: string; email: string; prenom: string | null }

/**
 * Responsable RH et membres du Pôle RH : qu'ils portent le profil en rôle de
 * base ou en poste cumulé (personne_postes). Comptes validés uniquement,
 * dédoublonnés (une même personne peut cumuler les deux).
 */
export async function chargerDestinataires(admin: SupabaseClient): Promise<Destinataire[]> {
  const { data: types, error: errTypes } = await admin
    .from("profils_types")
    .select("id")
    .in("slug", SLUGS_DESTINATAIRES)
  if (errTypes) throw new Error(`profils_types: ${errTypes.message}`)
  const typeIds = (types ?? []).map((t: any) => t.id)
  if (typeIds.length === 0) return []

  const [{ data: parRole, error: e1 }, { data: parPoste, error: e2 }] = await Promise.all([
    admin.from("personnes").select("id, email, prenom, account_status").in("profil_type_id", typeIds),
    admin
      .from("personne_postes")
      .select("personnes!inner(id, email, prenom, account_status)")
      .in("poste_id", typeIds),
  ])
  if (e1) throw new Error(`personnes: ${e1.message}`)
  if (e2) throw new Error(`personne_postes: ${e2.message}`)

  const candidats = [...(parRole ?? []), ...(parPoste ?? []).map((r: any) => r.personnes)]
  const uniques = new Map<string, Destinataire>()
  for (const p of candidats) {
    if (!p?.email || p.account_status !== "validated") continue
    uniques.set(p.id, { id: p.id, email: p.email, prenom: p.prenom ?? null })
  }
  return [...uniques.values()]
}

const PAGE = 1000

/** Lit toute une table par pages (PostgREST plafonne à 1000 lignes par requête). */
async function toutLire<T>(
  lire: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await lire(de, de + PAGE - 1)
    if (error) throw new Error(error.message)
    lignes.push(...(data ?? []))
    if (!data || data.length < PAGE) return lignes
  }
}

export async function collecterDigest(admin: SupabaseClient, maintenant = new Date()): Promise<Digest> {
  const { debut, fin } = periodeDuDigest(maintenant)
  const debutIso = debut.toISOString()

  const documents = await toutLire<DocumentLigne>((de, a) =>
    admin
      .from("documents_personnes")
      .select("personne_id, type, status, created_at, updated_at")
      .order("id")
      .range(de, a)
  )

  const [creesRes, validesRes, enAttenteRes] = await Promise.all([
    admin
      .from("personnes")
      .select("id, prenom, nom", { count: "exact" })
      .gte("created_at", debutIso)
      .neq("account_status", "deleted")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("personnes")
      .select("id, prenom, nom", { count: "exact" })
      .gte("validated_at", debutIso)
      .order("validated_at", { ascending: false })
      .limit(50),
    admin.from("personnes").select("id", { count: "exact", head: true }).eq("account_status", "pending_validation"),
  ])
  for (const r of [creesRes, validesRes, enAttenteRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  // Noms des déposants : une requête ciblée sur les ids concernés.
  const ids = [...new Set(documents.map((d) => d.personne_id))]
  const personnes = new Map<string, { prenom: string | null; nom: string | null }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("personnes").select("id, prenom, nom").in("id", ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const p of data ?? []) personnes.set(p.id, p)
  }

  return {
    debut: debutIso,
    fin: fin.toISOString(),
    comptesCrees: { total: creesRes.count ?? 0, personnes: (creesRes.data ?? []).map(nomComplet) },
    comptesValides: { total: validesRes.count ?? 0, personnes: (validesRes.data ?? []).map(nomComplet) },
    comptesEnAttente: enAttenteRes.count ?? 0,
    depots: regrouperDepots(documents, personnes, debut),
    attente: regrouperAttente(documents, personnes, maintenant),
  }
}
