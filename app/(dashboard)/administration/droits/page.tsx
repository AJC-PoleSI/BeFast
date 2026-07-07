import { redirect } from "next/navigation"

// Fusionnée dans « Membres & Droits » (onglet Rôles & permissions).
// On redirige pour préserver les anciens liens.
export default function DroitsRedirect() {
  redirect("/administration/membres?tab=roles")
}
