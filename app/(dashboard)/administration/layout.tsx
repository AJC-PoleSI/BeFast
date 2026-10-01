import { AdminSidebar } from "./_components/AdminSidebar"
import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

/**
 * Portes d'entrée de l'espace Administration. Chaque section possède en plus
 * son propre garde (voir les layouts de membres/, documents/, donnees/ et le
 * RoleGuard de la page Paramètres) : entrer dans l'espace ne donne pas accès
 * à toutes ses sections.
 */
export default async function AdministrationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await checkPageAccess([
    "administration",
    "membres",
    "parametres_structure",
    "gerer_parametres",
  ])
  if (!access.ok)
    return <AccessDenied message="L'espace d'administration est réservé aux rôles qui gèrent la structure, les membres ou les paramètres." />

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-8rem)]">
      <AdminSidebar />
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
