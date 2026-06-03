import { redirect } from "next/navigation"

// Cette page a été fusionnée dans la page unique de paramétrage (/administration,
// onglet « Structure & Légal »). On redirige pour préserver les anciens liens.
export default function StructureRedirect() {
  redirect("/administration")
}
