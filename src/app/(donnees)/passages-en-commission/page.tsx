import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import cartes from "@/app/page.module.css";
import {
  acteCommission,
  formatFrDate,
  formatSignatures,
  getPassagesEnCommission,
} from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Ce que les commissions ont fait des pétitions — ${SITE_NAME}`,
  description:
    "Les pétitions que les commissions de l'Assemblée nationale ont inscrites à leur ordre du jour, désignées par leur numéro ou leur titre exact — et dont le fichier public ne mentionne aucune décision.",
  alternates: { canonical: "/passages-en-commission" },
};

// La correspondance certaine (numéro ou titre exact cité à l'ordre du jour)
// ne concerne qu'une poignée de pétitions : la limite est très au-dessus.
const LIMITE = 50;

export default async function PassagesEnCommission() {
  const passages = await getPassagesEnCommission(LIMITE).catch((err) => {
    console.error("Lecture Firestore impossible :", err);
    return [];
  });

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}par constat
        </p>
        <h1>Ce que les commissions ont fait</h1>
        <p className={styles.lede}>
          Ces rapprochements ne sont pas des déductions de notre part&nbsp;: la
          commission a inscrit ces pétitions à son ordre du jour en les désignant
          elle-même, par leur numéro ou par leur titre exact. Chaque étape indique
          laquelle des deux, et donne accès au texte officiel intégral.
        </p>
        <p className={styles.lede}>
          Nous écartons volontairement tout rapprochement incertain&nbsp;: lorsque
          plusieurs pétitions portent le même titre et qu&apos;aucun numéro
          n&apos;est cité, nous préférons une lacune à une attribution douteuse.
          Cette liste est donc un minimum, pas un total.
        </p>
        <p className={styles.encadre}>
          <strong>
            Pour aucune d&apos;entre elles, le fichier public ne mentionne la moindre
            décision.
          </strong>{" "}
          Le travail a eu lieu&nbsp;; le signataire n&apos;en saura rien.
        </p>
      </header>

      <section className={styles.section}>
        {passages.length ? (
          passages.map((p) => (
            <div className={cartes.passage} key={p.identifiant}>
              <div className={cartes.petitionTop}>
                <Link className={cartes.petitionTitle} href={`/petition/${p.identifiant}`}>
                  {p.titre}
                </Link>
                <span className={`${cartes.tag} ${cartes.tagNone}`}>Décision non publiée</span>
              </div>
              <div className={cartes.petitionMeta}>
                <span>
                  <span className={cartes.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                </span>
                <span>{p.commission || "Commission non précisée"}</span>
              </div>

              <ol className={cartes.frise}>
                {p.reunions.map((r) => (
                  <li key={`${r.date}-${r.compteRenduRef ?? r.intitule.slice(0, 20)}`}>
                    <span className={cartes.friseDate}>{formatFrDate(r.date)}</span>
                    <span className={cartes.friseActe}>{acteCommission(r.intitule)}</span>
                    <span className={cartes.preuve}>
                      {r.appariement === "numero"
                        ? "La commission cite le numéro de la pétition"
                        : "La commission cite le titre exact de la pétition"}
                    </span>
                    <details className={cartes.friseDetail}>
                      <summary>Texte officiel</summary>
                      <p>{r.intitule}</p>
                      {r.compteRenduRef && (
                        <p className={cartes.friseCr}>Compte rendu de la réunion : {r.compteRenduRef}</p>
                      )}
                    </details>
                  </li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p>Les données ne sont pas accessibles pour le moment. Merci de réessayer dans quelques minutes.</p>
        )}
      </section>

      <p className={styles.source}>
        Passages établis depuis l&apos;agenda officiel des réunions de
        l&apos;Assemblée nationale, croisé avec le fichier des pétitions de
        data.gouv.fr. Règles de rapprochement sur la page{" "}
        <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
