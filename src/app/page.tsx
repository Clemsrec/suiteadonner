import Link from "next/link";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import {
  getFlagshipPetitions,
  getPassagesEnCommission,
  getSansDecision,
  getStats,
  getStatutObsolete,
  type PassageEnCommission,
  type Petition,
  type Stats,
} from "@/lib/petitions";
import { LEGAL } from "@/lib/site";

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
    getStatutObsolete(5),
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
            <a href="#commission">En commission</a>
            <a href="#statut-obsolete">Statut figé</a>
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
                <div className={styles.n}>{stats.fortSoutienSansSuite.toLocaleString("fr-FR")}</div>
                <div className={styles.l}>classées après avoir dépassé 10&nbsp;000 signatures</div>
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
                  {stats.closesSansTexte.toLocaleString("fr-FR")}
                </div>
                <p>
                  pétitions dont le recueil est terminé et pour lesquelles l&apos;emplacement
                  prévu pour la décision est resté entièrement vide. Les pétitions encore en
                  cours de signature ne sont pas comptées ici.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {(Math.round((stats.seuilDixMille / stats.total) * 1000) / 10)
                    .toLocaleString("fr-FR")}
                  &nbsp;%
                </div>
                <p>
                  des pétitions atteignent 10&nbsp;000 signatures, le seuil en dessous duquel
                  elles sont classées automatiquement, sans examen —{" "}
                  {stats.seuilDixMille.toLocaleString("fr-FR")} sur{" "}
                  {stats.total.toLocaleString("fr-FR")}.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.clotureesEnMasse.toLocaleString("fr-FR")}
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
                  <span className={styles.n}>{p.nbVotes.toLocaleString("fr-FR")}</span> soutiens
                </span>
                <span>{p.commission || "Commission non précisée"}</span>
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
                    <span className={styles.n}>{p.nbVotes.toLocaleString("fr-FR")}</span> soutiens
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
              <h2>Recueil terminé, statut jamais mis à jour</h2>
            </div>

            <p className={styles.blockLede}>
              La date limite de signature de ces pétitions est passée, parfois
              depuis des mois. Le jeu de données officiel les affiche pourtant
              toujours comme « en cours de signature », sans décision de
              commission.
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
                  <span className={`${styles.tag} ${styles.tagNone}`}>Statut non mis à jour</span>
                </div>
                <div className={styles.petitionMeta}>
                  <span>
                    <span className={styles.n}>{p.nbVotes.toLocaleString("fr-FR")}</span> soutiens
                  </span>
                  <span>Date limite : {formatFrDate(p.dateLimiteVote)}</span>
                  <span>{p.commission || "Commission non précisée"}</span>
                </div>
              </a>
            ))}
          </section>
        )}

        <section className={styles.ledger} id="sans-decision">
          <div className={styles.sectionHead}>
            <h2>Classées sans décision publiée</h2>
            {stats?.sansDecision ? (
              <span className={styles.meta}>{stats.sansDecision} au total</span>
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
                  {stats.sansDecision.toLocaleString("fr-FR")} pétitions concernées.
                </p>
              ) : null}
              {stats?.signaturesSansDecision ? (
                <p className={styles.counter}>
                  <span className={styles.counterN}>
                    {Math.round(stats.signaturesSansDecision).toLocaleString("fr-FR")}
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
                      <span className={styles.n}>{p.nbVotes.toLocaleString("fr-FR")}</span> soutiens
                    </span>
                    <span>{p.commission || "Commission non précisée"}</span>
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
              et le compte rendu de tout ce qui se dit en séance, publié au
              Journal officiel. Ce sont des documents ouverts, que
              n&apos;importe qui peut télécharger et vérifier.
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

            <dt>« Statut jamais mis à jour »</dt>
            <dd>
              Chaque pétition a une date de fin de récolte des signatures. Nous
              vérifions si cette date est passée. Quand elle l&apos;est mais que
              la pétition reste affichée « en cours de signature » sur le site
              officiel, nous le signalons. C&apos;est le cas de la pétition la
              plus signée de toute la plateforme, huit mois après sa clôture.
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
