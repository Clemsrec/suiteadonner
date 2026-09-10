import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import styles from "../../donnees.module.css";
import cartes from "@/app/page.module.css";
import { FriseReunions } from "@/app/FriseReunions";
import {
  MOTIF_LABELS,
  SEUIL_SIGNATURES,
  formatDelaiMois,
  formatFrDate,
  formatSignatures,
  getPetition,
  getReunionsPetition,
  moisDepuis,
  type Petition,
} from "@/lib/petitions";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Les données source ne changent qu'une fois par semaine (republication du
// lundi) : chaque fiche est générée à la première visite puis servie depuis le
// cache, et régénérée au plus une fois par jour. Le trafic n'a ainsi aucun
// effet sur Firestore — deux lectures par fiche et par jour au maximum.
export const revalidate = 86400;

// Aucune fiche pré-générée au build : 4 000 lectures Firestore par build pour
// des pages que personne n'a encore demandées seraient du gaspillage. Elles
// sont générées à la demande puis mises en cache (dynamicParams par défaut).
export async function generateStaticParams(): Promise<{ identifiant: string }[]> {
  return [];
}

// Une seule lecture partagée entre generateMetadata et la page.
const chargerPetition = cache(async (identifiant: string) => getPetition(identifiant));

type Params = { params: Promise<{ identifiant: string }> };

// Les identifiants du CSV sont numériques et courts. Refuser le reste évite
// de solliciter Firestore pour des URL fantaisistes.
function identifiantValide(identifiant: string): boolean {
  return /^\d{1,8}$/.test(identifiant);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { identifiant } = await params;
  if (!identifiantValide(identifiant)) return { title: `Pétition introuvable — ${SITE_NAME}` };
  const p = await chargerPetition(identifiant);
  if (!p) return { title: `Pétition introuvable — ${SITE_NAME}` };

  const extrait = p.description.length > 150 ? `${p.description.slice(0, 150).trimEnd()}…` : p.description;
  const description =
    `${p.statutLabel} · ${formatSignatures(p.nbVotes)} soutiens · déposée le ` +
    `${formatFrDate(p.datePublication)}. ${extrait}`;

  return {
    title: `Pétition n°${p.identifiant} : ${p.titre}`,
    description,
    alternates: { canonical: `/petition/${p.identifiant}` },
    openGraph: {
      type: "article",
      locale: "fr_FR",
      url: `/petition/${p.identifiant}`,
      siteName: SITE_NAME,
      title: `Pétition n°${p.identifiant} : ${p.titre}`,
      description,
    },
  };
}

// Ce que les champs dérivés permettent d'affirmer — et rien de plus. Chaque
// formulation reprend celles de l'accueil : des faits vérifiables, jamais une
// cause supposée.
function constats(p: Petition): string[] {
  const faits: string[] = [];

  faits.push(`Motif de classement lu dans le texte de décision : ${MOTIF_LABELS[p.motifClassement].toLowerCase()}.`);

  if (p.seuilAtteint === null) {
    faits.push(
      `Le nombre de signatures n'est pas renseigné dans le fichier : impossible de dire si le seuil de ${SEUIL_SIGNATURES.toLocaleString("fr-FR")} signatures est atteint.`
    );
  } else if (p.seuilAtteint) {
    faits.push(
      `A dépassé le seuil de ${SEUIL_SIGNATURES.toLocaleString("fr-FR")} signatures, en dessous duquel une pétition est classée d'office sans examen.`
    );
  } else {
    faits.push(
      `N'a pas atteint le seuil de ${SEUIL_SIGNATURES.toLocaleString("fr-FR")} signatures, en dessous duquel une pétition est classée d'office sans examen.`
    );
  }

  if (p.recueilTermine) {
    faits.push(`Le recueil des signatures est terminé depuis le ${formatFrDate(p.dateLimiteVote)}.`);
  } else if (p.dateLimiteVote) {
    faits.push(`Le recueil des signatures court jusqu'au ${formatFrDate(p.dateLimiteVote)}.`);
  }

  if (p.clotureGroupee) {
    faits.push(
      "Le recueil s'est arrêté le même jour que des centaines d'autres pétitions, et non à une échéance qui lui soit propre. Nous constatons ce regroupement sans en affirmer la cause."
    );
  }

  return faits;
}

export default async function FichePetition({ params }: Params) {
  const { identifiant } = await params;
  if (!identifiantValide(identifiant)) notFound();

  const p = await chargerPetition(identifiant);
  if (!p) notFound();

  // La plupart des pétitions n'ont aucun passage en commission : l'absence de
  // document est le cas normal, et la fiche dégrade sans cette section.
  const passages = await getReunionsPetition(identifiant).catch(() => null);

  const annee = p.datePublication?.slice(0, 4) ?? null;
  const sansDecisionPubliee = p.statutSource === "classee" && p.motifClassement === "absent";
  // La décision que la commission a énoncée dans son compte rendu, quand elle y
  // nomme la pétition. Le plus souvent absente : c'est le cas normal.
  const decisionLue = passages?.derniereDecision ?? null;
  // Le rapport déposé au terme d'un examen. Très rare : une pétition sur les
  // 4 102 du fichier en a reçu un à ce jour.
  const rapport = passages?.rapport ?? null;

  const filAriane = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Les pétitions", item: `${SITE_URL}/petitions` },
      ...(annee
        ? [{ "@type": "ListItem", position: 3, name: `Déposées en ${annee}`, item: `${SITE_URL}/petitions/${annee}` }]
        : []),
      {
        "@type": "ListItem",
        position: annee ? 4 : 3,
        name: `Pétition n°${p.identifiant}`,
        item: `${SITE_URL}/petition/${p.identifiant}`,
      },
    ],
  };

  return (
    <article className={styles.article}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filAriane) }} />

      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {annee && (
            <>
              {" · "}
              <Link href={`/petitions/${annee}`}>déposées en {annee}</Link>
            </>
          )}
          {" · "}n°{p.identifiant}
        </p>
        <h1>{p.titre}</h1>
        <div className={styles.etat}>
          <span className={`${cartes.tag} ${sansDecisionPubliee ? cartes.tagNone : cartes.tagExamined}`}>
            {sansDecisionPubliee ? "Décision non publiée" : p.statutLabel}
          </span>
          <span>
            <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
          </span>
          <span>{p.commissionSource || "Commission non précisée"}</span>
          <span>déposée le {formatFrDate(p.datePublication)}</span>
        </div>
      </header>

      {/* Colonne de repères : le fichier officiel champ par champ. Placée
          avant le corps dans le document — sur écran étroit elle se lit donc
          juste après le titre, comme avant la mise en colonnes. */}
      <aside className={styles.rail}>
        <div className={styles.railInner}>
          <h2 className={styles.railTitre}>Le fichier officiel, champ par champ</h2>
          <dl className={styles.reperes}>
            <dt>Identifiant</dt>
            <dd className={styles.mono}>{p.identifiant}</dd>
            <dt>Statut brut</dt>
            <dd className={styles.mono}>{p.statutSource}</dd>
            <dt>Signatures</dt>
            <dd className={styles.mono}>{formatSignatures(p.nbVotes)}</dd>
            <dt>Date de dépôt</dt>
            <dd>{formatFrDate(p.datePublication)}</dd>
            <dt>Date limite de signature</dt>
            <dd>{formatFrDate(p.dateLimiteVote)}</dd>
            <dt>Commission</dt>
            <dd>{p.commissionSource ?? <span className={styles.champVide}>non renseignée</span>}</dd>
            <dt>Législature</dt>
            <dd>{p.legislature ?? <span className={styles.champVide}>non renseignée</span>}</dd>
          </dl>
          <a className={styles.railLien} href={p.url} target="_blank" rel="noopener noreferrer">
            Voir la pétition sur la plateforme de l&apos;Assemblée nationale →
          </a>
        </div>
      </aside>

      <div className={styles.corps}>
        <section className={styles.section}>
          <h2>La décision de la commission</h2>
          <p>
            Voici, mot pour mot, ce que le jeu de données ouvert de l&apos;Assemblée
            nationale consacre au sort de cette pétition. Rien n&apos;est reformulé, et
            un champ vide est affiché vide.
          </p>
          {p.decisionTexte ? (
            <blockquote className={styles.citation}>
              {p.decisionTexte}
              <span className={styles.citationSource}>
                Champ «&nbsp;décision de la commission&nbsp;», reproduit sans modification.
              </span>
            </blockquote>
          ) : (
            <p className={`${styles.citation} ${styles.citationVide}`}>
              Le champ prévu pour motiver la décision est resté entièrement vide.
              <span className={styles.citationSource}>
                Champ «&nbsp;décision de la commission&nbsp;» du fichier officiel.
              </span>
            </p>
          )}

          {decisionLue && (
            <>
              <h3>Ce que le compte rendu de la commission indique</h3>
              <p>
                Le fichier de données n&apos;est pas la seule trace publique. Le
                compte rendu de la réunion du {formatFrDate(decisionLue.date)},
                publié par l&apos;Assemblée nationale, énonce la décision en ces
                termes.
              </p>
              <blockquote className={styles.citation}>
                {decisionLue.citation}
                <span className={styles.citationSource}>
                  Compte rendu {decisionLue.compteRenduRef}, reproduit sans modification —{" "}
                  <a href={decisionLue.url} target="_blank" rel="noopener noreferrer">
                    lire le compte rendu intégral
                  </a>
                  .
                </span>
              </blockquote>
              {p.decisionTexte ? (
                <p className={styles.encadre}>
                  <strong>Les deux sources officielles ne disent pas la même chose.</strong>{" "}
                  Le fichier réutilisable et le compte rendu de la commission émanent tous deux
                  de l&apos;Assemblée nationale. Nous reproduisons les deux textes, chacun daté
                  et sourcé, et n&apos;en départageons aucun.
                </p>
              ) : (
                <p className={styles.encadre}>
                  <strong>La décision existe, le fichier n&apos;en dit rien.</strong>{" "}
                  La commission s&apos;est prononcée et l&apos;a écrit dans son compte rendu. Le
                  fichier que l&apos;Assemblée publie en données ouvertes, lui, laisse le champ
                  vide&nbsp;: qui s&apos;y fie ne peut pas savoir ce qui a été décidé.
                </p>
              )}
            </>
          )}

          {decisionLue?.sens === "examen" && !rapport && (
            <p className={styles.encadre}>
              <strong>
                Examen voté, rapport attendu depuis{" "}
                {formatDelaiMois(moisDepuis(decisionLue.date))}.
              </strong>{" "}
              La commission s&apos;est prononcée pour l&apos;examen de cette pétition, et un
              examen se conclut par un rapport. Aucun n&apos;a été déposé à ce jour. Le
              Règlement ne fixe aucun délai&nbsp;: nous comptons le temps écoulé, nous n&apos;en
              tirons aucune conclusion.
            </p>
          )}

          {rapport && (
            <>
              <h3>Le rapport de la commission</h3>
              <p>
                L&apos;examen s&apos;est conclu par un rapport, déposé le{" "}
                {formatFrDate(rapport.dateDepot)}
                {rapport.numero ? ` sous le numéro ${rapport.numero}` : ""}. C&apos;est la seule
                suite écrite, argumentée et signée qu&apos;une pétition puisse recevoir. Ni le
                fichier de données ouvertes, ni la page où cette pétition a été signée n&apos;y
                renvoient.
              </p>
              <blockquote className={styles.citation}>
                {rapport.titre}
                <span className={styles.citationSource}>
                  Intitulé officiel du document, reproduit sans modification —{" "}
                  <a href={rapport.url} target="_blank" rel="noopener noreferrer">
                    lire le rapport intégral
                  </a>
                  .
                </span>
              </blockquote>
            </>
          )}
        </section>

        <section className={styles.section}>
          <h2>Ce que nous constatons</h2>
          <ul>
            {constats(p).map((fait) => (
              <li key={fait.slice(0, 40)}>{fait}</li>
            ))}
          </ul>

          {sansDecisionPubliee && (
            <p className={styles.encadre}>
              <strong>Classée sans décision publiée.</strong>{" "}Le jeu de données officiel
              prévoit un champ pour motiver le classement d&apos;une pétition&nbsp;:
              pour celle-ci, il est resté vide.{" "}
              {decisionLue ? (
                <>
                  Le compte rendu de la commission, lui, énonce la décision&nbsp;: elle a
                  donc bien été prise, et rendue publique ailleurs que dans le fichier
                  réutilisable.
                </>
              ) : (
                <>
                  Nous constatons une absence, nous n&apos;en déduisons rien — nous
                  ignorons si une décision a été prise sans être rendue publique, ou si
                  aucune ne l&apos;a été.
                </>
              )}{" "}
              <Link href="/decisions-non-publiees">Voir toutes les pétitions concernées</Link>.
            </p>
          )}

          {p.ecartStatutDates && (
            <p className={styles.encadre}>
              <strong>Le fichier public n&apos;est pas à jour.</strong> Sa date limite de
              signature est passée, mais le fichier de données ouvertes conserve à
              cette pétition le statut <code>ouverte</code>. La plateforme officielle,
              elle, affiche bien la date limite&nbsp;: le défaut ne concerne que le
              fichier réutilisable.{" "}
              <Link href="/fichier-non-a-jour">Voir toutes les pétitions concernées</Link>.
            </p>
          )}
        </section>

        {passages && passages.reunions.length > 0 && (
          <section className={styles.section}>
            <h2>Ce que la commission a fait</h2>
            <p>
              Ces étapes ne sont pas des déductions de notre part&nbsp;: la commission a
              désigné cette pétition elle-même, par son numéro ou par son titre exact, à
              son ordre du jour ou dans le compte rendu de sa réunion. Chaque étape
              indique laquelle des trois, avec le texte officiel intégral.
            </p>
            <FriseReunions reunions={passages.reunions} />
          </section>
        )}

        <section className={styles.section}>
          <h2>Texte de la pétition</h2>
          <p className={styles.texteIntegral}>{p.description}</p>
          <p className={styles.provenance}>
            Texte republié sans modification depuis le{" "}
            <a
              href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale"
              target="_blank"
              rel="noopener noreferrer"
            >
              jeu de données ouvert des pétitions
            </a>{" "}
            (Licence Ouverte 2.0). La pétition reste consultable sur{" "}
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              la plateforme officielle de l&apos;Assemblée nationale
            </a>
            .
          </p>
        </section>

        <p className={styles.source}>
          Données extraites du fichier officiel de data.gouv.fr, calculées le{" "}
          {formatFrDate(p.calculeLe)}. Notre méthode, nos règles et leurs limites sont
          détaillées sur la page <Link href="/methodologie">méthodologie</Link>.
        </p>
      </div>
    </article>
  );
}
