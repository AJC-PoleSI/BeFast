import { redirect } from "next/navigation"

// Fusionnée dans « Membres & Droits » (onglet Campagne mot de passe).
// On redirige pour préserver les anciens liens.
export default function CampagneMdpRedirect() {
  redirect("/administration/membres?tab=campagne")
}
