import { redirect } from "next/navigation"

// La page /administration redirige vers la vraie page de paramètres.
// L'ancienne page était un mock non connecté à la BDD — voir /administration/structure.
export default function AdminPage() {
  redirect("/administration/structure")
}
