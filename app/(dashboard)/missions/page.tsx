import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getMissions } from "@/lib/actions/missions"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { MissionWithEtude } from "@/types/database.types"
import { MissionsClient } from "./MissionsClient"

// Server Component : récupère les données côté serveur, livre le HTML
// avec les missions déjà présentes. Plus de "écran blanc + fetch + render".
export default async function MissionsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Vérifier le statut du compte côté serveur (pas de useUser ici)
  const { data: personne } = await supabase
    .from("personnes")
    .select("account_status, profil_type_id, profils_types(slug)")
    .eq("id", user.id)
    .single()

  const isAdmin = (personne as any)?.profils_types?.slug === "administrateur"
  const isAccessAllowed = isAdmin || personne?.account_status === "validated"

  if (!isAccessAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-manrope font-black text-[#00236f] mb-2">Accès restreint</h2>
        <p className="text-zinc-500 max-w-md mx-auto mb-6">
          Votre compte est en cours de validation par l&apos;administration. L&apos;accès au catalogue des missions sera disponible une fois votre profil validé.
        </p>
        <Link href="/documents">
          <Button className="bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl px-6">
            Vérifier mes documents
          </Button>
        </Link>
      </div>
    )
  }

  // Récupération sur le serveur — pas de loading côté client.
  const result = await getMissions()
  const missions = ((result as any).data || []) as MissionWithEtude[]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">
            Mission Catalog
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Missions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Découvrez et candidatez aux missions disponibles</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <MissionsClient initialMissions={missions} />
      </Suspense>
    </div>
  )
}
