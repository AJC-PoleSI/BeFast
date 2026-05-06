"use client"

import { useEffect, useState, useRef } from "react"
import { Users, PiggyBank, Briefcase, School, FileText, Euro, Clock, Loader2, TrendingUp } from "lucide-react"
import { getStats } from "@/lib/actions/stats"

/* ─── Animated counter hook ─────────────────────────────── */
function useCountUp(end: number, duration = 1200, start = 0, active = true) {
  const [value, setValue] = useState(start)
  const raf = useRef<number>()

  useEffect(() => {
    if (!active) { setValue(start); return }
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + (end - start) * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [end, duration, start, active])

  return value
}

/* ─── Single KPI card with animation ────────────────────── */
function KpiCard({
  icon: Icon,
  title,
  rawValue,
  displayValue,
  color,
  colorClasses,
  index,
  visible,
}: {
  icon: any
  title: string
  rawValue: number
  displayValue: string
  color: string
  colorClasses: string
  index: number
  visible: boolean
}) {
  const isEuro = displayValue.includes("€")
  const animated = useCountUp(rawValue, 1400, 0, visible)
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)

  return (
    <div
      className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 transition-all duration-500 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 hover:border-slate-300/80 cursor-default"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">
          {title}
        </p>
      </div>
      <p className="text-2xl font-manrope font-black text-[#00236f] tabular-nums">
        {isEuro ? `${fmt(animated)} €` : fmt(animated)}
      </p>
    </div>
  )
}

/* ─── Type breakdown card with animation ────────────────── */
function TypeCard({
  label,
  value,
  bgClass,
  borderClass,
  textClass,
  valueClass,
  index,
  visible,
}: {
  label: string
  value: number
  bgClass: string
  borderClass: string
  textClass: string
  valueClass: string
  index: number
  visible: boolean
}) {
  const animated = useCountUp(value, 1200, 0, visible)

  return (
    <div
      className={`p-5 rounded-xl ${bgClass} border ${borderClass} transition-all duration-500 hover:shadow-md hover:-translate-y-0.5 cursor-default`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${0.7 + index * 0.1}s, transform 0.5s ease ${0.7 + index * 0.1}s`,
      }}
    >
      <p className={`text-xs font-bold ${textClass} uppercase tracking-wider`}>{label}</p>
      <p className={`text-3xl font-manrope font-black ${valueClass} mt-1.5 tabular-nums`}>{animated}</p>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function AdminStatsDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    getStats().then(res => {
      if (res.data) setStats(res.data)
      setLoading(false)
      // trigger animations after a brief paint delay
      requestAnimationFrame(() => setTimeout(() => setVisible(true), 50))
    })
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
        <p className="text-sm text-slate-400 font-medium animate-pulse">Chargement des statistiques…</p>
      </div>
    )
  }

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
  const fmtEur = (n: number) => `${fmt(Math.round(n))} €`

  const kpis = [
    { icon: PiggyBank, title: "CA Réalisé", value: fmtEur(stats.caRealise), raw: Math.round(stats.caRealise), color: "emerald" },
    { icon: Euro, title: "CA Prévisionnel", value: fmtEur(stats.caPrevisionnel), raw: Math.round(stats.caPrevisionnel), color: "blue" },
    { icon: Briefcase, title: "Études", value: fmt(stats.nbEtudes), raw: stats.nbEtudes, color: "purple" },
    { icon: FileText, title: "Missions", value: fmt(stats.nbMissions), raw: stats.nbMissions, color: "amber" },
    { icon: Users, title: "Intervenants uniques", value: fmt(stats.nbIntervenants), raw: stats.nbIntervenants, color: "sky" },
    { icon: Clock, title: "JEH total", value: fmt(stats.totalJeh), raw: stats.totalJeh, color: "rose" },
    { icon: Euro, title: "Rétribution versée", value: fmtEur(stats.retributionTotal), raw: Math.round(stats.retributionTotal), color: "indigo" },
    { icon: School, title: "Candidatures ce mois", value: fmt(stats.candidaturesMois), raw: stats.candidaturesMois, color: "teal" },
  ]

  const COLOR_MAP: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    sky: "bg-sky-50 text-sky-600 border-sky-200",
    rose: "bg-rose-50 text-rose-600 border-rose-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div
        className="flex items-center gap-3"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-12px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-[#00236f] flex items-center justify-center shadow-md shadow-[#00236f]/20">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Statistiques</h1>
          <p className="text-slate-500 text-sm">Vue d&apos;ensemble de l&apos;activité et de la trésorerie.</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <KpiCard
            key={k.title}
            icon={k.icon}
            title={k.title}
            rawValue={k.raw}
            displayValue={k.value}
            color={k.color}
            colorClasses={COLOR_MAP[k.color]}
            index={i}
            visible={visible}
          />
        ))}
      </div>

      {/* Études par type */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease 0.6s, transform 0.5s ease 0.6s",
        }}
      >
        <h2 className="font-manrope font-bold text-[#00236f] mb-5 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#00236f]/50" />
          Répartition des études par type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TypeCard
            label="Appel d'offres"
            value={stats.etudesParType.ao}
            bgClass="bg-blue-50"
            borderClass="border-blue-200"
            textClass="text-blue-600"
            valueClass="text-blue-900"
            index={0}
            visible={visible}
          />
          <TypeCard
            label="Contact spontané"
            value={stats.etudesParType.cs}
            bgClass="bg-purple-50"
            borderClass="border-purple-200"
            textClass="text-purple-600"
            valueClass="text-purple-900"
            index={1}
            visible={visible}
          />
          <TypeCard
            label="Prospection"
            value={stats.etudesParType.prospection}
            bgClass="bg-amber-50"
            borderClass="border-amber-200"
            textClass="text-amber-600"
            valueClass="text-amber-900"
            index={2}
            visible={visible}
          />
        </div>
      </div>
    </div>
  )
}
