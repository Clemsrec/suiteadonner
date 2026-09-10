import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import cartes from "@/app/page.module.css";
import { FriseReunions } from "@/app/FriseReunions";
import {
  formatFrDate,
  formatSignatures,
  getPassagesEnCommission,
  pointFinal,
} from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Ce que les commissions ont fait des pétitions — ${SITE_NAME}`,
  description:
    "Les pétitions que les commissions de l'Assemblée nationale ont examinées en les désignant elles-mêmes, et la décision qu'elles ont votée — reprise mot pour mot du compte rendu officiel, là où le fichier public laisse le champ vide.",
  alternates: { canonical: "/passages-en-commission" },
};

// La correspondance certaine (numéro ou titre exact cité par la commission,
// à son ordre du jour ou dans son compte rendu) ne concerne qu'une poignée de
// pétitions : la limite est très au-dessus.
const LIMITE = 50;

export default async function PassagesEnCommission() {
  const passages = await getPassagesEnCommission(LIMITE).catch((err) => {
    console.error("Lecture Firestore impossible :", err);
    return [];
  });

  // Ces décomptes étaient écrits en dur dans le chapeau. Ils ont cessé d'être
  // vrais le jour où une pétition de la liste a eu, elle, un texte de décision
  // au fichier : on les calcule désormais sur les données affichées.
  const sansDecision = passages.filter((p) => !p.decisionPubliee);
  const avecDecisionLue = passages.filter((p) => p.derniereDecision);
  const divergentes = passages.filter((p) => p.derniereDecision && p.decisionTexte);

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
          commission a désigné ces pétitions elle-même, par leur numéro ou par
          leur titre exact, à son ordre du jour ou dans le compte rendu de sa
          réunion. Chaque étape indique laquelle des trois, et donne accès au
          texte officiel intégral.
        </p>
        <p className={styles.lede}>
          Nous écartons volontairement tout rapprochement incertain&nbsp;: lorsque
          plusieurs pétitions portent le même titre et qu&apos;aucun numéro
          n&apos;est cité, nous préférons une lacune à une attribution douteuse.
          Cette liste est donc un minimum, pas un total.
        </p>
        {sansDecision.length > 0 && (
          <p className={styles.encadre}>
            <strong>
              Pour {sansDecision.length === passages.length ? "aucune" : sansDecision.length}{" "}
              d&apos;entre elles, le fichier public ne mentionne la moindre décision.
            </strong>{" "}
            {avecDecisionLue.length > 0 && (
              <>
                Le compte rendu de la réunion, lui, énonce la décision de la
                commission pour {avecDecisionLue.length} d&apos;entre elles&nbsp;:
                nous la reproduisons mot pour mot, avec le lien vers le texte
                officiel.{" "}
              </>
            )}
            Le travail a eu lieu&nbsp;; le signataire n&apos;en saura rien par le
            fichier qu&apos;on lui donne à lire.
          </p>
        )}
        {divergentes.length > 0 && (
          <p className={styles.lede}>
            Pour{" "}
            {divergentes.length === 1
              ? "l’une d’elles"
              : `${divergentes.length} d’entre elles`}
            , le fichier public publie bien un texte de décision — mais il ne dit pas la même
            chose que le compte rendu de la commission. Les deux sont reproduits côte à côte,
            sans que nous départagions.
          </p>
        )}
      </header>

      <section className={styles.section}>
        {passages.length ? (
          passages.map((p) => (
            <div className={cartes.passage} key={p.identifiant}>
              <div className={cartes.petitionTop}>
                <Link className={cartes.petitionTitle} href={`/petition/${p.identifiant}`}>
                  {p.titre}
                </Link>
                <span
                  className={`${cartes.tag} ${p.decisionPubliee ? cartes.tagExamined : cartes.tagNone}`}
                >
                  {p.decisionPubliee ? "Décision publiée au fichier" : "Décision non publiée"}
                </span>
              </div>
              <div className={cartes.petitionMeta}>
                <span>
                  {p.nbVotes === null ? (
                    "Nombre de soutiens non renseigné"
                  ) : (
                    <>
                      <span className={cartes.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                    </>
                  )}
                </span>
                <span>{p.commission || "Commission non précisée"}</span>
              </div>

              <FriseReunions reunions={p.reunions} />

              {p.decisionTexte && p.derniereDecision && (
                <div className={styles.encadre}>
                  <strong>Les deux sources officielles ne disent pas la même chose.</strong>{" "}
                  Le fichier public écrit&nbsp;: «&nbsp;{p.decisionTexte}&nbsp;»
                  {pointFinal(p.decisionTexte)} Le compte rendu de la réunion du{" "}
                  {formatFrDate(p.derniereDecision.date)} écrit&nbsp;: «&nbsp;
                  {p.derniereDecision.citation}&nbsp;»
                  {pointFinal(p.derniereDecision.citation)} Nous reproduisons les deux textes et
                  n&apos;en départageons aucun.
                </div>
              )}
            </div>
          ))
        ) : (
          <p>Les données ne sont pas accessibles pour le moment. Merci de réessayer dans quelques minutes.</p>
        )}
      </section>

      <p className={styles.source}>
        Passages établis depuis l&apos;agenda officiel des réunions de
        l&apos;Assemblée nationale, croisé avec le fichier des pétitions de
        data.gouv.fr. Les décisions citées sont reprises mot pour mot des comptes
        rendus publiés par l&apos;Assemblée, dont le lien accompagne chaque
        étape. Règles de rapprochement sur la page{" "}
        <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
