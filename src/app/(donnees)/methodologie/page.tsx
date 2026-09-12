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
    <div className={styles.colonne}>
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
          publié sur data.gouv.fr, complété par l&apos;
          <a
            href="https://data.assemblee-nationale.fr/reunions/reunions"
            target="_blank"
            rel="noopener noreferrer"
          >
            agenda officiel des réunions de l&apos;Assemblée
          </a>{" "}
          et par les comptes rendus que ces réunions produisent, pour les passages
          en commission. Les rapports déposés au terme d&apos;un examen sont lus dans
          le jeu des{" "}
          <a
            href="https://data.assemblee-nationale.fr/travaux-parlementaires/dossiers-legislatifs"
            target="_blank"
            rel="noopener noreferrer"
          >
            dossiers législatifs
          </a>
          . La plateforme{" "}
          <a href="https://petitions.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer">
            petitions.assemblee-nationale.fr
          </a>{" "}
          sert de contexte et de comparaison, jamais de référence.
        </p>
        <p>
          <strong>Ce que ces corpus couvrent, et ce qu&apos;ils ne couvrent pas.</strong>{" "}
          Le fichier des pétitions contient des pétitions de trois législatures. Les
          réunions, comptes rendus et rapports ne sont lus que pour les deux
          dernières&nbsp;: l&apos;Assemblée ne publie pas ces corpus, à cette adresse,
          pour la législature 2017-2022. Les pétitions de cette période figurent donc
          dans nos chiffres tirés du fichier, mais aucune décision de commission ne peut
          leur être rattachée — leur absence de nos relevés ne signifie pas qu&apos;il ne
          s&apos;est rien passé.
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
          source de vérité&nbsp;: plusieurs centaines de pétitions y sont marquées
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
          l&apos;Assemblée a elle-même établis, par l&apos;une de ces trois voies&nbsp;:
          une commission qui inscrit une pétition à son ordre du jour en la désignant
          par son numéro ou par son titre exact, ou dont le compte rendu de réunion
          cite ce numéro. Chaque étape indique laquelle des trois a servi, avec le
          texte officiel intégral —{" "}
          <Link href="/passages-en-commission">voir ces passages en commission</Link>.
        </p>
        <p>
          La même exigence vaut pour les décisions que nous citons. Une commission
          énonce souvent sa décision sans nommer la pétition&nbsp;: «&nbsp;la
          commission adopte la proposition de classement de la pétition&nbsp;».
          Deviner laquelle en suivant le fil du débat serait une déduction&nbsp;: nous
          n&apos;affichons alors rien.
        </p>
        <p>
          Une seule exception, et elle ne demande aucune déduction&nbsp;: lorsque
          l&apos;ordre du jour de la réunion ne désigne qu&apos;une pétition, par son
          numéro, et que le compte rendu n&apos;en cite aucune autre, la décision qui
          ne la nomme pas ne peut désigner qu&apos;elle. Le référent est unique, pas
          supposé. Nous l&apos;indiquons alors sous la citation, pour que vous puissiez
          en juger. Sans cette règle, le classement de la pétition n°&nbsp;5158 —
          707&nbsp;957 signatures, rejetée par 30 voix contre 21 — resterait invisible,
          son compte rendu écrivant seulement «&nbsp;la commission classe donc la
          pétition&nbsp;».
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
            <strong>Classée d&apos;office (seuil de signatures non atteint)</strong>{" "}—
            le texte de décision énonce lui-même un classement d&apos;office faute de
            signatures, et dit d&apos;où vient la règle&nbsp;: dans 1 275 cas sur 1 560,
            d&apos;une décision du <em>bureau</em> de la commission saisie, et non
            d&apos;un texte général.{" "}
            <strong>Le seuil n&apos;est donc pas le même partout</strong> — le bureau de
            la commission des lois retient cinq mille signatures en six mois, celui des
            affaires sociales dix mille. Sur les 1 560 textes relevés le 10 septembre
            2026, 811 énoncent cinq mille et 688 dix mille. Nous affichons le seuil que
            le texte de la pétition écrit, et aucun quand il n&apos;en écrit pas&nbsp;:
            il ne se déduit pas de la commission, un bureau pouvant changer sa règle.
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
          <li>
            <strong>Décision lue au compte rendu</strong>{" "}— la commission énonce le
            classement ou l&apos;examen de la pétition en la nommant par son numéro,
            dans le compte rendu publié de sa réunion. La phrase est reproduite telle
            quelle, jamais reformulée, et le lien vers le compte rendu intégral
            l&apos;accompagne. Sans numéro cité, rien n&apos;est affiché — à la seule
            exception du référent unique décrit plus haut, signalé comme tel sous la
            citation —{" "}
            <Link href="/passages-en-commission">voir ces décisions</Link>.
          </li>
          <li>
            <strong>Examen voté, aucun rapport trouvé</strong>{" "}— la commission
            s&apos;est prononcée pour l&apos;examen d&apos;une pétition, et nous
            n&apos;avons trouvé aucun rapport. Le délai n&apos;est compté que si le
            recueil des signatures est clos&nbsp;: une pétition encore ouverte
            n&apos;attend rien, et afficher un compteur y suggérerait un retard que
            rien n&apos;établit. Nous comptons le temps écoulé depuis
            le vote et n&apos;en tirons aucune conclusion&nbsp;: nous ne savons pas quel
            délai s&apos;applique, ni si un rapport viendra. Ce délai est calculé au moment où la page est rendue, jamais
            figé en base — un compteur arrêté vieillirait sans que rien ne le signale.
          </li>
          <li>
            <strong>Rapport de commission</strong>{" "}— au terme d&apos;un examen, la
            commission dépose un rapport, signé par ses rapporteurs. Le document ne porte aucun
            champ reliant au numéro de pétition&nbsp;: c&apos;est son intitulé officiel
            qui la nomme, et sans ce numéro nous ne rattachons rien —{" "}
            <Link href="/passages-en-commission">voir les suites en commission</Link>.
          </li>
          <li>
            <strong>Classement d&apos;office en bloc</strong>{" "}— une pétition restée
            six mois sous le seuil fixé par sa commission est classée d&apos;office,
            sans examen&nbsp;: c&apos;est la règle, et rien n&apos;a à être motivé. Une
            commission en traite ainsi plusieurs dizaines en une séance — plus de deux
            cents lors de celle du 1er juillet 2026 —, et c&apos;est cet effectif que son
            compte rendu annonce. Nous
            relevons la date, l&apos;effectif annoncé et la phrase qui l&apos;énonce. Nous
            ne dressons pas la liste des pétitions concernées&nbsp;: le compte rendu la donne
            rarement — un seul des trente-quatre que nous avons lus la joint en tableau — et
            l&apos;établir nous-mêmes par recoupement serait un rapprochement de notre fait,
            pas une désignation de la commission. Ce n&apos;est donc pas
            un manquement que nous constatons, mais ce que le document ne permet pas de
            savoir. Un rappel d&apos;une séance antérieure n&apos;est pas recompté —{" "}
            <Link href="/passages-en-commission#en-bloc">voir ces séances</Link>.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>À quel rythme</h2>
        <p>
          L&apos;Assemblée republie le fichier chaque lundi matin. Nous le récupérons
          ensuite, recalculons toutes les catégories dérivées et mettons le site à
          jour. La date du dernier import figure sur les fiches et sur les listes tirées
          du fichier. Les passages en commission suivent un autre pipeline, dont la date
          n&apos;est pas encore affichée&nbsp;: leurs chiffres peuvent donc être en léger
          décalage avec ceux des autres pages.
        </p>
        <p>
          L&apos;agenda des réunions et les comptes rendus suivent leur propre
          calendrier, celui des travaux des commissions. Un compte rendu paraît
          quelques jours après la réunion&nbsp;: tant qu&apos;il n&apos;est pas
          publié, l&apos;étape figure sans décision, et la décision apparaît lors
          d&apos;une collecte suivante.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce que nous ne pouvons pas savoir</h2>
        <p>
          L&apos;ordre du jour d&apos;une réunion dit qu&apos;une pétition a été
          examinée, pas ce qui s&apos;y est dit. Le compte rendu de cette réunion,
          lui, le dit&nbsp;: quand il existe et qu&apos;il nomme la pétition, nous
          reproduisons la décision votée intégralement, avec le lien vers le texte
          officiel. Ce n&apos;est donc plus le sort de la pétition qui nous échappe,
          mais ce que le fichier réutilisable en laisse voir — et l&apos;écart entre
          les deux est précisément ce que ce site mesure.
        </p>
        <p>
          Trois limites demeurent. Un compte rendu peut n&apos;être pas encore publié
          au moment où nous lisons l&apos;agenda. Surtout, une commission classe des
          centaines de pétitions d&apos;office en une séance sans en nommer
          aucune&nbsp;: nous relevons alors la séance et son effectif, mais aucun
          signataire ne peut savoir si la sienne en faisait partie — le compte rendu
          ne contient pas la liste. Enfin, les motivations réelles d&apos;un vote — ce
          que chacun pense, ce qui s&apos;est décidé ailleurs — ne figurent dans aucun
          document&nbsp;: nous rapportons ce qui a été écrit, pas ce qui a été voulu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Refaire nos calculs</h2>
        <p>
          Le dépôt public contient l&apos;intégralité du pipeline&nbsp;:
          téléchargement du CSV canonique, normalisation, classification, lecture de
          l&apos;agenda et des comptes rendus de commission, et contrôles de
          cohérence. Les motifs exacts qui reconnaissent une décision dans un compte
          rendu y figurent, commentés. Toute erreur peut être signalée — elle sera corrigée, et
          inscrite avec la phrase fautive sur la page{" "}
          <Link href="/corrections">des corrections publiées</Link>. Les données republiées ici restent sous{" "}
          <strong>Licence Ouverte 2.0 (Etalab)</strong>, librement réutilisables avec
          mention de la source.
        </p>
      </section>

      <p className={styles.source}>
        Voir aussi&nbsp;: <Link href="/petitions">l&apos;index des pétitions</Link> ·{" "}
        <Link href="/mentions-legales">mentions légales</Link> ·{" "}
        <Link href="/">l&apos;accueil et ses chiffres à jour</Link>.
      </p>
    </div>
  );
}
