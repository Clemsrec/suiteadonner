import Link from "next/link";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import {
  getFlagshipPetitions,
  getSansDecision,
  getStats,
  getStatutObsolete,
  type Petition,
  type Stats,
} from "@/lib/petitions";

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
  error: boolean;
};

// allSettled et non all : chaque bloc de la page dépend d'une requête distincte,
// et un index Firestore encore en construction ne doit pas vider les sections
// qui, elles, fonctionnent. Chaque bloc dégrade indépendamment.
async function loadData(): Promise<PageData> {
  const [stats, flagship, sansDecision, statutObsolete] = await Promise.allSettled([
    getStats(),
    getFlagshipPetitions(6),
    getSansDecision(8),
    getStatutObsolete(5),
  ]);

  for (const r of [stats, flagship, sansDecision, statutObsolete]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }

  return {
    stats: stats.status === "fulfilled" ? stats.value : null,
    flagship: flagship.status === "fulfilled" ? flagship.value : [],
    sansDecision: sansDecision.status === "fulfilled" ? sansDecision.value : [],
    statutObsolete: statutObsolete.status === "fulfilled" ? statutObsolete.value : [],
    error: stats.status === "rejected",
  };
}

export default async function Home() {
  const { stats, flagship, sansDecision, statutObsolete, error } = await loadData();

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
                <div className={styles.l}>classées d&apos;office, sans examen</div>
              </div>
              <div className={`${styles.stat} ${styles.statFlag}`}>
                <div className={styles.n}>{stats.fortSoutienSansSuite.toLocaleString("fr-FR")}</div>
                <div className={styles.l}>fort soutien (10&nbsp;000+ signatures), classées sans suite</div>
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
              Sur {stats.total.toLocaleString("fr-FR")}{" "}
              pétitions déposées, aucune n&apos;a reçu de réponse expliquant la décision prise.
            </h2>

            <p className={styles.constatLede}>
              Signer une pétition à l&apos;Assemblée nationale n&apos;ouvre droit à aucune
              réponse motivée. Ce n&apos;est pas un dysfonctionnement&nbsp;: le règlement ne
              l&apos;impose pas. Les chiffres ci-dessous sont issus du fichier officiel et
              chacun peut les recompter.
            </p>

            <div className={styles.faits}>
              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.formulationsDistinctes.toLocaleString("fr-FR")}
                </div>
                <p>
                  formulations différentes pour l&apos;ensemble des{" "}
                  {stats.textesDecision.toLocaleString("fr-FR")}{" "}
                  décisions rédigées. Elles ne varient que par la date et le nom de la
                  commission — aucune n&apos;énonce de motif.
                </p>
              </div>

              <div className={styles.fait}>
                <div className={styles.faitN}>
                  {stats.sansTexteDecision.toLocaleString("fr-FR")}
                </div>
                <p>
                  pétitions pour lesquelles l&apos;emplacement prévu pour la décision est resté
                  entièrement vide, soit{" "}
                  {Math.round((stats.sansTexteDecision / stats.total) * 100)} % du total.
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
                  pétitions interrompues non pas à leur propre échéance, mais toutes le même
                  jour, à la fin d&apos;une législature
                  {stats.dateClotureMasse
                    ? ` — dont la plus grande vague le ${formatFrDate(stats.dateClotureMasse)}`
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
                organisé n&apos;oblige à aucune réponse individualisée, et les fins de
                législature interrompent les pétitions en cours sans procédure de reprise. Ce
                sont des règles, pas des négligences — et ce sont elles que ces chiffres
                décrivent.
              </p>
            </div>
          </section>
        )}

        <section className={styles.ledger}>
          <div className={styles.sectionHead}>
            <h2>Fort soutien, classées sans suite visible</h2>
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
              Deux situations très différentes portent la même étiquette. La
              plupart de ces pétitions n&apos;ont pas réuni assez de signatures
              dans le délai imparti. Mais un grand nombre a simplement été
              interrompu par la fin d&apos;une législature&nbsp;: quand
              l&apos;Assemblée est renouvelée, les pétitions en cours
              s&apos;arrêtent toutes le même jour, y compris celles qui avaient
              largement dépassé le seuil. La plus signée d&apos;entre elles en
              comptait plus de 260&nbsp;000.
            </dd>

            <dt>Ce que veut dire « classée »</dt>
            <dd>
              Une pétition qui a réuni assez de signatures est transmise à une
              commission de députés, qui décide de la suite à lui donner.
              Lorsqu&apos;elle décide de ne pas aller plus loin, la pétition est
              dite « classée ». Cela ne signifie pas qu&apos;elle a été débattue
              devant les députés en séance : le plus souvent, elle ne l&apos;a
              pas été.
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

            <dt>Ce que nous ne pouvons pas savoir</dt>
            <dd>
              Rien ne relie officiellement une pétition à un débat parlementaire
              — aucun numéro commun, aucun renvoi. Quand nous rapprochons les
              deux, c&apos;est par les mots employés et par les dates : c&apos;est
              un indice, jamais une preuve qu&apos;un débat a eu lieu à cause
              d&apos;une pétition. De même, les fichiers publics ne disent rien
              des auditions ni des échanges internes aux commissions : un travail
              a pu avoir lieu sans laisser de trace consultable.
            </dd>
          </dl>
        </section>

        <footer className={styles.footer}>
          <span>Suite à donner — projet indépendant, non affilié à l&apos;Assemblée nationale</span>
          <nav className={styles.footerNav}>
            <a href="#methode">Sources &amp; méthode</a>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Confidentialité</Link>
            <Link href="/politique-cookies">Cookies</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
