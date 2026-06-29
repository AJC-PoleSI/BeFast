"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  Loader2,
  Send,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  Archive,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  listBAMembers,
  getBaAdminSettings,
  saveBaAdminSettings,
  sendBAAction,
  setBaAutoGlobal,
  type BAMemberRow,
} from "@/lib/actions/signature"

type Settings = {
  presidentUserId: string | null
  tresorierUserId: string | null
  templateConfigured: boolean
  reminderDays: string
  autoGlobal: boolean
  users: { id: string; label: string }[]
}

const SIGNED = ["signed", "completed", "signe", "termine"]

export function BATab({ configured }: { configured: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [members, setMembers] = useState<BAMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [savingSettings, startSaving] = useTransition()

  async function reload() {
    const [s, m] = await Promise.all([getBaAdminSettings(), listBAMembers()])
    if ("data" in s && s.data) setSettings(s.data)
    else if ("error" in s) toast.error(s.error)
    if ("data" in m && m.data) setMembers(m.data)
    else if ("error" in m) toast.error(m.error)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveSettings() {
    if (!settings) return
    startSaving(async () => {
      const res = await saveBaAdminSettings({
        presidentUserId: settings.presidentUserId,
        tresorierUserId: settings.tresorierUserId,
        reminderDays: settings.reminderDays,
      })
      if ("error" in res) toast.error(res.error)
      else toast.success("Réglages enregistrés.")
    })
  }

  async function handleSend(id: string) {
    setBusy(id)
    const res = await sendBAAction(id)
    setBusy(null)
    if ("error" in res) toast.error(res.error)
    else {
      toast.success("Bulletin d'adhésion envoyé en signature.")
      reload()
    }
  }

  async function handleToggleAuto(value: boolean) {
    setSettings((s) => (s ? { ...s, autoGlobal: value } : s))
    const res = await setBaAutoGlobal(value)
    if ("error" in res) {
      toast.error(res.error)
      setSettings((s) => (s ? { ...s, autoGlobal: !value } : s))
    } else {
      toast.success(value ? "Envoi automatique activé." : "Envoi automatique désactivé.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Réglages bureau / template ───────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm shadow-black/5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-gold" /> Réglages des bulletins d&apos;adhésion
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Présidente (signataire)</Label>
            <select
              value={settings?.presidentUserId ?? ""}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, presidentUserId: e.target.value || null } : s))
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Aucune —</option>
              {settings?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Trésorier (signataire de repli)</Label>
            <select
              value={settings?.tresorierUserId ?? ""}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, tresorierUserId: e.target.value || null } : s))
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Aucun —</option>
              {settings?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminderDays">Relances (jours avant expiration)</Label>
            <Input
              id="reminderDays"
              value={settings?.reminderDays ?? "7,2"}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, reminderDays: e.target.value } : s))
              }
              placeholder="7,2"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={saveSettings} disabled={savingSettings} variant="outline">
              {savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="mt-5 border-t pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              Template du bulletin d&apos;adhésion
            </span>
            {settings?.templateConfigured ? (
              <Badge className="bg-emerald-100 text-emerald-700">configuré</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800">manquant</Badge>
            )}
            <Link
              href="/administration/documents"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" /> Gérer dans Administration → Documents
            </Link>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le bulletin d&apos;adhésion se dépose comme les autres modèles (convention, RDM…),
            dans <strong>Administration → Documents</strong>, section « Adhésion / Membre ». Format
            attendu : un <strong>PDF à champs de formulaire (AcroForm)</strong> nommés{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">prenom, nom,
            nom_complet, date_naissance, adresse, ville, code_postal, promo, email, etablissement,
            scolarite, date_jour</code>. Les champs sont remplis automatiquement puis aplatis avant
            envoi en signature.
          </p>
        </div>
      </div>

      {/* ── Liste des membres ────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Membres ({members.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envoi automatique : le BA part dès que le profil et les documents d&apos;un membre
              sont complets. Désactivé, tout passe en envoi manuel.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="text-sm font-medium text-foreground">Envoi automatique</span>
            <Switch
              checked={settings?.autoGlobal ?? true}
              onCheckedChange={handleToggleAuto}
              aria-label="Envoi automatique du bulletin d'adhésion"
            />
          </div>
        </div>
        {members.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Aucun membre.</p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const signed = m.ba_status && SIGNED.includes(m.ba_status.toLowerCase())
              const sent = Boolean(m.ba_sent_at) && !m.ba_archived && !signed
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {[m.prenom, m.nom].filter(Boolean).join(" ") || m.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>

                  {/* Complétude */}
                  {m.complete ? (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Complet
                    </Badge>
                  ) : (
                    <Badge
                      className="bg-zinc-100 text-zinc-600"
                      title={`Manque : ${m.missing.join(", ")}`}
                    >
                      Incomplet ({m.missing.length})
                    </Badge>
                  )}

                  {/* Statut BA */}
                  {signed ? (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <Archive className="mr-1 h-3 w-3" /> Signé
                    </Badge>
                  ) : sent ? (
                    <Badge className="bg-blue-100 text-blue-700">
                      <Clock className="mr-1 h-3 w-3" />
                      Envoyé · {m.days_since_sent}j
                    </Badge>
                  ) : null}

                  {/* Envoi manuel */}
                  <button
                    onClick={() => handleSend(m.id)}
                    disabled={!configured || !m.complete || sent || !!signed || busy === m.id}
                    title={
                      !m.complete
                        ? `Profil incomplet : ${m.missing.join(", ")}`
                        : sent
                          ? "Bulletin déjà en cours"
                          : "Envoyer le bulletin d'adhésion"
                    }
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      "hover:bg-accent disabled:opacity-40"
                    )}
                  >
                    {busy === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Envoyer le BA
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
