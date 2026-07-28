import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import PetitionCard from "@/app/PetitionCard";
import { formatFrDate, getSansDecision, getStats } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Pétitions classées sans décision publiée — ${SITE_NAME}`,
  description:
    "La liste complète des pétitions examinées par une commission de l'Assemblée nationale puis classées sans qu'aucune motivation ne soit inscrite dans le champ officiel prévu à cet effet.",
  alternates: { canonical: "/decisions-non-publiees" },
};

// 269 pétitions concernées au dernier relevé ; la limite laisse de la marge
// sans risquer une lecture non bornée si le jeu de données évoluait brutalement.
const LIMITE = 600;

async function loadData() {
  const [petitions, stats] = await Promise.allSettled([getSansDecision(LIMITE), getStats()]);
  for (const r of [petitions, stats]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }
  return {
    petitions: petitions.status === "fulfilled" ? petitions.value : [],
    stats: stats.status === "fulfilled" ? stats.value : null,
  };
}

export default async function DecisionsNonPubliees() {
  const { petitions, stats } = await loadData();

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}par constat
        </p>
        <h1>Classées sans décision publiée</h1>
        <p className={styles.lede}>
          Ces pétitions ont été examinées par une commission, puis classées. Le jeu
          de données officiel prévoit un champ pour motiver cette décision&nbsp;: il
          est resté entièrement vide. Nous constatons une absence, nous n&apos;en
          déduisons rien — nous ignorons si une décision a été prise sans être rendue
          publique, ou si aucune ne l&apos;a été.
        </p>
        {stats?.signaturesClasseesSansTexte ? (
          <p className={styles.encadre}>
            <strong>
              {Math.round(stats.signaturesClasseesSansTexte).toLocaleString("fr-FR")} signatures
              cumulées
            </strong>{" "}
            pour les {stats.classeesHorsSeuilSansTexte.toLocaleString("fr-FR")}{" "}pétitions
            de cette liste, sans qu&apos;aucune motivation ne soit publiée.
          </p>
        ) : null}
      </header>

      <section className={styles.section}>
        {petitions.length ? (
          petitions.map((p) => (
            <PetitionCard
              key={p.identifiant}
              identifiant={p.identifiant}
              titre={p.titre}
              tagLabel="Décision non publiée"
              tagType="none"
              nbVotes={p.nbVotes}
              commission={p.commissionSource}
              dateLabel={p.dateLimiteVote ? `Recueil clos le ${formatFrDate(p.dateLimiteVote)}` : null}
            />
          ))
        ) : (
          <p>Les données ne sont pas accessibles pour le moment. Merci de réessayer dans quelques minutes.</p>
        )}
      </section>

      <p className={styles.source}>
        Liste établie depuis le fichier officiel de data.gouv.fr&nbsp;: pétitions au
        statut «&nbsp;classée&nbsp;» dont le champ <code>decision_commission</code> est
        vide, triées par nombre de soutiens
        {stats?.calculeLe ? `, dernier import le ${formatFrDate(stats.calculeLe)}` : ""}.
        Règles de lecture sur la page <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
