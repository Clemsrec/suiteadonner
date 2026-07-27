import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import ChoixConsentement from "./ChoixConsentement";
import { LEGAL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de cookies — Suite à donner",
  description: `${SITE_NAME} n'utilise qu'un seul traceur — la mesure d'audience — et uniquement après votre consentement. Explication et vérification.`,
  alternates: { canonical: "/politique-cookies" },
};

export default function PolitiqueCookies() {
  return (
    <>
      <h1>Politique de cookies</h1>
      <p className={styles.maj}>Dernière mise à jour : {LEGAL.derniereMaj}</p>

      <div className={styles.encadre}>
        <p>
          <strong>Ce site ne dépose aucun cookie sans votre consentement.</strong>{" "}
          Un seul traceur existe — la mesure d&apos;audience Google Analytics — et il
          n&apos;est activé que si vous cliquez « Accepter » dans la bannière.
        </p>
        <p>
          Si vous refusez, ou si vous ignorez la bannière, rien n&apos;est déposé et aucune
          donnée n&apos;est transmise à Google. Le site se consulte exactement de la même
          façon.
        </p>
      </div>

      <h2>1. Le principe</h2>
      <p>
        {SITE_NAME}{" "}
        est un site de consultation. Il n&apos;a ni compte utilisateur, ni panier, ni
        préférence à mémoriser, ni formulaire à protéger. Les pages sont servies depuis un
        cache et identiques pour tous les visiteurs : aucun cookie technique n&apos;est
        nécessaire.
      </p>
      <p>
        L&apos;éditeur utilise en revanche un outil de mesure d&apos;audience pour savoir
        combien de personnes consultent le site et quelles pages sont lues. Conformément à
        l&apos;article 82 de la loi « Informatique et Libertés », cet outil est subordonné à
        votre consentement préalable, recueilli par une bannière où le refus est aussi simple
        que l&apos;acceptation. Par défaut — avant votre réponse, ou après un refus — le site
        fonctionne sans aucun traceur.
      </p>

      <h2>2. Le seul traceur : la mesure d&apos;audience</h2>
      <p>
        Si, et seulement si, vous acceptez, le script Google Analytics 4 (société Google) est
        chargé et dépose les cookies suivants :
      </p>
      <ul>
        <li>
          <code>_ga</code> — identifiant anonyme de navigateur, conservé 13 mois
        </li>
        <li>
          <code>_ga_*</code> — état de la session de consultation, conservé 13 mois
        </li>
      </ul>
      <p>
        Ces cookies permettent de compter les visites et les pages vues. Les données
        associées (pages consultées, type d&apos;appareil, provenance géographique
        approximative) sont transmises à Google, qui agit comme sous-traitant. Le détail du
        traitement — finalité, base légale, durées, transferts — figure dans la{" "}
        <Link href="/politique-de-confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>3. La mémorisation de votre choix</h2>
      <p>
        Votre réponse à la bannière — acceptation comme refus — est enregistrée dans votre
        navigateur, dans une entrée <code>localStorage</code> nommée{" "}
        <code>suiteadonner-consentement-audience</code>. Elle ne contient que votre choix et
        sa date, n&apos;est transmise à personne, et expire après six mois : la bannière vous
        sera alors reposée. Ce stockage est strictement nécessaire à la mémorisation de votre
        choix ; c&apos;est la seule chose que le site écrit dans votre navigateur sans
        consentement, et il est exempté à ce titre.
      </p>

      <h2>4. Changer d&apos;avis</h2>
      <p>
        Vous pouvez retirer ou modifier votre choix à tout moment depuis cette page. Le
        retrait supprime immédiatement les cookies de mesure d&apos;audience déjà déposés et
        fait réapparaître la bannière.
      </p>
      <ChoixConsentement />

      <h2>5. Le vérifier vous-même</h2>
      <p>
        Ces affirmations sont vérifiables en quelques secondes et ne demandent aucune
        confiance envers l&apos;éditeur. Ouvrez les outils de développement de votre
        navigateur (<code>F12</code>), onglet <em>Application</em> ou <em>Stockage</em>{" "}
        : tant que vous n&apos;avez pas accepté, la rubrique Cookies est vide pour ce domaine,
        et Local Storage ne contient au plus que l&apos;entrée mémorisant votre choix.
        L&apos;onglet <em>Réseau</em>{" "}
        montre par ailleurs qu&apos;aucune requête ne part vers les domaines de Google
        Analytics.
      </p>

      <h2>6. Services tiers appelés par le site</h2>
      <p>
        Deux services extérieurs sont sollicités depuis votre navigateur pour afficher les
        données, indépendamment de votre choix. Aucun des deux ne dépose de cookie dans le
        cadre de cet usage :
      </p>
      <ul>
        <li>
          <strong>Cloud Firestore</strong> (Google) — lecture des données de pétitions affichées
          sur la page
        </li>
        <li>
          <strong>Algolia</strong> — exécution de vos requêtes dans le champ de recherche
        </li>
      </ul>
      <p>
        Ces appels transmettent nécessairement votre adresse IP aux serveurs concernés, comme
        toute requête réseau. S&apos;y ajoutent, uniquement après consentement, les appels
        vers Google Analytics décrits plus haut. Le détail figure dans la{" "}
        <Link href="/politique-de-confidentialite">politique de confidentialité</Link>.
      </p>

      <p>
        Toute question :{" "}
        <a href={`mailto:${LEGAL.emailDonnees}`}>{LEGAL.emailDonnees}</a>.
      </p>
    </>
  );
}
