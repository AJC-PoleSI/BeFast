"use client"

import { useState, useEffect } from "react"
import { Copy, Check, BookOpen, UserCheck, Building2, Calendar, Search, Plus, Trash2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getTagsDictionary, saveTagsDictionary } from "@/lib/actions/tags"
import { toast } from "sonner"

const DEFAULT_DICTIONARY = [
  {
    category: "Étudiant / Intervenant",
    iconName: "UserCheck",
    tags: [
      { name: "intervenant.prenom", desc: "Prénom de l'étudiant", example: "Jean" },
      { name: "intervenant.nom", desc: "Nom de famille de l'étudiant", example: "Dupont" },
      { name: "intervenant.email", desc: "Adresse email", example: "jean.dupont@audencia.com" },
      { name: "intervenant.portable", desc: "Numéro de téléphone", example: "06 12 34 56 78" },
      { name: "intervenant.adresse", desc: "Adresse postale", example: "12 rue de la Paix" },
      { name: "intervenant.code_postal", desc: "Code postal", example: "44000" },
      { name: "intervenant.ville", desc: "Ville", example: "Nantes" },
      { name: "intervenant.promo", desc: "Promotion de l'étudiant", example: "PGE 2026" },
      { name: "intervenant.date_naissance", desc: "Date de naissance", example: "1999-05-14" },
    ]
  },
  {
    category: "Mission / RDM",
    iconName: "BookOpen",
    tags: [
      { name: "mission.nom", desc: "Nom de la mission", example: "Développement web" },
      { name: "mission.type", desc: "Type de mission", example: "Réalisation" },
      { name: "mission.description", desc: "Description détaillée", example: "Création d'un site vitrine" },
      { name: "mission.nb_jours", desc: "Nombre de jours-homme (JH)", example: "4" },
      { name: "mission.taux_jour", desc: "Taux journalier moyen", example: "80" },
      { name: "mission.date_debut", desc: "Date de début", example: "10/05/2026" },
      { name: "mission.date_fin", desc: "Date de fin", example: "14/05/2026" },
      { name: "mission.numero_etude", desc: "Numéro court de l'étude", example: "07" },
      { name: "numero_document", desc: "Numéro auto-incrémenté", example: "2" },
    ]
  },
  {
    category: "Étude Globale",
    iconName: "BookOpen",
    tags: [
      { name: "reference", desc: "Référence complète de l'étude", example: "2026-DEV-07" },
      { name: "etude.nom", desc: "Nom global de l'étude", example: "Site E-commerce Client X" },
      { name: "etude.prix", desc: "Prix total TTC", example: "1450.00" },
      { name: "etude.tarif_ht", desc: "Tarif total HT", example: "1450.00" },
      { name: "etude.nb_jeh", desc: "Total des JEH de l'étude", example: "10" },
      { name: "client.nom", desc: "Nom du client", example: "Entreprise XYZ" },
    ]
  },
  {
    category: "Structure & Bureau",
    iconName: "Building2",
    tags: [
      { name: "president.nom_complet", desc: "Prénom et Nom du Président", example: "Alice Martin" },
      { name: "president.civilite", desc: "Monsieur ou Madame", example: "Madame" },
      { name: "tresorier.nom_complet", desc: "Prénom et Nom du Trésorier", example: "Paul Bernard" },
      { name: "structure.raison_sociale", desc: "Nom de la JE", example: "Audencia Junior Conseil" },
      { name: "structure.siret", desc: "Numéro de SIRET", example: "123 456 789 00012" },
    ]
  },
  {
    category: "Dates Générales",
    iconName: "Calendar",
    tags: [
      { name: "date", desc: "Date du jour formatée", example: "06/05/2026" },
      { name: "annee", desc: "Année en cours", example: "2026" },
    ]
  }
]

const ICONS: Record<string, any> = {
  UserCheck,
  BookOpen,
  Building2,
  Calendar
}

export function TagsDictionary({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (val: boolean) => void
}) {
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  
  const [dictionary, setDictionary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Mode "Ajout"
  const [isAdding, setIsAdding] = useState(false)
  const [newCat, setNewCat] = useState("Étudiant / Intervenant")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newExample, setNewExample] = useState("")

  useEffect(() => {
    if (open) {
      loadDict()
    }
  }, [open])

  async function loadDict() {
    setLoading(true)
    const saved = await getTagsDictionary()
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setDictionary(saved)
    } else {
      setDictionary(DEFAULT_DICTIONARY)
      await saveTagsDictionary(DEFAULT_DICTIONARY) // Initialize in DB
    }
    setLoading(false)
  }

  const handleCopy = (tag: string) => {
    const text = `{${tag}}`
    navigator.clipboard.writeText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleAddTag = async () => {
    if (!newName || !newDesc) {
      toast.error("Le nom et la description sont requis.")
      return
    }
    
    // Find or create category
    let nextDict = [...dictionary]
    const catIndex = nextDict.findIndex(c => c.category === newCat)
    
    if (catIndex >= 0) {
      // Add to existing
      nextDict[catIndex].tags.push({ name: newName, desc: newDesc, example: newExample })
    } else {
      // Create new category
      nextDict.push({
        category: newCat,
        iconName: "BookOpen", // default
        tags: [{ name: newName, desc: newDesc, example: newExample }]
      })
    }

    setDictionary(nextDict)
    setIsAdding(false)
    setNewName("")
    setNewDesc("")
    setNewExample("")
    
    const res = await saveTagsDictionary(nextDict)
    if ("error" in res) {
      toast.error("Erreur lors de la sauvegarde.")
    } else {
      toast.success("Balise ajoutée au dictionnaire.")
    }
  }

  const handleDeleteTag = async (catName: string, tagName: string) => {
    if (!confirm(`Supprimer la balise {${tagName}} du dictionnaire ? (Cela ne l'efface pas de la base de données)`)) return
    
    const nextDict = dictionary.map(cat => {
      if (cat.category !== catName) return cat
      return { ...cat, tags: cat.tags.filter((t: any) => t.name !== tagName) }
    }).filter(cat => cat.tags.length > 0)

    setDictionary(nextDict)
    const res = await saveTagsDictionary(nextDict)
    if ("error" in res) toast.error("Erreur.")
  }

  const filteredDict = dictionary.map(cat => ({
    ...cat,
    tags: cat.tags.filter((t: any) => 
      t.name.toLowerCase().includes(search.toLowerCase()) || 
      t.desc.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.tags.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-manrope font-bold text-[#00236f] flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Dictionnaire des Balises
          </DialogTitle>
          <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? "Fermer l'ajout" : <><Plus className="w-4 h-4 mr-1" /> Nouvelle balise</>}
          </Button>
        </DialogHeader>

        {isAdding && (
          <div className="bg-blue-50/50 p-6 border-b border-blue-100 flex-shrink-0 animate-in slide-in-from-top-2">
            <h4 className="font-bold text-[#00236f] mb-3 text-sm uppercase tracking-wide">Ajouter au dictionnaire</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Catégorie</label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={newCat} 
                  onChange={e => setNewCat(e.target.value)}
                >
                  {dictionary.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nom balise (ex: intervenant.ville)</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="mission.nouvelle_donnee" className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Description</label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Ville de l'intervenant" className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Exemple (optionnel)</label>
                <Input value={newExample} onChange={e => setNewExample(e.target.value)} placeholder="Paris" className="h-9" />
              </div>
            </div>
            <Button size="sm" className="bg-[#00236f] hover:bg-[#00236f]/90 text-white" onClick={handleAddTag}>
              Ajouter la balise
            </Button>
            <p className="text-xs text-slate-500 mt-3">
              💡 <b>Note:</b> Toutes les colonnes de votre base de données sont déjà accessibles. Vous n'avez qu'à ajouter le nom ici pour que vos collaborateurs le voient.
            </p>
          </div>
        )}

        <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher une balise (ex: intervenant, date...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-[#00236f]" />
            </div>
          ) : filteredDict.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              Aucune balise ne correspond à votre recherche.
            </div>
          ) : (
            <div className="space-y-8">
              {filteredDict.map((category, idx) => {
                const IconComponent = ICONS[category.iconName] || BookOpen
                return (
                  <div key={idx} className="space-y-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <IconComponent className="w-5 h-5 text-[#00236f]" />
                      {category.category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.tags.map((tag: any) => (
                        <div 
                          key={tag.name} 
                          className="group flex flex-col bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#00236f]/30 transition-colors cursor-pointer relative"
                          onClick={() => handleCopy(tag.name)}
                        >
                          <button 
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            onClick={(e) => { e.stopPropagation(); handleDeleteTag(category.category, tag.name) }}
                            title="Supprimer du dictionnaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center justify-between mb-1 pr-6">
                            <code className="text-[13px] font-bold text-[#00236f]">
                              {"{"}{tag.name}{"}"}
                            </code>
                            <div className="text-slate-400 bg-slate-100 rounded p-1 group-hover:bg-[#00236f]/10 group-hover:text-[#00236f] transition-colors">
                              {copied === tag.name ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{tag.desc}</p>
                          <p className="text-[11px] text-slate-400 italic mt-1 truncate">
                            Exemple : {tag.example}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
