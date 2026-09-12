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

/** Jours écoulés depuis une date ISO. null si la date est absente ou illisible. */
export function joursDepuis(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T12:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
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

/**
 * Décision énoncée par la commission dans le compte rendu de sa réunion, là où
 * le fichier public laisse souvent le champ prévu vide. Extraite par
 * scripts/lib/comptes-rendus.mjs, qui n'en retient que les formes citant le
 * numéro de la pétition : la commission désigne elle-même, rien n'est déduit.
 */
export type DecisionCompteRendu = {
  sens: "examen" | "classement";
  /** La phrase officielle, reproduite sans modification. */
  citation: string;
  /**
   * Comment la décision a été rattachée à cette pétition — le site l'affiche,
   * pour que le lecteur juge de la solidité du lien :
   * « cite » la phrase nomme la pétition ; « unique » elle ne la nomme pas,
   * mais le compte rendu ne traite que d'elle et l'ordre du jour la désignait
   * par son numéro.
   */
  referent: "cite" | "unique";
  url: string;
};

export type ReunionCommission = {
  date: string;
  etat: string | null;
  organeRef: string | null;
  compteRenduRef: string | null;
  intitule: string;
  estCommission: boolean;
  /**
   * Comment la commission a désigné la pétition — les trois voies sont d'égale
   * certitude, aucune ne repose sur une déduction de notre part :
   * « numero » et « titre », lus dans l'ordre du jour ; « compte-rendu »,
   * lorsque seul le compte rendu de la réunion la nomme.
   */
  appariement: "numero" | "titre" | "compte-rendu";
  decision: DecisionCompteRendu | null;
};

export type PassageEnCommission = {
  identifiant: string;
  titre: string;
  /** Absent du fichier pour certaines pétitions : jamais remplacé par zéro. */
  nbVotes: number | null;
  statut: string;
  commission: string;
  decisionPubliee: boolean;
  /** Le champ « décision de la commission » du fichier public, mot pour mot. */
  decisionTexte: string | null;
  /** Date limite de signature, pour distinguer un recueil clos d'un recueil en cours. */
  dateLimiteVote: string | null;
  url: string;
  nbReunions: number;
  premiereReunion: string;
  derniereReunion: string;
  /** La plus récente des décisions lues dans les comptes rendus. */
  derniereDecision: (DecisionCompteRendu & { date: string; compteRenduRef: string }) | null;
  /** Le rapport déposé au terme d'un examen, quand il existe. */
  rapport: RapportCommission | null;
  reunions: ReunionCommission[];
};

/** Une pétition résumée pour l'accueil, sans charger sa fiche. */
export type CasCommission = {
  identifiant: string;
  titre: string;
  nbVotes: number | null;
  statut: string;
  sens: "examen" | "classement" | null;
  date: string | null;
  /** Ce que le fichier public écrit, s'il écrit quelque chose. */
  decisionTexte: string | null;
  /** Ce que la commission a écrit dans son compte rendu. */
  citation: string | null;
};

/**
 * Le rapport qu'une commission dépose au terme de l'examen d'une pétition — la
 * seule suite écrite, argumentée et signée qu'une pétition puisse recevoir. Ni
 * le fichier de data.gouv.fr ni la fiche de la pétition sur la plateforme n'y
 * renvoient : le lien se lit dans le titre du rapport, qui cite son numéro.
 */
export type RapportCommission = {
  /** Numéro du rapport parlementaire, ex. « 2069 ». */
  numero: string | null;
  uid: string;
  dateDepot: string | null;
  /** L'intitulé officiel du document, reproduit sans modification. */
  titre: string;
  url: string;
};

/**
 * Une séance où une commission classe d'office, en bloc, toutes les pétitions
 * de son ressort restées sous le seuil de signatures. Aucune n'y est nommée :
 * le relevé porte donc sur la séance, jamais sur une pétition en particulier.
 */
export type ClassementEnBloc = {
  date: string;
  nombre: number;
  citation: string;
  /**
   * « accompli » : le compte rendu constate le classement. « proposition » :
   * un rapporteur le propose — deux séances sur trois sont dans ce cas, et les
   * présenter comme acquises ferait dire au site plus que le document.
   */
  nature: "accompli" | "proposition";
  /** Le paragraphe mentionne « (Assentiment.) » — fait du document, pas conclusion. */
  assentiment: boolean;
  compteRenduRef: string;
  url: string;
};

/**
 * Les points forts de l'accueil, calculés par scripts/fetch-reunions.mjs et
 * relus d'un seul document. Aucun de ces chiffres n'est écrit dans le code :
 * deux constats de l'accueil l'ont été et ont fini par affirmer le faux.
 */
export type SyntheseCommission = {
  nbPetitions: number;
  nbDecisions: number;
  nbDecisionsAbsentesDuFichier: number;
  signaturesDecisionsAbsentes: number;
  emblematique: CasCommission | null;
  nbDivergences: number;
  divergence: CasCommission | null;
  nbDecisionsAttendues: number;
  signaturesDecisionsAttendues: number;
  classementsEnBloc: ClassementEnBloc[];
  /**
   * Ce que ces chiffres couvrent. Attaché à la synthèse et non à une page : un
   * total qui voyage sans son périmètre finit par se lire comme exhaustif.
   */
  perimetre: {
    legislatures: string[];
    /** Législature dont l'Assemblée ne publie pas ces corpus à cette adresse. */
    legislatureNonCouverte: string;
    comptesRendusLus: number;
    calculeLe: string;
  };
  nbClassementsEnBloc: number;
  /** Effectif cumulé annoncé en séance, propositions comprises. */
  petitionsClasseesEnBloc: number;
  attenteRapport: {
    identifiant: string;
    titre: string;
    nbVotes: number | null;
    statut: string;
    /** Date à laquelle la commission a voté l'examen. */
    dateExamen: string;
    dateLimiteVote: string | null;
    citation: string;
    url: string;
  }[];
  nbAttenteRapport: number;
  signaturesAttenteRapport: number;
  nbRapports: number;
  rapports: (RapportCommission & {
    identifiant: string;
    titrePetition: string;
    nbVotes: number | null;
  })[];
};

/**
 * L'état d'une pétition, qualifié en un seul endroit.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *
 * Chaque page qualifiait la même pétition à sa façon, dans des conditions
 * écrites à même le JSX. L'une d'elles regardait `derniereDecision` sans voir
 * `dateLimiteVote`, et la fiche de la pétition n° 3070 a affiché « rapport
 * attendu depuis 5 mois » alors que son recueil courait jusqu'en 2029 : le
 * compteur y suggérait un retard que rien n'établissait.
 *
 * Un `if` local ne voit que ce qu'on lui passe. Cette fonction reçoit la
 * pétition et son dossier de commission, et croise les champs une fois pour
 * toutes ; les pages n'ont plus qu'à afficher un état déjà qualifié. Toute
 * nouvelle qualification s'ajoute ici, jamais dans une page.
 */
export type EtatPetition = {
  /** Le fichier public porte-t-il un texte de décision ? */
  decisionAuFichier: "publiee" | "absente";
  /** « inconnu » quand le fichier ne renseigne aucune date limite. */
  recueil: "clos" | "en-cours" | "inconnu";
  /** Ce que la commission a écrit dans son compte rendu, s'il a pu être lu. */
  decisionLue: (DecisionCompteRendu & { date: string; compteRenduRef: string }) | null;
  rapport: RapportCommission | null;
  /**
   * Le fichier et un compte rendu portent chacun un texte sur cette pétition.
   * Le site les affiche alors côte à côte — il ne les compare pas, et ne
   * prétend donc jamais qu'ils divergent.
   */
  deuxTextesOfficiels: boolean;
  /** Un examen a été voté, et aucun rapport n'a été trouvé. */
  examenSansRapport: boolean;
  /**
   * Le délai depuis ce vote a-t-il un sens ? Seulement si le recueil est clos :
   * une pétition encore ouverte à la signature n'attend rien.
   */
  attenteMesurable: boolean;
  /** Classée, et le champ prévu pour motiver la décision est resté vide. */
  classeeSansMotif: boolean;
};

/**
 * Une seule entrée, et des champs tous facultatifs sauf ceux qui fondent l'état.
 * La fiche d'une pétition passe son `Petition` complété de son document
 * `reunions` ; une liste de passages passe le document `reunions` seul, qui
 * porte déjà le texte de décision et la date limite. Deux signatures auraient
 * signifié deux endroits où qualifier, donc deux endroits où se tromper.
 */
export type SourceEtat = {
  statutSource?: StatutSource;
  motifClassement?: MotifClassement;
  decisionTexte: string | null;
  dateLimiteVote: string | null;
  /** Calculé depuis la date limite s'il n'est pas fourni. */
  recueilTermine?: boolean;
  derniereDecision?: (DecisionCompteRendu & { date: string; compteRenduRef: string }) | null;
  rapport?: RapportCommission | null;
};

export function etatPetition(source: SourceEtat, aujourdhui = new Date()): EtatPetition {
  const decisionLue = source.derniereDecision ?? null;
  const rapport = source.rapport ?? null;

  const clos =
    source.recueilTermine ??
    Boolean(source.dateLimiteVote && source.dateLimiteVote < aujourdhui.toISOString().slice(0, 10));
  const recueil: EtatPetition["recueil"] = !source.dateLimiteVote
    ? "inconnu"
    : clos
      ? "clos"
      : "en-cours";

  const examenSansRapport = decisionLue?.sens === "examen" && !rapport;

  // Sans motif calculé, on retombe sur ce que le document porte : un sort
  // décidé et aucun texte. C'est la même définition, lue autrement.
  const sortDecide = source.motifClassement
    ? source.motifClassement === "absent"
    : ["classee", "archivee", "expiree"].includes(source.statutSource ?? "");

  return {
    decisionAuFichier: source.decisionTexte ? "publiee" : "absente",
    recueil,
    decisionLue,
    rapport,
    deuxTextesOfficiels: Boolean(source.decisionTexte && decisionLue),
    examenSansRapport,
    // La condition qui manquait : le délai ne se compte que sur un recueil clos.
    attenteMesurable: examenSansRapport && recueil === "clos",
    classeeSansMotif: sortDecide && !source.decisionTexte,
  };
}
