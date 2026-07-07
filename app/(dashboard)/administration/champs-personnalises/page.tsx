import { redirect } from "next/navigation"

// Fusionnée dans « Membres & Droits » (onglet Champs personnalisés).
// On redirige pour préserver les anciens liens.
export default function ChampsPersonnalisesRedirect() {
  redirect("/administration/membres?tab=champs")
}
