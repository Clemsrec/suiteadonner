import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import propre from "./corrections.module.css";
import { ERRATA } from "@/lib/errata";
import { formatFrDate } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

// Page entièrement statique : elle décrit des faits passés, qui ne changent
// plus. Seule la liste s'allonge, avec le dépôt.
export const metadata: Metadata = {
  title: `Ce que ce site a affiché de faux — ${SITE_NAME}`,
  description:
    "Les erreurs que cet observatoire a publiées, ce qu'elles affirmaient, pourquoi elles étaient fausses et ce qu'il dit désormais. Un site qui reproche à l'Assemblée de ne pas publier ses décisions ne peut pas corriger les siennes en silence.",
  alternates: { canonical: "/corrections" },
};

export default function Corrections() {
  const dates = ERRATA.map((e) => e.date).sort();

  return (
    <div className={styles.colonne}>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>Sources, règles et limites</p>
        <h1>Ce que ce site a affiché de faux</h1>
        <p className={styles.lede}>
          Cet observatoire affirme des choses sur le travail de l&apos;Assemblée nationale
          et sur le sort de pétitions signées par des centaines de milliers de personnes.
          Il s&apos;est trompé. Cette page dit quand, sur quoi, et ce qu&apos;il en a fait.
        </p>
        <p className={styles.lede}>
          Chaque correction cite la phrase fautive telle qu&apos;elle était affichée. La
          recopier est désagréable, et c&apos;est voulu&nbsp;: une correction qui ne montre
          pas ce qu&apos;elle corrige demande encore qu&apos;on lui fasse confiance.
        </p>
        <p className={styles.encadre}>
          <strong>
            {ERRATA.length} correction{ERRATA.length > 1 ? "s" : ""} publiée
            {ERRATA.length > 1 ? "s" : ""}
          </strong>{" "}
          {dates.length > 0 && (
            <>
              entre le {formatFrDate(dates[0])} et le {formatFrDate(dates.at(-1)!)}.{" "}
            </>
          )}
          Seules figurent ici les erreurs qu&apos;un visiteur a pu lire. Ce qui a été
          rattrapé avant publication n&apos;y est pas&nbsp;: cette page dit ce qui a été
          dit, pas comment le code a évolué.
        </p>
      </header>

      <section className={styles.section}>
        <ol className={propre.liste}>
          {ERRATA.map((e) => (
            <li key={`${e.date}-${e.affirmait.slice(0, 40)}`} className={propre.entree}>
              <p className={propre.meta}>
                <span className={propre.date}>{formatFrDate(e.date)}</span>
                <span className={propre.ou}>{e.ou}</span>
              </p>

              <p className={propre.etiquette}>Le site affirmait</p>
              <blockquote className={propre.faux}>{e.affirmait}</blockquote>

              <p className={propre.etiquette}>Pourquoi c&apos;était faux</p>
              <p className={propre.texte}>{e.pourquoi}</p>

              <p className={propre.etiquette}>Ce qu&apos;il dit désormais</p>
              <p className={propre.texte}>{e.corrige}</p>

              {e.gardeFou && (
                <p className={propre.gardeFou}>
                  <strong>Pour que cela ne revienne pas&nbsp;:</strong> {e.gardeFou}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Signaler une erreur</h2>
        <p>
          Si un chiffre ou une phrase de ce site vous paraît faux, écrivez à{" "}
          <a href="mailto:clement@nucom.fr">clement@nucom.fr</a> en citant la page et ce
          qui la contredit. La correction commence toujours par déterminer si l&apos;écart
          vient du jeu de données officiel ou de notre lecture — les deux arrivent, et la
          distinction figure dans la correction publiée.
        </p>
      </section>

      <p className={styles.source}>
        Voir aussi&nbsp;: <Link href="/methodologie">la méthodologie</Link>, qui énonce les
        règles que ces erreurs ont enfreintes ·{" "}
        <Link href="/">l&apos;accueil et ses chiffres à jour</Link>.
      </p>
    </div>
  );
}
