// Source unique de l'URL publique. Elle sert à la fois aux métadonnées, au
// robots.txt, au sitemap et au llms.txt — la dupliquer garantirait qu'un jour
// l'un des quatre pointe ailleurs.
export const SITE_URL = "https://suiteadonner.nucom.fr";
export const SITE_NAME = "Suite à donner";
export const SITE_TITRE = "Suite à donner — Observatoire des pétitions citoyennes";
export const SITE_DESCRIPTION =
  "Ce que deviennent réellement les pétitions déposées à l'Assemblée nationale, à partir des données ouvertes.";

// Mesure d'audience Google Analytics 4 — propriété 547145394, flux
// « suiteadonner » 15327433459. Le script n'est JAMAIS chargé sans un
// consentement explicite : voir src/app/MesureAudience.tsx et la politique de
// cookies, qui documentent ce comportement publiquement.
export const GA_MESURE_ID = "G-RHQGYZ242D";

// RELEVÉ MANUEL SUR LA PLATEFORME OFFICIELLE — valeurs observées, non calculées.
//
// La plateforme propose un filtre « Sort de la pétition » à trois issues. Les
// trois renvoient zéro résultat, alors que le mécanisme de filtrage fonctionne :
// « Archivée » renvoie 1 454 pétitions, exactement le compte du fichier ouvert.
// Le champ existe donc, et n'est jamais renseigné.
//
// Ces chiffres ne sont pas récupérés automatiquement : la plateforme rejette
// les requêtes automatisées (HTTP 422). Ils sont relevés à la main, datés, et
// chaque lien ci-dessous permet à quiconque de refaire la vérification.
export const SORT_PETITION = {
  releveLe: "2026-07-27",
  base: "https://petitions.assemblee-nationale.fr/initiatives",
  total: 1656,
  etats: [
    { cle: "published", libelle: "Enregistrée", nombre: 1656 },
    { cle: "classified", libelle: "Classée par la commission", nombre: 0 },
    { cle: "examinated", libelle: "Examinée en commission", nombre: 0 },
    { cle: "debatted", libelle: "Débattue en séance publique", nombre: 0 },
  ],
} as const;

export function lienSortPetition(cle: string): string {
  return `${SORT_PETITION.base}?filter%5Bcustom_state%5D%5B%5D=${cle}`;
}

// Informations légales — source unique pour les trois pages réglementaires.
// Les valeurs d'identification proviennent de l'éditeur ; les valeurs
// techniques (régions d'hébergement) ont été relevées sur l'infrastructure.
export const LEGAL = {
  denomination: "NuCom",
  formeJuridique: "Entrepreneur individuel",
  siren: "490 369 352",
  siret: "490 369 352 00037",
  tva: "FR54490369352",
  naf: "6201Z — Programmation informatique",
  dateCreation: "25 mai 2006",
  adresse: ["7 place de l'Hôtel de Ville", "74000 Annecy", "France"],
  email: "clement@nucom.fr",
  emailDonnees: "clement@nucom.fr",
  directeurPublication: "Clément Tournier",
  juridiction: "Annecy",
  // Relevé le 27/07/2026 via `firebase apphosting:backends:list` et l'API
  // Firestore : l'application tourne en Europe, la base est aux États-Unis.
  regionApplication: "europe-west4 (Pays-Bas)",
  regionBaseDonnees: "nam5 (États-Unis)",
  derniereMaj: "27 juillet 2026",
} as const;
