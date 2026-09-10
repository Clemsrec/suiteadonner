"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";
import { formatFrDate, formatSignatures } from "@/lib/petitions";

export type TagType = "done" | "pending" | "none" | "examined";

const TAG_CLASS: Record<TagType, string> = {
  done: styles.tagDone,
  pending: styles.tagPending,
  none: styles.tagNone,
  examined: styles.tagExamined,
};

export type LignePetition = {
  identifiant: string;
  titre: string;
  tagLabel: string;
  tagType: TagType;
  nbVotes: number | null;
  commission: string | null;
  /* Date brute (AAAA-MM-JJ), pas son libellé : c'est elle qui sert au tri, et
     le tableau la met en forme lui-même. */
  date: string | null;
};

type Colonne = "titre" | "soutiens" | "statut" | "date";
type Sens = "asc" | "desc";
type Tri = { colonne: Colonne; sens: Sens };

// Premier clic : l'ordre le plus utile pour la colonne. On lit des titres de A
// à Z, mais des soutiens et des dates du plus grand au plus petit.
const SENS_INITIAL: Record<Colonne, Sens> = {
  titre: "asc",
  soutiens: "desc",
  statut: "asc",
  date: "desc",
};

// Une valeur absente n'est pas une valeur basse : un nombre de signatures non
// renseigné ne vaut pas zéro, et une date manquante n'est pas la plus
// ancienne. Ces lignes sortent du tri et se rangent toujours en fin de liste.
function valeurManquante(l: LignePetition, colonne: Colonne): boolean {
  if (colonne === "soutiens") return l.nbVotes === null;
  if (colonne === "date") return !l.date;
  return false;
}

function comparer(a: LignePetition, b: LignePetition, colonne: Colonne): number {
  switch (colonne) {
    case "soutiens":
      return (a.nbVotes ?? 0) - (b.nbVotes ?? 0);
    // Dates au format AAAA-MM-JJ : l'ordre alphabétique est l'ordre chronologique.
    case "date":
      return (a.date ?? "").localeCompare(b.date ?? "");
    case "statut":
      return a.tagLabel.localeCompare(b.tagLabel, "fr");
    case "titre":
      return a.titre.localeCompare(b.titre, "fr");
  }
}

function trier(lignes: LignePetition[], tri: Tri | null): LignePetition[] {
  if (!tri) return lignes;
  return [...lignes].sort((a, b) => {
    const aVide = valeurManquante(a, tri.colonne);
    const bVide = valeurManquante(b, tri.colonne);
    if (aVide || bVide) return aVide && bVide ? 0 : aVide ? 1 : -1;
    const ecart = comparer(a, b, tri.colonne);
    return tri.sens === "asc" ? ecart : -ecart;
  });
}

// En-tête de colonne : le libellé est un bouton, et la cellule porte l'état du
// tri en `aria-sort` pour qu'un lecteur d'écran l'annonce. Sur un tableau qui
// ne montre qu'un extrait, le libellé redevient un simple intitulé : un tri
// qui ne classerait que les lignes visibles donnerait un classement faux.
function Entete({
  colonne,
  tri,
  onTri,
  className,
  children,
}: {
  colonne: Colonne;
  tri: Tri | null;
  onTri: ((colonne: Colonne) => void) | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (!onTri) {
    return (
      <th scope="col" className={className}>
        {children}
      </th>
    );
  }
  const actif = tri?.colonne === colonne;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={actif ? (tri.sens === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={styles.triBouton} onClick={() => onTri(colonne)}>
        {children}
        <span className={styles.triFleche} aria-hidden="true">
          {actif ? (tri.sens === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

// Tableau des pétitions, commun à l'accueil, à la recherche et aux pages de
// listes. Une pétition par ligne, toujours les mêmes colonnes dans le même
// ordre : on lit une liste de haut en bas, pas une suite de cartes. Le titre
// seul porte le lien — c'est lui qu'annonce un lecteur d'écran, et non la
// ligne entière avec ses chiffres.
export default function TableauPetitions({
  lignes,
  enteteDate,
  legende,
  complet = true,
}: {
  lignes: LignePetition[];
  /* Ce que mesure la colonne de droite : dépôt, clôture, date limite… Le
     libellé change d'une liste à l'autre, la colonne reste au même endroit. */
  enteteDate: string;
  legende?: string;
  /* Le tableau tient-il toutes les pétitions dont il parle ? Le tri n'est
     proposé que dans ce cas. Un extrait — les six plus signées de l'accueil,
     les trente premiers résultats d'une recherche — n'est pas triable : le
     classement obtenu ne vaudrait que pour les lignes déjà là, et ferait
     passer un sous-ensemble pour un palmarès. La liste complète, elle, est
     toujours à un lien de distance. */
  complet?: boolean;
}) {
  // Aucun tri au départ : l'ordre d'arrivée est celui qu'annonce la page
  // (« de la plus signée à la moins signée », « de la plus récente à la plus
  // ancienne »).
  const [tri, setTri] = useState<Tri | null>(null);

  function basculer(colonne: Colonne) {
    setTri((actuel) =>
      actuel?.colonne === colonne
        ? { colonne, sens: actuel.sens === "asc" ? "desc" : "asc" }
        : { colonne, sens: SENS_INITIAL[colonne] }
    );
  }

  return (
    <table className={styles.tableau}>
      {legende && <caption className={styles.tableauLegende}>{legende}</caption>}
      <thead>
        <tr>
          <Entete colonne="titre" tri={tri} onTri={complet ? basculer : null}>
            Pétition
          </Entete>
          <Entete colonne="soutiens" tri={tri} onTri={complet ? basculer : null} className={styles.colNombre}>
            Soutiens
          </Entete>
          <Entete colonne="statut" tri={tri} onTri={complet ? basculer : null} className={styles.colStatut}>
            Ce qu&apos;en dit le fichier
          </Entete>
          <Entete colonne="date" tri={tri} onTri={complet ? basculer : null} className={styles.colDate}>
            {enteteDate}
          </Entete>
        </tr>
      </thead>
      <tbody>
        {/* Le tri est ignoré dès que le tableau ne montre qu'un extrait. Sur la
            recherche, `complet` change d'une requête à l'autre : sans cette
            garde, un tri hérité d'une recherche exhaustive resterait appliqué
            aux trente premiers résultats de la suivante, sans flèche ni
            aria-sort pour le dire — un sous-ensemble présenté en palmarès. */}
        {trier(lignes, complet ? tri : null).map((l) => (
          <tr key={l.identifiant}>
            <td className={styles.cellTitre}>
              <Link href={`/petition/${l.identifiant}`}>{l.titre}</Link>
              <span className={styles.cellCommission}>
                {l.commission || "Commission non précisée"}
              </span>
            </td>
            <td className={styles.cellNombre}>{formatSignatures(l.nbVotes)}</td>
            <td className={styles.cellStatut}>
              <span className={`${styles.tag} ${TAG_CLASS[l.tagType]}`}>{l.tagLabel}</span>
            </td>
            <td className={styles.cellDate}>{l.date ? formatFrDate(l.date) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
