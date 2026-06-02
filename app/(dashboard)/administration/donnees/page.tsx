"use client"

import { useEffect, useState } from "react"
import { Database, Loader2 } from "lucide-react"

export default function ExplorateurDonneesPage() {
  const [tables, setTables] = useState<string[]>([])
  const [active, setActive] = useState<string>("personnes")
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (table: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/explore?table=${table}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Erreur"); setRows([]); setLoading(false); return }
      if (json.tables) setTables(json.tables)
      setRows(json.rows ?? [])
    } catch {
      setError("Erreur réseau")
    }
    setLoading(false)
  }

  useEffect(() => { load(active) }, [active])

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-manrope font-black text-[#00236f] flex items-center gap-2">
          <Database className="w-6 h-6" /> Explorateur de données
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Visualisation en lecture seule des tables (500 lignes max).</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              active === t ? "bg-[#00236f] text-white border-[#00236f]" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-[#00236f]" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-amber-700 bg-amber-50">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-zinc-400 text-sm">Table vide.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-zinc-700 whitespace-nowrap max-w-[260px] truncate" title={String(r[h] ?? "")}>
                        {r[h] === null || r[h] === undefined ? <span className="text-zinc-300">—</span> : String(r[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-3">{rows.length} ligne{rows.length > 1 ? "s" : ""} affichée{rows.length > 1 ? "s" : ""}.</p>
    </div>
  )
}
