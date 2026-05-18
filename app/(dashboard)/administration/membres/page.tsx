import { redirect } from "next/navigation"

// La gestion des membres est consolidée dans /membres.
export default function AdminMembresPage() {
  redirect("/membres")
}
