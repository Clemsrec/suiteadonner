// Source unique de l'URL publique. Elle sert à la fois aux métadonnées, au
// robots.txt, au sitemap et au llms.txt — la dupliquer garantirait qu'un jour
// l'un des quatre pointe ailleurs.
export const SITE_URL = "https://suiteadonner.nucom.fr";
export const SITE_NAME = "Suite à donner";
export const SITE_TITRE = "Suite à donner — Observatoire des pétitions citoyennes";
export const SITE_DESCRIPTION =
  "Ce que deviennent réellement les pétitions déposées à l'Assemblée nationale, à partir des données ouvertes.";

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
