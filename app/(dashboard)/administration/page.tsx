import { redirect } from "next/navigation"
import { getPageProfile } from "@/lib/auth/page-guards"
import { hasPermission } from "@/lib/auth/permissions"
import ParametresPage from "./_components/ParametresPage"

/**
 * Entrée de l'espace administration.
 *
 * Le layout ouvre l'espace à quatre clés, mais cette page est l'écran
 * Paramètres (`parametres_structure`). Un porteur de `membres` seul (Pôle RH)
 * ou d'`administration` seul (Secrétaire général) atterrissait sur un refus,
 * sans menu latéral sur mobile pour rejoindre sa section : on le redirige vers
 * la première section qui lui est ouverte.
 */
export default async function AdministrationPage() {
  const ctx = await getPageProfile()
  const profile = ctx?.profile ?? null
  if (hasPermission(profile, "parametres_structure")) return <ParametresPage />
  if (hasPermission(profile, "membres")) redirect("/administration/membres")
  if (hasPermission(profile, "administration") || hasPermission(profile, "gerer_parametres")) {
    redirect("/administration/documents")
  }
  return <ParametresPage />
}
