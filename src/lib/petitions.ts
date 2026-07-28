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
  /** null quand nbVotes est inconnu : on ne peut pas trancher. */
  seuilAtteint: boolean | null;
  /** Le fichier dit « ouverte » alors que la date limite est passée. */
  ecartStatutDates: boolean;
  clotureGroupee: boolean;

  statutLabel: string;
  sourceCsv: string;
  calculeLe: string;
};

export const MOTIF_LABELS: Record<MotifClassement, string> = {
  seuil: "Classée d'office, seuil non atteint",
  constat: "Classement constaté, sans motif",
  absent: "Aucune décision publiée",
  sans_objet: "Recueil en cours",
};

export const SEUIL_SIGNATURES = 10000;

// Libellés de repli, employés quand seul le statut brut est disponible (index
// de recherche). Aucun n'affirme un examen : le fichier ne l'atteste jamais.
export const STATUT_LABELS: Record<StatutSource, string> = {
  ouverte: "En cours de signature",
  archivee: "Classée d'office",
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

export type ReunionCommission = {
  date: string;
  compteRenduRef: string | null;
  intitule: string;
  /** « numero » : la commission cite le numéro — correspondance certaine. */
  appariement: "numero" | "titre";
};

export type PassageEnCommission = {
  identifiant: string;
  titre: string;
  nbVotes: number;
  statut: string;
  commission: string;
  decisionPubliee: boolean;
  url: string;
  nbReunions: number;
  premiereReunion: string;
  derniereReunion: string;
  reunions: ReunionCommission[];
};

// Contrairement aux rapprochements thématiques, ces passages sont établis à
// partir de l'ordre du jour officiel des commissions, qui désigne la pétition
// par son numéro ou son titre exact.
export async function getPassagesEnCommission(max = 6): Promise<PassageEnCommission[]> {
  const q = query(collection(db, "reunions"), orderBy("nbVotes", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PassageEnCommission);
}
