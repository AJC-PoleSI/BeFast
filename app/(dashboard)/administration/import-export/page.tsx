import { redirect } from "next/navigation"

// Fusionnée dans « Données » (onglet Import / Export).
// On redirige pour préserver les anciens liens.
export default function ImportExportRedirect() {
  redirect("/administration/donnees?tab=export")
}
