"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireActionPermission } from "@/lib/auth/action-guards"

export async function getTagsDictionary() {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data } = await sb.from("parametres").select("value").eq("key", "tags_dictionary").single()
  if (data?.value) {
    try {
      return JSON.parse(data.value)
    } catch {}
  }
  return null
}

export async function saveTagsDictionary(tags: any[]) {
  // Dictionnaire des balises de documents : paramétrage avancé.
  const guard = await requireActionPermission(
    ["gerer_parametres", "administration"],
    "Vous n'avez pas la permission de modifier le dictionnaire des balises."
  )
  if (!guard.ok) return { error: guard.error }
  // Client admin : la RLS de `parametres` (069) n'ouvre l'écriture qu'à
  // `parametres_structure`, le garde applicatif ci-dessus fait foi ici.
  const sb = createAdminClient()

  const { error } = await sb.from("parametres").upsert({ key: "tags_dictionary", value: JSON.stringify(tags) }, { onConflict: "key" })
  if (error) return { error: error.message }
  return { success: true }
}
