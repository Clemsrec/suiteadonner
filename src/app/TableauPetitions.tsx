import Link from "next/link";
import styles from "./page.module.css";
import { formatSignatures } from "@/lib/petitions";

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
  dateLabel: string | null;
};

// Tableau des pétitions, commun à l'accueil, à la recherche et aux pages de
// listes. Une pétition par ligne, toujours les mêmes colonnes dans le même
// ordre : on lit une liste de haut en bas, pas une suite de cartes. Le titre
// seul porte le lien — c'est lui qu'annonce un lecteur d'écran, et non la
// ligne entière avec ses chiffres.
export default function TableauPetitions({
  lignes,
  enteteDate,
  legende,
}: {
  lignes: LignePetition[];
  /* Ce que mesure la colonne de droite : dépôt, clôture, date limite… Le
     libellé change d'une liste à l'autre, la colonne reste au même endroit. */
  enteteDate: string;
  legende?: string;
}) {
  return (
    <table className={styles.tableau}>
      {legende && <caption className={styles.tableauLegende}>{legende}</caption>}
      <thead>
        <tr>
          <th scope="col">Pétition</th>
          <th scope="col" className={styles.colNombre}>
            Soutiens
          </th>
          <th scope="col" className={styles.colStatut}>
            Ce qu&apos;en dit le fichier
          </th>
          <th scope="col" className={styles.colDate}>
            {enteteDate}
          </th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
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
            <td className={styles.cellDate}>{l.dateLabel ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
