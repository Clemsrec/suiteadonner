import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import cartes from "@/app/page.module.css";
import { FriseReunions } from "@/app/FriseReunions";
import {
  formatFrDate,
  formatSignatures,
  getPassagesEnCommission,
  getSyntheseCommission,
  pointFinal,
} from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Ce que les commissions ont fait des pétitions — ${SITE_NAME}`,
  description:
    "Les pétitions dont une commission de l'Assemblée nationale s'est saisie en les désignant elle-même, et la décision qu'elle a énoncée dans son compte rendu — reprise mot pour mot, le plus souvent là où le fichier public laisse le champ vide.",
  alternates: { canonical: "/passages-en-commission" },
};

// La correspondance certaine (numéro ou titre exact cité par la commission,
// à son ordre du jour ou dans son compte rendu) ne concerne qu'une poignée de
// pétitions : la limite est très au-dessus.
const LIMITE = 50;

export default async function PassagesEnCommission() {
  const [passages, synthese] = await Promise.all([
    getPassagesEnCommission(LIMITE).catch((err) => {
      console.error("Lecture Firestore impossible :", err);
      return [];
    }),
    getSyntheseCommission().catch(() => null),
  ]);

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
          commission a désigné ces pétitions elle-même, par leur numéro ou par leur
          titre, à son ordre du jour ou dans le compte rendu de sa réunion. Chaque
          étape indique laquelle des trois, et donne accès au texte officiel dont
          elle est tirée.
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
            Une commission s&apos;en est saisie&nbsp;; le signataire n&apos;en saura rien par
            le fichier qu&apos;on lui donne à lire.
          </p>
        )}
        {divergentes.length > 0 && (
          <p className={styles.lede}>
            Pour{" "}
            {divergentes.length === 1
              ? "l’une d’elles"
              : `${divergentes.length} d’entre elles`}
            , le fichier public publie un texte de décision et le compte rendu de la commission
            en publie un autre. Les deux sont reproduits côte à côte, tels quels&nbsp;: nous ne
            les comparons pas et n&apos;en départageons aucun.
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
                  <strong>Deux textes officiels portent sur cette pétition.</strong>{" "}
                  Le fichier public écrit&nbsp;: «&nbsp;{p.decisionTexte}&nbsp;»
                  {pointFinal(p.decisionTexte)} Le compte rendu de la réunion du{" "}
                  {formatFrDate(p.derniereDecision.date)} écrit&nbsp;: «&nbsp;
                  {p.derniereDecision.citation}&nbsp;»
                  {pointFinal(p.derniereDecision.citation)} Nous les reproduisons sans les
                  comparer ni en départager aucun&nbsp;: à vous de lire.
                </div>
              )}
            </div>
          ))
        ) : (
          <p>Les données ne sont pas accessibles pour le moment. Merci de réessayer dans quelques minutes.</p>
        )}
      </section>

      {synthese?.classementsEnBloc?.length ? (
        <section className={styles.section} id="en-bloc">
          <h2>Le classement en bloc</h2>
          <p className={styles.lede}>
            Une pétition qui n&apos;atteint pas dix mille signatures en six mois est classée
            d&apos;office, sans examen&nbsp;: c&apos;est la règle, et la commission n&apos;a
            aucune décision à motiver. Elle traite ensemble toutes celles de son ressort, en une
            séance. Les comptes rendus annoncent ainsi{" "}
            {synthese.petitionsClasseesEnBloc.toLocaleString("fr-FR")} pétitions au total,
            contre {synthese.nbDecisions} pour lesquelles nous pouvons citer une décision
            individuelle.
          </p>
          <p className={styles.lede}>
            Nous ne relevons donc pas un manquement, mais une limite de ce que le document
            public permet de savoir&nbsp;: le compte rendu annonce un effectif, jamais la liste
            des pétitions concernées. Un signataire dont la pétition est restée sous le seuil ne
            peut pas y vérifier qu&apos;elle a bien été classée ce jour-là, ni lequel de ces
            votes la concernait. Nous relevons la séance, son effectif et son compte
            rendu&nbsp;; le reste, le document ne le contient pas.
          </p>

          <ol className={cartes.frise}>
            {synthese.classementsEnBloc.map((c) => (
              <li key={c.compteRenduRef}>
                <span className={cartes.friseDate}>{formatFrDate(c.date)}</span>
                <span className={cartes.friseActe}>
                  {c.nombre.toLocaleString("fr-FR")} pétitions —{" "}
                  {c.nature === "accompli"
                    ? "classement d’office constaté"
                    : "classement d’office proposé par le rapporteur"}
                </span>
                <span className={cartes.preuve}>
                  {c.nature === "accompli"
                    ? "Le compte rendu énonce le classement comme accompli."
                    : c.assentiment
                      ? "Le compte rendu note « (Assentiment.) » après cette proposition, sans rapporter de vote nominal."
                      : "Le compte rendu ne rapporte ni assentiment ni vote après cette proposition."}
                </span>
                <blockquote className={cartes.friseDecision}>
                  {c.citation}
                  <span className={cartes.friseDecisionSource}>
                    Compte rendu {c.compteRenduRef}, reproduit sans modification —{" "}
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      lire le compte rendu intégral
                    </a>
                    .
                  </span>
                </blockquote>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

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
