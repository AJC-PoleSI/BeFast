"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, FileText, CheckSquare, Plus, Loader2, Download } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function MissionInternePage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.missionId as string
  const { profile, isAdmin, loading: authLoading } = useUser()

  const [loading, setLoading] = useState(true)
  const [mission, setMission] = useState<any>(null)
  const [collaboration, setCollaboration] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any[]>([])
  const [newChecklistDesc, setNewChecklistDesc] = useState("")

  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  const fetchData = async () => {
    const supabase = createClient()
    
    // Fetch mission
    const { data: m } = await supabase
      .from("missions")
      .select("*, personnes!intervenant_id(prenom, nom)")
      .eq("id", missionId)
      .single()
    setMission(m)

    // Fetch collaboration
    let { data: collab } = await supabase
      .from("mission_collaborations")
      .select("*, chef_projet:chef_projet_id(prenom, nom), intervenant:intervenant_id(prenom, nom)")
      .eq("mission_id", missionId)
      .maybeSingle()

    // Create collaboration space if it doesn't exist and we have an intervenant
    if (!collab && m?.intervenant_id) {
      const { data: newCollab, error: collabError } = await supabase
        .from("mission_collaborations")
        .insert({
          mission_id: missionId,
          intervenant_id: m.intervenant_id,
          chef_projet_id: m.created_by
        })
        .select()
        .single()
      if (collabError) {
        console.error("[interne] création mission_collaborations échouée:", collabError.message)
      }
      collab = newCollab
    }

    if (collab) {
      setCollaboration(collab)
      
      const { data: docs } = await supabase
        .from("mission_documents")
        .select("*")
        .eq("mission_collaboration_id", collab.id)
        .order("uploaded_at", { ascending: false })
      setDocuments(docs || [])

      const { data: checks } = await supabase
        .from("mission_checklist")
        .select("*")
        .eq("mission_collaboration_id", collab.id)
        .order("created_at", { ascending: true })
      setChecklist(checks || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading && profile) {
      fetchData()
    }
  }, [authLoading, profile])

  const handleUploadDocument = async () => {
    if (!fileToUpload || !collaboration) return
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append("missionId", missionId)
      formData.append("collaborationId", collaboration.id)
      formData.append("file", fileToUpload)

      const res = await fetch(`/api/missions/${missionId}/documents`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Erreur lors de l'upload")
      
      toast.success("Document partagé avec succès")
      setFileToUpload(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistDesc.trim() || !collaboration) return

    const supabase = createClient()
    const { error } = await supabase.from("mission_checklist").insert({
      mission_collaboration_id: collaboration.id,
      description_tache: newChecklistDesc.trim()
    })

    if (!error) {
      setNewChecklistDesc("")
      fetchData()
    } else {
      toast.error("Erreur lors de l'ajout de la tâche")
    }
  }

  const toggleChecklist = async (id: string, currentState: boolean) => {
    const supabase = createClient()
    await supabase.from("mission_checklist").update({
      completed: !currentState,
      completed_at: !currentState ? new Date().toISOString() : null,
      completed_by: !currentState ? profile!.id : null
    }).eq("id", id)
    fetchData()
  }

  if (loading || authLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  
  if (!mission || !collaboration) return <div>Espace collaboration non disponible pour cette mission. (Un intervenant doit être assigné)</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/missions/${missionId}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la mission
        </Button>
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Espace Intervenant & Chef de Projet</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><FileText className="mr-2" /> Documents partagés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} />
              <Button onClick={handleUploadDocument} disabled={!fileToUpload || uploadingDoc}>
                {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
            
            <ul className="space-y-3 mt-4">
              {documents.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document.</p> : null}
              {documents.map(doc => (
                <li key={doc.id} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                  <span className="text-sm truncate mr-4">{doc.nom_fichier}</span>
                  <a href={`/api/storage/download?key=${encodeURIComponent(doc.file_url)}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><CheckSquare className="mr-2" /> Checklist d'exécution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddChecklist} className="flex gap-2">
              <Input 
                placeholder="Nouvelle tâche..." 
                value={newChecklistDesc}
                onChange={e => setNewChecklistDesc(e.target.value)}
              />
              <Button type="submit"><Plus className="h-4 w-4" /></Button>
            </form>

            <ul className="space-y-2 mt-4">
              {checklist.length === 0 ? <p className="text-sm text-muted-foreground">Aucune tâche.</p> : null}
              {checklist.map(task => (
                <li key={task.id} className="flex items-center gap-3 bg-muted/20 p-2 rounded-md">
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => toggleChecklist(task.id, task.completed)} 
                    className="h-4 w-4"
                  />
                  <span className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.description_tache}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-center mt-8">
        <Link href={`/missions/${missionId}/notes-de-frais`}>
           <Button className="w-full md:w-auto">Gérer mes notes de frais</Button>
        </Link>
      </div>
    </div>
  )
}
