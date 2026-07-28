import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import PetitionCard from "@/app/PetitionCard";
import { formatFrDate, getEcartStatutDates, getStats } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Pétitions dont le fichier public n'est pas à jour — ${SITE_NAME}`,
  description:
    "Les pétitions de l'Assemblée nationale dont la date limite de signature est passée mais que le fichier de données ouvertes affiche toujours « en cours de signature ».",
  alternates: { canonical: "/fichier-non-a-jour" },
};

// Deux pétitions concernées au dernier relevé — la limite couvre très
// largement une éventuelle dégradation du fichier amont.
const LIMITE = 200;

async function loadData() {
  const [petitions, stats] = await Promise.allSettled([getEcartStatutDates(LIMITE), getStats()]);
  for (const r of [petitions, stats]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }
  return {
    petitions: petitions.status === "fulfilled" ? petitions.value : [],
    stats: stats.status === "fulfilled" ? stats.value : null,
  };
}

export default async function FichierNonAJour() {
  const { petitions, stats } = await loadData();

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}par constat
        </p>
        <h1>Le fichier public n&apos;est pas à jour</h1>
        <p className={styles.lede}>
          La date limite de recueil des signatures de ces pétitions est passée,
          parfois depuis des mois. Le fichier de données ouvertes leur conserve
          pourtant le statut <code>ouverte</code>, sans décision de commission.
        </p>
        <p className={styles.encadre}>
          Précision importante&nbsp;: <strong>la plateforme officielle, elle, affiche
          bien la date limite</strong>{" "}
          et ne prétend pas que le recueil se poursuit. Ce défaut ne concerne que le
          fichier réutilisable — c&apos;est-à-dire celui dont se servent les
          chercheurs, les journalistes et ce site.
        </p>
      </header>

      <section className={styles.section}>
        {petitions.length ? (
          petitions.map((p) => (
            <PetitionCard
              key={p.identifiant}
              identifiant={p.identifiant}
              titre={p.titre}
              tagLabel="Fichier non à jour"
              tagType="none"
              nbVotes={p.nbVotes}
              commission={p.commissionSource}
              dateLabel={`Date limite : ${formatFrDate(p.dateLimiteVote)}`}
            />
          ))
        ) : (
          <p>
            Aucune pétition dans ce cas au dernier import — ou données momentanément
            inaccessibles.
          </p>
        )}
      </section>

      <p className={styles.source}>
        Liste établie depuis le fichier officiel de data.gouv.fr&nbsp;: pétitions au
        statut <code>ouverte</code> dont la date limite de signature est passée,
        triées par nombre de soutiens
        {stats?.calculeLe ? `, dernier import le ${formatFrDate(stats.calculeLe)}` : ""}.
        Règles de lecture sur la page <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
