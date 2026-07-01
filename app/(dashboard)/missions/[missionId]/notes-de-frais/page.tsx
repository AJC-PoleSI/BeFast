"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Upload, FileText, Loader2, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function NotesDeFraisPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.missionId as string
  const { profile, loading: authLoading } = useUser()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [noteFrais, setNoteFrais] = useState<any>(null)
  const [montant, setMontant] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [mission, setMission] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && profile) {
      fetchData()
    }
  }, [authLoading, profile])

  const fetchData = async () => {
    const supabase = createClient()
    
    // Fetch mission
    const { data: m } = await supabase
      .from("missions")
      .select("*")
      .eq("id", missionId)
      .single()
    setMission(m)

    // Fetch existing note de frais (draft or submitted)
    const { data: nf } = await supabase
      .from("notes_de_frais")
      .select("*")
      .eq("mission_id", missionId)
      .eq("intervenant_id", profile!.id)
      .maybeSingle()
    
    if (nf) {
      setNoteFrais(nf)
      setMontant(nf.montant_total?.toString() || "")
      setDescription(nf.description || "")
    }

    setLoading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!montant || isNaN(Number(montant))) {
      toast.error("Veuillez saisir un montant valide")
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("missionId", missionId)
      formData.append("montant", montant)
      formData.append("description", description)
      files.forEach(f => formData.append("files", f))

      const res = await fetch("/api/upload/frais", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Erreur lors de la soumission")
      }

      toast.success("Note de frais soumise avec succès")
      fetchData() // Refresh data
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (!mission) {
    return <div>Mission introuvable</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/missions/${missionId}`}>
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la mission
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Notes de Frais</CardTitle>
              <CardDescription>Mission : {mission.nom}</CardDescription>
            </div>
            {noteFrais && (
              <Badge variant={noteFrais.statut === 'paye' ? 'default' : 'secondary'}>
                {noteFrais.statut.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {noteFrais?.statut && noteFrais.statut !== 'brouillon' ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Numéro : {noteFrais.numero_note_de_frais}</p>
                <p className="text-sm font-medium">Montant total : {noteFrais.montant_total} €</p>
                <p className="text-sm mt-2 text-muted-foreground">{noteFrais.description}</p>
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Justificatifs :</h4>
                  <ul className="space-y-2">
                    {noteFrais.fichiers_justificatifs?.map((f: string, i: number) => (
                      <li key={i} className="flex items-center text-sm text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        <a href={`/api/storage/download?key=${encodeURIComponent(f)}`} target="_blank" rel="noopener noreferrer">Fichier {i + 1}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="montant">Montant total déclaré (€)</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 45.50"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description des frais</Label>
                <Input
                  id="description"
                  placeholder="Repas avec le client, Train Paris-Lyon..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Justificatifs (PDF, JPG, PNG)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20">
                  <Upload className="h-8 w-8 text-muted-foreground mb-4" />
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="max-w-xs"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Plusieurs fichiers possibles
                  </p>
                </div>
                {files.length > 0 && (
                  <ul className="mt-2 text-sm text-muted-foreground">
                    {files.map(f => (
                      <li key={f.name}>• {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                    ))}
                  </ul>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Soumettre pour validation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
