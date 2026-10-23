import cguData from "./cgu.json"

// Source unique des CGU : `cgu.json` alimente la page publique /cgu et le Word
// (docs/CGU_BEFAST.docx). Toute modification de fond incrémente `version` ; la
// version acceptée est enregistrée avec chaque compte (migration 083).
export type CguBlock = { p: string } | { ul: string[] }
export type CguArticle = { num: string; title: string; blocks: CguBlock[] }

export const CGU_VERSION: string = cguData.version
export const CGU = { ...cguData, articles: cguData.articles as CguArticle[] }

// Mentions de l'éditeur (Kiwi Légal : dénomination, siège, directeur de
// publication = le Président, téléphone joignable, hébergeurs). Les champs à
// `null` ne sont pas affichés : à renseigner par l'Association.
export const CGU_EDITEUR = {
  denomination: "Audencia Junior Conseil",
  forme: "association loi 1901",
  siret: "331 647 750 00016",
  adresse: "8 route de la Jonelière, BP 31222, 44312 Nantes Cedex 3",
  email: "contact@ajc-mail.com",
  telephone: null as string | null,
  directeurPublication: null as string | null,
  hebergeurs: [
    {
      nom: "Vercel Inc.",
      role: "hébergement de l’application",
      adresse: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    },
    {
      nom: "Supabase",
      role: "base de données et authentification (région UE, Irlande)",
      adresse: "970 Toa Payoh North #07-04, Singapour 318992",
    },
    {
      nom: "Scaleway SAS",
      role: "stockage des documents (Paris, France)",
      adresse: "8 rue de la Ville l’Évêque, 75008 Paris, France",
    },
  ],
}
