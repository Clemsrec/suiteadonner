import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LEGAL, SITE_NAME, SITE_URL } from "@/lib/site";

// Déclaration d'accessibilité sur le modèle publié par la DINUM. Le niveau
// annoncé suit la règle officielle : « partiellement conforme » suppose un
// audit des 106 critères du RGAA, qui n'a pas été mené. Toute correction ou
// tout audit futur doit mettre à jour la date et les listes ci-dessous.
const DATE_VERIFICATION = "26 novembre 2026";

export const metadata: Metadata = {
  title: "Accessibilité — Suite à donner",
  description: `Déclaration d'accessibilité de ${SITE_NAME} : niveau de conformité au RGAA, ce qui a été vérifié, ce qui reste à faire et comment nous signaler un problème.`,
  alternates: { canonical: "/accessibilite" },
};

export default function Accessibilite() {
  return (
    <>
      <h1>Déclaration d&apos;accessibilité</h1>
      <p className={styles.maj}>Dernière mise à jour : {DATE_VERIFICATION}</p>

      <div className={styles.encadre}>
        <p>
          <strong>État de conformité : non conforme.</strong> Le site n&apos;a pas encore fait
          l&apos;objet d&apos;un audit complet selon le référentiel officiel (RGAA). Nous avons
          vérifié les points les plus importants, listés ci-dessous, et corrigé ce que nous
          avons trouvé.
        </p>
        <p>
          Si un contenu vous est difficile d&apos;accès, écrivez-nous à{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : nous vous répondrons et vous
          donnerons l&apos;information sous une autre forme.
        </p>
      </div>

      <h2>1. Notre engagement</h2>
      <p>
        {LEGAL.denomination} veut que {SITE_NAME} soit lisible par le plus grand nombre : personnes qui
        naviguent au clavier, avec un lecteur d&apos;écran, avec un fort zoom ou sur un petit
        téléphone. Cette déclaration s&apos;applique au site{" "}
        <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>.
      </p>
      <p>
        Le site est un projet indépendant. La loi n&apos;oblige pas à publier cette
        déclaration : nous le faisons volontairement, pour dire où nous en sommes.
      </p>

      <h2>2. État de conformité</h2>
      <p>
        {SITE_NAME} est <strong>non conforme</strong> avec le référentiel général
        d&apos;amélioration de l&apos;accessibilité (RGAA), version 4.1.2. Ce niveau
        signifie seulement que l&apos;audit complet n&apos;a pas eu lieu. Il ne dit pas que le
        site est inutilisable.
      </p>

      <h2>3. Ce que nous avons vérifié</h2>
      <p>Vérification menée le {DATE_VERIFICATION} sur les seize modèles de page du site :</p>
      <ul>
        <li>la langue de chaque page est déclarée (français) ;</li>
        <li>chaque page a un seul titre principal et des titres rangés dans l&apos;ordre ;</li>
        <li>l&apos;en-tête, le contenu et le pied de page sont repérables ;</li>
        <li>
          un lien « Aller au contenu » permet de passer le menu au clavier ;
        </li>
        <li>
          tout se fait au clavier, dans un ordre logique, et l&apos;élément atteint est
          entouré d&apos;un contour visible ;
        </li>
        <li>
          les champs, boutons et icônes ont un nom lu par les lecteurs d&apos;écran ; le
          nombre de résultats d&apos;une recherche est annoncé ;
        </li>
        <li>les tableaux ont un titre et des en-têtes de colonnes ;</li>
        <li>
          les textes atteignent le contraste recommandé, en couleurs claires comme
          sombres ;
        </li>
        <li>le statut d&apos;une pétition est écrit en mots, pas seulement donné par une couleur ;</li>
        <li>
          les boutons et liens des menus font au moins 44 pixels de haut, pour le doigt ;
        </li>
        <li>
          l&apos;affichage tient sur un écran de 320 pixels de large, ce qui équivaut à un
          zoom de 400 %, sans défilement de côté ;
        </li>
        <li>les liens vers d&apos;autres sites s&apos;ouvrent dans le même onglet ;</li>
        <li>rien ne bouge ni ne clignote à l&apos;écran.</li>
      </ul>

      <h2>4. Ce qui reste à faire</h2>
      <ul>
        <li>un audit complet des 106 critères du RGAA ;</li>
        <li>
          un essai complet avec un lecteur d&apos;écran (VoiceOver, NVDA) : nous avons
          contrôlé ce qu&apos;il lit, pas encore écouté le résultat ;
        </li>
        <li>des essais sur Safari, Firefox et sur de vrais téléphones.</li>
      </ul>
      <p>
        Les documents de l&apos;Assemblée nationale vers lesquels le site renvoie (comptes
        rendus, rapports, fichier officiel) ne dépendent pas de nous.
      </p>

      <h2>5. Comment cette déclaration a été établie</h2>
      <dl className={styles.fiche}>
        <dt>Date</dt>
        <dd>{DATE_VERIFICATION}</dd>
        <dt>Technologies</dt>
        <dd>HTML, CSS, JavaScript</dd>
        <dt>Navigateur</dt>
        <dd>Chromium sur macOS</dd>
        <dt>Largeurs d&apos;écran</dt>
        <dd>320, 375, 768 et 1 320 pixels</dd>
        <dt>Méthode</dt>
        <dd>contrôle automatique des pages et parcours au clavier</dd>
      </dl>

      <h2>6. Nous signaler un problème</h2>
      <p>
        Si vous n&apos;arrivez pas à lire un contenu ou à utiliser une fonction, écrivez à{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Dites-nous la page concernée et
        ce qui vous a gêné : nous vous répondrons et chercherons une solution.
      </p>

      <h2>7. Voies de recours</h2>
      <p>
        Si vous nous avez signalé un défaut et que notre réponse ne vous satisfait pas, vous
        pouvez vous adresser au Défenseur des droits :
      </p>
      <ul>
        <li>
          par le{" "}
          <a href="https://formulaire.defenseurdesdroits.fr/" rel="noopener noreferrer">
            formulaire en ligne
          </a>{" "}
          ;
        </li>
        <li>
          auprès d&apos;un{" "}
          <a href="https://www.defenseurdesdroits.fr/carte-des-delegues" rel="noopener noreferrer">
            délégué près de chez vous
          </a>{" "}
          ;
        </li>
        <li>par téléphone au 09 69 39 00 00 ;</li>
        <li>
          par courrier, sans timbre : Défenseur des droits, Libre réponse 71120, 75342 Paris
          CEDEX 07.
        </li>
      </ul>

      <p>
        Voir aussi les <Link href="/mentions-legales">mentions légales</Link>.
      </p>
    </>
  );
}
