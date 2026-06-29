"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, FileSignature, ClipboardCheck, Stamp } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SignatureRequestRow } from "@/lib/actions/signature"
import { LibreTab } from "./tabs/LibreTab"
import { BATab } from "./tabs/BATab"
import { BureauTab } from "./tabs/BureauTab"

type TabKey = "libre" | "ba" | "bureau"

export function SignaturesTabs({
  configured,
  initialRequests,
  loadError,
  isAdmin,
  isBureau,
}: {
  configured: boolean
  initialRequests: SignatureRequestRow[]
  loadError: string | null
  isAdmin: boolean
  isBureau: boolean
}) {
  const tabs = useMemo(() => {
    const t: { key: TabKey; label: string; icon: typeof FileSignature }[] = [
      { key: "libre", label: "Demandes libres", icon: FileSignature },
    ]
    if (isAdmin) t.push({ key: "ba", label: "Bulletins d'adhésion", icon: ClipboardCheck })
    if (isBureau) t.push({ key: "bureau", label: "À signer (bureau)", icon: Stamp })
    return t
  }, [isAdmin, isBureau])

  const [active, setActive] = useState<TabKey>("libre")

  // Restaure / persiste l'onglet dans l'URL (?tab=) sans dépendance externe.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab") as TabKey | null
    if (fromUrl && tabs.some((t) => t.key === fromUrl)) setActive(fromUrl)
  }, [tabs])

  function selectTab(key: TabKey) {
    setActive(key)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", key)
    window.history.replaceState(null, "", url.toString())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-manrope text-2xl font-extrabold text-primary">
          Signatures électroniques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envoyez des documents en signature via LiveConsent (conventions, RDM, bulletins
          d&apos;adhésion) et suivez leur avancement.
        </p>
      </div>

      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            LiveConsent n&apos;est pas configuré. Renseignez{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_USERNAME
            </code>
            ,{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_DEVELOPER_KEY
            </code>{" "}
            et{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_SECRET_KEY
            </code>{" "}
            dans les variables d&apos;environnement (Vercel) pour activer l&apos;envoi.
          </p>
        </div>
      )}

      {/* ── Barre d'onglets ──────────────────────────────────────────── */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((t) => {
            const Icon = t.icon
            const on = active === t.key
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                  on
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>
      )}

      {active === "libre" && (
        <LibreTab configured={configured} initialRequests={initialRequests} loadError={loadError} />
      )}
      {active === "ba" && isAdmin && <BATab configured={configured} />}
      {active === "bureau" && isBureau && <BureauTab configured={configured} />}
    </div>
  )
}
