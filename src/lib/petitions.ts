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
  url: string;
};

export type Stats = {
  total: number;
  ouverte: number;
  archivee: number;
  classee: number;
  expiree: number;
  fortSoutienSansSuite: number;
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
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
  };
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
