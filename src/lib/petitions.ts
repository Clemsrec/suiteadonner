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
