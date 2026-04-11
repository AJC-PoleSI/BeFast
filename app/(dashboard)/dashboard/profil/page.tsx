"use client"

import { useUser } from "@/hooks/useUser"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AvatarUpload } from "./_components/AvatarUpload"
import { ProfileInfoForm } from "./_components/ProfileInfoForm"
import { SensitiveFieldsCard } from "./_components/SensitiveFieldsCard"
import { DocumentsGrid } from "./_components/DocumentsGrid"
import { User, FileText, Mail, Calendar, Lock, Phone, MapPin } from "lucide-react"
import type { ProfileFormValues } from "./_lib/schemas"

export default function ProfilPage() {
  const { profile, loading } = useUser()

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-navy">Mon profil</h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos informations personnelles et documents
        </p>
      </div>

      {/* Profile Header Card */}
      <Card className="border-border shadow-sm overflow-hidden">
        {/* Background Banner */}
        <div className="h-32 bg-gradient-to-r from-navy via-navy/90 to-navy/70 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNDOUE4NEMiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4SDI0djEyaDEyVjE4em0tMiAydjhoLThWMjBoOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        </div>

        {/* Content */}
        <CardContent className="p-6 -mt-16 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            {/* Avatar */}
            <AvatarUpload
              currentUrl={profile.avatar_url}
              initials={initials}
            />

            {/* Info */}
            <div className="flex-1 pt-4 sm:pt-0">
              <h1 className="text-3xl font-heading font-bold text-navy">
                {fullName}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Badge
                  className="bg-gold/10 text-gold border-gold/20 font-medium"
                  variant="outline"
                >
                  {roleName}
                </Badge>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail size={16} className="text-gold" />
                  {profile.email}
                </div>

                {profile.promo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar size={16} className="text-gold" />
                    Promo {profile.promo}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Créé le
                  </p>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {new Date(profile.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Actif
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-2 w-2 rounded-full ${profile.actif ? "bg-green-500" : "bg-gray-400"}`} />
                    <p className="text-sm font-semibold text-navy">
                      {profile.actif ? "Oui" : "Non"}
                    </p>
                  </div>
                </div>
                {profile.pole && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Pôle
                    </p>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {profile.pole}
                    </p>
                  </div>
                )}
                {profile.portable && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Téléphone
                    </p>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {profile.portable}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="informations" className="space-y-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 lg:grid-cols-3">
          <TabsTrigger value="informations" className="gap-2">
            <User size={16} />
            <span className="hidden sm:inline">Informations</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText size={16} />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="securite" className="gap-2">
            <Lock size={16} />
            <span className="hidden sm:inline">Sécurité</span>
            <span className="sm:hidden">Sec</span>
          </TabsTrigger>
        </TabsList>

        {/* Informations Tab */}
        <TabsContent value="informations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <ProfileInfoForm initialValues={initialValues} />
            </div>

            {/* Contact Info Sidebar */}
            <div className="space-y-4">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Coordonnées</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.portable && (
                    <div className="flex items-start gap-3">
                      <Phone size={16} className="text-gold mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Téléphone</p>
                        <p className="text-sm font-medium text-navy break-all">
                          {profile.portable}
                        </p>
                      </div>
                    </div>
                  )}

                  {profile.adresse && (
                    <div className="flex items-start gap-3 pt-4 border-t border-border">
                      <MapPin size={16} className="text-gold mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Adresse</p>
                        <p className="text-sm font-medium text-navy">
                          {profile.adresse}
                        </p>
                        {(profile.code_postal || profile.ville) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {[profile.code_postal, profile.ville]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!profile.portable && !profile.adresse && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune information de contact
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gold/30 bg-gold/5 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-gold">Conseil</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Gardez vos informations à jour pour que l'équipe puisse vous contacter facilement.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Mes documents</CardTitle>
              <CardDescription>
                Téléchargez vos documents d'identité et documents importants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsGrid />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sécurité Tab */}
        <TabsContent value="securite" className="space-y-6">
          <SensitiveFieldsCard
            hasNss={!!profile.nss_encrypted}
            hasIban={!!profile.iban_encrypted}
          />

          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">
                Chiffrage de données
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Lock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-900">
                    Données sensibles chiffrées
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Vos numéro de sécurité sociale et IBAN sont chiffrés en bout à bout.
                    Seul vous et l'administration peuvent y accéder.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Historique</CardTitle>
              <CardDescription>
                Informations sur votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">
                    Date de création
                  </p>
                  <p className="text-sm font-semibold text-navy mt-2">
                    {new Date(profile.created_at).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">
                    Dernière mise à jour
                  </p>
                  <p className="text-sm font-semibold text-navy mt-2">
                    {new Date(profile.updated_at).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
