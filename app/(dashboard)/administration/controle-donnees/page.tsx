import { redirect } from "next/navigation"

// Cette page a été fusionnée dans la page unique de paramétrage (/administration,
// onglet « Propositions & Prix »). On redirige pour préserver les anciens liens.
export default function ControleDonneesRedirect() {
  redirect("/administration")
}
