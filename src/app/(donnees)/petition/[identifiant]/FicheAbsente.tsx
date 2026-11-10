import Link from "next/link";
import styles from "../../donnees.module.css";
import cartes from "@/app/page.module.css";
import { formatFrDate, formatSignatures, type PetitionAbsente } from "@/lib/petitions";

// Fiche d'une pétition publiée sur la plateforme mais absente du fichier
// ouvert. Elle ne montre que ce que le relevé a lu sur la plateforme : aucun
// champ du fichier, puisque le fichier ne la contient pas. Page en noindex
// (voir generateMetadata) : elle renvoie à la fiche officielle, seule complète.
export function FicheAbsente({ p, releveLe }: { p: PetitionAbsente; releveLe: string }) {
  return (
    <article className={styles.article}>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/absentes-du-fichier">Absentes du fichier</Link>
          {" · "}n°{p.identifiant}
        </p>
        <h1>{p.titre}</h1>
        <div className={styles.etat}>
          <span className={`${cartes.tag} ${cartes.tagNone}`}>Absente du fichier officiel</span>
          <span>
            <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
          </span>
          <span>{p.commission || "Commission non précisée"}</span>
          {p.datePublication && <span>publiée le {formatFrDate(p.datePublication)}</span>}
        </div>
      </header>

      <div className={styles.corps}>
        <p className={styles.encadre}>
          <strong>Cette pétition n&apos;a jamais figuré dans le fichier de données
          ouvertes.</strong>{" "}
          Elle est pourtant publiée sur la plateforme de l&apos;Assemblée nationale.
          Les informations ci-dessus y ont été lues lors de notre relevé du{" "}
          {formatFrDate(releveLe)}. Faute de fichier, nous ne pouvons pas suivre sa
          décision de commission ni l&apos;inclure dans nos chiffres.{" "}
          <Link href="/absentes-du-fichier">Pourquoi elle manque</Link>.
        </p>

        <section className={styles.section}>
          <p>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              Voir la pétition sur la plateforme de l&apos;Assemblée nationale →
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
