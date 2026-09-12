import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import { getSitemapMeta, getStats, formatFrDate } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Toutes les pétitions déposées à l'Assemblée nationale — ${SITE_NAME}`,
  description:
    "Index complet des pétitions citoyennes déposées à l'Assemblée nationale, année par année, avec pour chacune une fiche : statut, signatures, décision de la commission — ou son absence.",
  alternates: { canonical: "/petitions" },
};

// allSettled et non all : l'index doit rendre même si l'une des deux lectures
// échoue — les sections dégradent indépendamment, comme sur l'accueil.
async function loadData() {
  const [meta, stats] = await Promise.allSettled([getSitemapMeta(), getStats()]);
  for (const r of [meta, stats]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }
  return {
    meta: meta.status === "fulfilled" ? meta.value : null,
    stats: stats.status === "fulfilled" ? stats.value : null,
  };
}

export default async function IndexPetitions() {
  const { meta, stats } = await loadData();

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>Assemblée nationale — données ouvertes</p>
        <h1>Toutes les pétitions, année par année</h1>
        <p className={styles.lede}>
          {stats
            ? `${stats.total.toLocaleString("fr-FR")} pétitions déposées sur la plateforme de l'Assemblée nationale, suivies depuis le fichier officiel de data.gouv.fr.`
            : "Les pétitions déposées sur la plateforme de l'Assemblée nationale, suivies depuis le fichier officiel de data.gouv.fr."}{" "}
          Chaque fiche rassemble ce que le fichier permet d&apos;établir&nbsp;: statut,
          signatures, décision de la commission — ou son absence, fréquente dès lors que le
          classement n&apos;est pas motivé par le nombre de signatures.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Par année de dépôt</h2>
        {meta && meta.annees.length > 0 ? (
          <ul className={styles.annees}>
            {meta.annees.map((a) => (
              <li key={a.annee}>
                <Link href={`/petitions/${a.annee}`}>
                  <span className={styles.anneeN}>{a.annee}</span>
                  <span className={styles.anneeNb}>
                    {a.nb.toLocaleString("fr-FR")} pétition{a.nb > 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            L&apos;index par année est en cours de préparation. En attendant, la
            recherche de l&apos;<Link href="/">accueil</Link> donne accès à toutes les
            pétitions.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Par constat</h2>
        <ul>
          <li>
            <Link href="/decisions-non-publiees">Classées sans décision publiée</Link>{" "}— le
            fichier les donne pour classées, sans qu&apos;aucune motivation ne soit inscrite
            dans le champ officiel prévu à cet effet. Nous ignorons si une commission les a
            examinées.
          </li>
          <li>
            <Link href="/passages-en-commission">Passées en commission</Link> — les pétitions
            dont une commission s&apos;est saisie en les désignant elle-même, par leur numéro ou
            par leur titre.
          </li>
          <li>
            <Link href="/fichier-non-a-jour">Fichier non à jour</Link>{" "}— la date limite de
            signature est passée, mais le fichier ouvert conserve à ces pétitions le statut{" "}
            <code>ouverte</code>.
          </li>
        </ul>
      </section>

      <p className={styles.source}>
        Source&nbsp;: fichier officiel des pétitions publié sur data.gouv.fr
        {meta?.calculeLe ? `, dernier import le ${formatFrDate(meta.calculeLe)}` : ""}.
        Règles de lecture détaillées sur la page{" "}
        <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
