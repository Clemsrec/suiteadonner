import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Schéma miroir de scripts/lib/petitions-source.mjs. Les champs bruts viennent
// du CSV officiel sans réinterprétation ; les champs dérivés portent chacun le
// nom de leur règle et sont documentés dans ce module source.
//
// Deux principes s'y appliquent : aucune valeur n'est inventée (un champ absent
// reste null, jamais 0), et le champ `statutSource` n'est pas une source de
// vérité — 890 pétitions y sont marquées « classee » alors que leur propre
// texte de décision indique un classement d'office.

export * from "./petitions-format";
import type { Petition } from "./petitions-format";

export type Stats = {
  calculeLe: string;
  sourceCsv: string;
  total: number;

  ouverte: number;
  archivee: number;
  classee: number;
  expiree: number;

  recueilTermine: number;
  seuilAtteint: number;
  signaturesInconnues: number;
  motifSeuil: number;
  motifConstat: number;
  motifAbsent: number;
  motifSansObjet: number;
  ecartStatutDates: number;
  signaturesEcartStatutDates: number;
  clotureGroupee: number;
  dateClotureMasse: string | null;
  nbClotureMasse: number;

  classeesHorsSeuil: number;
  classeesHorsSeuilSansTexte: number;
  signaturesClasseesSansTexte: number;

  formulationsDistinctes: number;
  textesDecision: number;
  signaturesTotal: number;

  updatedAt: string | null;
};

export async function getStats(): Promise<Stats | null> {
  const snap = await getDoc(doc(db, "meta", "stats"));
  if (!snap.exists()) return null;
  const d = snap.data();
  const n = (cle: string) => (d[cle] as number) ?? 0;
  return {
    calculeLe: d.calculeLe ?? "",
    sourceCsv: d.sourceCsv ?? "",
    total: n("total"),
    ouverte: n("ouverte"),
    archivee: n("archivee"),
    classee: n("classee"),
    expiree: n("expiree"),
    recueilTermine: n("recueilTermine"),
    seuilAtteint: n("seuilAtteint"),
    signaturesInconnues: n("signaturesInconnues"),
    motifSeuil: n("motifSeuil"),
    motifConstat: n("motifConstat"),
    motifAbsent: n("motifAbsent"),
    motifSansObjet: n("motifSansObjet"),
    ecartStatutDates: n("ecartStatutDates"),
    signaturesEcartStatutDates: n("signaturesEcartStatutDates"),
    clotureGroupee: n("clotureGroupee"),
    dateClotureMasse: d.dateClotureMasse ?? null,
    nbClotureMasse: n("nbClotureMasse"),
    classeesHorsSeuil: n("classeesHorsSeuil"),
    classeesHorsSeuilSansTexte: n("classeesHorsSeuilSansTexte"),
    signaturesClasseesSansTexte: n("signaturesClasseesSansTexte"),
    formulationsDistinctes: n("formulationsDistinctes"),
    textesDecision: n("textesDecision"),
    signaturesTotal: n("signaturesTotal"),
    updatedAt: d.updatedAt?.toDate?.().toISOString() ?? null,
  };
}

// Une fiche par pétition : lecture directe par identifiant (l'identifiant du
// CSV est la clé du document). null si la pétition n'existe pas — la page
// répond alors 404 au lieu d'inventer une fiche vide.
export async function getPetition(identifiant: string): Promise<Petition | null> {
  const snap = await getDoc(doc(db, "petitions", identifiant));
  return snap.exists() ? (snap.data() as Petition) : null;
}

// Passages en commission d'une pétition précise. La collection `reunions` est
// elle aussi indexée par identifiant de pétition ; la plupart des pétitions
// n'y figurent pas — null est le cas normal, pas une erreur.
export async function getReunionsPetition(identifiant: string): Promise<PassageEnCommission | null> {
  const snap = await getDoc(doc(db, "reunions", identifiant));
  return snap.exists() ? (snap.data() as PassageEnCommission) : null;
}

// Écrit par scripts/import-petitions.mjs à chaque import : la liste des
// identifiants et les années de dépôt. Une seule lecture Firestore suffit
// alors au sitemap et à l'index des pétitions, au lieu d'énumérer les
// 4 000 documents à chaque passage de robot.
export type AnneeDepot = { annee: string; nb: number };

export type SitemapMeta = {
  calculeLe: string;
  identifiants: string[];
  annees: AnneeDepot[];
};

export async function getSitemapMeta(): Promise<SitemapMeta | null> {
  const snap = await getDoc(doc(db, "meta", "sitemap"));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    calculeLe: d.calculeLe ?? "",
    identifiants: (d.identifiants as string[]) ?? [],
    annees: (d.annees as AnneeDepot[]) ?? [],
  };
}

// Journal des imports, écrit par scripts/import-petitions.mjs : ce que le
// fichier officiel a changé entre deux lectures, pétition par pétition. Chaque
// entrée est un constat de différence, jamais une interprétation.
export type PetitionResume = { identifiant: string; titre: string; nbVotes: number | null };

export type ImportDelta = {
  calculeLe: string;
  /** null au tout premier import : rien à quoi comparer. */
  depuis: string | null;
  total: number;
  nbNouvelles: number;
  nbSeuilFranchi: number;
  nbRecueilsClos: number;
  nbDecisionsPubliees: number;
  nbStatutsChanges: number;
  signaturesGagnees: number;
  /** Listes bornées (échantillon cliquable) : les compteurs ci-dessus font foi. */
  nouvelles: PetitionResume[];
  seuilFranchi: PetitionResume[];
  recueilsClos: PetitionResume[];
  decisionsPubliees: (PetitionResume & { decisionTexte: string })[];
  statutsChanges: (PetitionResume & { de: string; vers: string })[];
};

export async function getDernierImport(): Promise<ImportDelta | null> {
  const snap = await getDoc(doc(db, "meta", "journal"));
  if (!snap.exists()) return null;
  const imports = (snap.data().imports as ImportDelta[]) ?? [];
  return imports[0] ?? null;
}

// Toutes les pétitions déposées une année donnée, de la plus récente à la
// plus ancienne. Bornes textuelles sur la date ISO : les dates sont validées
// AAAA-MM-JJ à l'import, la comparaison lexicographique est donc exacte, et
// la requête ne demande aucun index composite.
export async function getPetitionsParAnnee(annee: string): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("datePublication", ">=", `${annee}-01-01`),
    where("datePublication", "<=", `${annee}-12-31`),
    orderBy("datePublication", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// Les plus signées parmi celles que le fichier déclare classées.
export async function getFlagshipPetitions(max = 6): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("statutSource", "==", "classee"),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// Pétitions classées sans que le motif du seuil soit invoqué et sans aucun
// texte de décision : le cas où l'absence d'explication est signifiante.
export async function getSansDecision(max = 8): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("statutSource", "==", "classee"),
    where("motifClassement", "==", "absent"),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// Écart constaté entre le fichier et les dates : signalé, jamais corrigé.
export async function getEcartStatutDates(max = 5): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("ecartStatutDates", "==", true),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
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

export async function getSyntheseCommission(): Promise<SyntheseCommission | null> {
  const snap = await getDoc(doc(db, "meta", "reunions"));
  return snap.exists() ? (snap.data() as SyntheseCommission) : null;
}

// Contrairement aux rapprochements thématiques, ces passages sont établis à
// partir de l'ordre du jour officiel des commissions, qui désigne la pétition
// par son numéro ou son titre exact.
export async function getPassagesEnCommission(max = 6): Promise<PassageEnCommission[]> {
  const q = query(collection(db, "reunions"), orderBy("nbVotes", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PassageEnCommission);
}
