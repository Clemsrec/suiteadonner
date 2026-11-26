import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import styles from "../../donnees.module.css";
import cartes from "@/app/page.module.css";
import { FriseReunions } from "@/app/FriseReunions";
import { FicheAbsente } from "./FicheAbsente";
import {
  MOTIF_LABELS,
  SEUIL_SIGNATURES,
  formatDelaiMois,
  formatFrDate,
  formatSignatures,
  getEchantillonFiches,
  getPetition,
  getReleveAbsentes,
  etatPetition,
  getReunionsPetition,
  moisDepuis,
  type EtatPetition,
  type Petition,
} from "@/lib/petitions";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { nombre } from "@/lib/nombre";

// Les données source ne changent qu'une fois par semaine (republication du
// lundi) : chaque fiche est générée à la première visite puis servie depuis le
// cache, et régénérée au plus une fois par jour. Le trafic n'a ainsi aucun
// effet sur Firestore — deux lectures par fiche et par jour au maximum.
export const revalidate = 86400;

// Les 4 000 fiches sont générées à la demande puis mises en cache
// (dynamicParams par défaut) : les pré-générer toutes coûterait 4 000 lectures
// Firestore par build. Un échantillon l'est pourtant, pour que verifier:textes,
// qui ne lit que le rendu du build, lise aussi les phrases des fiches. Il n'en
// avait jamais lu une : « A atteint le seuil de 5 000 signatures » (n° 4023)
// ne pouvait pas y être vu. Voir getEchantillonFiches().
export async function generateStaticParams(): Promise<{ identifiant: string }[]> {
  const identifiants = await getEchantillonFiches();
  return identifiants.map((identifiant) => ({ identifiant }));
}

// Une seule lecture partagée entre generateMetadata et la page.
const chargerPetition = cache(async (identifiant: string) => getPetition(identifiant));

// Repli pour un numéro que le fichier ignore mais que la plateforme publie
// (relevé de scripts/relever-absentes.mjs). Lu seulement quand le fichier ne
// connaît pas le numéro : les fiches ordinaires n'en paient pas la lecture.
const chargerAbsente = cache(async (identifiant: string) => {
  const releve = await getReleveAbsentes().catch(() => null);
  const p = releve?.petitions.find((a) => a.identifiant === identifiant);
  return releve && p ? { p, releveLe: releve.releveLe } : null;
});

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
  if (!p) {
    const absente = await chargerAbsente(identifiant);
    if (!absente) return { title: `Pétition introuvable — ${SITE_NAME}` };
    return {
      title: `Pétition n°${identifiant} : ${absente.p.titre}`,
      description: `Publiée sur la plateforme de l'Assemblée nationale, absente du fichier de données ouvertes · ${formatSignatures(absente.p.nbVotes)} soutiens au relevé du ${formatFrDate(absente.releveLe)}.`,
      alternates: { canonical: `/petition/${identifiant}` },
      robots: { index: false, follow: true },
    };
  }

  const extrait = p.description.length > 150 ? `${p.description.slice(0, 150).trimEnd()}…` : p.description;
  const statut = p.absenteDuFichierDepuis
    ? `Absente du fichier officiel lu le ${formatFrDate(p.absenteDuFichierDepuis)}`
    : p.statutLabel;
  const description =
    `${statut} · ${formatSignatures(p.nbVotes)} soutiens · déposée le ` +
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
function constats(p: Petition, etat: EtatPetition): string[] {
  const faits: string[] = [];

  // Le motif n'est « lu dans le texte » que lorsqu'un texte existe. Sans lui,
  // la ligne annonçait une lecture qui n'avait pas eu lieu — et un « motif de
  // classement » à des pétitions encore ouvertes.
  if (p.decisionTexte) {
    faits.push(`Motif lu dans le texte de décision : ${MOTIF_LABELS[p.motifClassement].toLowerCase()}.`);
  } else if (p.motifClassement === "absent") {
    // Borné au fichier : sur la même fiche, un compte rendu peut publier la
    // décision que ce champ ne porte pas.
    faits.push("Le champ de décision du fichier est vide : le fichier ne donne pas de motif.");
  }

  // Le seuil opposé à une pétition dépend de sa commission, et n'est connu que
  // si son texte de décision l'énonce. Il porte sur un délai que le nombre de
  // signatures du fichier ne couvre pas : on le cite sans l'y comparer. À
  // défaut de seuil, on s'en tient au fait brut, le nombre comparé à 10 000.
  if (etat.seuil) {
    const delai = etat.seuil.sixMois ? " dans un délai de six mois après le dépôt" : "";
    faits.push(
      `Son texte de décision énonce un seuil de ${nombre(etat.seuil.signatures)} signatures${delai}.`
    );
    const lecture = etat.horsFichier ? `à la lecture du ${formatFrDate(p.calculeLe)}` : "au dernier import";
    faits.push(
      p.nbVotes === null
        ? "Le nombre de signatures n'est pas renseigné dans le fichier."
        : `Le fichier lui en compte ${nombre(p.nbVotes)} ${lecture}${etat.seuil.sixMois ? ", sans dire combien elle en avait au terme de ce délai" : ""}.`
    );
  } else if (p.seuilAtteint === null) {
    faits.push(
      "Le nombre de signatures n'est pas renseigné dans le fichier : impossible de le comparer à un seuil."
    );
  } else {
    faits.push(
      `${p.seuilAtteint ? "A dépassé" : "N'a pas dépassé"} ${nombre(SEUIL_SIGNATURES)} signatures. Le seuil de classement d'office varie selon la commission, et le fichier ne l'énonce pas pour cette pétition.`
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

// La réponse en une phrase, en tête de fiche, pour qui arrive d'un lien et ne
// lira pas plus loin. Elle ne dit que ce que les sections suivantes établissent,
// dans le même ordre de priorité : la sortie du fichier, puis ce qu'une
// commission a écrit (rapport, compte rendu), puis ce que dit le fichier.
function ouEnEst(p: Petition, etat: EtatPetition): { titre: string; texte: string } {
  const { decisionLue, rapport } = etat;
  if (etat.horsFichier) {
    return {
      titre: "Elle ne figure plus dans le fichier officiel",
      texte: `Notre lecture du ${formatFrDate(etat.horsFichier.constateLe)} ne l'y a pas trouvée. Les informations ci-dessous sont celles de la dernière lecture qui la contenait.`,
    };
  }
  if (rapport) {
    return {
      titre: "Examinée, avec un rapport publié",
      texte: `La commission l'a examinée et un rapport a été déposé le ${formatFrDate(rapport.dateDepot)}.`,
    };
  }
  if (decisionLue?.sens === "examen") {
    return {
      titre: "La commission a voté son examen",
      texte: etat.attenteMesurable
        ? `Vote du ${formatFrDate(decisionLue.date)}. Nous n'avons pas trouvé de rapport depuis.`
        : `Vote du ${formatFrDate(decisionLue.date)}, alors que la signature est encore ouverte.`,
    };
  }
  if (decisionLue?.sens === "classement") {
    return {
      titre: "Classée par la commission",
      texte:
        `D'après le compte rendu de sa réunion du ${formatFrDate(decisionLue.date)}.` +
        (etat.decisionAuFichier === "absente" ? " Le fichier officiel, lui, ne l'indique pas." : ""),
    };
  }
  if (p.ecartStatutDates) {
    return {
      titre: "Date limite passée, décision non indiquée",
      texte: `La signature s'est terminée le ${formatFrDate(p.dateLimiteVote)}, mais le fichier officiel la marque encore « ouverte », sans décision.`,
    };
  }
  if (etat.recueil === "en-cours") {
    return {
      titre: "Ouverte à la signature",
      texte: `Vous pouvez la signer jusqu'au ${formatFrDate(p.dateLimiteVote)} sur la plateforme de l'Assemblée nationale.`,
    };
  }
  if (p.motifClassement === "seuil") {
    return {
      titre: "Classée d'office",
      texte: "Le texte de la décision invoque le nombre de signatures demandé par la commission.",
    };
  }
  if (p.motifClassement === "constat") {
    return {
      titre: "Classée",
      texte: "Le texte de la décision constate le classement sans en donner la raison.",
    };
  }
  if (etat.classeeSansMotif) {
    return {
      titre: "Classée, sans explication",
      texte: "Le fichier officiel prévoit une case pour expliquer la décision, et elle est restée vide.",
    };
  }
  if (etat.recueil === "clos") {
    return {
      titre: "Signature terminée, décision non indiquée",
      texte: `La signature s'est terminée le ${formatFrDate(p.dateLimiteVote)}. Le fichier officiel n'indique pas de décision.`,
    };
  }
  return {
    titre: p.statutLabel,
    texte: "Le fichier officiel ne donne pas de date limite de signature pour cette pétition.",
  };
}

export default async function FichePetition({ params }: Params) {
  const { identifiant } = await params;
  if (!identifiantValide(identifiant)) notFound();

  const p = await chargerPetition(identifiant);
  if (!p) {
    const absente = await chargerAbsente(identifiant);
    if (!absente) notFound();
    const passagesAbsente = await getReunionsPetition(identifiant).catch(() => null);
    return <FicheAbsente p={absente.p} releveLe={absente.releveLe} passages={passagesAbsente} />;
  }

  // La plupart des pétitions n'ont aucun passage en commission : l'absence de
  // document est le cas normal, et la fiche dégrade sans cette section.
  const passages = await getReunionsPetition(identifiant).catch(() => null);

  const annee = p.datePublication?.slice(0, 4) ?? null;
  // Un seul endroit qualifie l'état d'une pétition, en voyant tous ses champs :
  // la fiche n'écrit plus ses propres conditions. Voir etatPetition().
  // Le fichier des pétitions passe en dernier : le document `reunions` recopie
  // texte de décision et date limite au jour de sa collecte, et ne doit pas
  // contredire ce que le reste de la fiche affiche depuis l'import plus récent.
  const etat = etatPetition({ ...passages, ...p });
  const { decisionLue, rapport } = etat;
  const reponse = ouEnEst(p, etat);

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
          <span
            className={`${cartes.tag} ${etat.horsFichier || etat.classeeSansMotif ? cartes.tagNone : cartes.tagExamined}`}
          >
            {etat.horsFichier
              ? "Absente du fichier officiel"
              : etat.classeeSansMotif
                ? "Décision non publiée"
                : p.statutLabel}
          </span>
          <span>
            <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
          </span>
          <span>{p.commissionSource || "Commission non précisée"}</span>
          <span>déposée le {formatFrDate(p.datePublication)}</span>
        </div>
        <section className={styles.reponse} aria-labelledby="ou-en-est">
          <h2 id="ou-en-est" className={styles.reponseQuestion}>Où en est-elle&nbsp;?</h2>
          <p className={styles.reponseTitre}>{reponse.titre}</p>
          <p className={styles.reponseTexte}>{reponse.texte}</p>
        </section>
      </header>


      <div className={styles.corps}>
        {etat.horsFichier && (
          <p className={styles.encadre}>
            <strong>Cette pétition ne figure plus dans le fichier officiel.</strong>{" "}
            Notre import du {formatFrDate(etat.horsFichier.constateLe)} ne l&apos;y a pas
            trouvée. Les champs du fichier affichés sur cette page sont ceux de notre
            lecture du {formatFrDate(etat.horsFichier.derniereLecture)}, la dernière qui la
            contenait. Nous ne savons pas pourquoi elle en est sortie, ni si elle reste
            consultable sur la plateforme de l&apos;Assemblée nationale.
          </p>
        )}

        <section className={styles.section}>
          <h2>La décision de la commission</h2>
          <p>
            Voici, mot pour mot, ce que le fichier officiel de l&apos;Assemblée nationale
            écrit sur la décision. Une case vide est montrée vide.
          </p>
          {etat.decisionAuFichier === "publiee" ? (
            <blockquote className={styles.citation}>
              {p.decisionTexte}
              <span className={styles.citationSource}>
                Champ «&nbsp;décision de la commission&nbsp;», reproduit intégralement
                (seules les apostrophes et les espaces en trop sont uniformisées).
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
                  Compte rendu {decisionLue.compteRenduRef}, phrase reproduite intégralement —{" "}
                  <a href={decisionLue.url} target="_blank" rel="noopener noreferrer">
                    lire le compte rendu intégral
                  </a>
                  .
                </span>
              </blockquote>
              {etat.deuxTextesOfficiels ? (
                <p className={styles.encadre}>
                  <strong>Deux textes officiels portent sur cette pétition.</strong>{" "}
                  Le fichier réutilisable et le compte rendu de la commission émanent tous deux
                  de l&apos;Assemblée nationale. Nous les reproduisons, chacun daté et sourcé,
                  sans les comparer ni en départager aucun.
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

          {etat.examenSansRapport && decisionLue && (
            <p className={styles.encadre}>
              {etat.attenteMesurable ? (
                <>
                  <strong>
                    Examen voté, aucun rapport trouvé depuis{" "}
                    {formatDelaiMois(moisDepuis(decisionLue.date))}.
                  </strong>{" "}
                  La commission s&apos;est prononcée pour l&apos;examen de cette pétition. Les
                  rapports que nous avons trouvés pour d&apos;autres pétitions s&apos;intitulent
                  eux-mêmes «&nbsp;en conclusion des travaux&nbsp;» sur la pétition
                  concernée&nbsp;; pour celle-ci, nous n&apos;en avons trouvé aucun. Nous
                  comptons le temps écoulé depuis ce vote&nbsp;; nous n&apos;en tirons aucune
                  conclusion, et nous ignorons quel délai s&apos;applique.
                </>
              ) : (
                <>
                  <strong>Examen voté, recueil toujours en cours.</strong>{" "}
                  La commission s&apos;est prononcée pour l&apos;examen de cette pétition le{" "}
                  {formatFrDate(decisionLue.date)}, alors que le fichier lui donne une date
                  limite de signature au {formatFrDate(p.dateLimiteVote)}. Nous n&apos;avons
                  pas trouvé de rapport dans les corpus que nous lisons, et nous ne comptons
                  pas de délai&nbsp;: une pétition encore ouverte à la signature n&apos;est pas
                  une pétition en attente.
                </>
              )}
            </p>
          )}

          {rapport && (
            <>
              <h3>Le rapport de la commission</h3>
              <p>
                L&apos;examen s&apos;est conclu par un rapport, déposé le{" "}
                {formatFrDate(rapport.dateDepot)}
                {rapport.numero ? ` sous le numéro ${rapport.numero}` : ""}. Ni le fichier de
                données ouvertes, ni la page où cette pétition a été signée n&apos;y renvoient.
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
            {constats(p, etat).map((fait) => (
              <li key={fait.slice(0, 40)}>{fait}</li>
            ))}
          </ul>

          {etat.classeeSansMotif && (
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
              désigné cette pétition elle-même, par son numéro ou par son titre, à son
              ordre du jour ou dans le compte rendu de sa réunion. Chaque étape
              indique laquelle des trois, avec le texte officiel intégral.
            </p>
            <FriseReunions reunions={passages.reunions} />
          </section>
        )}

        <section className={styles.section}>
          <h2>Texte de la pétition</h2>
          <p className={styles.texteIntegral} data-texte-tiers>
            {p.description}
          </p>
          <p className={styles.provenance}>
            Texte republié intégralement depuis le{" "}
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

      {/* Colonne de repères : le fichier officiel champ par champ. Placée
          après le corps dans le document : sur téléphone, on lit d'abord où en
          est la pétition, puis les données brutes. Sur grand écran, la grille
          la place à droite du corps. */}
      <aside className={styles.rail}>
        <div className={styles.railInner}>
          <h2 className={styles.railTitre}>Les données du fichier officiel</h2>
          <dl className={styles.reperes}>
            <dt>Numéro</dt>
            <dd className={styles.mono}>{p.identifiant}</dd>
            <dt>Statut dans le fichier</dt>
            <dd className={styles.mono}>{p.statutSource}</dd>
            <dt>Signatures</dt>
            <dd className={styles.mono}>{formatSignatures(p.nbVotes)}</dd>
            <dt>Date de dépôt</dt>
            <dd>{formatFrDate(p.datePublication)}</dd>
            <dt>Fin de la signature</dt>
            <dd>{formatFrDate(p.dateLimiteVote)}</dd>
            <dt>Commission</dt>
            <dd>{p.commissionSource ?? <span className={styles.champVide}>non renseignée</span>}</dd>
            <dt>Législature (mandat)</dt>
            <dd>{p.legislature ?? <span className={styles.champVide}>non renseignée</span>}</dd>
          </dl>
          <a className={styles.railLien} href={p.url} target="_blank" rel="noopener noreferrer">
            Voir la pétition sur la plateforme de l&apos;Assemblée nationale →
          </a>
        </div>
      </aside>
    </article>
  );
}
