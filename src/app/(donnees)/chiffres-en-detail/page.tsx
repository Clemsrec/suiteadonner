import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../page.module.css";
import donnees from "../donnees.module.css";
import {
  getStats,
  formatFrDate,
  joursDepuis,
  type Stats,
} from "@/lib/petitions";
import { RELEVE_PLATEFORME, SITE_NAME, SORT_PETITION, lienSortPetition } from "@/lib/site";
import { nombre } from "@/lib/nombre";

export const metadata: Metadata = {
  title: `Les chiffres en détail — ${SITE_NAME}`,
  description:
    "Le constat chiffré sur les décisions des commissions, la comparaison avec la plateforme officielle des pétitions, et la façon de lire chaque chiffre de l'observatoire.",
  alternates: { canonical: "/chiffres-en-detail" },
};

// Les blocs longs de l'accueil, déplacés tels quels le 26/11/2026 pour que
// l'accueil reste lisible : le constat d'ensemble, la comparaison avec la
// plateforme officielle et les définitions. Mêmes données que l'accueil
// (meta/stats), même rythme de régénération.
export const revalidate = 3600;

async function lireStats(): Promise<Stats | null> {
  try {
    return await getStats();
  } catch (err) {
    console.error("Lecture Firestore impossible :", err);
    return null;
  }
}

export default async function ChiffresEnDetail() {
  const stats = await lireStats();

  return (
    <div className={styles.detail}>
      <header className={donnees.entete}>
        <p className={donnees.eyebrow}>Les chiffres en détail</p>
        <h1>Ce que disent les données, chiffre par chiffre</h1>
        <p className={donnees.lede}>
          Cette page rassemble les mesures complètes de l&apos;observatoire&nbsp;: ce que le
          fichier officiel dit des décisions, ce que montre la plateforme où les pétitions
          sont signées, et comment lire chaque chiffre. L&apos;
          <Link href="/">accueil</Link> en donne l&apos;essentiel.
        </p>
        {!stats && (
          <p className={styles.demoNote}>
            Les données ne sont pas accessibles pour le moment. Merci de réessayer dans
            quelques minutes.
          </p>
        )}
      </header>

    {stats && (
      <section className={styles.constat} id="constat">
        <p className={styles.eyebrow}>Le constat d&apos;ensemble</p>
        <h2>
          Quand le fichier ne rattache pas un classement au nombre de signatures, il
          n&apos;écrit le plus souvent aucune motivation&nbsp;:{" "}
          {nombre(stats.classeesHorsSeuilSansTexte)} fois sur{" "}
          {nombre(stats.classeesHorsSeuil)}.
        </h2>

        <p className={styles.constatLede}>
          La plupart des pétitions dont le fichier motive le classement le sont faute
          d&apos;avoir réuni le nombre de signatures exigé par leur commission, et le
          fichier le dit clairement. Pour les autres, l&apos;emplacement prévu pour motiver
          la décision reste vide dans la très grande majorité des cas — le rapport exact
          est donné ci-dessus. Tous les chiffres ci-dessous proviennent du fichier officiel
          et peuvent être recomptés.
        </p>

        <div className={styles.faits}>
          <div className={styles.fait}>
            <div className={styles.faitN}>
              {nombre(stats.formulationsDistinctes)}
            </div>
            <p>
              formulations différentes pour l&apos;ensemble des{" "}
              {nombre(stats.textesDecision)}{" "}
              décisions rédigées. Ce sont des formules types&nbsp;: aucune ne cite le numéro
              ni le titre de la pétition qu&apos;elle concerne — nous les avons toutes
              relues pour le vérifier.
            </p>
          </div>

          <div className={styles.fait}>
            <div className={styles.faitN}>
              {nombre(stats.motifAbsent)}
            </div>
            <p>
              pétitions dont le recueil est terminé et pour lesquelles l&apos;emplacement
              prévu pour la décision est resté entièrement vide. Les pétitions encore en
              cours de signature ne sont pas comptées ici.
            </p>
          </div>

          <div className={styles.fait}>
            <div className={styles.faitN}>
              {nombre(Math.round((stats.seuilAtteint / stats.total) * 1000) / 10)}
              &nbsp;%
            </div>
            <p>
              des pétitions dépassent 10&nbsp;000 signatures —{" "}
              {nombre(stats.seuilAtteint)} sur{" "}
              {nombre(stats.total)}.
            </p>
          </div>

          <div className={styles.fait}>
            <div className={styles.faitN}>
              {nombre(stats.clotureGroupee)}
            </div>
            <p>
              pétitions dont le recueil s&apos;est arrêté le même jour qu&apos;au moins
              cent autres
              {stats.dateClotureMasse
                ? ` — la plus grosse vague en regroupe ${nombre(stats.nbClotureMasse)} le ${formatFrDate(stats.dateClotureMasse)}`
                : ""}
              . Leur nombre de signatures n&apos;y change rien.
            </p>
          </div>
        </div>

        <div className={styles.reserve}>
          <h3>Ce que ces chiffres ne disent pas</h3>
          <p>
            Ils ne prouvent pas que rien n&apos;a été fait. Une commission a pu auditionner,
            échanger, tenir compte d&apos;une pétition dans un travail législatif dont le
            fichier ne garde aucune trace. Quand cette trace existe ailleurs — un compte
            rendu de réunion qui nomme la pétition —{" "}
            <Link href="/passages-en-commission">nous la publions</Link>. Ce que les données
            établissent, c&apos;est que{" "}
            <strong>
              ce fichier n&apos;en porte aucune trace, et que le citoyen qui s&apos;y fie ne
              peut donc pas l&apos;y lire
            </strong>
            .
          </p>
          <p>
            Ils ne désignent personne non plus. Le classement d&apos;office faute de
            signatures est une règle que chaque commission se donne&nbsp;: les textes de
            décision du fichier l&apos;écrivent eux-mêmes, en renvoyant le plus souvent à
            une décision du bureau de la commission saisie. Nous ignorons si une réponse
            individualisée est due au signataire&nbsp;; ce que ces chiffres décrivent,
            c&apos;est ce que ces règles laissent voir.
          </p>
        </div>
      </section>
    )}

    {/* Comparaison avec l'interface, et non chiffre du site : ces valeurs
        sont relevées à la main sur la plateforme, qui n'est pour nous
        qu'une source de contexte. D'où la présentation sobre et la date
        en évidence, à distance du bloc « constat » bâti sur le fichier. */}
    <section className={styles.comparaison} id="suivi">
      <p className={styles.eyebrow}>
        Comparaison avec l&apos;interface officielle · relevé du{" "}
        {formatFrDate(SORT_PETITION.releveLe)}
        {(() => {
          // La plateforme rejette les requêtes automatisées (HTTP 422) : ce
          // relevé est fait à la main et ne se rafraîchit pas tout seul. Il
          // annonce donc lui-même quand il a vieilli, plutôt que de laisser
          // sa date en petit et le lecteur faire la soustraction.
          const jours = joursDepuis(SORT_PETITION.releveLe);
          return jours !== null && jours > SORT_PETITION.peremptionJours ? (
            <>
              {" · "}
              <strong>à revérifier — {jours} jours</strong>
            </>
          ) : null;
        })()}
      </p>
      <h2>
        La plateforme prévoit de dire ce qu&apos;est devenue une pétition. Le jour de notre
        relevé, aucune des {nombre(SORT_PETITION.total)} initiatives
        qu&apos;elle listait n&apos;était rangée dans l&apos;une de ces trois issues.
      </h2>

      <p className={styles.constatLede}>
        Cette section ne repose pas sur le fichier de données, mais sur ce que montre le
        site officiel — nous l&apos;avons relevé à la main, il ne se met pas à jour tout
        seul. Le site propose un filtre «&nbsp;Sort de la pétition&nbsp;» avec trois
        issues possibles. Les trois renvoyaient zéro résultat lors de ce relevé. Le filtre
        lui-même répond&nbsp;: au même moment, «&nbsp;Archivée&nbsp;» renvoyait{" "}
        {nombre(SORT_PETITION.archivees)} pétitions, soit le nombre que le
        fichier ouvert portait alors ({stats ? nombre(stats.archivee) : "—"}{" "}
        aujourd&apos;hui).
      </p>

      <ul className={styles.suivi}>
        {SORT_PETITION.etats.map((e) => (
          <li key={e.cle} className={e.nombre === 0 ? styles.suiviZero : undefined}>
            <a href={lienSortPetition(e.cle)} target="_blank" rel="noopener noreferrer">
              {e.libelle}
            </a>
            <span className={styles.suiviN}>
              {nombre(e.nombre)}
              {e.nombre === 0 ? "" : " pétitions"}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.reserve}>
        <h3>Ce que cela veut dire, et ce que cela ne veut pas dire</h3>
        <p>
          <strong>Cela ne signifie pas qu&apos;aucune pétition n&apos;a jamais été
          examinée.</strong>{" "}
          Nous démontrons le contraire plus bas, ordres du jour et comptes rendus à
          l&apos;appui. Cela signifie que le suivi prévu pour l&apos;expliquer au citoyen
          n&apos;était renseigné pour aucune des initiatives listées ce jour-là&nbsp;:
          toutes restaient à l&apos;état «&nbsp;Enregistrée&nbsp;».
        </p>
        <p>
          Chiffres relevés à la main le {formatFrDate(SORT_PETITION.releveLe)}. La
          plateforme refusant les requêtes automatisées, ils ne sont pas actualisés
          automatiquement — cliquez sur les libellés ci-dessus, vous verrez la même chose.
        </p>
        <p>
          Une précision d&apos;honnêteté&nbsp;: le compteur de la plateforme et celui du
          fichier ouvert ne coïncident pas, et nous ne savons pas l&apos;expliquer. Seule
          la catégorie «&nbsp;Archivée&nbsp;» correspond exactement de part et
          d&apos;autre. Les trois zéros ci-dessus, eux, ne prêtent à aucune ambiguïté.
        </p>
      </div>
    </section>

    <section className={styles.methode} id="methode">
      <h2>Comment lire ces chiffres</h2>
      <p className={styles.methodeLede}>
        Nous n&apos;enquêtons pas et nous n&apos;interprétons rien. Nous
        republions ce que l&apos;Assemblée nationale publie elle-même, en
        rendant visible ce qui s&apos;y trouve — ou ce qui devrait s&apos;y
        trouver et n&apos;y est pas.
      </p>
      <dl>
        <div className={styles.entree}>
          <dt>D&apos;où viennent les chiffres</dt>
          <dd>
            De deux fichiers publiés par l&apos;État : la liste officielle des{" "}
            <a
              href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale"
              target="_blank"
              rel="noopener noreferrer"
            >
              pétitions déposées à l&apos;Assemblée nationale
            </a>{" "}
            et l&apos;agenda des réunions de l&apos;Assemblée, qui contient
            l&apos;ordre du jour des commissions. Ce sont des documents
            ouverts, que n&apos;importe qui peut télécharger et vérifier.
          </dd>
          <dd>
            Le fichier des pétitions est <strong>notre unique source de
            référence</strong>. La plateforme officielle nous sert à comparer
            et à mettre en contexte, jamais à établir un chiffre. Attention si
            vous refaites nos calculs&nbsp;: plusieurs copies de ce fichier
            circulent, et l&apos;une d&apos;elles avait un mois de retard
            lorsque nous l&apos;avons contrôlée le 27 juillet 2026.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que nous ne calculons jamais</dt>
          <dd>
            Quand le fichier ne dit rien, nous n&apos;inventons pas. Un
            nombre de signatures absent s&apos;affiche « non renseigné » et
            non «&nbsp;0&nbsp;»
            {stats
              ? ` — cela concerne ${nombre(stats.signaturesInconnues)} pétitions.`
              : "."}{" "}
            Une date manquante
            ne devient pas une date par défaut. Un regroupement de clôtures
            est constaté sans qu&apos;une cause lui soit attribuée.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Les écarts que nous laissons tels quels</dt>
          <dd>
            Quand le fichier se contredit, nous le signalons au lieu de
            choisir à sa place. Aujourd&apos;hui&nbsp;:{" "}
            {stats ? nombre(stats.ecartStatutDates) : "—"}{" "}
            pétitions portent le statut
            «&nbsp;ouverte&nbsp;» alors que leur date limite est passée, et{" "}
            {stats ? nombre(stats.classee - stats.classeesHorsSeuil) : "—"}{" "}
            pétitions marquées «&nbsp;classée&nbsp;» ont un texte de décision indiquant
            en réalité un classement d&apos;office. C&apos;est pourquoi nous
            lisons le motif dans le texte, et jamais dans le statut.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>À quel rythme</dt>
          <dd>
            La liste des pétitions est actualisée chaque lundi matin par
            l&apos;Assemblée. Nous la récupérons ensuite pour mettre le site à
            jour. La date de dernière mise à jour est affichée en haut de
            chaque tableau.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que veut dire « classée d&apos;office »</dt>
          <dd>
            Cela signifie que le texte de décision invoque lui-même un classement
            d&apos;office faute de signatures. C&apos;est le seul motif pour lequel le
            fichier emploie une formule explicite&nbsp;: les autres classements y sont
            enregistrés sans qu&apos;aucune raison soit écrite, ce qui est précisément ce
            qui les range dans les autres catégories.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Les clôtures groupées</dt>
          <dd>
            Certaines dates voient au moins cent pétitions s&apos;arrêter en
            même temps, quel que soit leur nombre de signatures. La plus
            importante en regroupe{" "}
            {stats?.nbClotureMasse
              ? `${nombre(stats.nbClotureMasse)} au ${formatFrDate(stats.dateClotureMasse)}`
              : "plusieurs centaines"}
            . Nous constatons
            ce regroupement dans les données&nbsp;; nous n&apos;affirmons pas
            sa cause, faute d&apos;information officielle qui la documente.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que veut dire « classée »</dt>
          <dd>
            La pétition est écartée et ne connaîtra pas de suite. Attention
            toutefois&nbsp;: le fichier officiel emploie cette étiquette y
            compris pour des pétitions dont le texte de décision indique
            qu&apos;elles ont en réalité été classées d&apos;office, faute de
            signatures. Nous n&apos;écrivons donc jamais « classée après
            examen », car rien dans les données ne prouve qu&apos;un examen a
            eu lieu.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>« Le fichier public n&apos;est pas à jour »</dt>
          <dd>
            Quand une pétition porte une date de fin de recueil et que cette
            date est passée alors que le fichier de données ouvertes lui
            conserve le statut <code>ouverte</code>, nous le signalons. Le
            fichier ne renseigne pas toujours cette date&nbsp;: sans elle, nous
            ne signalons rien.
            <br />
            Le {formatFrDate(RELEVE_PLATEFORME.releveLe)}, nous avons ouvert
            {RELEVE_PLATEFORME.pages.length > 1
              ? " les pages officielles des pétitions "
              : " la page officielle de la pétition "}
            {RELEVE_PLATEFORME.pages.map((p, i) => (
              <span key={p.identifiant}>
                {i > 0 && (i === RELEVE_PLATEFORME.pages.length - 1 ? " et " : ", ")}
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  n<sup>o</sup>&nbsp;{p.identifiant}
                </a>
              </span>
            ))}
            {RELEVE_PLATEFORME.pages.length > 1 ? " : chacune affiche" : " : elle affiche"}{" "}
            sa date limite de recueil et le statut «&nbsp;
            {RELEVE_PLATEFORME.pages[0].statutAffiche}&nbsp;», et la formule
            «&nbsp;{RELEVE_PLATEFORME.formuleAbsente}&nbsp;» n&apos;y figurait pas.{" "}
            <strong>
              Le défaut porte donc sur le fichier réutilisable, pas sur ce que
              voit un citoyen.
            </strong>{" "}
            Nous le signalons parce que ce fichier est la source des travaux qui
            s&apos;appuient dessus, dont le nôtre.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>« Classée sans décision publiée »</dt>
          <dd>
            Le fichier officiel prévoit un emplacement pour expliquer pourquoi
            une pétition a été classée. Nous listons celles pour lesquelles
            cet emplacement a été laissé vide. Nous constatons une absence,
            nous n&apos;en déduisons rien : nous ignorons si une décision a été
            prise sans être rendue publique, ou si aucune ne l&apos;a été.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que nous publions, et ce que nous gardons pour nous</dt>
          <dd>
            <strong>
              Tout ce qui figure sur ce site est soit une lecture directe du
              fichier officiel, soit un rapprochement que l&apos;Assemblée a
              elle-même établi.
            </strong>{" "}
            Quand une commission inscrit une pétition à son ordre du jour, elle
            la désigne par son numéro ou son titre exact&nbsp;: nous indiquons
            à chaque étape laquelle des deux, avec le texte officiel intégral.
            <br />
            Nous calculons par ailleurs des rapprochements entre pétitions et
            débats en séance publique, par mots-clés et par dates. Rien ne
            reliant officiellement les deux, ce ne sont que des indices —
            c&apos;est pourquoi <strong>nous ne les affichons pas</strong>. Ils
            servent à orienter nos recherches, pas à établir des faits.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que nous ne pouvons pas savoir</dt>
          <dd>
            L&apos;ordre du jour d&apos;une réunion dit qu&apos;une pétition a
            été examinée, pas ce qui s&apos;y est dit. Le compte rendu de cette
            réunion, lui, le dit&nbsp;: quand il existe et qu&apos;il nomme la
            pétition, nous reproduisons la décision votée intégralement, avec le
            lien vers le texte officiel.
            <br />
            Deux choses nous échappent encore. Une commission classe des
            centaines de pétitions d&apos;office en une séance sans en nommer
            aucune, et le compte rendu ne joint la liste que dans un cas sur les
            trente-quatre que nous avons lus&nbsp;: partout ailleurs, un
            signataire ne peut pas savoir si la sienne en faisait partie. Et nous
            rapportons ce qu&apos;un vote a écrit, jamais ce qu&apos;il a voulu.
          </dd>
        </div>

        <div className={styles.entree}>
          <dt>Ce que nous avons affiché de faux</dt>
          <dd>
            Nous nous sommes trompés, et nous le publions&nbsp;: la{" "}
            <Link href="/corrections">page des corrections</Link> cite chaque
            phrase fautive telle qu&apos;elle était affichée, dit pourquoi elle
            l&apos;était et ce qui la remplace. Un site qui reproche à
            l&apos;Assemblée de ne pas publier ses décisions ne peut pas
            corriger les siennes en silence.
          </dd>
        </div>
      </dl>
      <p className={styles.methodeLede}>
        Les règles complètes, catégorie par catégorie, sont détaillées sur la
        page <Link href="/methodologie">méthodologie</Link>.
      </p>
    </section>

    </div>
  );
}
