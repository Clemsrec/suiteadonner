import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type PetitionStatut = "ouverte" | "archivee" | "classee" | "expiree";

export type Petition = {
  identifiant: string;
  titre: string;
  description: string;
  datePublication: string | null;
  dateLimiteVote: string | null;
  nbVotes: number;
  statut: PetitionStatut;
  statutLabel: string;
  commission: string;
  legislature: string;
  decisionCommission: string;
  decisionPubliee: boolean;
  signaturesCloses: boolean;
  statutObsolete: boolean;
  url: string;
};

export const STATUS_LABELS: Record<PetitionStatut, string> = {
  ouverte: "En cours de signature",
  archivee: "Classée d'office",
  classee: "Classée après examen",
  expiree: "Expirée",
};

export const STATUS_TAG_CLASS: Record<PetitionStatut, "pending" | "none" | "examined"> = {
  ouverte: "pending",
  archivee: "none",
  classee: "examined",
  expiree: "none",
};

export type Stats = {
  total: number;
  ouverte: number;
  archivee: number;
  classee: number;
  expiree: number;
  fortSoutienSansSuite: number;
  sansDecision: number;
  signaturesSansDecision: number;
  statutObsolete: number;
  signaturesStatutObsolete: number;
  signaturesTotal: number;
  seuilDixMille: number;
  sansTexteDecision: number;
  textesDecision: number;
  formulationsDistinctes: number;
  clotureesEnMasse: number;
  dateClotureMasse: string | null;
  updatedAt: string | null;
};

export async function getStats(): Promise<Stats | null> {
  const snap = await getDoc(doc(db, "meta", "stats"));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    total: data.total ?? 0,
    ouverte: data.ouverte ?? 0,
    archivee: data.archivee ?? 0,
    classee: data.classee ?? 0,
    expiree: data.expiree ?? 0,
    fortSoutienSansSuite: data.fortSoutienSansSuite ?? 0,
    sansDecision: data.sansDecision ?? 0,
    signaturesSansDecision: data.signaturesSansDecision ?? 0,
    statutObsolete: data.statutObsolete ?? 0,
    signaturesStatutObsolete: data.signaturesStatutObsolete ?? 0,
    signaturesTotal: data.signaturesTotal ?? 0,
    seuilDixMille: data.seuilDixMille ?? 0,
    sansTexteDecision: data.sansTexteDecision ?? 0,
    textesDecision: data.textesDecision ?? 0,
    formulationsDistinctes: data.formulationsDistinctes ?? 0,
    clotureesEnMasse: data.clotureesEnMasse ?? 0,
    dateClotureMasse: data.dateClotureMasse ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
  };
}

// Pétitions dont le recueil de signatures est terminé depuis longtemps mais que
// le jeu de données affiche toujours « en cours de signature ». Elles échappent
// à toute requête filtrant sur le statut — or ce sont les deux plus signées de
// la plateforme.
export async function getStatutObsolete(max = 5): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("statutObsolete", "==", true),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// Pétitions examinées puis classées sans qu'aucune motivation ne soit publiée.
// Contrairement au rapprochement pétition ↔ débat, qui reste un recoupement
// thématique, il n'y a ici aucune interprétation : le champ officiel est vide.
export async function getSansDecision(max = 8): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("statut", "==", "classee"),
    where("decisionPubliee", "==", false),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// Le cœur de la thèse du produit : des pétitions ayant franchi le seuil de
// signatures nécessaire, examinées, puis classées sans suite documentée.
export async function getFlagshipPetitions(max = 6): Promise<Petition[]> {
  const q = query(
    collection(db, "petitions"),
    where("statut", "==", "classee"),
    orderBy("nbVotes", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Petition);
}

// La recherche plein texte (mot-clé + filtre par statut) est gérée par
// Algolia — voir src/lib/algolia.ts — Firestore ne fait pas de recherche
// plein texte et ne sert ici qu'aux requêtes structurées (stats, palmarès).
