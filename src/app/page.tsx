import Link from "next/link";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import {
  getFlagshipPetitions,
  getPassagesEnCommission,
  getSansDecision,
  getStats,
  getEcartStatutDates,
  formatSignatures,
  type PassageEnCommission,
  type Petition,
  type Stats,
} from "@/lib/petitions";
import { LEGAL, SORT_PETITION, lienSortPetition } from "@/lib/site";

// Les ordres du jour sont rédigés en langue administrative : « Nomination d'un
// rapporteur, en application de l'article 148 alinéa 2 du Règlement, sur une
// pétition renvoyée à la Commission, en vue de sa présentation ». On en extrait
// l'acte en français courant, le texte officiel restant consultable en entier.
//
// Chercher les mots-clés n'importe où dans le texte donnait de faux résultats :
// ces intitulés annoncent souvent l'étape suivante (« en vue de sa présentation »,
// « décision de classement ou d'examen »), si bien qu'un même point contient
// plusieurs mots d'action. L'acte réellement accompli est toujours le PREMIER
// mot de l'intitulé — c'est donc lui seul qu'on teste.
const ACTES: Array<[RegExp, string]> = [
  [/^(nomination|d[ée]signation)/, "Nomination d’un rapporteur"],
  [/^pr[ée]sentation/, "Présentation devant la commission"],
  [/^examen/, "Examen par la commission"],
  [/^d[ée]cision/, "Décision sur son classement"],
  [/^(audition|table ronde)/, "Audition"],
];

function acteCommission(intitule: string): string {
  const debut = intitule
    .replace(/^[\s\-–—•]+/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [motif, libelle] of ACTES) {
    if (motif.test(debut)) return libelle;
  }
  // Cas restant : la pétition est évoquée au sein d'une réunion consacrée à
  // autre chose, typiquement l'audition de son initiateur.
  if (/audition|table ronde/.test(debut)) return "Audition";
  return "Évoquée en réunion";
}

// Les données source ne changent qu'une fois par semaine (republication du
// lundi côté data.gouv.fr) : rendre la page à chaque visite faisait 20 lectures
// Firestore par visiteur pour un résultat identique. En ISR, la page est servie
// depuis le cache et régénérée au plus une fois par heure — le trafic n'a plus
// d'effet sur Firestore, et une seule instance encaisse n'importe quel pic.
export const revalidate = 3600;

function formatFrDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

type PageData = {
  stats: Stats | null;
  flagship: Petition[];
  sansDecision: Petition[];
  statutObsolete: Petition[];
  commission: PassageEnCommission[];
  error: boolean;
};

// allSettled et non all : chaque bloc de la page dépend d'une requête distincte,
// et un index Firestore encore en construction ne doit pas vider les sections
// qui, elles, fonctionnent. Chaque bloc dégrade indépendamment.
async function loadData(): Promise<PageData> {
  const [stats, flagship, sansDecision, statutObsolete, commission] = await Promise.allSettled([
    getStats(),
    getFlagshipPetitions(6),
    getSansDecision(8),
    getEcartStatutDates(5),
    getPassagesEnCommission(6),
  ]);

  for (const r of [stats, flagship, sansDecision, statutObsolete, commission]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }

  return {
    stats: stats.status === "fulfilled" ? stats.value : null,
    flagship: flagship.status === "fulfilled" ? flagship.value : [],
    sansDecision: sansDecision.status === "fulfilled" ? sansDecision.value : [],
    statutObsolete: statutObsolete.status === "fulfilled" ? statutObsolete.value : [],
    commission: commission.status === "fulfilled" ? commission.value : [],
    error: stats.status === "rejected",
  };
}

export default async function Home() {
  const { stats, flagship, sansDecision, statutObsolete, commission, error } = await loadData();

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

        <SearchBar />

        {stats && (
          <section className={styles.constat} id="constat">
            <p className={styles.eyebrow}>Le constat d&apos;ensemble</p>
            <h2>
              Quand une pétition est classée pour une autre raison que le nombre de signatures,
              l&apos;Assemblée n&apos;explique pas pourquoi&nbsp;:{" "}
              {stats.classeesHorsSeuilSansTexte.toLocaleString("fr-FR")} fois sur{" "}
              {stats.classeesHorsSeuil.toLocaleString("fr-FR")}.
            </h2>

            <p className={styles.constatLede}>
              L&apos;immense majorité des pétitions sont classées automatiquement faute
              d&apos;avoir réuni 10&nbsp;000 signatures, et le fichier officiel le dit
              clairement. Mais dès qu&apos;une pétition franchit ce seuil et qu&apos;une
              commission doit se prononcer, l&apos;emplacement prévu pour motiver la décision
              reste presque toujours vide. Tous les chiffres ci-dessous proviennent du fichier
              officiel et peuvent être recomptés.
            </p>

            <div className={styles.faits}>
              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.formulationsDistinctes.toLocaleString("fr-FR")}
                </div>
                <p>
                  formulations différentes pour l&apos;ensemble des{" "}
                  {stats.textesDecision.toLocaleString("fr-FR")}{" "}
                  décisions rédigées. Ce sont des formules types, qui ne varient que par la date
                  et le nom de la commission&nbsp;: aucune n&apos;est écrite pour la pétition
                  qu&apos;elle concerne.
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
                  des pétitions atteignent 10&nbsp;000 signatures, le seuil en dessous duquel
                  elles sont classées automatiquement, sans examen —{" "}
                  {stats.seuilAtteint.toLocaleString("fr-FR")} sur{" "}
                  {stats.total.toLocaleString("fr-FR")}.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.clotureGroupee.toLocaleString("fr-FR")}
                </div>
                <p>
                  pétitions dont le recueil s&apos;est arrêté le même jour que des centaines
                  d&apos;autres, et non à une échéance qui leur soit propre
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
                échanger, tenir compte d&apos;une pétition dans un travail législatif sans
                qu&apos;aucune trace publique n&apos;en subsiste. Ce que les données établissent,
                c&apos;est qu&apos;<strong>un citoyen qui signe n&apos;a aucun moyen de le
                savoir</strong>.
              </p>
              <p>
                Ils ne désignent personne non plus. Le droit de pétition tel qu&apos;il est
                organisé n&apos;oblige à aucune réponse individualisée. Ce sont des règles, pas
                des négligences — et ce sont elles que ces chiffres décrivent.
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

          {flagship.map((p) => (
            <a
              className={styles.petition}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              key={p.identifiant}
            >
              <div className={styles.petitionTop}>
                <div className={styles.petitionTitle}>{p.titre}</div>
                <span className={`${styles.tag} ${styles.tagExamined}`}>{p.statutLabel}</span>
              </div>
              <div className={styles.petitionMeta}>
                <span>
                  <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                </span>
                <span>{p.commissionSource || "Commission non précisée"}</span>
                <span>{formatFrDate(p.datePublication)}</span>
              </div>
            </a>
          ))}

          {!flagship.length && (
            <p className={styles.demoNote}>Pas encore de données à afficher ici.</p>
          )}

          <div className={styles.ledgerFoot}>
            <a href="https://petitions.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer">
              Voir la plateforme officielle des pétitions →
            </a>
          </div>
        </section>

        {commission.length > 0 && (
          <section className={styles.ledger} id="commission">
            <div className={styles.sectionHead}>
              <h2>Ce que la commission a fait</h2>
            </div>

            <p className={styles.blockLede}>
              Ces rapprochements ne sont pas des déductions de notre part&nbsp;:
              la commission a inscrit ces pétitions à son ordre du jour en les
              désignant elle-même, par leur numéro ou par leur titre exact. Chaque
              étape ci-dessous indique laquelle des deux, et donne accès au texte
              officiel intégral pour que vous puissiez le vérifier.
            </p>
            <p className={styles.blockLede}>
              Nous écartons volontairement tout rapprochement incertain&nbsp;:
              lorsque plusieurs pétitions portent le même titre et qu&apos;aucun
              numéro n&apos;est cité, nous préférons une lacune à une attribution
              douteuse. Cette liste est donc un minimum, pas un total.
            </p>
            <p className={styles.blockLede}>
              <strong>
                Pour aucune d&apos;entre elles, le fichier public ne mentionne la
                moindre décision.
              </strong>{" "}
              Le travail a eu lieu&nbsp;; le signataire n&apos;en saura rien.
            </p>

            {commission.map((p) => (
              <div className={styles.passage} key={p.identifiant}>
                <div className={styles.petitionTop}>
                  <a
                    className={styles.petitionTitle}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.titre}
                  </a>
                  <span className={`${styles.tag} ${styles.tagNone}`}>Décision non publiée</span>
                </div>
                <div className={styles.petitionMeta}>
                  <span>
                    <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                  </span>
                  <span>{p.commission || "Commission non précisée"}</span>
                </div>

                <ol className={styles.frise}>
                  {p.reunions.map((r) => (
                    <li key={`${r.date}-${r.compteRenduRef ?? r.intitule.slice(0, 20)}`}>
                      <span className={styles.friseDate}>{formatFrDate(r.date)}</span>
                      <span className={styles.friseActe}>{acteCommission(r.intitule)}</span>
                      {/* Comment le lien a été établi : le visiteur doit pouvoir
                          juger lui-même de la solidité de chaque rapprochement. */}
                      <span className={styles.preuve}>
                        {r.appariement === "numero"
                          ? "La commission cite le numéro de la pétition"
                          : "La commission cite le titre exact de la pétition"}
                      </span>
                      {/* <details> natif : le texte officiel n'est jamais tronqué,
                          il est replié. Fonctionne sans JavaScript. */}
                      <details className={styles.friseDetail}>
                        <summary>Texte officiel</summary>
                        <p>{r.intitule}</p>
                        {r.compteRenduRef && (
                          <p className={styles.friseCr}>
                            Compte rendu de la réunion : {r.compteRenduRef}
                          </p>
                        )}
                      </details>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
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
              elle, affiche bien la date limite</strong> et ne prétend pas que
              le recueil se poursuit. Ce défaut ne concerne que le fichier
              réutilisable — c&apos;est-à-dire celui dont se servent les
              chercheurs, les journalistes et ce site.
            </p>

            {statutObsolete.map((p) => (
              <a
                className={styles.petition}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                key={p.identifiant}
              >
                <div className={styles.petitionTop}>
                  <div className={styles.petitionTitle}>{p.titre}</div>
                  <span className={`${styles.tag} ${styles.tagNone}`}>Fichier non à jour</span>
                </div>
                <div className={styles.petitionMeta}>
                  <span>
                    <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                  </span>
                  <span>Date limite : {formatFrDate(p.dateLimiteVote)}</span>
                  <span>{p.commissionSource || "Commission non précisée"}</span>
                </div>
              </a>
            ))}
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
            Ces pétitions ont été examinées par une commission, puis classées.
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

              {sansDecision.map((p) => (
                <a
                  className={styles.petition}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={p.identifiant}
                >
                  <div className={styles.petitionTop}>
                    <div className={styles.petitionTitle}>{p.titre}</div>
                    <span className={`${styles.tag} ${styles.tagNone}`}>Décision non publiée</span>
                  </div>
                  <div className={styles.petitionMeta}>
                    <span>
                      <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
                    </span>
                    <span>{p.commissionSource || "Commission non précisée"}</span>
                    <span>{formatFrDate(p.dateLimiteVote)}</span>
                  </div>
                </a>
              ))}
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
          </p>
          <h2>
            La plateforme sait dire ce qu&apos;est devenue une pétition. Elle ne l&apos;a jamais
            fait, pas une seule fois.
          </h2>

          <p className={styles.constatLede}>
            Cette section ne repose pas sur le fichier de données, mais sur ce que montre le
            site officiel — nous l&apos;avons relevé à la main, il ne se met pas à jour tout
            seul. Le site propose un filtre «&nbsp;Sort de la pétition&nbsp;» avec trois
            issues possibles. Les trois renvoient zéro résultat. Ce n&apos;est pas une panne du
            filtre&nbsp;: la recherche par statut, elle, fonctionne parfaitement — «&nbsp;Archivée&nbsp;»
            renvoie 1&nbsp;454 pétitions, très exactement le nombre inscrit dans le fichier ouvert.
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
              n&apos;est jamais renseigné&nbsp;: toutes les pétitions restent indéfiniment à
              l&apos;état «&nbsp;Enregistrée&nbsp;».
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

            <dt>Ce que nous ne calculons jamais</dt>
            <dd>
              Quand le fichier ne dit rien, nous n&apos;inventons pas. Un
              nombre de signatures absent s&apos;affiche « non renseigné » et
              non «&nbsp;0&nbsp;» — cela concerne {""}
              {stats?.signaturesInconnues ?? 0}{" "}
              pétitions. Une date manquante
              ne devient pas une date par défaut. Un regroupement de clôtures
              est constaté sans qu&apos;une cause lui soit attribuée.
            </dd>

            <dt>Les écarts que nous laissons tels quels</dt>
            <dd>
              Quand le fichier se contredit, nous le signalons au lieu de
              choisir à sa place. Aujourd&apos;hui&nbsp;:{" "}
              {stats?.ecartStatutDates ?? 0}{" "}
              pétitions portent le statut
              «&nbsp;ouverte&nbsp;» alors que leur date limite est passée, et{" "}
              {stats ? stats.classee - stats.classeesHorsSeuil : 0}{" "}
              pétitions marquées «&nbsp;classée&nbsp;» ont un texte de décision indiquant
              en réalité un classement d&apos;office. C&apos;est pourquoi nous
              lisons le motif dans le texte, et jamais dans le statut.
            </dd>

            <dt>À quel rythme</dt>
            <dd>
              La liste des pétitions est actualisée chaque lundi matin par
              l&apos;Assemblée. Nous la récupérons ensuite pour mettre le site à
              jour. La date de dernière mise à jour est affichée en haut de
              chaque tableau.
            </dd>

            <dt>Ce que veut dire « classée d&apos;office »</dt>
            <dd>
              Cela signifie qu&apos;une pétition a été écartée sans qu&apos;une
              commission ait eu à se prononcer, le plus souvent parce
              qu&apos;elle n&apos;a pas réuni 10&nbsp;000 signatures dans le
              délai imparti. Dans ce cas, le fichier officiel indique bien ce
              motif&nbsp;: c&apos;est la seule situation où une explication est
              systématiquement donnée.
            </dd>

            <dt>Les clôtures groupées</dt>
            <dd>
              Certaines dates voient des centaines de pétitions s&apos;arrêter
              en même temps, quel que soit leur nombre de signatures. La plus
              importante regroupe 892 pétitions au 9 juin 2024. Nous constatons
              ce regroupement dans les données&nbsp;; nous n&apos;affirmons pas
              sa cause, faute d&apos;information officielle qui la documente.
            </dd>

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

            <dt>« Le fichier public n&apos;est pas à jour »</dt>
            <dd>
              Chaque pétition a une date de fin de recueil des signatures. Nous
              vérifions si cette date est passée. Quand elle l&apos;est alors que
              le fichier de données ouvertes conserve le statut{" "}
              <code>ouverte</code>, nous le signalons. C&apos;est le cas de la
              pétition la plus signée de la plateforme, huit mois après sa date
              limite.
              <br />
              Nous avons vérifié la page officielle de ces pétitions&nbsp;: elle
              affiche la date limite et le statut « Acceptées », et n&apos;emploie
              jamais la formule « en cours de signature ». <strong>Le défaut
              porte donc sur le fichier réutilisable, pas sur ce que voit un
              citoyen.</strong> Nous le signalons parce que ce fichier est la
              source de tous les travaux qui s&apos;appuient dessus, dont le nôtre.
            </dd>

            <dt>« Classée sans décision publiée »</dt>
            <dd>
              Le fichier officiel prévoit un emplacement pour expliquer pourquoi
              une pétition a été classée. Nous listons celles pour lesquelles
              cet emplacement a été laissé vide. Nous constatons une absence,
              nous n&apos;en déduisons rien : nous ignorons si une décision a été
              prise sans être rendue publique, ou si aucune ne l&apos;a été.
            </dd>

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

            <dt>Ce que nous ne pouvons pas savoir</dt>
            <dd>
              L&apos;ordre du jour d&apos;une réunion dit qu&apos;une pétition a
              été examinée, pas ce qui s&apos;y est dit. Les échanges, les
              arguments et le sens du vote ne figurent pas dans les données que
              nous exploitons. Un travail réel a donc pu avoir lieu sans que nous
              puissions le décrire.
            </dd>
          </dl>
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
          <nav className={styles.footerNav}>
            <a href="#methode">Sources &amp; méthode</a>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Confidentialité</Link>
            <Link href="/politique-cookies">Cookies</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
