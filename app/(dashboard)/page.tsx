import { createClient } from "@/lib/supabase/server"
import { getMissions, getMesCandidatures } from "@/lib/actions/missions"
import { getEtudes, getMesEtudeIds } from "@/lib/actions/etudes"
import { partitionMesEtudes, ordonnerPourAccueil } from "@/lib/etudes/mes-etudes"
import Link from "next/link"
import type { MissionWithEtude, CandidatureWithMission } from "@/types/database.types"
import { MemberSignatureBanner } from "./_components/MemberSignatureBanner"
import { IntervenantDashboard } from "./_components/IntervenantDashboard"
import { redirect } from "next/navigation"
import { getPageProfile } from "@/lib/auth/page-guards"
import { hasPermission } from "@/lib/auth/permissions"

const ETUDE_STATUT: Record<string, { label: string; className: string }> = {
  en_cours: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  signee: { label: "Signée", className: "bg-indigo-100 text-indigo-700" },
  en_cours_prospection: { label: "En cours de prospection", className: "bg-amber-100 text-amber-700" },
  prospection: { label: "Prospection", className: "bg-zinc-100 text-zinc-600" },
  prospect: { label: "Prospection", className: "bg-zinc-100 text-zinc-600" },
  terminee: { label: "Terminée", className: "bg-green-100 text-green-700" },
  annulee: { label: "Annulée", className: "bg-red-100 text-red-600" },
}

const STATUT_BADGE: Record<string, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-blue-100 text-blue-700" },
  en_cours: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  terminee: { label: "Terminée", className: "bg-green-100 text-green-700" },
  payee: { label: "Payée", className: "bg-emerald-100 text-emerald-700" },
  annulee: { label: "Annulée", className: "bg-red-100 text-red-600" },
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sans la permission `dashboard` (candidats, comptes en attente…), on renvoie
  // vers la première page réellement accessible plutôt que d'afficher un écran
  // de refus sur la page d'atterrissage de la connexion.
  const ctx = await getPageProfile()
  if (ctx && !hasPermission(ctx.profile, "dashboard")) {
    redirect(hasPermission(ctx.profile, "profil") ? "/dashboard/profil" : "/attente")
  }

  // Intervenant : accueil dédié dont les cartes ne comptent que ce qui le
  // concerne (rétributions, missions, études, candidatures). Les autres rôles
  // gardent l'accueil ci-dessous.
  if (ctx?.profile?.profils_types?.slug === "intervenant") {
    return <IntervenantDashboard userId={ctx.userId} profile={ctx.profile} />
  }

  const [
    personneResult,
    missionsResult,
    etudesResult,
    candidaturesResult,
    mesEtudeIdsResult,
  ] = await Promise.all([
    user
      ? supabase.from("personnes").select("prenom, email").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    getMissions({ statut: "ouverte" }),
    getEtudes(),
    getMesCandidatures(),
    getMesEtudeIds(),
  ])

  const personne = personneResult.data
  const allMissions = ((missionsResult as any).data || []) as unknown as MissionWithEtude[]
  const allEtudes = (etudesResult as any).data || []
  const allCandidatures = ((candidaturesResult as any).data || []) as CandidatureWithMission[]

  const missions = allMissions.slice(0, 5)
  const candidatures = allCandidatures.slice(0, 3)
  // Accueil centré sur la personne (retour de Baptiste du 02/10/2026) : ses
  // études d'abord, et uniquement des chiffres réels — la carte « CA
  // Financier » restait vide et « 75 % acceptation » était écrit en dur.
  const mesEtudes = ordonnerPourAccueil(
    partitionMesEtudes(allEtudes as { id: string; statut: string; nom: string; numero: string; clients?: { nom: string } | null }[], mesEtudeIdsResult.data ?? []).mine
  )
  const mesEtudesEnCours = mesEtudes.filter((e) => e.statut === "en_cours")
  const candidaturesAcceptees = allCandidatures.filter((c) => c.statut === "acceptee").length
  const candidaturesRefusees = allCandidatures.filter((c) => c.statut === "refusee").length
  const candidaturesEnAttente = allCandidatures.length - candidaturesAcceptees - candidaturesRefusees

  const greeting = personne
    ? `Bienvenue, ${personne.prenom || personne.email}`
    : "Bienvenue"

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{greeting}</p>
      </div>

      {/* Bannière : bulletin d'adhésion en attente de signature */}
      <MemberSignatureBanner />

      {/* Stats cards — chiffres personnels et réels uniquement */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Mes études en cours</p>
              <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{mesEtudesEnCours.length}</p>
              <Link href="/etudes" className="text-xs text-[#00236f] mt-1 hover:underline inline-flex items-center gap-0.5">
                Voir mes études
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-xl">school</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Missions ouvertes</p>
              <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{allMissions.length}</p>
              <Link href="/missions" className="text-xs text-[#00236f] mt-1 hover:underline inline-flex items-center gap-0.5">
                Candidater
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-xl">assignment</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Mes candidatures</p>
              <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{allCandidatures.length}</p>
              {allCandidatures.length > 0 ? (
                <p className="text-xs text-zinc-500 mt-1">
                  {candidaturesAcceptees} acceptée{candidaturesAcceptees > 1 ? "s" : ""} · {candidaturesEnAttente} en attente
                </p>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">Aucune candidature</p>
              )}
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-xl">group</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
        {/* Mes études : accès direct, sans passer par la liste de toute la JE */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Mes études</h2>
            <Link href="/etudes" className="text-xs text-[#00236f] font-medium hover:underline flex items-center gap-0.5">
              Toutes les études
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {mesEtudes.length > 0 ? (
              mesEtudes.slice(0, 6).map((etude) => {
                const badge = ETUDE_STATUT[etude.statut] || { label: etude.statut, className: "bg-zinc-100 text-zinc-600" }
                return (
                  <Link
                    key={etude.id}
                    href={`/etudes/${etude.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-purple-600 text-lg">school</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{etude.nom?.trim() || "Sans nom"}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        {[etude.numero, etude.clients?.nom].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </Link>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
                <span className="material-symbols-outlined text-4xl mb-2">school</span>
                <p className="text-sm">Vous ne suivez aucune étude pour l&apos;instant</p>
              </div>
            )}
          </div>
        </div>

        {/* Missions ouvertes */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Missions ouvertes</h2>
            <Link href="/missions" className="text-xs text-[#00236f] font-medium hover:underline flex items-center gap-0.5">
              Voir tout
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {missions.length > 0 ? (
              missions.map((mission) => {
                const badge = STATUT_BADGE[mission.statut] || { label: mission.statut, className: "bg-zinc-100 text-zinc-600" }
                return (
                  <Link
                    key={mission.id}
                    href={`/missions/${mission.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#d0d8ff] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#00236f] text-lg">assignment</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{mission.nom}</p>
                      <p className="text-xs text-zinc-400 truncate">{mission.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {mission.remuneration && (
                        <span className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <span className="material-symbols-outlined text-4xl mb-2">assignment</span>
                <p className="text-sm">Aucune mission disponible</p>
              </div>
            )}
          </div>
        </div>

        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Actions rapides</h2>
            <div className="space-y-2">
              {[
                { label: "Candidater à une mission", href: "/missions", icon: "assignment" },
                { label: "Voir mes études", href: "/etudes", icon: "school" },
                { label: "Gérer mes documents", href: "/documents", icon: "folder_open" },
                { label: "Mon profil", href: "/dashboard/profil", icon: "person" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#eceef0] flex items-center justify-center group-hover:bg-[#d0d8ff] transition-colors">
                    <span className="material-symbols-outlined text-[#00236f] text-lg">{action.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-700 group-hover:text-[#00236f] transition-colors">{action.label}</span>
                  <span className="material-symbols-outlined text-zinc-300 text-base ml-auto">arrow_forward_ios</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Statut candidatures</h2>
            {candidatures.length > 0 ? (
              <div className="space-y-2">
                {candidatures.map((cand) => (
                  <div key={cand.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-50">
                    <span className={`material-symbols-outlined text-xl ${
                      cand.statut === "acceptee" ? "text-emerald-500" :
                      cand.statut === "refusee" ? "text-red-500" :
                      "text-amber-500"
                    }`}>
                      {cand.statut === "acceptee" ? "check_circle" : cand.statut === "refusee" ? "cancel" : "schedule"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{cand.missions?.nom}</p>
                      <p className="text-xs text-zinc-400">{new Date(cand.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
                <span className="material-symbols-outlined text-3xl mb-1">timeline</span>
                <p className="text-xs">Aucune candidature</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
