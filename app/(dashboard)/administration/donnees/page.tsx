"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Database, ArrowDownUp, Loader2 } from "lucide-react"
import { ExplorateurTab } from "./_components/ExplorateurTab"
import { ExportTab } from "./_components/ExportTab"

/* ──────────────────────────────────────────────────────────────────────────
 * Données — regroupe l'explorateur de tables (lecture seule) et les exports
 * CSV. Remplace les anciennes pages « Explorateur » et « Import / Export »
 * (cette dernière redirige désormais ici).
 * ────────────────────────────────────────────────────────────────────────── */

type TabKey = "explorateur" | "export"

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "explorateur", label: "Explorateur", icon: Database },
  { key: "export", label: "Import / Export", icon: ArrowDownUp },
]

function DonneesShell() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get("tab")
  const activeTab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "explorateur"

  const setTab = (tab: TabKey) => {
    router.replace(tab === "explorateur" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Données</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Consultation des tables et exports CSV (réservé aux administrateurs).
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 mb-6 self-start">
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
        {activeTab === "explorateur" && <ExplorateurTab />}
        {activeTab === "export" && <ExportTab />}
      </div>
    </div>
  )
}

export default function DonneesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
        </div>
      }
    >
      <DonneesShell />
    </Suspense>
  )
}
