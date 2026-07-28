import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Méthodologie — comment ${SITE_NAME} lit les données officielles`,
  description:
    "Source canonique, règles de lecture, catégories dérivées et limites : comment l'observatoire établit chacun de ses constats sur les pétitions de l'Assemblée nationale, et ce qu'il s'interdit d'affirmer.",
  alternates: { canonical: "/methodologie" },
};

// Page entièrement statique : elle décrit des règles, pas des chiffres — les
// compteurs à jour vivent sur l'accueil et les pages de constat.
export default function Methodologie() {
  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>Sources, règles et limites</p>
        <h1>Méthodologie</h1>
        <p className={styles.lede}>
          Ce site publie des affirmations vérifiables sur des données publiques. Sa
          crédibilité repose sur quatre règles, appliquées partout — dans le code
          d&apos;import, dans les contrôles de cohérence et dans chaque libellé
          affiché. Le code est{" "}
          <a href="https://github.com/Clemsrec/suiteadonner" target="_blank" rel="noopener noreferrer">
            ouvert
          </a>
          &nbsp;: chacune de ces règles peut être relue et recontrôlée.
        </p>
      </header>

      <section className={styles.section}>
        <h2>1. Une seule source canonique</h2>
        <p>
          Tous les chiffres proviennent du{" "}
          <a
            href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale"
            target="_blank"
            rel="noopener noreferrer"
          >
            fichier officiel des pétitions de l&apos;Assemblée nationale
          </a>{" "}
          publié sur data.gouv.fr, complété par l&apos;agenda officiel des réunions
          de l&apos;Assemblée pour les passages en commission. La plateforme{" "}
          <a href="https://petitions.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer">
            petitions.assemblee-nationale.fr
          </a>{" "}
          sert de contexte et de comparaison, jamais de référence.
        </p>
        <p>
          Attention si vous refaites nos calculs&nbsp;: plusieurs copies de ce fichier
          circulent, et l&apos;une d&apos;elles avait un mois de retard lorsque nous
          l&apos;avons contrôlée le 27 juillet 2026. Nous lisons la ressource déclarée
          par le jeu de données officiel, à son adresse stable.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Aucune valeur inventée</h2>
        <p>
          Un champ absent reste absent. Un nombre de signatures manquant
          s&apos;affiche «&nbsp;non renseigné&nbsp;» et jamais «&nbsp;0&nbsp;» —
          écrire zéro reviendrait à affirmer «&nbsp;aucun soutien&nbsp;» là où le
          fichier ne dit rien. Une date manquante ne devient pas une date par défaut.
          Un champ de décision vide est montré vide.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Aucune cause inférée</h2>
        <p>
          Nous constatons ce que le jeu de données contient, nous
          n&apos;interprétons pas. Les libellés décrivent des faits vérifiables
          («&nbsp;Aucune décision publiée&nbsp;»), jamais des intentions. Quand des
          centaines de pétitions voient leur recueil s&apos;arrêter le même jour,
          nous constatons le regroupement sans lui attribuer de cause&nbsp;: aucune
          information officielle ne la documente.
        </p>
        <p>
          Le champ <code>statut</code>{" "}du fichier n&apos;est pas traité comme une
          source de vérité&nbsp;: près de 900 pétitions y sont marquées
          «&nbsp;classée&nbsp;» alors que leur propre texte de décision indique un
          classement d&apos;office faute de signatures. Le motif d&apos;un classement
          est donc toujours lu dans le texte de décision et dans les dates, jamais
          déduit du statut. C&apos;est pourquoi nous n&apos;écrivons jamais
          «&nbsp;classée après examen&nbsp;»&nbsp;: rien dans les données ne prouve
          qu&apos;un examen a eu lieu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Un recoupement n&apos;est pas un lien officiel</h2>
        <p>
          Il n&apos;existe aucun identifiant commun entre une pétition et un débat
          parlementaire. Les seuls rapprochements que nous publions sont ceux que
          l&apos;Assemblée a elle-même établis&nbsp;: une commission qui inscrit une
          pétition à son ordre du jour en la désignant par son numéro ou par son
          titre exact. Chaque étape indique laquelle des deux, avec le texte officiel
          intégral —{" "}
          <Link href="/passages-en-commission">voir ces passages en commission</Link>.
        </p>
        <p>
          Nous calculons par ailleurs des rapprochements thématiques entre pétitions
          et débats en séance publique, par mots-clés et par dates. Ce ne sont que
          des indices&nbsp;: <strong>nous ne les affichons pas</strong>. Ils servent à
          orienter nos recherches, pas à établir des faits.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Les catégories dérivées, règle par règle</h2>
        <ul>
          <li>
            <strong>Recueil terminé</strong>{" "}— la date limite de signature est
            passée. Fondé sur les dates seules&nbsp;; le champ <code>statut</code>{" "}
            n&apos;intervient pas.
          </li>
          <li>
            <strong>Classée d&apos;office (seuil non atteint)</strong>{" "}— le texte de
            décision invoque lui-même le seuil de 10&nbsp;000 signatures. C&apos;est
            la seule situation où le fichier explique systématiquement le classement.
          </li>
          <li>
            <strong>Classement constaté, sans motif</strong> — un texte de décision
            existe, mais il enregistre le classement sans énoncer de motif.
          </li>
          <li>
            <strong>Aucune décision publiée</strong> — le sort de la pétition est
            scellé (recueil terminé ou statut décidé) et le champ de décision est
            resté entièrement vide —{" "}
            <Link href="/decisions-non-publiees">voir ces pétitions</Link>.
          </li>
          <li>
            <strong>Fichier non à jour</strong>{" "}— le statut affiché
            («&nbsp;ouverte&nbsp;») contredit la date limite passée. L&apos;écart est
            signalé, jamais corrigé —{" "}
            <Link href="/fichier-non-a-jour">voir ces pétitions</Link>.
          </li>
          <li>
            <strong>Clôture groupée</strong>{" "}— au moins cent pétitions partagent la
            même date de fin de recueil&nbsp;: ce n&apos;est pas une échéance
            individuelle. Le regroupement est constaté, sa cause n&apos;est pas
            affirmée.
          </li>
          <li>
            <strong>Seuil atteint</strong>{" "}— vaut «&nbsp;inconnu&nbsp;» quand le
            nombre de signatures n&apos;est pas renseigné&nbsp;: on ne peut pas dire
            qu&apos;une pétition n&apos;a pas atteint un seuil si on ignore combien
            elle a recueilli.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>À quel rythme</h2>
        <p>
          L&apos;Assemblée republie le fichier chaque lundi matin. Nous le récupérons
          ensuite, recalculons toutes les catégories dérivées et mettons le site à
          jour. La date du dernier import figure sur chaque fiche et chaque liste.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce que nous ne pouvons pas savoir</h2>
        <p>
          L&apos;ordre du jour d&apos;une réunion dit qu&apos;une pétition a été
          examinée, pas ce qui s&apos;y est dit. Les échanges, les arguments et le
          sens d&apos;un vote ne figurent pas dans les données que nous exploitons.
          Un travail réel a donc pu avoir lieu sans que nous puissions le décrire —
          et sans que le signataire puisse le savoir&nbsp;: c&apos;est précisément ce
          que ce site mesure.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Refaire nos calculs</h2>
        <p>
          Le dépôt public contient l&apos;intégralité du pipeline&nbsp;:
          téléchargement du CSV canonique, normalisation, classification et contrôles
          de cohérence. Toute erreur peut être signalée — elle sera corrigée et
          signalée publiquement. Les données republiées ici restent sous{" "}
          <strong>Licence Ouverte 2.0 (Etalab)</strong>, librement réutilisables avec
          mention de la source.
        </p>
      </section>

      <p className={styles.source}>
        Voir aussi&nbsp;: <Link href="/petitions">l&apos;index des pétitions</Link> ·{" "}
        <Link href="/mentions-legales">mentions légales</Link> ·{" "}
        <Link href="/">l&apos;accueil et ses chiffres à jour</Link>.
      </p>
    </>
  );
}
