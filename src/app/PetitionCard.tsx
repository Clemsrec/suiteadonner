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

// Carte pétition commune à l'accueil, à la recherche et aux pages de listes.
// Elle mène à la fiche interne, qui rassemble tout ce que le fichier officiel
// permet d'établir — le lien vers la plateforme officielle vit sur la fiche,
// à côté de ces constats, et non plus directement sur chaque carte.
export default function PetitionCard({
  identifiant,
  titre,
  tagLabel,
  tagType,
  nbVotes,
  commission,
  dateLabel,
}: {
  identifiant: string;
  titre: string;
  tagLabel: string;
  tagType: TagType;
  nbVotes: number | null;
  commission: string | null;
  dateLabel: string | null;
}) {
  return (
    <Link className={styles.petition} href={`/petition/${identifiant}`}>
      <div className={styles.petitionTop}>
        <div className={styles.petitionTitle}>{titre}</div>
        <span className={`${styles.tag} ${TAG_CLASS[tagType]}`}>{tagLabel}</span>
      </div>
      <div className={styles.petitionMeta}>
        <span>
          <span className={styles.n}>{formatSignatures(nbVotes)}</span> soutiens
        </span>
        <span>{commission || "Commission non précisée"}</span>
        {dateLabel && <span>{dateLabel}</span>}
      </div>
    </Link>
  );
}
