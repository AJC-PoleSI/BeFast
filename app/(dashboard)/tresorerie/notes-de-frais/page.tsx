"use client"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, FileText, Banknote } from "lucide-react"
import { toast } from "sonner"

export default function TresorerieNotesDeFraisPage() {
  const { profile, loading: authLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<any[]>([])
  const [filter, setFilter] = useState("soumis") // 'tous', 'soumis', 'valide', 'paye'

  const fetchData = async () => {
    const supabase = createClient()
    let query = supabase
      .from("notes_de_frais")
      .select(`
        *,
        intervenant:intervenant_id(prenom, nom),
        mission:mission_id(nom, etudes(numero))
      `)
      .neq("statut", "brouillon")
      .order("submitted_at", { ascending: false })

    if (filter !== "tous") {
      query = query.eq("statut", filter)
    }

    const { data } = await query
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading) fetchData()
  }, [authLoading, filter])

  const handleAction = async (id: string, action: "valider" | "rejeter" | "payer") => {
    try {
      const res = await fetch("/api/tresorerie/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })

      if (!res.ok) throw new Error("Erreur lors de l'action")
      toast.success(`Action '${action}' effectuée avec succès`)
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (loading || authLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trésorerie - Notes de Frais</h1>
        
        <div className="flex gap-2">
          {['tous', 'soumis', 'valide', 'paye'].map(f => (
            <Button 
              key={f} 
              variant={filter === f ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {notes.length === 0 ? <p className="text-muted-foreground text-center py-12">Aucune note de frais trouvée.</p> : null}
        
        {notes.map(note => (
          <Card key={note.id}>
            <CardHeader className="py-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center">
                    {note.numero_note_de_frais} - {note.intervenant?.prenom} {note.intervenant?.nom}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Mission : {note.mission?.etudes?.numero} - {note.mission?.nom}
                  </p>
                </div>
                <Badge variant={note.statut === 'paye' ? 'default' : note.statut === 'valide' ? 'secondary' : 'outline'}>
                  {note.statut.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{note.montant_total} €</p>
                  {note.description && <p className="text-sm text-muted-foreground">{note.description}</p>}
                  
                  <div className="flex gap-3 mt-3">
                    {note.fichiers_justificatifs?.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline">
                        <FileText className="h-4 w-4 mr-1" /> Justificatif {i + 1}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {note.statut === 'soumis' && (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => handleAction(note.id, "rejeter")}>Rejeter</Button>
                      <Button size="sm" onClick={() => handleAction(note.id, "valider")} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="h-4 w-4 mr-2" /> Valider
                      </Button>
                    </>
                  )}
                  {note.statut === 'valide' && (
                    <Button size="sm" onClick={() => handleAction(note.id, "payer")} className="bg-blue-600 hover:bg-blue-700">
                      <Banknote className="h-4 w-4 mr-2" /> Marquer Payée
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
