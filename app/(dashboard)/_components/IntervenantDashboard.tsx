import type { ReactNode } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMissions } from "@/lib/actions/missions"
import { hasPermission } from "@/lib/auth/permissions"
import { formatEuros, remunerationParIntervenant } from "@/lib/missions/remuneration"
import {
  candidaturesDeposees,
  libelleMission,
  libelleStatutCandidature,
  missionsEnCours,
  missionsRetenues,
  nbEtudesEnCours,
  resumeCandidatures,
  retributionsIntervenant,
  sousTitreCandidatures,
  type CandidatureTableauDeBord,
  type ResumeCandidatures,
  type RetributionTableauDeBord,
} from "@/lib/dashboard/intervenant"
import type { MissionWithEtude, PermissionKey, PersonneWithRole } from "@/types/database.types"
import { MemberSignatureBanner } from "./MemberSignatureBanner"

const STATUT_BADGE: Record<string, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-blue-100 text-blue-700" },
  en_cours: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  terminee: { label: "Terminée", className: "bg-green-100 text-green-700" },
  payee: { label: "Payée", className: "bg-emerald-100 text-emerald-700" },
  annulee: { label: "Annulée", className: "bg-red-100 text-red-600" },
}

const CANDIDATURE_STYLE: Record<string, { icone: string; couleurIcone: string; couleurTexte: string }> = {
  acceptee: { icone: "check_circle", couleurIcone: "text-emerald-500", couleurTexte: "text-emerald-700" },
  refusee: { icone: "cancel", couleurIcone: "text-red-500", couleurTexte: "text-red-600" },
  en_attente: { icone: "schedule", couleurIcone: "text-amber-500", couleurTexte: "text-amber-700" },
}

type ActionRapide = { label: string; href: string; icon: string; permission?: PermissionKey }

// « Voir mes études » mène à /etudes, fermé aux intervenants (clé `etudes`) :
// le lien n'apparaît que pour qui peut l'ouvrir.
const ACTIONS_RAPIDES: ActionRapide[] = [
  { label: "Candidater à une mission", href: "/missions", icon: "assignment" },
  { label: "Voir mes études", href: "/etudes", icon: "school", permission: "etudes" },
  { label: "Gérer mes documents", href: "/profil", icon: "folder_open" },
  { label: "Mon profil", href: "/profil", icon: "person" },
]

// Barème, statut et étude : de quoi chiffrer et compter, rien de plus.
const COLONNES_MISSION = "id, nom, statut, etude_id, remuneration, nb_jeh, nb_intervenants, taux_jour, etudes(id, statut)"

/**
 * Accueil du rôle intervenant. Chaque carte « Mes … » ne compte que ce qui
 * concerne l'intervenant connecté ; les règles de calcul vivent dans
 * lib/dashboard/intervenant.ts.
 */
export async function IntervenantDashboard({
  userId,
  profile,
}: {
  userId: string
  profile: PersonneWithRole | null
}) {
  const supabase = createClient()
  const [missionsRes, candidaturesRes, retributionsRes] = await Promise.all([
    getMissions({ statut: "ouverte" }),
    supabase
      .from("candidatures")
      .select(`id, personne_id, mission_id, created_by, statut, created_at, missions(${COLONNES_MISSION})`)
      .eq("personne_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("retributions")
      .select("mission_id, montant, date_paiement")
      .eq("personne_id", userId),
  ])

  if (candidaturesRes.error) console.error("[IntervenantDashboard] candidatures:", candidaturesRes.error)
  if (retributionsRes.error) console.error("[IntervenantDashboard] retributions:", retributionsRes.error)

  const candidatures = (candidaturesRes.data ?? []) as unknown as CandidatureTableauDeBord[]
  const records = (retributionsRes.data ?? []) as RetributionTableauDeBord[]
  const missionsOuvertes = ((missionsRes as { data?: unknown[] }).data ?? []) as MissionWithEtude[]

  const deposees = candidaturesDeposees(candidatures)
  const retenues = missionsRetenues(candidatures)
  const enCours = missionsEnCours(retenues)

  return (
    <IntervenantDashboardView
      greeting={profile ? `Bienvenue, ${profile.prenom || profile.email}` : "Bienvenue"}
      banner={<MemberSignatureBanner />}
      retributions={retributionsIntervenant(retenues, records)}
      nbMissionsEnCours={enCours.length}
      nbEtudesEnCours={nbEtudesEnCours(enCours)}
      resume={resumeCandidatures(deposees)}
      dernieresCandidatures={deposees.slice(0, 3)}
      missionsOuvertes={missionsOuvertes}
      actions={ACTIONS_RAPIDES.filter((a) => !a.permission || hasPermission(profile, a.permission))}
    />
  )
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  iconClassName,
  iconBgClassName,
}: {
  label: string
  value: string | number
  subtitle: string
  icon: string
  iconClassName: string
  iconBgClassName: string
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{value}</p>
          <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBgClassName} flex items-center justify-center`}>
          <span aria-hidden="true" className={`material-symbols-outlined ${iconClassName} text-xl`}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

export function IntervenantDashboardView({
  greeting,
  banner,
  retributions,
  nbMissionsEnCours,
  nbEtudesEnCours,
  resume,
  dernieresCandidatures,
  missionsOuvertes,
  actions,
}: {
  greeting: string
  banner?: ReactNode
  retributions: { prevu: number; verse: number }
  nbMissionsEnCours: number
  nbEtudesEnCours: number
  resume: ResumeCandidatures
  dernieresCandidatures: CandidatureTableauDeBord[]
  missionsOuvertes: MissionWithEtude[]
  actions: ActionRapide[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{greeting}</p>
      </div>

      {/* Bannière : bulletin d'adhésion en attente de signature */}
      {banner}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Mes rétributions"
          value={formatEuros(retributions.prevu)}
          subtitle={`dont ${formatEuros(retributions.verse)} versés`}
          icon="euro"
          iconClassName="text-[#00236f]"
          iconBgClassName="bg-[#d0d8ff]"
        />
        <StatCard
          label="Mes missions en cours"
          value={nbMissionsEnCours}
          subtitle={nbMissionsEnCours > 0 ? "Missions où vous êtes retenu·e" : "Aucune mission en cours"}
          icon="assignment"
          iconClassName="text-blue-600"
          iconBgClassName="bg-blue-100"
        />
        <StatCard
          label="Mes études en cours"
          value={nbEtudesEnCours}
          subtitle={nbEtudesEnCours > 0 ? "Études de vos missions en cours" : "Aucune étude en cours"}
          icon="school"
          iconClassName="text-purple-600"
          iconBgClassName="bg-purple-100"
        />
        <StatCard
          label="Mes candidatures"
          value={resume.total}
          subtitle={sousTitreCandidatures(resume)}
          icon="group"
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-100"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Missions ouvertes aux candidatures (toute la plateforme) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">
              Missions ouvertes <span className="text-zinc-400 font-semibold">({missionsOuvertes.length})</span>
            </h2>
            <Link href="/missions" className="text-xs text-[#00236f] font-medium hover:underline flex items-center gap-0.5">
              Voir tout
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {missionsOuvertes.length > 0 ? (
              missionsOuvertes.slice(0, 5).map((mission) => {
                const badge = STATUT_BADGE[mission.statut] || { label: mission.statut, className: "bg-zinc-100 text-zinc-600" }
                const retribution = remunerationParIntervenant(mission)
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
                      {retribution > 0 && (
                        <span className="text-sm font-bold text-[#00236f]">{formatEuros(retribution)}</span>
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
                <p className="text-sm">Aucune mission ouverte</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Actions rapides</h2>
            <div className="space-y-2">
              {actions.map((action) => (
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
            {dernieresCandidatures.length > 0 ? (
              <div className="space-y-2">
                {dernieresCandidatures.map((cand) => {
                  const style = CANDIDATURE_STYLE[cand.statut] ?? CANDIDATURE_STYLE.en_attente
                  const libelle = libelleMission(cand)
                  return (
                    <div key={cand.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-50">
                      <span aria-hidden="true" className={`material-symbols-outlined text-xl ${style.couleurIcone}`}>
                        {style.icone}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${cand.missions?.nom?.trim() ? "text-zinc-800" : "text-zinc-400 italic"}`}
                          title={libelle}
                        >
                          {libelle}
                        </p>
                        <p className="text-xs text-zinc-400">
                          <span className={`font-medium ${style.couleurTexte}`}>{libelleStatutCandidature(cand.statut)}</span>
                          {" · "}
                          {new Date(cand.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  )
                })}
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
