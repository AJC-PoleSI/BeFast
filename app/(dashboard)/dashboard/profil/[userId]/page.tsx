"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ProfileInfoForm } from "../_components/ProfileInfoForm"
import { DocumentsGrid } from "../_components/DocumentsGrid"
import {
  ArrowLeft,
  User,
  FileText,
  Mail,
  Calendar,
  Shield,
} from "lucide-react"
import Link from "next/link"
import type { PersonneWithRole } from "@/types/database.types"
import type { ProfileFormValues } from "../_lib/schemas"

export default function AdminProfilePage() {
  const params = useParams()
  const userId = params.userId as string
  const { isAdmin, permissions, loading: authLoading } = useUser()

  const [profile, setProfile] = useState<PersonneWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("personnes")
      .select("*, profils_types(*)")
      .eq("id", userId)
      .single()

    setProfile(data as PersonneWithRole | null)
    setLoading(false)
  }, [userId])

  const canViewMemberDocs = isAdmin || permissions?.voir_documents_membres === true

  useEffect(() => {
    if (!authLoading && canViewMemberDocs) {
      fetchProfile()
    } else if (!authLoading && !canViewMemberDocs) {
      setLoading(false)
    }
  }, [authLoading, canViewMemberDocs, fetchProfile])

  if (authLoading || loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!canViewMemberDocs) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="font-heading text-xl font-bold mb-2">Accès non autorisé</h2>
          <p className="text-muted-foreground">
            Vous n'avez pas la permission de consulter les documents des membres.
          </p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Profil introuvable.</p>
      </div>
    )
  }

  const initials = [profile.prenom?.[0], profile.nom?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?"

  const fullName =
    [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email

  const roleName = profile.profils_types?.nom || "Non assigné"

  const initialValues: ProfileFormValues = {
    prenom: profile.prenom || "",
    nom: profile.nom || "",
    portable: profile.portable || "",
    promo: profile.promo || "",
    adresse: profile.adresse || "",
    ville: profile.ville || "",
    code_postal: profile.code_postal || "",
    pole: profile.pole || "",
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link href="/membres">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retour aux membres
        </Button>
      </Link>

      {/* Profile Header (Admin view) */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
          <Shield className="h-4 w-4" />
          <span className="font-medium">
            Vue administrateur — Modification du profil de {fullName}
          </span>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-muted/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gold text-navy text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div>
              <h1 className="font-heading text-xl font-bold">{fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <Badge
                  variant="secondary"
                  className="bg-gold/10 text-gold border-gold/20"
                >
                  {roleName}
                </Badge>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
                </span>
                {profile.promo && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Promo {profile.promo}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="informations">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="informations" className="gap-1.5">
            <User className="h-4 w-4" />
            Informations
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="informations">
          <div className="space-y-6">
            <ProfileInfoForm
              initialValues={initialValues}
              targetUserId={userId}
            />

            {/* Sensitive fields - read-only info for admin */}
            <div className="bg-white rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-gold" />
                <h3 className="font-heading text-lg font-semibold">
                  Données sensibles
                </h3>
              </div>
              <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                <p>
                  Les données sensibles (NSS, IBAN) ne sont modifiables que par
                  le membre lui-même. Elles sont chiffrées en AES-256 et ne
                  peuvent pas être consultées.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      N° Sécurité Sociale
                    </span>
                    <p className="text-xs mt-1">
                      {profile.nss_encrypted ? "✓ Renseigné" : "✗ Non renseigné"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      IBAN
                    </span>
                    <p className="text-xs mt-1">
                      {profile.iban_encrypted ? "✓ Renseigné" : "✗ Non renseigné"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsGrid targetUserId={userId} readOnly />
        </TabsContent>
      </Tabs>
    </div>
  )
}
