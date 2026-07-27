import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LEGAL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de cookies — Suite à donner",
  description: `${SITE_NAME} ne dépose aucun cookie et n'utilise aucun traceur. Explication et vérification.`,
  alternates: { canonical: "/politique-cookies" },
};

export default function PolitiqueCookies() {
  return (
    <>
      <h1>Politique de cookies</h1>
      <p className={styles.maj}>Dernière mise à jour : {LEGAL.derniereMaj}</p>

      <div className={styles.encadre}>
        <p>
          <strong>Ce site ne dépose aucun cookie.</strong>{" "}
          Ni cookie technique, ni cookie de mesure d&apos;audience, ni cookie publicitaire, ni
          traceur tiers.
        </p>
        <p>
          C&apos;est aussi la raison pour laquelle aucune bannière de consentement ne vous est
          présentée : il n&apos;y a rien à consentir.
        </p>
      </div>

      <h2>1. Pourquoi aucun cookie</h2>
      <p>
        {SITE_NAME}{" "}
        est un site de consultation. Il n&apos;a ni compte utilisateur, ni panier, ni
        préférence à mémoriser, ni formulaire à protéger. Les pages sont servies depuis un cache
        et identiques pour tous les visiteurs. Aucune de ces fonctions ne nécessite de stocker
        quoi que ce soit dans votre navigateur.
      </p>
      <p>
        L&apos;éditeur a par ailleurs fait le choix de ne pas installer d&apos;outil de mesure
        d&apos;audience. Le site ne sait donc pas combien de personnes le consultent, ni
        d&apos;où elles viennent.
      </p>

      <h2>2. Ce que le site ne stocke pas</h2>
      <ul>
        <li>
          Aucun <code>cookie</code>, de première ou de tierce partie
        </li>
        <li>
          Aucune entrée dans <code>localStorage</code> ni <code>sessionStorage</code>
        </li>
        <li>
          Aucune base <code>IndexedDB</code>, aucun <em>service worker</em>
        </li>
        <li>Aucun pixel invisible, aucune balise de suivi, aucune empreinte de navigateur</li>
      </ul>

      <h2>3. Le vérifier vous-même</h2>
      <p>
        Cette affirmation est vérifiable en quelques secondes et ne demande aucune confiance
        envers l&apos;éditeur. Ouvrez les outils de développement de votre navigateur
        (<code>F12</code>), onglet <em>Application</em> ou <em>Stockage</em> : les rubriques
        Cookies, Local Storage et Session Storage sont vides pour ce domaine.
      </p>

      <h2>4. Services tiers appelés par le site</h2>
      <p>
        Deux services extérieurs sont sollicités depuis votre navigateur pour afficher les
        données. Aucun des deux ne dépose de cookie dans le cadre de cet usage :
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
        toute requête réseau. Le détail figure dans la{" "}
        <Link href="/politique-de-confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>5. Si cela devait changer</h2>
      <p>
        L&apos;ajout d&apos;un outil de mesure d&apos;audience ou de tout traceur non strictement
        nécessaire imposerait, en application de l&apos;article 82 de la loi « Informatique et
        Libertés », le recueil de votre consentement préalable au moyen d&apos;une bannière
        offrant un refus aussi simple que l&apos;acceptation. Cette page serait mise à jour en
        conséquence, et la date en tête de document modifiée.
      </p>
      <p>
        Toute question :{" "}
        <a href={`mailto:${LEGAL.emailDonnees}`}>{LEGAL.emailDonnees}</a>.
      </p>
    </>
  );
}
