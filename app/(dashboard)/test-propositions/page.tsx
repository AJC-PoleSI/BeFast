import { redirect } from "next/navigation";

// Ancienne route — déplacée vers /prospection/nouvelle.
// On conserve l'éventuel ?id= pour l'édition d'une proposition existante.
export default async function LegacyProposalFormPage(
  props: {
    searchParams: Promise<{ id?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  redirect(searchParams.id ? `/prospection/nouvelle?id=${searchParams.id}` : "/prospection/nouvelle");
}
