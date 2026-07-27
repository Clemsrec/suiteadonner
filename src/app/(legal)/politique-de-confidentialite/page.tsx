import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LEGAL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Suite à donner",
  description: `Quelles données ${SITE_NAME} traite, pourquoi, où elles sont hébergées et comment exercer vos droits.`,
  alternates: { canonical: "/politique-de-confidentialite" },
};

export default function PolitiqueConfidentialite() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className={styles.maj}>Dernière mise à jour : {LEGAL.derniereMaj}</p>

      <div className={styles.encadre}>
        <p>
          <strong>En résumé :</strong>{" "}
          ce site ne vous demande rien. Pas de compte, pas de
          formulaire, pas de profilage. Une seule exception : une mesure d&apos;audience
          (Google Analytics), activée uniquement si vous l&apos;acceptez via la bannière de
          consentement. Sans acceptation de votre part, les seules données vous concernant
          qui transitent sont celles que tout serveur web reçoit nécessairement pour vous
          répondre.
        </p>
      </div>

      <h2>1. Responsable du traitement</h2>
      <p>
        {LEGAL.denomination}, {LEGAL.formeJuridique.toLowerCase()}, {LEGAL.adresse.join(", ")}.
        Contact : <a href={`mailto:${LEGAL.emailDonnees}`}>{LEGAL.emailDonnees}</a>.
      </p>
      <p>
        Compte tenu de la nature et du volume des traitements, {LEGAL.denomination}{" "}
        n&apos;est pas tenu de désigner un délégué à la protection des données. Les demandes sont traitées
        directement par le responsable du traitement à l&apos;adresse ci-dessus.
      </p>

      <h2>2. Ce que le site ne fait pas</h2>
      <ul>
        <li>Aucune création de compte, aucune authentification</li>
        <li>Aucun formulaire de contact, d&apos;inscription ou de commentaire</li>
        <li>Aucun cookie ni traceur sans votre consentement explicite et révocable</li>
        <li>Aucun pixel publicitaire, aucun réseau publicitaire</li>
        <li>Aucun profilage, aucune décision automatisée vous concernant</li>
        <li>Aucune revente ni transmission commerciale de données</li>
      </ul>

      <h2>3. Données effectivement traitées</h2>

      <h3>Journaux techniques du serveur</h3>
      <p>
        Comme tout service web, l&apos;infrastructure d&apos;hébergement enregistre pour chaque
        requête l&apos;adresse IP, la date et l&apos;heure, la page demandée, le code de réponse
        et le type de navigateur.
      </p>
      <ul>
        <li>
          <strong>Finalité :</strong>{" "}
          fonctionnement du service, sécurité, diagnostic d&apos;incident
        </li>
        <li>
          <strong>Base légale :</strong> intérêt légitime (article 6.1.f du RGPD) à maintenir un
          service disponible et sécurisé
        </li>
        <li>
          <strong>Sous-traitant :</strong> Google (Firebase App Hosting), région{" "}
          <code>{LEGAL.regionApplication}</code>
        </li>
        <li>
          <strong>Conservation :</strong>{" "}
          selon la politique de rétention de Google Cloud
          Platform ; ces journaux ne sont ni exploités, ni recoupés, ni exportés par
          l&apos;éditeur
        </li>
      </ul>

      <h3>Requêtes de recherche</h3>
      <p>
        Lorsque vous utilisez le champ de recherche, votre requête est envoyée depuis votre
        navigateur au service <strong>Algolia</strong>, qui renvoie les résultats. Aucun
        identifiant de session, aucun cookie et aucune donnée de compte n&apos;est associé à
        cette requête, l&apos;éditeur ne la conserve pas et ne peut pas la relier à un visiteur.
      </p>

      <h3>Mesure d&apos;audience — uniquement après consentement</h3>
      <p>
        Si vous acceptez la bannière de consentement, l&apos;outil{" "}
        <strong>Google Analytics 4</strong>{" "}
        collecte les pages consultées, le type
        d&apos;appareil et de navigateur, et une localisation géographique approximative,
        associés à un identifiant aléatoire propre à votre navigateur.
      </p>
      <ul>
        <li>
          <strong>Finalité :</strong> statistiques de fréquentation du site — volumes de
          visites, pages lues, provenance
        </li>
        <li>
          <strong>Base légale :</strong> votre consentement (article 6.1.a du RGPD),
          librement retirable à tout moment depuis la{" "}
          <Link href="/politique-cookies">politique de cookies</Link>
        </li>
        <li>
          <strong>Sous-traitant :</strong> Google Ireland Limited (Google Analytics)
        </li>
        <li>
          <strong>Conservation :</strong> cookies limités à 13 mois dans votre navigateur ;
          données de mesure conservées au plus 14 mois dans Google Analytics
        </li>
      </ul>
      <p>
        Sans consentement, rien de tout cela n&apos;existe : le script n&apos;est même pas
        chargé, et aucune requête ne part vers Google Analytics.
      </p>

      <h2>4. Localisation et transferts hors Union européenne</h2>
      <p>
        L&apos;application est exécutée dans la région <code>{LEGAL.regionApplication}</code>. La
        base de données qui contient les pétitions est en revanche située en{" "}
        <code>{LEGAL.regionBaseDonnees}</code>. Cette base{" "}
        <strong>ne contient aucune donnée relative aux visiteurs</strong>{" "}
      : elle ne stocke que
        des données publiques issues de l&apos;open data.
      </p>
      <p>
        Les transferts éventuels vers les États-Unis dans le cadre des services Google sont
        encadrés par les clauses contractuelles types de la Commission européenne et par le
        cadre de protection des données UE–États-Unis.
      </p>

      <h2>5. Données publiques publiées sur le site</h2>
      <p>
        Le site republie des jeux de données ouverts qui peuvent contenir des données à
        caractère personnel déjà rendues publiques par les autorités : intitulés et textes de
        pétitions rédigés par des citoyens, noms de députés et de membres du gouvernement
        figurant au compte rendu intégral des débats.
      </p>
      <ul>
        <li>
          <strong>Finalité :</strong> information du public sur le fonctionnement du droit de
          pétition
        </li>
        <li>
          <strong>Base légale :</strong>{" "}
          mission d&apos;intérêt public d&apos;information et
          intérêt légitime, dans le cadre du régime applicable aux traitements à des fins
          journalistiques et documentaires
        </li>
        <li>
          <strong>Source :</strong> données diffusées sous Licence Ouverte 2.0, republiées sans
          modification de contenu
        </li>
      </ul>
      <p>
        Si vous estimez qu&apos;une information vous concernant ne devrait pas figurer sur ce
        site, écrivez à <a href={`mailto:${LEGAL.emailDonnees}`}>{LEGAL.emailDonnees}</a>{" "}
        : la demande sera examinée au regard de l&apos;intérêt du public à
        l&apos;information. Notez
        que le retrait sur ce site ne modifie pas la source officielle, qu&apos;il convient de
        saisir séparément.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de
        limitation, d&apos;opposition et de portabilité prévus par le RGPD et par la loi
        « Informatique et Libertés » du 6 janvier 1978 modifiée.
      </p>
      <p>
        Ces droits s&apos;exercent auprès de{" "}
        <a href={`mailto:${LEGAL.emailDonnees}`}>{LEGAL.emailDonnees}</a>{" "}
        ou par courrier à l&apos;adresse du siège. Une réponse vous sera apportée dans un
        délai d&apos;un mois.
      </p>
      <p>
        En pratique, si vous n&apos;avez pas accepté la mesure d&apos;audience,
        l&apos;absence de compte et de cookie fait qu&apos;aucune donnée de navigation ne
        peut vous être rattachée : l&apos;éditeur n&apos;est pas en mesure de vous identifier
        à partir des seuls journaux techniques. Si vous l&apos;avez acceptée, le retrait du
        consentement et la suppression des cookies s&apos;effectuent depuis la{" "}
        <Link href="/politique-cookies">politique de cookies</Link>.
      </p>
      <p>
        Vous pouvez à tout moment introduire une réclamation auprès de la{" "}
        <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">
          Commission nationale de l&apos;informatique et des libertés (CNIL)
        </a>
        .
      </p>

      <h2>7. Modifications</h2>
      <p>
        Toute évolution du site introduisant un nouveau traitement — mesure d&apos;audience,
        formulaire, service tiers — donnera lieu à une mise à jour de cette page et, si la
        réglementation l&apos;impose, au recueil préalable de votre consentement. Voir également
        la <Link href="/politique-cookies">politique de cookies</Link>.
      </p>
    </>
  );
}
