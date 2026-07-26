export type PetitionStatus = "debattue" | "adoptee" | "sans-suite" | "en-attente";

export type Petition = {
  slug: string;
  titre: string;
  soutiens: number;
  statut: PetitionStatus;
  statutLabel: string;
  commission: string;
  date: string;
};

export const STATUS_LABELS: Record<PetitionStatus, string> = {
  debattue: "Débattue",
  adoptee: "Adoptée 1ère lecture",
  "sans-suite": "Sans suite",
  "en-attente": "En attente",
};

// Données de démonstration — à remplacer par l'import depuis
// data.assemblee-nationale.fr une fois le connecteur branché.
export const demoPetitions: Petition[] = [
  {
    slug: "therapies-de-conversion",
    titre: "Interdiction des thérapies de conversion",
    soutiens: 187442,
    statut: "debattue",
    statutLabel: STATUS_LABELS.debattue,
    commission: "Commission des lois",
    date: "12 mai 2026",
  },
  {
    slug: "demarchage-telephonique",
    titre: "Encadrement du démarchage téléphonique commercial",
    soutiens: 251630,
    statut: "adoptee",
    statutLabel: STATUS_LABELS.adoptee,
    commission: "Affaires économiques",
    date: "28 juin 2026",
  },
  {
    slug: "perturbateurs-endocriniens",
    titre: "Régulation des perturbateurs endocriniens dans l'emballage alimentaire",
    soutiens: 132877,
    statut: "sans-suite",
    statutLabel: STATUS_LABELS["sans-suite"],
    commission: "Développement durable",
    date: "9 janv. 2026",
  },
  {
    slug: "transports-scolaires-ruraux",
    titre: "Gratuité des transports scolaires en zone rurale",
    soutiens: 94210,
    statut: "sans-suite",
    statutLabel: STATUS_LABELS["sans-suite"],
    commission: "Développement durable",
    date: "3 mars 2026",
  },
  {
    slug: "burn-out-parental",
    titre: "Reconnaissance du burn-out parental comme affection ouvrant droit à congé",
    soutiens: 61004,
    statut: "en-attente",
    statutLabel: STATUS_LABELS["en-attente"],
    commission: "Affaires sociales",
    date: "15 juil. 2026",
  },
];
