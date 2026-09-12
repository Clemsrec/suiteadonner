// Les services tiers que ce site autorise, déclarés une fois pour toutes.
//
// POURQUOI CE FICHIER EXISTE
//
// La politique de confidentialité promet que « toute évolution du site
// introduisant un nouveau traitement — mesure d'audience, formulaire, service
// tiers — donnera lieu à une mise à jour de cette page ». C'était un engagement
// sur parole : rien n'empêchait d'ajouter un domaine à la CSP et d'oublier la
// page. Le visiteur aurait continué à lire une liste exacte la veille.
//
// La CSP de next.config.ts est la liste, faisant autorité, de ce qu'un
// navigateur a le droit d'appeler depuis ce site. `npm run verifier:tiers`
// compare les deux : tout domaine autorisé par la CSP doit être déclaré ici, et
// tout domaine déclaré ici doit figurer dans la CSP. Ajouter un service sans
// l'écrire dans cette liste casse le contrôle — l'engagement devient opposable
// au lieu d'être une promesse.
//
// AUTORISÉ N'EST PAS APPELÉ
//
// La CSP dit ce qui est permis, jamais ce qui se produit. Le champ
// `depuisLeNavigateur` distingue les deux, et RELEVE_APPELS enregistre ce qui a
// été réellement observé, à une date, sur le site en production.

export type Tiers = {
  /** Nom du service tel que les pages légales le nomment. */
  nom: string;
  /** Ce qu'il fait, en une ligne. */
  role: string;
  /**
   * Motifs de domaine tels qu'ils figurent dans la CSP de next.config.ts.
   * Le contrôle les compare caractère pour caractère.
   */
  domaines: string[];
  /** Le navigateur du visiteur le contacte-t-il ? */
  depuisLeNavigateur: boolean;
  /** Le consentement conditionne-t-il l'appel ? */
  consentement: "requis" | "non requis" | "sans objet";
  /** Précision affichée sous la ligne, quand elle est nécessaire. */
  note?: string;
};

export const TIERS: Tiers[] = [
  {
    nom: "Algolia",
    role: "Exécute les requêtes du champ de recherche",
    domaines: ["https://*.algolia.net", "https://*.algolianet.com"],
    depuisLeNavigateur: true,
    consentement: "non requis",
    note: "Seul service que le navigateur contacte sans condition. Il ne dépose aucun cookie, et l'index ne conserve ni les requêtes ni les clics : c'est écrit dans le code qui l'appelle, pas seulement dans un réglage de compte. Le second domaine est celui des serveurs de secours, sollicité quand le premier ne répond pas.",
  },
  {
    nom: "Google Analytics 4",
    role: "Mesure d'audience",
    domaines: [
      "https://*.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
    ],
    depuisLeNavigateur: true,
    consentement: "requis",
    note: "Le script n'est pas chargé tant que le consentement n'a pas été donné : sans lui, aucune de ces adresses n'est contactée.",
  },
  {
    nom: "Cloud Firestore",
    role: "Base de données des pétitions",
    domaines: ["https://*.googleapis.com", "https://*.firebaseio.com"],
    depuisLeNavigateur: false,
    consentement: "sans objet",
    note: "Lu par le serveur au moment où il fabrique la page. Ces adresses restent autorisées par la CSP alors qu'aucun appel n'en part : le relevé ci-dessous le constate. Une autorisation qui ne sert pas est une surface ouverte pour rien.",
  },
];

// RELEVÉ DES APPELS RÉELLEMENT OBSERVÉS
//
// La CSP autorise ; ce relevé constate. Il a été fait sur le site en
// production, pas sur un serveur local : instrumentation de `fetch`, de
// `XMLHttpRequest.open` et de `navigator.sendBeacon`, puis chargement de
// l'accueil et exécution d'une recherche, sans donner le consentement.
export const RELEVE_APPELS = {
  releveLe: "2026-09-12",
  page: "https://suiteadonner.nucom.fr/",
  consentementDonne: false,
  /** Les seules adresses tierces atteintes pendant le relevé. */
  observes: ["B8GIER7BSB-dsn.algolia.net"],
  /** Déclenchées par quoi. */
  declencheur: "l'envoi du formulaire de recherche",
} as const;
