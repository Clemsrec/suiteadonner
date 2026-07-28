import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import styles from "../../donnees.module.css";
import {
  formatFrDate,
  formatSignatures,
  getPetitionsParAnnee,
  getSitemapMeta,
} from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

// Les listes annuelles sont générées à la première visite puis mises en cache,
// comme les fiches — le sitemap et l'index /petitions les font découvrir.
export async function generateStaticParams(): Promise<{ annee: string }[]> {
  return [];
}

const chargerAnnee = cache(async (annee: string) => getPetitionsParAnnee(annee));

type Params = { params: Promise<{ annee: string }> };

// La première pétition du fichier date de 2020 : hors de la plage plausible,
// on répond 404 sans interroger Firestore.
function anneeValide(annee: string): boolean {
  return /^20[2-9]\d$/.test(annee);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { annee } = await params;
  if (!anneeValide(annee)) return { title: `Page introuvable — ${SITE_NAME}` };
  const petitions = await chargerAnnee(annee);
  return {
    title: `Les ${petitions.length.toLocaleString("fr-FR")} pétitions déposées en ${annee} — ${SITE_NAME}`,
    description:
      `Liste complète des pétitions citoyennes déposées à l'Assemblée nationale en ${annee}, ` +
      "avec pour chacune une fiche : statut, signatures et décision de la commission — ou son absence.",
    alternates: { canonical: `/petitions/${annee}` },
  };
}

export default async function PetitionsParAnnee({ params }: Params) {
  const { annee } = await params;
  if (!anneeValide(annee)) notFound();

  const petitions = await chargerAnnee(annee);
  if (petitions.length === 0) notFound();

  // Navigation entre années depuis le document meta : sa lecture peut échouer
  // sans priver la page de sa liste.
  const meta = await getSitemapMeta().catch(() => null);
  const annees = meta?.annees.map((a) => a.annee).sort() ?? [];
  const i = annees.indexOf(annee);
  const precedente = i > 0 ? annees[i - 1] : null;
  const suivante = i >= 0 && i < annees.length - 1 ? annees[i + 1] : null;

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}année {annee}
        </p>
        <h1>
          Les {petitions.length.toLocaleString("fr-FR")} pétitions déposées en {annee}
        </h1>
        <p className={styles.lede}>
          De la plus récente à la plus ancienne, telles qu&apos;elles figurent dans le
          fichier officiel. Chaque fiche détaille le statut, les signatures et ce que
          le fichier dit — ou ne dit pas — de la décision de la commission.
        </p>
      </header>

      <section className={styles.section}>
        <ol className={styles.annuaire}>
          {petitions.map((p) => (
            <li key={p.identifiant}>
              <Link href={`/petition/${p.identifiant}`}>
                <span className={styles.annuaireTitre}>{p.titre}</span>
                <span className={styles.annuaireMeta}>
                  {formatSignatures(p.nbVotes)} soutiens
                  {" · "}
                  {p.statutLabel}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <nav className={styles.pagination} aria-label="Autres années">
          <span>{precedente && <Link href={`/petitions/${precedente}`}>← Déposées en {precedente}</Link>}</span>
          <span>{suivante && <Link href={`/petitions/${suivante}`}>Déposées en {suivante} →</Link>}</span>
        </nav>
      </section>

      <p className={styles.source}>
        Les libellés de statut sont lus dans le texte de décision et dans les dates,
        jamais déduits du seul champ «&nbsp;statut&nbsp;» du fichier — qui se contredit
        pour près de 900 pétitions. Voir la <Link href="/methodologie">méthodologie</Link>.
        {petitions[0]?.calculeLe ? (
          <>
            {" "}
            Dernier import&nbsp;: {formatFrDate(petitions[0].calculeLe)}.
          </>
        ) : null}
      </p>
    </>
  );
}
