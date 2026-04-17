"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock, 
  Loader2,
  IdCard,
  GraduationCap,
  HeartPulse,
  Wallet,
  Landmark,
  User
} from "lucide-react"

type DocumentStatus = "pending" | "approved" | "rejected"

interface Personne {
  id: string
  prenom: string | null
  nom: string | null
  email: string
}

interface DocumentPersonneAdmin {
  id: string
  personne_id: string
  type: string
  file_path: string
  file_name: string
  status: DocumentStatus
  created_at: string
  personnes: Personne
}

const DOC_TYPE_LABELS: Record<string, string> = {
  carte_identite: "Carte d'identité",
  carte_etudiante: "Carte d'étudiant",
  carte_vitale: "Carte vitale",
  preuve_lydia: "Preuve Lydia",
  rib: "RIB",
}

const DOC_ICONS: Record<string, React.ElementType> = {
  carte_identite: IdCard,
  carte_etudiante: GraduationCap,
  carte_vitale: HeartPulse,
  preuve_lydia: Wallet,
  rib: Landmark,
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentPersonneAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocumentStatus | "all">("pending")

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/documents")
      const data = await res.json()
      if (res.ok) {
        setDocuments(data.documents || [])
      } else {
        toast.error(data.error || "Erreur lors de la récupération des documents")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpdateStatus = async (docId: string, status: DocumentStatus) => {
    setUpdating(docId)
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(status === "approved" ? "Document validé" : "Document refusé")
        setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status } : d))
      } else {
        toast.error(data.error || "Erreur lors de la mise à jour")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setUpdating(null)
    }
  }

  const handleView = async (filePath: string) => {
    try {
      const res = await fetch("/api/profil/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, "_blank")
      } else {
        toast.error(data.error || "Erreur lors de la lecture du document")
      }
    } catch {
      toast.error("Erreur réseau")
    }
  }

  const filteredDocuments = documents.filter(doc => filter === "all" || doc.status === filter)

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Validation des Documents</h1>
          <p className="text-slate-500 text-sm mt-1">Examinez et validez les documents uploadés par les membres.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === f 
                  ? "bg-slate-100 text-slate-900" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f === "pending" && "En attente"}
              {f === "approved" && "Validés"}
              {f === "rejected" && "Refusés"}
              {f === "all" && "Tous"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00236f]" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Aucun document trouvé pour ce filtre.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-6 py-4">Membre</th>
                  <th className="px-6 py-4">Document</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map(doc => {
                  const Icon = DOC_ICONS[doc.type] || FileText
                  const isPending = doc.status === "pending"
                  const isUpdating = updating === doc.id

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {doc.personnes?.prenom} {doc.personnes?.nom}
                            </div>
                            <div className="text-xs text-slate-500">{doc.personnes?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric"
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {doc.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="w-3.5 h-3.5" /> En attente
                          </span>
                        )}
                        {doc.status === "approved" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Validé
                          </span>
                        )}
                        {doc.status === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3.5 h-3.5" /> Refusé
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(doc.file_path)}
                            className="p-2 text-slate-400 hover:text-[#00236f] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Consulter"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(doc.id, "approved")}
                                disabled={isUpdating}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Valider"
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(doc.id, "rejected")}
                                disabled={isUpdating}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Refuser"
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
