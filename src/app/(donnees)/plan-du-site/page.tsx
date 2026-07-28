import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import { getSitemapMeta } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Plan du site — ${SITE_NAME}`,
  description:
    "Toutes les rubriques de l'observatoire : l'index des pétitions par année, les listes par constat, la méthodologie et les pages d'information.",
  alternates: { canonical: "/plan-du-site" },
};

// Pendant du sitemap.xml pour les visiteurs : les mêmes rubriques, lisibles.
// Les 4 000 fiches ne sont pas listées ici — ce sont les pages par année qui
// jouent ce rôle, à raison de quelques centaines de liens chacune.
export default async function PlanDuSite() {
  const meta = await getSitemapMeta().catch((err) => {
    console.error("Lecture Firestore impossible :", err);
    return null;
  });

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>Toutes les rubriques</p>
        <h1>Plan du site</h1>
      </header>

      <section className={styles.section}>
        <h2>L&apos;observatoire</h2>
        <ul>
          <li>
            <Link href="/">Accueil</Link>{" "}— le constat d&apos;ensemble, les chiffres à
            jour et la recherche parmi toutes les pétitions.
          </li>
          <li>
            <Link href="/petitions">Toutes les pétitions</Link>{" "}— l&apos;index complet,
            année par année ; chaque pétition y a sa fiche détaillée.
          </li>
          <li>
            <Link href="/methodologie">Méthodologie</Link>{" "}— la source canonique, les
            règles de lecture et ce que nous nous interdisons d&apos;affirmer.
          </li>
        </ul>
      </section>

      {meta && meta.annees.length > 0 && (
        <section className={styles.section}>
          <h2>Les pétitions par année de dépôt</h2>
          <ul>
            {meta.annees.map((a) => (
              <li key={a.annee}>
                <Link href={`/petitions/${a.annee}`}>Pétitions déposées en {a.annee}</Link>{" "}(
                {a.nb.toLocaleString("fr-FR")})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2>Les constats</h2>
        <ul>
          <li>
            <Link href="/decisions-non-publiees">Classées sans décision publiée</Link>
          </li>
          <li>
            <Link href="/passages-en-commission">Ce que les commissions ont fait</Link>
          </li>
          <li>
            <Link href="/fichier-non-a-jour">Le fichier public n&apos;est pas à jour</Link>
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Informations</h2>
        <ul>
          <li>
            <Link href="/mentions-legales">Mentions légales</Link>
          </li>
          <li>
            <Link href="/politique-de-confidentialite">Politique de confidentialité</Link>
          </li>
          <li>
            <Link href="/politique-cookies">Politique de cookies</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
