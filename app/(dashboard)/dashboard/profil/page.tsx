"use client"

import { useUser } from "@/hooks/useUser"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AvatarUpload } from "./_components/AvatarUpload"
import { ProfileInfoForm } from "./_components/ProfileInfoForm"
import { SensitiveFieldsCard } from "./_components/SensitiveFieldsCard"
import { DocumentsGrid } from "./_components/DocumentsGrid"
import { User, FileText, Mail, Calendar } from "lucide-react"
import type { ProfileFormValues } from "./_lib/schemas"

export default function ProfilPage() {
  const { profile, loading } = useUser()

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
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
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-navy via-navy/90 to-navy/70 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNDOUE4NEMiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4SDI0djEyaDEyVjE4em0tMiAydjhoLThWMjBoOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        </div>

        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <AvatarUpload
              currentUrl={profile.avatar_url}
              initials={initials}
            />

            <div className="flex-1 pt-14 sm:pt-0 sm:pb-1">
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {fullName}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge
                  variant="secondary"
                  className="bg-gold/10 text-gold border-gold/20 font-medium"
                >
                  {roleName}
                </Badge>

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
                </div>

                {profile.promo && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Promo {profile.promo}
                  </div>
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
            <ProfileInfoForm initialValues={initialValues} />
            <SensitiveFieldsCard
              hasNss={!!profile.nss_encrypted}
              hasIban={!!profile.iban_encrypted}
            />
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsGrid />
        </TabsContent>
      </Tabs>
    </div>
  )
}
