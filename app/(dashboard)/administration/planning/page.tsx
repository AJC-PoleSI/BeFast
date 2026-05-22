"use client"

import { useState } from "react"
import { Plus, Trash2, Save, Calendar, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function PlanningPage() {
  const [nbSalles, setNbSalles] = useState(2)
  const [salles, setSalles] = useState<string[]>(["Salle 1", "Salle 2"])
  const [hasChanges, setHasChanges] = useState(false)

  const handleNbSallesChange = (value: string) => {
    const newVal = parseInt(value) || 0
    if (newVal < 0) return

    setNbSalles(newVal)
    setHasChanges(true)

    if (newVal < salles.length) {
      setSalles(salles.slice(0, newVal))
    }
  }

  const handleAddSalle = () => {
    if (salles.length >= nbSalles) {
      toast.error(`Nombre maximum de salles atteint (${nbSalles})`)
      return
    }
    const newSalleNum = salles.length + 1
    setSalles([...salles, `Salle ${newSalleNum}`])
    setHasChanges(true)
  }

  const handleRemoveSalle = (index: number) => {
    setSalles(salles.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const handleSaveSalle = (index: number, newName: string) => {
    const updated = [...salles]
    updated[index] = newName
    setSalles(updated)
    setHasChanges(true)
  }

  const handleSave = () => {
    toast.success("Configuration du planning sauvegardée")
    setHasChanges(false)
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Planning & Logistique</h1>
          <p className="text-zinc-500 text-sm mt-1">Configurez les paramètres de logistique des crénaux pour vos missions.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] disabled:bg-zinc-300 transition-all shadow-sm"
        >
          <Save className="w-4 h-4" />
          Enregistrer
        </button>
      </div>

      <div className="space-y-6">
        {/* Logistique des crénaux */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#00236f]" />
            <h2 className="font-bold text-zinc-800">Logistique des crénaux</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Nombre de salles input */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Nombre de salles</Label>
              <Input
                type="number"
                min="0"
                value={nbSalles}
                onChange={(e) => handleNbSallesChange(e.target.value)}
                className="w-32 h-10"
              />
              <p className="text-xs text-zinc-500">Définissez le nombre maximal de salles disponibles pour les missions.</p>
            </div>

            <hr className="border-zinc-100" />

            {/* Calendar Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#00236f]">Calendar Builder</h3>
                <Button
                  onClick={handleAddSalle}
                  disabled={salles.length >= nbSalles}
                  size="sm"
                  className="bg-[#00236f] text-white hover:bg-[#1e3a8a] disabled:bg-zinc-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Ajouter une salle
                </Button>
              </div>

              {salles.length >= nbSalles && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Nombre maximum de salles atteint. Augmentez le paramètre ci-dessus pour en ajouter plus.</p>
                </div>
              )}

              <div className="space-y-2">
                {salles.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <p className="text-sm">Aucune salle configurée. Définissez un nombre de salles et cliquez sur "Ajouter une salle".</p>
                  </div>
                ) : (
                  salles.map((salle, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Input
                          value={salle}
                          onChange={(e) => handleSaveSalle(idx, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveSalle(idx)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
