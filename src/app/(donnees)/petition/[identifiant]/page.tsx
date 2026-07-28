import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import styles from "../../donnees.module.css";
import cartes from "@/app/page.module.css";
import {
  MOTIF_LABELS,
  SEUIL_SIGNATURES,
  acteCommission,
  formatFrDate,
  formatSignatures,
  getPetition,
  getReunionsPetition,
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
    <article>
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

      <section className={styles.section}>
        <h2>Ce que dit le fichier officiel</h2>
        <p>
          Champs relevés tels quels dans le jeu de données ouvert de l&apos;Assemblée
          nationale, sans réinterprétation. Un champ vide est affiché vide.
        </p>
        <dl className={styles.fiche}>
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
          <dt>Décision de la commission</dt>
          <dd>
            {p.decisionTexte ?? (
              <span className={styles.champVide}>champ laissé entièrement vide</span>
            )}
          </dd>
        </dl>
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
            pour celle-ci, il est resté vide. Nous constatons une absence, nous
            n&apos;en déduisons rien — nous ignorons si une décision a été prise sans
            être rendue publique, ou si aucune ne l&apos;a été.{" "}
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
            inscrit cette pétition à son ordre du jour en la désignant elle-même, par
            son numéro ou par son titre exact. Chaque étape indique laquelle des deux,
            avec le texte officiel intégral.
          </p>
          <ol className={cartes.frise}>
            {passages.reunions.map((r) => (
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
    </article>
  );
}
