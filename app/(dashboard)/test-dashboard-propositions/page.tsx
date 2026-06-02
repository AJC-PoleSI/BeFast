import { redirect } from "next/navigation";

// Ancienne route — déplacée vers /prospection.
export default function LegacyDashboardPropositionsPage() {
  redirect("/prospection");
}
