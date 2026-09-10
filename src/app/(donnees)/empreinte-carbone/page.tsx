import type { Metadata } from "next";
import Link from "next/link";
import { WEB_METHODOLOGY, estimateWeb, explain } from "carbone-cost";
import styles from "../donnees.module.css";
import propre from "./empreinte-page.module.css";
import DetailEmpreinte from "./DetailEmpreinte";
import { HEBERGEMENT } from "@/lib/empreinte";
import { LEGAL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Empreinte carbone du site — ${SITE_NAME}`,
  description:
    "Ce que coûte la consultation de ce site, mesuré dans votre navigateur et calculé chez vous : la méthode, les coefficients, et ce que le calcul ne couvre pas.",
  alternates: { canonical: "/empreinte-carbone" },
};

// Aucun coefficient n'est recopié à la main : on les redéduit en soumettant à
// la bibliothèque un transfert d'exactement un gigaoctet. Le résultat EST le
// coefficient, ce qui reste vrai même si elle renomme ses champs internes ou
// révise ses valeurs — les chiffres de cette page ne peuvent donc pas diverger
// de ceux du badge.
//
// 1e9 et non 1024³ : le modèle Sustainable Web Design raisonne en gigaoctets
// décimaux. Sonder sur un gibioctet donnerait 159 g là où le modèle annonce
// 148 g, et la page afficherait un coefficient de 7 % trop élevé sous
// l'étiquette « par gigaoctet ».
const OCTETS_PAR_GO = 1e9;
const SONDE = estimateWeb({ bytesTransferred: OCTETS_PAR_GO });
const SONDE_VERTE = estimateWeb({ bytesTransferred: OCTETS_PAR_GO, greenHosting: true });

const GRAMMES_PAR_GO = SONDE.gramsCO2e;
const REDUCTION_VERTE = Math.round((1 - SONDE_VERTE.gramsCO2e / SONDE.gramsCO2e) * 100);
const METHODE = explain(WEB_METHODOLOGY);

// Ventilation par segment du modèle. Elle n'est affichée que si les trois
// segments sont présents et qu'ils totalisent bien le coefficient : plutôt que
// d'afficher des zéros si la bibliothèque renomme ses clés, on retire le bloc.
const SEGMENTS = (
  [
    ["dataCenterGrams", "Centre de données"],
    ["networkGrams", "Réseau de transport"],
    ["userDeviceGrams", "Votre appareil"],
  ] as const
).map(([cle, libelle]) => ({ libelle, grammes: SONDE.breakdown?.[cle] }));

const VENTILATION = SEGMENTS.every((s) => typeof s.grammes === "number")
  ? SEGMENTS.map((s) => ({
      libelle: s.libelle,
      grammes: s.grammes as number,
      part: Math.round(((s.grammes as number) / GRAMMES_PAR_GO) * 100),
    }))
  : null;

export default function EmpreinteCarbonePage() {
  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>Ce que ce site vous coûte</p>
        <h1>Empreinte carbone de la consultation</h1>
        <p className={styles.lede}>
          Un site qui reproche à l&apos;Assemblée de ne pas publier ses chiffres se doit de
          publier les siens. Voici ce que pèse la consultation de ces pages, comment ce
          poids est calculé, et surtout ce que ce calcul ne sait pas voir.
        </p>
      </header>

      <div className={styles.encadre}>
        <p>
          <strong>Cette mesure ne nous apprend rien sur vous.</strong>{" "}
          Elle est calculée
          par votre navigateur, pour votre navigateur : aucun chiffre n&apos;est transmis à
          l&apos;éditeur ni à personne d&apos;autre, et rien n&apos;est écrit dans votre
          appareil — ni cookie, ni stockage local. Fermez l&apos;onglet, le relevé
          disparaît. Vous pouvez le vérifier dans l&apos;onglet <em>Réseau</em> de vos
          outils de développement.
        </p>
      </div>

      <DetailEmpreinte />

      <section className={styles.section}>
        <h2>La méthode</h2>
        <p>
          Le calcul est fait par <code>carbone-cost</code>, une bibliothèque libre publiée
          par l&apos;éditeur de ce site. Elle applique le{" "}
          <a
            href="https://sustainablewebdesign.org/estimating-digital-emissions/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sustainable Web Design Model
          </a>
          , une méthode publique&nbsp;: chaque gigaoctet transféré correspond à une
          quantité d&apos;énergie, répartie entre le centre de données, le réseau et
          l&apos;appareil qui affiche la page, et convertie en carbone selon
          l&apos;intensité du réseau électrique.
        </p>
        <dl className={styles.fiche}>
          <dt>Version de la méthode</dt>
          <dd>
            <code>{METHODE.methodology[0].methodologyVersion}</code> (
            {METHODE.methodology[0].source}), révision du{" "}
            {METHODE.methodology[0].updatedAt}
          </dd>
          <dt>Coefficient d&apos;intensité</dt>
          <dd>
            {GRAMMES_PAR_GO.toLocaleString("fr-FR")} g CO<sub>2</sub>e par gigaoctet
            transféré, énergie de fonctionnement et de fabrication comprises
          </dd>
          <dt>Hébergement déclaré vert</dt>
          <dd>
            {HEBERGEMENT.vert ? "oui" : "non"} — {HEBERGEMENT.fournisseur}, région{" "}
            {HEBERGEMENT.region}. La réduction ne porte que sur le fonctionnement du
            centre de données, soit {REDUCTION_VERTE}&nbsp;% du total. Ni le réseau ni
            votre appareil ne changent parce que nos serveurs sont alimentés autrement.
          </dd>
          <dt>Périmètre</dt>
          <dd>
            la livraison web&nbsp;: les octets qui vont du serveur à votre navigateur, et
            l&apos;énergie qu&apos;ils coûtent sur tout leur trajet
          </dd>
        </dl>

        {VENTILATION && (
          <table className={propre.table}>
            <caption className={propre.legende}>
              Où part l&apos;énergie, pour un gigaoctet transféré. C&apos;est votre propre
              appareil qui pèse le plus lourd — un point que la plupart des compteurs
              d&apos;empreinte web passent sous silence, parce qu&apos;il ne dépend pas de
              l&apos;éditeur du site.
            </caption>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">
                  g CO<sub>2</sub>e / Go
                </th>
                <th scope="col">Part</th>
              </tr>
            </thead>
            <tbody>
              {VENTILATION.map((s) => (
                <tr key={s.libelle}>
                  <td>{s.libelle}</td>
                  <td>{s.grammes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                  <td>{s.part}&nbsp;%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={propre.avertissement}>
          Ce coefficient est une convention de place, pas une mesure de notre
          infrastructure. Nous ne disposons d&apos;aucun relevé de consommation de nos
          serveurs&nbsp;: personne, sur le web, n&apos;en dispose vraiment. Tout chiffre
          d&apos;empreinte carbone d&apos;un site — le nôtre comme celui des autres — est
          un ordre de grandeur bâti sur des moyennes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce que ce chiffre ne dit pas</h2>
        <p>
          Par cohérence avec le reste du site&nbsp;: quand nous ne savons pas, nous le
          disons plutôt que de combler. Ce total n&apos;est pas seulement incomplet —{" "}
          <strong>il est incertain dans les deux sens</strong>, et voici lesquels.
        </p>
        <ul>
          <li>
            <strong>Les appels aux services de données ne sont pas comptés.</strong>{" "}
            Les réponses de Algolia arrivent bien dans votre navigateur,
            mais celui-ci en masque la taille aux scripts de la page — une protection
            normale entre domaines. Nous ne les estimons pas. Sur ce point, le chiffre est
            trop bas.
          </li>
          <li>
            <strong>L&apos;électricité est comptée à la moyenne mondiale.</strong>{" "}
            Le modèle applique {SONDE.breakdown?.gridIntensityGCO2ePerKWh ?? 0} g CO
            <sub>2</sub>e par kilowattheure. Or nos serveurs sont aux Pays-Bas et nos
            lecteurs en France, deux réseaux électriques nettement moins carbonés que cette
            moyenne. Sur ce point, le chiffre est probablement trop haut. Nous ne
            l&apos;ajustons pas&nbsp;: le modèle n&apos;accepte qu&apos;une seule intensité
            pour les trois segments, et en choisir une reviendrait à décider en douce
            laquelle des trois compte.
          </li>
          <li>
            <strong>Votre appareil est compté, mais ce n&apos;est pas le vôtre.</strong>{" "}
            Le segment le plus lourd du calcul est un terminal moyen mondial. Un vieux
            portable et un téléphone récent n&apos;ont rien à voir&nbsp;; le modèle ne fait
            pas la différence, et nous ne cherchons pas à le savoir.
          </li>
          <li>
            <strong>La préparation des données n&apos;est pas comptée.</strong>{" "}
            L&apos;import hebdomadaire qui alimente ce site télécharge et recalcule des
            fichiers publics chaque lundi&nbsp;; ce travail n&apos;apparaît pas ici.
          </li>
          <li>
            <strong>Un modèle reste un modèle.</strong>{" "}
            Les méthodes publiées varient d&apos;un facteur trois selon les hypothèses
            retenues sur le réseau et les centres de données. Nous en appliquons une, la
            plus documentée, sans prétendre qu&apos;elle a raison contre les autres.
          </li>
        </ul>
        <p>
          Ce que le chiffre permet, en revanche&nbsp;: comparer les pages entre elles,
          constater qu&apos;une page revisitée coûte presque rien, et vérifier que ce site
          reste léger. C&apos;est un instrument de mesure relative, pas un bilan carbone.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Pourquoi ce site est léger</h2>
        <p>
          La sobriété n&apos;est pas un argument de communication ajouté après coup&nbsp;:
          elle découle de choix techniques que l&apos;on peut vérifier en lisant le code.
        </p>
        <ul>
          <li>
            Aucune police d&apos;écriture n&apos;est téléchargée — le site utilise celles
            déjà présentes dans votre système.
          </li>
          <li>
            Aucune image de contenu, aucune vidéo, aucune bannière. Le logo est un tracé
            vectoriel inscrit dans la page, sans requête supplémentaire.
          </li>
          <li>
            Les pages sont rendues à l&apos;avance et servies depuis un cache&nbsp;: votre
            visite ne déclenche pas de nouveau calcul côté serveur.
          </li>
          <li>
            Aucun traceur n&apos;est chargé tant que vous ne l&apos;avez pas accepté —
            voir la{" "}
            <Link href="/politique-cookies">politique de cookies</Link>. Refuser réduit
            aussi le poids de la page.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Vérifier, ou refaire le calcul</h2>
        <p>
          Le code de mesure de ce site est lisible dans{" "}
          <code>src/lib/empreinte.ts</code>, et la bibliothèque de calcul est publiée sous
          licence MIT sur{" "}
          <a
            href="https://github.com/Clemsrec/carboncost"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          . Vous pouvez relever vous-même le poids d&apos;une page dans l&apos;onglet{" "}
          <em>Réseau</em> de vos outils de développement (<code>F12</code>) et refaire la
          multiplication.
        </p>
        <p>
          Une erreur de méthode, un coefficient mieux sourcé, une part oubliée&nbsp;?
          Écrivez-nous&nbsp;: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. La
          correction sera faite et signalée, ici comme ailleurs.
        </p>
      </section>
    </>
  );
}
