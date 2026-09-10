// Types et fonctions de présentation, sans aucune dépendance à Firebase.
//
// POURQUOI CE FICHIER EXISTE
//
// `petitions.ts` initialise Firestore au niveau module. Les composants clients
// — le tableau, la barre de recherche — n'avaient besoin que de trois
// formateurs et de deux tables de libellés, mais l'import entraînait tout le
// SDK : 417 Ko de JavaScript envoyés à chaque visiteur pour du code qu'aucune
// page n'exécute côté navigateur, toutes les lectures Firestore étant faites
// par le serveur. Ce module isole ce qui est pur ; `petitions.ts` le réexporte,
// donc rien ne change pour les Server Components.

export type StatutSource = "ouverte" | "archivee" | "classee" | "expiree";

// Motif du classement, lu dans le texte de décision et jamais déduit du statut.
export type MotifClassement =
  | "seuil" // le texte invoque le seuil de signatures non atteint
  | "constat" // le texte constate le classement sans énoncer de motif
  | "absent" // recueil terminé, aucun texte
  | "sans_objet"; // recueil en cours, aucune décision attendue

export type Petition = {
  identifiant: string;
  titre: string;
  description: string;
  url: string;
  datePublication: string | null;
  dateLimiteVote: string | null;
  /** null quand le fichier ne renseigne rien — à ne jamais afficher comme 0. */
  nbVotes: number | null;
  statutSource: StatutSource;
  commissionSource: string | null;
  legislature: string | null;
  decisionTexte: string | null;

  recueilTermine: boolean;
  motifClassement: MotifClassement;
  /** A dépassé 10 000 signatures. null quand nbVotes est inconnu. */
  seuilAtteint: boolean | null;
  /**
   * Le seuil que le texte de décision oppose à cette pétition, quand il
   * l'écrit — 5 000 pour la commission des lois, 10 000 ailleurs. null si
   * aucun texte ne l'énonce : il n'est jamais déduit de la commission.
   */
  seuilEnonce: number | null;
  /** Le fichier dit « ouverte » alors que la date limite est passée. */
  ecartStatutDates: boolean;
  clotureGroupee: boolean;

  statutLabel: string;
  sourceCsv: string;
  calculeLe: string;
};

export const MOTIF_LABELS: Record<MotifClassement, string> = {
  seuil: "Classée d'office, seuil de signatures non atteint",
  constat: "Classement constaté, sans motif",
  absent: "Aucune décision publiée",
  sans_objet: "Recueil en cours",
};

// Ce seuil n'est pas celui de toutes les commissions : voir seuilEnonce et
// le commentaire de scripts/lib/petitions-source.mjs. Il ne sert qu'au constat
// brut « a dépassé 10 000 signatures ».
export const SEUIL_SIGNATURES = 10000;

// Libellés de repli, employés quand seul le statut brut est disponible (index
// de recherche). Ils nomment le statut du fichier et rien de plus : aucun
// n'affirme un examen, et aucun n'énonce le motif d'un classement.
//
// « ouverte » ne devient plus « En cours de signature » : le fichier conserve
// ce statut à des pétitions dont la date limite est passée — c'est même le
// constat de /fichier-non-a-jour. Le libellé dit donc ce que le fichier
// déclare, sans certifier que le recueil se poursuit.
export const STATUT_LABELS: Record<StatutSource, string> = {
  ouverte: "Déclarée ouverte",
  archivee: "Archivée",
  classee: "Classée",
  expiree: "Expirée",
};

export const STATUT_TAG: Record<StatutSource, "pending" | "none" | "examined"> = {
  ouverte: "pending",
  archivee: "none",
  classee: "examined",
  expiree: "none",
};

// Un nombre de signatures absent ne vaut pas zéro : le fichier ne dit rien.
export function formatSignatures(nbVotes: number | null): string {
  return nbVotes === null ? "non renseigné" : nbVotes.toLocaleString("fr-FR");
}

/**
 * Le point final d'une phrase qui vient d'enchâsser un texte source — citation
 * ou titre de pétition. Renvoie une chaîne vide si ce texte porte déjà sa
 * ponctuation, pour ne pas écrire « … intelligence collective.. ». La source
 * n'est jamais modifiée : c'est la phrase qui l'entoure qui s'adapte.
 */
export function pointFinal(texte: string | null): string {
  return texte && /[.!?»]$/.test(texte.trim()) ? "" : ".";
}

/**
 * Nombre de mois entiers écoulés depuis une date. Calculé au rendu et non à la
 * collecte : un délai figé en base vieillirait d'une semaine à l'autre sans que
 * rien ne le signale.
 */
export function moisDepuis(iso: string | null, aujourdhui = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const mois =
    (aujourdhui.getFullYear() - d.getFullYear()) * 12 + (aujourdhui.getMonth() - d.getMonth());
  // Le mois n'est révolu qu'une fois le quantième atteint.
  return Math.max(0, aujourdhui.getDate() < d.getDate() ? mois - 1 : mois);
}

/** « depuis onze mois », « depuis un an et deux mois ». */
export function formatDelaiMois(mois: number | null): string {
  if (mois === null) return "—";
  if (mois === 0) return "ce mois-ci";
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const libelleAns = ans === 1 ? "un an" : `${ans} ans`;
  return reste ? `${libelleAns} et ${reste} mois` : libelleAns;
}

export function formatFrDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

// Les ordres du jour sont rédigés en langue administrative : « Nomination d'un
// rapporteur, en application de l'article 148 alinéa 2 du Règlement, sur une
// pétition renvoyée à la Commission, en vue de sa présentation ». On en extrait
// l'acte en français courant, le texte officiel restant consultable en entier.
//
// Chercher les mots-clés n'importe où dans le texte donnait de faux résultats :
// ces intitulés annoncent souvent l'étape suivante (« en vue de sa présentation »,
// « décision de classement ou d'examen »), si bien qu'un même point contient
// plusieurs mots d'action. L'acte réellement accompli est toujours le PREMIER
// mot de l'intitulé — c'est donc lui seul qu'on teste.
const ACTES: Array<[RegExp, string]> = [
  [/^(nomination|d[ée]signation)/, "Nomination d’un rapporteur"],
  [/^pr[ée]sentation/, "Présentation devant la commission"],
  [/^examen/, "Examen par la commission"],
  [/^d[ée]cision/, "Décision sur son classement"],
  [/^(audition|table ronde)/, "Audition"],
];

// Le compte rendu intégral d'une réunion de commission, à partir de la
// référence que porte l'agenda officiel. Les comptes rendus de séance publique
// (préfixe CRS) ne sont pas servis à cette adresse : on ne propose alors aucun
// lien plutôt qu'un lien mort.
export function urlCompteRendu(reference: string | null): string | null {
  if (!reference?.startsWith("CRCANR")) return null;
  return `https://www.assemblee-nationale.fr/dyn/opendata/${reference}.html`;
}

export function acteCommission(intitule: string): string {
  const debut = intitule
    .replace(/^[\s\-–—•]+/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [motif, libelle] of ACTES) {
    if (motif.test(debut)) return libelle;
  }
  // Cas restant : la pétition est évoquée au sein d'une réunion consacrée à
  // autre chose, typiquement l'audition de son initiateur.
  if (/audition|table ronde/.test(debut)) return "Audition";
  return "Évoquée en réunion";
}

