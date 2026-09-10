"use client";

import { Fragment } from "react";
import {
  MIN_SAMPLE_EVENTS,
  aggregateEvents,
  diagnose,
  formatForDisplay,
  toEquivalents,
  type CoverageReason,
  type CoverageStatus,
} from "carbone-cost";
import styles from "../donnees.module.css";
import propre from "./empreinte-page.module.css";
import {
  HEBERGEMENT,
  formatEquivalent,
  formatGrammes,
  formatOctets,
  nommerOrigine,
  octetsTotal,
} from "@/lib/empreinte";
import { useEmpreinte } from "../../useEmpreinte";

// Le relevé n'existe que dans le navigateur : cette partie de la page est donc
// la seule à ne pas être rendue côté serveur. Elle n'affiche rien tant qu'elle
// n'a pas mesuré, plutôt que d'afficher des zéros.

const LIBELLE_STATUT: Record<CoverageStatus, string> = {
  covered: "mesuré",
  partial: "partiellement mesuré",
  missing: "non mesuré",
  unknown: "inconnu",
  "not-applicable": "sans objet",
};

// La traduction part de `reason`, code stable prévu pour cet usage, et jamais
// de `notes` — que la bibliothèque documente comme de la prose anglaise
// destinée à l'intégrateur, pas au visiteur.
const LIBELLE_RAISON: Record<CoverageReason, string> = {
  "sufficient-samples": "Assez de relevés pour conclure.",
  "no-events": "Aucun relevé de ce type n'a pu être fait.",
  "not-expected": "Il n'y a rien de tel sur ce site : rien à mesurer.",
  "below-sample-threshold": `Moins de ${MIN_SAMPLE_EVENTS} pages relevées — le diagnostic refuse de conclure sur un échantillon aussi mince.`,
  "incomplete-fields": "Une partie des relevés n'a pas les informations nécessaires au calcul.",
  "unmeasured-requests":
    "Des requêtes n'ont pas pu être mesurées : le total affiché est un plancher.",
  "config-complete": "L'hébergement est entièrement déclaré.",
  "config-incomplete": "L'hébergement n'est déclaré qu'en partie.",
  "config-missing": "Aucune information d'hébergement n'est déclarée.",
  "covered-by-model": "Ce poste est inclus dans le modèle de calcul.",
};

// Ce que chaque dimension recouvre sur CE site. La phrase de verdict, elle,
// vient de `reason` ci-dessus : on ne réécrit jamais à la main ce que le
// diagnostic a conclu, sous peine de le contredire à la prochaine version.
const DIMENSIONS = [
  {
    cle: "webPageviews",
    titre: "Les pages que vous avez consultées",
    texte:
      "Chaque fichier reçu du site — page, feuille de style, script — est compté à sa taille réelle de transfert.",
  },
  {
    cle: "webApiCalls",
    titre: "Les appels aux services de données",
    texte:
      "Les données de pétitions sont lues par le serveur dans Cloud Firestore, sans appel depuis votre navigateur ; la recherche, elle, interroge Algolia depuis votre navigateur, la recherche d'Algolia. Ces services ne transmettent pas la taille de leurs réponses à votre navigateur : nous ne pouvons pas les compter, et nous ne les estimons pas.",
  },
  {
    cle: "aiInference",
    titre: "Les traitements d'intelligence artificielle",
    texte:
      "Le site n'appelle aucun modèle d'IA, ni à l'affichage ni à la préparation des données.",
  },
  {
    cle: "hostingInfo",
    titre: "L'hébergement",
    texte: `Application hébergée en ${HEBERGEMENT.region}, chez un fournisseur qui déclare s'alimenter en énergie renouvelable. Le calcul en tient compte sur la foi de cette déclaration, et uniquement sur le fonctionnement du centre de données.`,
  },
  {
    cle: "clientDevice",
    titre: "Votre appareil",
    texte:
      "L'électricité de votre écran et de votre processeur pendant la lecture est comptée — c'est même le poste le plus lourd du calcul. Mais c'est un appareil moyen mondial, pas le vôtre.",
  },
] as const;

export default function DetailEmpreinte() {
  const { events, session, unknownRequests, unknownOrigins, mesure } = useEmpreinte();

  if (!mesure) {
    return (
      <section className={styles.section}>
        <h2>Votre consultation</h2>
        <p>
          La mesure se fait dans votre navigateur. Si rien ne s&apos;affiche ici,
          c&apos;est que votre navigateur ne donne pas accès aux tailles de transfert, ou
          que JavaScript est désactivé — le reste de cette page reste exact.
        </p>
      </section>
    );
  }

  const parRoute = aggregateEvents(events, { groupBy: "route" });
  const octets = octetsTotal(events);
  const enCache = events.reduce((somme, e) => somme + (e.input.cachedRequests ?? 0), 0);
  const affichage = formatForDisplay(events[events.length - 1].result);
  const mille = toEquivalents(affichage.gramsPerThousandViews);

  const couverture = diagnose(
    {
      expectsApiTracking: true,
      expectsAiTracking: false,
      hostingProvider: HEBERGEMENT.fournisseur,
      region: HEBERGEMENT.region,
      greenHosting: HEBERGEMENT.vert,
    },
    events,
  );

  return (
    <>
      <section className={styles.section}>
        <h2>Votre consultation, depuis l&apos;ouverture de cet onglet</h2>

        <div className={propre.chiffres}>
          <div className={propre.chiffre}>
            <div className={propre.n}>{formatGrammes(session.totalGrams)}</div>
            <div className={propre.l}>
              CO<sub>2</sub>e au total
            </div>
          </div>
          <div className={propre.chiffre}>
            <div className={propre.n}>{formatOctets(octets)}</div>
            <div className={propre.l}>reçus par votre navigateur</div>
          </div>
          <div className={propre.chiffre}>
            <div className={propre.n}>{session.totalViews.toLocaleString("fr-FR")}</div>
            <div className={propre.l}>
              {session.totalViews > 1 ? "pages affichées" : "page affichée"}
            </div>
          </div>
        </div>

        <table className={propre.table}>
          <caption className={propre.legende}>
            Détail par page, cumulé sur tous vos affichages de cette page. Revenir sur une
            page déjà vue ne coûte presque rien : votre navigateur en garde
            l&apos;essentiel en cache, et seules les données propres à la page sont
            retéléchargées.
          </caption>
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Affichages</th>
              <th scope="col">
                CO<sub>2</sub>e
              </th>
            </tr>
          </thead>
          <tbody>
            {parRoute.buckets.map((bloc) => (
              <tr key={bloc.key}>
                <td>
                  <code>{bloc.key}</code>
                </td>
                <td>{bloc.events.toLocaleString("fr-FR")}</td>
                <td>{formatGrammes(bloc.gramsCO2e)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {enCache > 0 && (
          <p>
            {enCache.toLocaleString("fr-FR")}{" "}
            {enCache > 1
              ? "fichiers vous ont été servis par le cache"
              : "fichier vous a été servi par le cache"}{" "}
            de votre navigateur plutôt que par le réseau. Ils pèsent quand même quelques
            octets dans le total ci-dessus&nbsp;: Chrome facture forfaitairement environ
            300 octets par fichier mis en cache, là où d&apos;autres navigateurs comptent
            zéro. Nous laissons cet écart visible plutôt que de le corriger par une
            soustraction inventée qui deviendrait fausse le jour où Chrome changera
            d&apos;avis.
          </p>
        )}

        {unknownRequests > 0 && (
          <p>
            <strong>
              {unknownRequests.toLocaleString("fr-FR")}{" "}
              {unknownRequests > 1
                ? "requêtes ne sont pas comptées"
                : "requête n'est pas comptée"}
            </strong>{" "}
            dans ce total
            {unknownOrigins.length > 0 && (
              <> — {unknownOrigins.map(nommerOrigine).join(", ")}</>
            )}
            . Votre navigateur nous en masque la taille pour des raisons de sécurité, comme
            il le fait pour tout service extérieur au site. Le chiffre ci-dessus est donc
            un minimum, jamais un total.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Ce que cela représenterait à mille lectures</h2>
        <p>
          Un gramme n&apos;évoque rien à personne. Voici donc à quoi correspondrait la
          dernière page affichée si mille personnes la consultaient — une projection à
          partir de la mesure ci-dessus, pas une observation. Les facteurs de conversion
          sont des ordres de grandeur courants, indiqués pour la sensibilisation et non
          pour un bilan carbone.
        </p>
        <ul className={propre.equivalents}>
          <li>
            <span className={propre.eqN}>{formatGrammes(affichage.gramsPerThousandViews)}</span> de
            CO<sub>2</sub>e
          </li>
          <li>
            <span className={propre.eqN}>{formatEquivalent(mille.trainKm)}&nbsp;km</span> en train
          </li>
          <li>
            <span className={propre.eqN}>{formatEquivalent(mille.carKm)}&nbsp;km</span> en voiture
          </li>
          <li>
            <span className={propre.eqN}>{formatEquivalent(mille.phoneCharges)}</span> charge
            {mille.phoneCharges > 1 ? "s" : ""} de téléphone
          </li>
          <li>
            <span className={propre.eqN}>{formatEquivalent(mille.ledBulbHours)}&nbsp;h</span>{" "}
            d&apos;une ampoule LED
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Ce que cette mesure couvre, et ce qu&apos;elle ne couvre pas</h2>
        <p>
          Le tableau ci-dessous est produit par le diagnostic de couverture de la
          bibliothèque de calcul. Il ne dit pas que le chiffre est bon : il dit sur quoi
          il porte. La phrase en italique est son verdict, traduit&nbsp;; nous ne le
          réécrivons pas.
        </p>
        {/* Fragment et non <div> : .fiche est une grille à deux colonnes dont
            dt et dd doivent rester les enfants directs. */}
        <dl className={styles.fiche}>
          {DIMENSIONS.map(({ cle, titre, texte }) => (
            <Fragment key={cle}>
              <dt>
                {titre}
                <span className={propre.statut} data-statut={couverture[cle].status}>
                  {LIBELLE_STATUT[couverture[cle].status]}
                </span>
              </dt>
              <dd>
                {texte}{" "}
                <em className={propre.verdict}>{LIBELLE_RAISON[couverture[cle].reason]}</em>
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>
    </>
  );
}
