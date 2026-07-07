"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Users, ShieldCheck, KeyRound, ListPlus, Loader } from "lucide-react"
import { MembresTab } from "./_components/MembresTab"
import { RolesTab } from "./_components/RolesTab"
import { CampagneTab } from "./_components/CampagneTab"
import { ChampsTab } from "./_components/ChampsTab"

/* ──────────────────────────────────────────────────────────────────────────
 * Membres & Droits — hub unique pour tout ce qui touche aux personnes :
 * comptes/validation, rôles & permissions, campagne mot de passe, champs
 * personnalisés. Remplace les 4 anciennes pages (membres, droits,
 * campagne-mdp, champs-personnalises) qui redirigent désormais ici.
 * Chaque onglet ne monte (et ne charge ses données) qu'à l'activation.
 * ────────────────────────────────────────────────────────────────────────── */

type TabKey = "membres" | "roles" | "campagne" | "champs"

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "membres", label: "Membres", icon: Users },
  { key: "roles", label: "Rôles & permissions", icon: ShieldCheck },
  { key: "campagne", label: "Campagne mot de passe", icon: KeyRound },
  { key: "champs", label: "Champs personnalisés", icon: ListPlus },
]

function MembresDroitsShell() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get("tab")
  const activeTab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "membres"

  const setTab = (tab: TabKey) => {
    router.replace(tab === "membres" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Membres & Droits</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Comptes, validation, rôles, permissions et outils liés aux membres.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 mb-6 self-start flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === key
                ? "bg-white text-[#00236f] shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "membres" && <MembresTab />}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "campagne" && <CampagneTab />}
        {activeTab === "champs" && <ChampsTab />}
      </div>
    </div>
  )
}

export default function MembresDroitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader className="w-6 h-6 animate-spin text-zinc-300" />
        </div>
      }
    >
      <MembresDroitsShell />
    </Suspense>
  )
}
