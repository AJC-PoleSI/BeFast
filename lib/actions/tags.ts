"use server"

import { createClient } from "@/lib/supabase/server"

export async function getTagsDictionary() {
  const sb = createClient()
  const { data } = await sb.from("parametres").select("value").eq("key", "tags_dictionary").single()
  if (data?.value) {
    try {
      return JSON.parse(data.value)
    } catch {}
  }
  return null
}

export async function saveTagsDictionary(tags: any[]) {
  const sb = createClient()
  const { error } = await sb.from("parametres").upsert({ key: "tags_dictionary", value: JSON.stringify(tags) }, { onConflict: "key" })
  if (error) return { error: error.message }
  return { success: true }
}
