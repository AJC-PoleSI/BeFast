"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  Loader2,
  Send,
  Upload,
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
import {
  listBAMembers,
  getBaAdminSettings,
  saveBaAdminSettings,
  uploadBaTemplate,
  sendBAAction,
  setBaAuto,
  type BAMemberRow,
} from "@/lib/actions/signature"

type Settings = {
  presidentUserId: string | null
  tresorierUserId: string | null
  templateConfigured: boolean
  reminderDays: string
  users: { id: string; label: string }[]
}

const SIGNED = ["signed", "completed", "signe", "termine"]

export function BATab({ configured }: { configured: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [members, setMembers] = useState<BAMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [savingSettings, startSaving] = useTransition()
  const templateRef = useRef<HTMLFormElement>(null)

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

  async function handleUpload(formData: FormData) {
    const res = await uploadBaTemplate(formData)
    if ("error" in res) toast.error(res.error)
    else {
      toast.success("Template du bulletin d'adhésion enregistré.")
      templateRef.current?.reset()
      reload()
    }
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

  async function handleToggle(id: string, value: boolean) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ba_auto: value } : m)))
    const res = await setBaAuto(id, value)
    if ("error" in res) {
      toast.error(res.error)
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ba_auto: !value } : m)))
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

        <form ref={templateRef} action={handleUpload} className="mt-5 border-t pt-5">
          <Label htmlFor="ba-template">
            Template PDF du bulletin d&apos;adhésion{" "}
            {settings?.templateConfigured ? (
              <Badge className="ml-2 bg-emerald-100 text-emerald-700">configuré</Badge>
            ) : (
              <Badge className="ml-2 bg-amber-100 text-amber-800">manquant</Badge>
            )}
          </Label>
          <div className="mt-2 flex items-center gap-3">
            <Input
              id="ba-template"
              name="file"
              type="file"
              accept="application/pdf"
              required
              className="max-w-md"
            />
            <Button type="submit" variant="outline">
              <Upload className="h-4 w-4" /> Téléverser
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            PDF avec champs de formulaire nommés (prenom, nom, date_naissance, adresse, ville,
            code_postal, promo, email, etablissement, scolarite, date_jour). Les champs sont
            remplis automatiquement puis aplatis.
          </p>
        </form>
      </div>

      {/* ── Liste des membres ────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm shadow-black/5">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Membres ({members.length})</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto : le BA part dès que le profil et les documents sont complets. Sinon, envoi manuel.
          </p>
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

                  {/* Toggle auto */}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={m.ba_auto}
                      onChange={(e) => handleToggle(m.id, e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#00236f]"
                    />
                    Auto
                  </label>

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
