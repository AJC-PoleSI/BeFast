"use client"

import { useState } from "react"
import { Copy, Check, BookOpen, UserCheck, Building2, Calendar, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const DICTIONARY = [
  {
    category: "Étudiant / Intervenant",
    icon: <UserCheck className="w-5 h-5 text-blue-500" />,
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
    icon: <BookOpen className="w-5 h-5 text-emerald-500" />,
    tags: [
      { name: "mission.nom", desc: "Nom de la mission", example: "Développement web" },
      { name: "mission.type", desc: "Type de mission", example: "Réalisation" },
      { name: "mission.description", desc: "Description détaillée", example: "Création d'un site vitrine" },
      { name: "mission.nb_jours", desc: "Nombre de jours-homme (JH)", example: "4" },
      { name: "mission.taux_jour", desc: "Taux journalier moyen", example: "80" },
      { name: "mission.date_debut", desc: "Date de début (JJ/MM/AAAA)", example: "10/05/2026" },
      { name: "mission.date_fin", desc: "Date de fin (JJ/MM/AAAA)", example: "14/05/2026" },
      { name: "mission.numero_etude", desc: "Numéro court de l'étude (2 chiffres)", example: "07" },
      { name: "numero_document", desc: "Numéro auto-incrémenté du document", example: "2" },
    ]
  },
  {
    category: "Étude Globale",
    icon: <BookOpen className="w-5 h-5 text-purple-500" />,
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
    icon: <Building2 className="w-5 h-5 text-orange-500" />,
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
    icon: <Calendar className="w-5 h-5 text-red-500" />,
    tags: [
      { name: "date", desc: "Date du jour formatée", example: "06/05/2026" },
      { name: "annee", desc: "Année en cours", example: "2026" },
    ]
  }
]

export function TagsDictionary({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (val: boolean) => void
}) {
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (tag: string) => {
    const text = `{${tag}}`
    navigator.clipboard.writeText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredDict = DICTIONARY.map(cat => ({
    ...cat,
    tags: cat.tags.filter(t => 
      t.name.toLowerCase().includes(search.toLowerCase()) || 
      t.desc.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.tags.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-xl font-manrope font-bold text-[#00236f] flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Dictionnaire des Balises
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4" />
        </DialogHeader>

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
          {filteredDict.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              Aucune balise ne correspond à votre recherche.
            </div>
          ) : (
            <div className="space-y-8">
              {filteredDict.map((category, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    {category.icon}
                    {category.category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.tags.map(tag => (
                      <div 
                        key={tag.name} 
                        className="group flex flex-col bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#00236f]/30 transition-colors cursor-pointer relative"
                        onClick={() => handleCopy(tag.name)}
                      >
                        <div className="flex items-center justify-between mb-1">
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
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
