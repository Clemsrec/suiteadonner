import Link from "next/link";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import TableauPetitions, { type LignePetition } from "./TableauPetitions";
import EmpreinteCarbone from "./EmpreinteCarbone";
import CetteSemaine from "./CetteSemaine";
import { FriseReunions } from "./FriseReunions";
import { PointsForts } from "./PointsForts";
import {
  getDernierImport,
  getFlagshipPetitions,
  getPassagesEnCommission,
  getSansDecision,
  getSyntheseCommission,
  getStats,
  getEcartStatutDates,
  formatFrDate,
  formatSignatures,
  joursDepuis,
  type ImportDelta,
  type PassageEnCommission,
  type SyntheseCommission,
  type Petition,
  type Stats,
} from "@/lib/petitions";
import { LEGAL, SORT_PETITION, lienSortPetition } from "@/lib/site";

// Les données source ne changent qu'une fois par semaine (republication du
// lundi côté data.gouv.fr) : rendre la page à chaque visite faisait 20 lectures
// Firestore par visiteur pour un résultat identique. En ISR, la page est servie
// depuis le cache et régénérée au plus une fois par heure — le trafic n'a plus
// d'effet sur Firestore, et une seule instance encaisse n'importe quel pic.
export const revalidate = 3600;

type PageData = {
  stats: Stats | null;
  flagship: Petition[];
  sansDecision: Petition[];
  statutObsolete: Petition[];
  commission: PassageEnCommission[];
  synthese: SyntheseCommission | null;
  dernierImport: ImportDelta | null;
  error: boolean;
};

// allSettled et non all : chaque bloc de la page dépend d'une requête distincte,
// et un index Firestore encore en construction ne doit pas vider les sections
// qui, elles, fonctionnent. Chaque bloc dégrade indépendamment.
async function loadData(): Promise<PageData> {
  const [stats, flagship, sansDecision, statutObsolete, commission, synthese, dernierImport] =
    await Promise.allSettled([
      getStats(),
      getFlagshipPetitions(6),
      getSansDecision(8),
      getEcartStatutDates(5),
      getPassagesEnCommission(6),
      getSyntheseCommission(),
      getDernierImport(),
    ]);

  for (const r of [stats, flagship, sansDecision, statutObsolete, commission, synthese, dernierImport]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }

  return {
    stats: stats.status === "fulfilled" ? stats.value : null,
    flagship: flagship.status === "fulfilled" ? flagship.value : [],
    sansDecision: sansDecision.status === "fulfilled" ? sansDecision.value : [],
    statutObsolete: statutObsolete.status === "fulfilled" ? statutObsolete.value : [],
    commission: commission.status === "fulfilled" ? commission.value : [],
    synthese: synthese.status === "fulfilled" ? synthese.value : null,
    dernierImport: dernierImport.status === "fulfilled" ? dernierImport.value : null,
    error: stats.status === "rejected",
  };
}

export default async function Home() {
  const { stats, flagship, sansDecision, statutObsolete, commission, synthese, dernierImport, error } =
    await loadData();

  // Le constat était écrit en dur. Il a cessé d'être vrai le jour où une
  // pétition passée en commission a eu, elle, un texte de décision au fichier.
  const commissionSansDecision = commission.filter((p) => !p.decisionPubliee);

  return (
    <>
      <header className={styles.site}>
        <div className={styles.siteInner}>
          <a className={styles.wordmark} href="#">
            {/* Symbole inline plutôt qu'un <img> vers public/logo : les deux
                traits reprennent les variables de thème, donc la bascule
                clair/sombre est exacte sans second fichier ni requête. Les SVG
                de public/logo restent le jeu distribuable (presse, réseaux). */}
            <svg
              className={styles.mark}
              viewBox="0 0 32 32"
              width="26"
              height="26"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2.4"
                strokeDasharray="4.2 3.34"
                strokeDashoffset="2.1"
              />
              <line
                x1="10.5"
                y1="16"
                x2="21.5"
                y2="16"
                stroke="var(--accent)"
                strokeWidth="2.2"
              />
            </svg>
            <span className={styles.wordmarkText}>
              Suite à donner
              <small>Observatoire des pétitions citoyennes</small>
            </span>
          </a>
          <nav className={styles.siteNav}>
            <a href="#constat">Le constat</a>
            <a href="#recherche">Rechercher</a>
            <a href="#suivi">Le suivi</a>
            <a href="#commission">En commission</a>
            <a href="#statut-obsolete">Fichier non à jour</a>
            <a href="#sans-decision">Sans décision</a>
            <a href="#methode">Méthode</a>
            <Link href="/petitions">Toutes les pétitions</Link>
          </nav>
        </div>
      </header>

      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Assemblée nationale — données ouvertes</p>
          <h1>Que devient votre pétition après la signature&nbsp;?</h1>
          <p className={styles.lede}>
            Chaque semaine, nous suivons les pétitions déposées à l&apos;Assemblée
            nationale, de leur dépôt à leur sort final. Pas de discours — les
            faits, la commission compétente, et ce qu&apos;il en reste.
          </p>

          {stats ? (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.n}>{stats.total.toLocaleString("fr-FR")}</div>
                <div className={styles.l}>pétitions suivies</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.n}>
                  {(stats.archivee + stats.expiree).toLocaleString("fr-FR")}
                </div>
                <div className={styles.l}>classées d&apos;office</div>
              </div>
              <div className={`${styles.stat} ${styles.statFlag}`}>
                <div className={styles.n}>{stats.seuilAtteint.toLocaleString("fr-FR")}</div>
                <div className={styles.l}>ont dépassé 10&nbsp;000 signatures</div>
              </div>
            </div>
          ) : (
            <p className={styles.demoNote} style={{ marginTop: 28 }}>
              {error
                ? "Les données ne sont pas accessibles pour le moment. Merci de réessayer dans quelques minutes."
                : "Les données sont en cours de préparation et seront affichées prochainement."}
            </p>
          )}
        </section>

        <PointsForts synthese={synthese} />

        <CetteSemaine delta={dernierImport} />

        <SearchBar />

        {stats && (
          <section className={styles.constat} id="constat">
            <p className={styles.eyebrow}>Le constat d&apos;ensemble</p>
            <h2>
              Quand le fichier ne rattache pas un classement au nombre de signatures, il
              n&apos;écrit le plus souvent aucune motivation&nbsp;:{" "}
              {stats.classeesHorsSeuilSansTexte.toLocaleString("fr-FR")} fois sur{" "}
              {stats.classeesHorsSeuil.toLocaleString("fr-FR")}.
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
                  {stats.formulationsDistinctes.toLocaleString("fr-FR")}
                </div>
                <p>
                  formulations différentes pour l&apos;ensemble des{" "}
                  {stats.textesDecision.toLocaleString("fr-FR")}{" "}
                  décisions rédigées. Ce sont des formules types&nbsp;: aucune ne cite le numéro
                  ni le titre de la pétition qu&apos;elle concerne — nous les avons toutes
                  relues pour le vérifier.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.motifAbsent.toLocaleString("fr-FR")}
                </div>
                <p>
                  pétitions dont le recueil est terminé et pour lesquelles l&apos;emplacement
                  prévu pour la décision est resté entièrement vide. Les pétitions encore en
                  cours de signature ne sont pas comptées ici.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {(Math.round((stats.seuilAtteint / stats.total) * 1000) / 10)
                    .toLocaleString("fr-FR")}
                  &nbsp;%
                </div>
                <p>
                  des pétitions dépassent 10&nbsp;000 signatures —{" "}
                  {stats.seuilAtteint.toLocaleString("fr-FR")} sur{" "}
                  {stats.total.toLocaleString("fr-FR")}.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.clotureGroupee.toLocaleString("fr-FR")}
                </div>
                <p>
                  pétitions dont le recueil s&apos;est arrêté le même jour qu&apos;au moins
                  cent autres
                  {stats.dateClotureMasse
                    ? ` — la plus grosse vague en regroupe ${stats.nbClotureMasse.toLocaleString("fr-FR")} le ${formatFrDate(stats.dateClotureMasse)}`
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

        <section className={styles.ledger}>
          <div className={styles.sectionHead}>
            <h2>Fort soutien, puis classées</h2>
            {stats?.updatedAt && (
              <span className={styles.meta}>maj {formatFrDate(stats.updatedAt.slice(0, 10))}</span>
            )}
          </div>
          {stats ? (
            <p className={styles.extrait}>
              Les {flagship.length} plus signées parmi les{" "}
              {stats.classee.toLocaleString("fr-FR")} pétitions classées. Les autres sont
              accessibles par la recherche ci-dessus.
            </p>
          ) : null}

          {flagship.length > 0 && (
            <TableauPetitions
              enteteDate="Déposée le"
              complet={false}
              lignes={flagship.map((p): LignePetition => ({
                identifiant: p.identifiant,
                titre: p.titre,
                tagLabel: p.statutLabel,
                tagType: "examined",
                nbVotes: p.nbVotes,
                commission: p.commissionSource,
                date: p.datePublication,
              }))}
            />
          )}

          {!flagship.length && (
            <p className={styles.demoNote}>Pas encore de données à afficher ici.</p>
          )}

          <div className={styles.ledgerFoot}>
            <Link href="/petitions">Toutes les pétitions, année par année →</Link>
          </div>
        </section>

        {commission.length > 0 && (
          <section className={styles.ledger} id="commission">
            <div className={styles.sectionHead}>
              <h2>Ce que la commission a fait</h2>
            </div>

            <p className={styles.blockLede}>
              Ces rapprochements ne sont pas des déductions de notre part&nbsp;:
              la commission a désigné ces pétitions elle-même, par leur numéro ou
              par leur titre exact, à son ordre du jour ou dans le compte rendu de
              sa réunion. Chaque étape ci-dessous indique laquelle des trois, et
              donne accès au texte officiel intégral pour que vous puissiez le
              vérifier.
            </p>
            <p className={styles.blockLede}>
              Nous écartons volontairement tout rapprochement incertain&nbsp;:
              lorsque plusieurs pétitions portent le même titre et qu&apos;aucun
              numéro n&apos;est cité, nous préférons une lacune à une attribution
              douteuse. Cette liste est donc un minimum, pas un total.
            </p>
            {commissionSansDecision.length > 0 && (
              <p className={styles.blockLede}>
                <strong>
                  Pour{" "}
                  {commissionSansDecision.length === commission.length
                    ? "aucune"
                    : commissionSansDecision.length}{" "}
                  d&apos;entre elles, le fichier public ne mentionne la moindre
                  décision.
                </strong>{" "}
                Le travail a eu lieu&nbsp;; le signataire n&apos;en saura rien par
                le fichier qu&apos;on lui donne à lire.
              </p>
            )}

            {commission.map((p) => (
              <div className={styles.passage} key={p.identifiant}>
                <div className={styles.petitionTop}>
                  <Link className={styles.petitionTitle} href={`/petition/${p.identifiant}`}>
                    {p.titre}
                  </Link>
                  <span
                    className={`${styles.tag} ${p.decisionPubliee ? styles.tagExamined : styles.tagNone}`}
                  >
                    {p.decisionPubliee ? "Décision publiée au fichier" : "Décision non publiée"}
                  </span>
                </div>
                <div className={styles.petitionMeta}>
                  <span>
                    {p.nbVotes === null ? (
                      "Nombre de soutiens non renseigné"
                    ) : (
                      <>
                        <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                      </>
                    )}
                  </span>
                  <span>{p.commission || "Commission non précisée"}</span>
                </div>

                <FriseReunions reunions={p.reunions} />
              </div>
            ))}

            <div className={styles.ledgerFoot}>
              <Link href="/passages-en-commission">Tous les passages en commission →</Link>
            </div>
          </section>
        )}

        {statutObsolete.length > 0 && (
          <section className={styles.ledger} id="statut-obsolete">
            <div className={styles.sectionHead}>
              <h2>Le fichier public n&apos;est pas à jour</h2>
            </div>

            <p className={styles.blockLede}>
              La date limite de recueil des signatures de ces pétitions est
              passée, parfois depuis des mois. Le fichier de données ouvertes
              leur conserve pourtant le statut <code>ouverte</code>, sans
              décision de commission.
            </p>
            <p className={styles.blockLede}>
              Précision importante&nbsp;: <strong>la plateforme officielle,
              elle, affiche bien la date limite</strong>{" "}
              et ne prétend pas que le recueil se poursuit. Ce défaut ne concerne que le fichier
              réutilisable — c&apos;est-à-dire celui dont se servent les
              chercheurs, les journalistes et ce site.
            </p>

            <TableauPetitions
              enteteDate="Date limite"
              complet={false}
              lignes={statutObsolete.map((p): LignePetition => ({
                identifiant: p.identifiant,
                titre: p.titre,
                tagLabel: "Fichier non à jour",
                tagType: "none",
                nbVotes: p.nbVotes,
                commission: p.commissionSource,
                date: p.dateLimiteVote,
              }))}
            />

            <div className={styles.ledgerFoot}>
              <Link href="/fichier-non-a-jour">La liste complète et le détail du constat →</Link>
            </div>
          </section>
        )}

        <section className={styles.ledger} id="sans-decision">
          <div className={styles.sectionHead}>
            <h2>Classées sans décision publiée</h2>
            {stats?.classeesHorsSeuilSansTexte ? (
              <span className={styles.meta}>{stats.classeesHorsSeuilSansTexte} au total</span>
            ) : null}
          </div>

          <p className={styles.blockLede}>
            Ces pétitions sont classées.
            Le jeu de données officiel prévoit un champ pour motiver cette
            décision&nbsp;: il est resté vide.
          </p>

          {sansDecision.length ? (
            <>
              {stats ? (
                <p className={styles.extrait}>
                  Les {sansDecision.length} plus signées parmi les{" "}
                  {stats.classeesHorsSeuilSansTexte.toLocaleString("fr-FR")} pétitions concernées.
                </p>
              ) : null}
              {stats?.signaturesClasseesSansTexte ? (
                <p className={styles.counter}>
                  <span className={styles.counterN}>
                    {Math.round(stats.signaturesClasseesSansTexte).toLocaleString("fr-FR")}
                  </span>{" "}
                  signatures cumulées, aucune motivation publiée
                </p>
              ) : null}

              <TableauPetitions
                enteteDate="Recueil clos le"
              complet={false}
                lignes={sansDecision.map((p): LignePetition => ({
                  identifiant: p.identifiant,
                  titre: p.titre,
                  tagLabel: "Décision non publiée",
                  tagType: "none",
                  nbVotes: p.nbVotes,
                  commission: p.commissionSource,
                  date: p.dateLimiteVote,
                }))}
              />

              <div className={styles.ledgerFoot}>
                <Link href="/decisions-non-publiees">
                  Toutes les pétitions classées sans décision publiée →
                </Link>
              </div>
            </>
          ) : (
            <p className={styles.demoNote}>
              Aucune pétition dans ce cas pour le moment.
            </p>
          )}
        </section>

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
            relevé, aucune des {SORT_PETITION.total.toLocaleString("fr-FR")} initiatives
            qu&apos;elle listait n&apos;était rangée dans l&apos;une de ces trois issues.
          </h2>

          <p className={styles.constatLede}>
            Cette section ne repose pas sur le fichier de données, mais sur ce que montre le
            site officiel — nous l&apos;avons relevé à la main, il ne se met pas à jour tout
            seul. Le site propose un filtre «&nbsp;Sort de la pétition&nbsp;» avec trois
            issues possibles. Les trois renvoyaient zéro résultat lors de ce relevé. Le filtre
            lui-même répond&nbsp;: au même moment, «&nbsp;Archivée&nbsp;» renvoyait{" "}
            {SORT_PETITION.archivees.toLocaleString("fr-FR")} pétitions, soit le nombre que le
            fichier ouvert portait alors ({stats ? stats.archivee.toLocaleString("fr-FR") : "—"}{" "}
            aujourd&apos;hui).
          </p>

          <ul className={styles.suivi}>
            {SORT_PETITION.etats.map((e) => (
              <li key={e.cle} className={e.nombre === 0 ? styles.suiviZero : undefined}>
                <a href={lienSortPetition(e.cle)} target="_blank" rel="noopener noreferrer">
                  {e.libelle}
                </a>
                <span className={styles.suiviN}>
                  {e.nombre.toLocaleString("fr-FR")}
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
          <h2>Comment nous travaillons</h2>
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
                  ? ` — cela concerne ${stats.signaturesInconnues.toLocaleString("fr-FR")} pétitions.`
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
                {stats ? stats.ecartStatutDates.toLocaleString("fr-FR") : "—"}{" "}
                pétitions portent le statut
                «&nbsp;ouverte&nbsp;» alors que leur date limite est passée, et{" "}
                {stats ? (stats.classee - stats.classeesHorsSeuil).toLocaleString("fr-FR") : "—"}{" "}
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
                  ? `${stats.nbClotureMasse.toLocaleString("fr-FR")} au ${formatFrDate(stats.dateClotureMasse)}`
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
                Nous avons vérifié la page officielle de ces pétitions&nbsp;: elle
                affiche la date limite et le statut « Acceptées », et n&apos;emploie
                jamais la formule « en cours de signature ». <strong>Le défaut
                porte donc sur le fichier réutilisable, pas sur ce que voit un
                citoyen.</strong>{" "}
                Nous le signalons parce que ce fichier est la
                source de tous les travaux qui s&apos;appuient dessus, dont le nôtre.
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
                été examinée, pas ce qui s&apos;y est dit. Les échanges, les
                arguments et le sens du vote ne figurent pas dans les données que
                nous exploitons. Un travail réel a donc pu avoir lieu sans que nous
                puissions le décrire.
              </dd>
            </div>
          </dl>
          <p className={styles.methodeLede}>
            Les règles complètes, catégorie par catégorie, sont détaillées sur la
            page <Link href="/methodologie">méthodologie</Link>.
          </p>
        </section>

        <section className={styles.contribuer} id="contribuer">
          <h2>Une erreur&nbsp;? Une contribution&nbsp;?</h2>
          <p>
            Ce site n&apos;a d&apos;intérêt que s&apos;il est exact. Si vous
            repérez un chiffre faux, un rapprochement abusif ou une formulation
            qui va plus loin que ce que les données démontrent, écrivez-nous&nbsp;:
            la correction sera faite et signalée.
          </p>
          <p>
            Sont particulièrement bienvenus les regards de spécialistes du droit
            parlementaire, de journalistes et de chercheurs, ainsi que toute aide
            technique sur la récupération et le recoupement des données.
          </p>
          <p className={styles.contact}>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
          </p>
        </section>

        <footer className={styles.footer}>
          <span>Suite à donner — projet indépendant, non affilié à l&apos;Assemblée nationale</span>
          <EmpreinteCarbone />
          <nav className={styles.footerNav}>
            <Link href="/petitions">Toutes les pétitions</Link>
            <Link href="/methodologie">Méthodologie</Link>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Confidentialité</Link>
            <Link href="/politique-cookies">Cookies</Link>
            <Link href="/empreinte-carbone">Empreinte carbone</Link>
            <Link href="/plan-du-site">Plan du site</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
