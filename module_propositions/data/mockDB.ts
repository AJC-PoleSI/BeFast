export const mockPhases = [
  { id: 1, name: "Recherche et documentation", objectifs: "Recherche et documentation ciblée...", methodologie: "- Ciblage de l’information pertinente..." },
  { id: 2, name: "Création d’un questionnaire/guide d'entretien", objectifs: "Création d’un questionnaire...", methodologie: "- Revue de littérature..." },
  { id: 3, name: "Passation du questionnaire", objectifs: "L’administration du questionnaire...", methodologie: "- Prise de contact..." },
  { id: 4, name: "Analyse du questionnaire", objectifs: "L’analyse qualitative ou quantitative...", methodologie: "- Récolte des données..." },
  { id: 5, name: "Benchmark", objectifs: "Le benchmark a pour objectif...", methodologie: "- Entretien avec l’intervenant..." },
  { id: 6, name: "Plan d’action", objectifs: "Le plan d’action a pour objectif...", methodologie: "- Transmission par le client..." },
  { id: 7, name: "Business Plan", objectifs: "Le business plan a pour objectif...", methodologie: "- Entretien avec notre intervenant..." },
  { id: 8, name: "Rétro-planning", objectifs: "Le rétro-planning a pour objectif...", methodologie: "- Compréhension du contexte..." },
  { id: 9, name: "Création d’une base de données", objectifs: "L’objectif est de constituer une base de données...", methodologie: "- Identification des informations..." }
];

export const mockCDPs = [
  { id: 1, civilite: "M.", firstName: "Jean", lastName: "Dupont", email: "jean.dupont@example.com", pole: "Marketing", initials: "JDU" },
  { id: 2, civilite: "Mme", firstName: "Alice", lastName: "Martin", email: "alice.martin@example.com", pole: "Stratégie", initials: "ALM" },
  { id: 3, civilite: "M.", firstName: "Jacques", lastName: "Durand", email: "jacques.durand@example.com", pole: "Développement", initials: "JQD" }
];

export const studyTypes = [
  "Étude de marché",
  "Étude de faisabilité",
  "Business Plan",
  "Benchmark concurrentiel",
  "Enquête de satisfaction"
];

export const mockSavedPropales = [
  {
    id: 'JDU-20240501-0900',
    cdpId: 1,
    clientName: 'Entreprise ABC',
    clientCivilite: 'M.',
    clientFirstName: 'Paul',
    clientLastName: 'Bismuth',
    clientEmail: 'paul.bismuth@abc.com',
    clientPhone: '06 12 34 56 78',
    studyType: 'Étude de marché',
    contextSituation: 'Lancement d\'un nouveau produit.',
    contextIntervention: 'Analyser le marché local.',
    contextEnjeu: 'Atteindre 10% de parts de marché.',
    cdcObjectifs: 'Avoir une vision claire.',
    cdcContraintes: 'Budget limité.',
    cdcLivrables: 'Rapport complet.',
    totalTTC: 2700,
    totalHT: 2250,
    suiviJehCount: 1,
    suiviJehPrice: 250,
    status: 'envoyée',
    date: '2024-05-01',
    phases: [
      { phaseId: 101, name: "Benchmark concurrentiel", dureeSemaines: 2, startAfterPhaseId: 'project_start', jehCount: 10, jehPrice: 200 }
    ]
  },
  {
    id: 'ALM-20240428-1430',
    cdpId: 2,
    clientName: 'Startup XYZ',
    clientCivilite: 'Mme',
    clientFirstName: 'Sophie',
    clientLastName: 'Fonsec',
    clientEmail: 'sophie.f@xyz.co',
    clientPhone: '07 98 76 54 32',
    studyType: 'Étude de faisabilité',
    contextSituation: 'Création d\'une application mobile.',
    contextIntervention: 'Vérifier la faisabilité technique.',
    contextEnjeu: 'Éviter des coûts inutiles.',
    cdcObjectifs: 'Étude technique.',
    cdcContraintes: 'Temps très court.',
    cdcLivrables: 'Cahier des charges technique.',
    totalTTC: 11880,
    totalHT: 9900,
    suiviJehCount: 2,
    suiviJehPrice: 200,
    status: 'CE éditée',
    date: '2024-04-28',
    phases: [
      { phaseId: 102, name: "Recherche et documentation", dureeSemaines: 2, startAfterPhaseId: 'project_start', jehCount: 15, jehPrice: 200 },
      { phaseId: 103, name: "Entretiens", dureeSemaines: 1, startAfterPhaseId: 102, jehCount: 10, jehPrice: 250 },
      { phaseId: 104, name: "Analyse et livrable", dureeSemaines: 2, startAfterPhaseId: 103, jehCount: 20, jehPrice: 200 }
    ]
  }
];
