import { redirect } from "next/navigation";

// Ancienne route — déplacée vers /prospection/nouvelle.
// On conserve l'éventuel ?id= pour l'édition d'une proposition existante.
export default function LegacyProposalFormPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  redirect(searchParams.id ? `/prospection/nouvelle?id=${searchParams.id}` : "/prospection/nouvelle");
}
