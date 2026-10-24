import type { Metadata } from "next"
import Link from "next/link"
import { CGU, CGU_EDITEUR, CGU_VERSION, type CguBlock } from "@/lib/legal/cgu"

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation — BeFast Audencia",
  description:
    "Conditions générales d’utilisation de BeFast, la plateforme d’Audencia Junior Conseil : accès, comptes, données et responsabilités.",
  alternates: { canonical: "/cgu" },
}

// « 1.1 Texte » : le numéro passe en gras, le reste suit.
function Paragraphe({ text }: { text: string }) {
  const m = /^(\d+\.\d+)\s+([\s\S]*)$/.exec(text)
  if (!m) return <p>{text}</p>
  return (
    <p>
      <span className="font-semibold text-zinc-900">{m[1]}</span> {m[2]}
    </p>
  )
}

function Blocs({ blocks }: { blocks: readonly CguBlock[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        "ul" in b ? (
          <ul key={i} className="list-disc space-y-1 pl-5 text-zinc-600">
            {b.ul.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <Paragraphe key={i} text={b.p} />
        )
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  )
}

// Page publique (hors layouts auth/dashboard) : lisible sans être connecté,
// liée depuis l'inscription et la connexion.
export default function CguPage() {
  const { annexe } = CGU
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-[#00236f] hover:underline"
        >
          ← Retour à BeFast
        </Link>

        <h1 className="mb-2 text-3xl font-semibold text-zinc-900">
          Conditions générales d’utilisation
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          BeFast, outil de gestion interne d’Audencia Junior Conseil · Version {CGU_VERSION}
        </p>

        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-700 sm:p-8">
          <p>{CGU.intro}</p>

          {CGU.articles.map((a) => (
            <Section key={a.num} title={`Article ${a.num} — ${a.title}`}>
              <Blocs blocks={a.blocks} />
            </Section>
          ))}

          <Section title="Éditeur et hébergeurs">
            <div className="space-y-2">
              <p>
                {CGU_EDITEUR.denomination}, {CGU_EDITEUR.forme}, SIRET {CGU_EDITEUR.siret},{" "}
                {CGU_EDITEUR.adresse}. Contact : {CGU_EDITEUR.email}
                {CGU_EDITEUR.telephone ? `, ${CGU_EDITEUR.telephone}` : ""}.
                {CGU_EDITEUR.directeurPublication
                  ? ` Directeur de la publication : ${CGU_EDITEUR.directeurPublication}, Président.`
                  : " Directeur de la publication : le Président en exercice."}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-zinc-600">
                {CGU_EDITEUR.hebergeurs.map((h) => (
                  <li key={h.nom}>
                    {h.nom} — {h.role} — {h.adresse}
                  </li>
                ))}
              </ul>
              <p>
                Les autres prestataires qui traitent des données sont listés dans la{" "}
                <Link
                  href="/politique-confidentialite"
                  className="text-[#00236f] hover:underline"
                >
                  politique de confidentialité
                </Link>
                .
              </p>
            </div>
          </Section>

          <hr className="border-zinc-200" />

          <Section title={annexe.title}>
            <div className="space-y-4">
              <p>{annexe.intro}</p>

              <div>
                <h3 className="mb-2 font-semibold text-zinc-900">{annexe.table.title}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr>
                        {annexe.table.head.map((h) => (
                          <th key={h} className="border border-zinc-200 bg-zinc-50 p-2 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {annexe.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell) => (
                            <td key={cell} className="border border-zinc-200 p-2 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-zinc-500">{annexe.table.note}</p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-zinc-900">{annexe.engagements.title}</h3>
                <p>{annexe.engagements.intro}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                  {annexe.engagements.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-zinc-900">{annexe.consequences.title}</h3>
                <p>{annexe.consequences.text}</p>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
