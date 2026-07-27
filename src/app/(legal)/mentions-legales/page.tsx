import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LEGAL, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales — Suite à donner",
  description: `Éditeur, directeur de publication, hébergement et conditions d'utilisation de ${SITE_NAME}.`,
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegales() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className={styles.maj}>Dernière mise à jour : {LEGAL.derniereMaj}</p>

      <h2>1. Éditeur du site</h2>
      <dl className={styles.fiche}>
        <dt>Dénomination</dt>
        <dd>{LEGAL.denomination}</dd>
        <dt>Forme juridique</dt>
        <dd>{LEGAL.formeJuridique}</dd>
        <dt>SIREN</dt>
        <dd>{LEGAL.siren}</dd>
        <dt>SIRET (siège)</dt>
        <dd>{LEGAL.siret}</dd>
        <dt>Numéro de TVA</dt>
        <dd>{LEGAL.tva}</dd>
        <dt>Code NAF/APE</dt>
        <dd>{LEGAL.naf}</dd>
        <dt>Date de création</dt>
        <dd>{LEGAL.dateCreation}</dd>
        <dt>Siège social</dt>
        <dd>{LEGAL.adresse.join(", ")}</dd>
        <dt>Contact</dt>
        <dd>
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </dd>
      </dl>

      <h2>2. Directeur de la publication</h2>
      <p>
        Le directeur de la publication est <strong>{LEGAL.directeurPublication}</strong>,
        entrepreneur individuel exerçant sous le nom commercial {LEGAL.denomination}.
      </p>

      <h2>3. Hébergement</h2>
      <p>
        Le site est hébergé par <strong>Google LLC</strong> (Firebase App Hosting), 1600
        Amphitheatre Parkway, Mountain View, CA 94043, États-Unis.
      </p>
      <p>Services d&apos;infrastructure effectivement utilisés :</p>
      <ul>
        <li>
          <strong>Firebase App Hosting</strong> — exécution de l&apos;application, région{" "}
          <code>{LEGAL.regionApplication}</code>
        </li>
        <li>
          <strong>Cloud Firestore</strong> — base de données des pétitions, région{" "}
          <code>{LEGAL.regionBaseDonnees}</code>
        </li>
        <li>
          <strong>Algolia</strong> — moteur de recherche plein texte interrogé depuis le
          navigateur
        </li>
      </ul>
      <p>
        Le site n&apos;utilise ni service d&apos;authentification, ni stockage de fichiers, ni
        outil de mesure d&apos;audience.
      </p>

      <h2>4. Objet du site</h2>
      <p>
        {SITE_NAME}{" "}
        est un observatoire indépendant du sort réservé aux pétitions citoyennes
        déposées à l&apos;Assemblée nationale. Il est constitué à partir de données publiques et{" "}
        <strong>n&apos;est ni affilié à l&apos;Assemblée nationale, ni à aucune institution
        publique</strong>, ni à aucun parti politique ou organisation militante.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <h3>Contenus produits par l&apos;éditeur</h3>
      <p>
        La charte graphique, les logotypes, la structure du site, les textes de présentation et
        de méthode ainsi que le code source des traitements sont la propriété de{" "}
        {LEGAL.denomination}. Leur reproduction est soumise à autorisation préalable.
      </p>
      <h3>Données publiques republiées</h3>
      <p>
        Les données relatives aux pétitions et aux débats parlementaires proviennent de jeux de
        données publics diffusés sous <strong>Licence Ouverte 2.0 (Etalab)</strong>. Elles
        demeurent librement réutilisables aux conditions de cette licence, qui impose la mention
        de leur source et de leur date de mise à jour. La présente rubrique ne restreint en
        aucune manière ces droits.
      </p>
      <ul>
        <li>
          <a
            href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale"
            target="_blank"
            rel="noopener noreferrer"
          >
            Pétitions de l&apos;Assemblée nationale
          </a>{" "}
          — data.gouv.fr
        </li>
        <li>
          <a
            href="https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Comptes rendus des débats de l&apos;Assemblée nationale
          </a>{" "}
          — DILA
        </li>
      </ul>
      <p>
        Les propos tenus en séance publique et reproduits sur le site sont extraits du compte
        rendu intégral publié au Journal officiel.
      </p>

      <h2>6. Exactitude et limites</h2>
      <p>
        Le site restitue des données ouvertes sans en modifier le contenu. Il peut néanmoins
        comporter des inexactitudes, notamment lorsque les données source elles-mêmes sont
        incomplètes ou non mises à jour — cas que le site signale explicitement lorsqu&apos;il
        le détecte.
      </p>
      <p>
        Les rapprochements entre une pétition et les débats parlementaires sont des{" "}
        <strong>recoupements thématiques établis par mots-clés</strong>, jamais des liens
        officiels confirmés : il n&apos;existe aucun identifiant commun entre ces deux
        ensembles de données. Ces rapprochements ne sauraient être interprétés comme
        établissant une relation de cause à effet.
      </p>
      <p>
        {LEGAL.denomination}{" "}
        ne peut être tenu responsable des dommages résultant de
        l&apos;interprétation ou de l&apos;utilisation des informations publiées. Toute erreur
        constatée peut être signalée à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> ; elle
        sera corrigée ou documentée.
      </p>

      <h2>7. Données personnelles et cookies</h2>
      <p>
        Le site ne requiert aucune inscription, ne comporte aucun formulaire et{" "}
        <strong>ne dépose aucun cookie</strong>. Le détail des traitements figure dans la{" "}
        <Link href="/politique-de-confidentialite">politique de confidentialité</Link> et la{" "}
        <Link href="/politique-cookies">politique de cookies</Link>.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Tout litige relatif à l&apos;utilisation de <code>{SITE_URL.replace("https://", "")}</code>{" "}
        est soumis au droit français. À défaut de règlement amiable et dans les cas où la loi le
        permet, compétence exclusive est attribuée aux tribunaux de {LEGAL.juridiction}.
      </p>
    </>
  );
}
