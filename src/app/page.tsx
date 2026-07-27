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

export const dynamic = "force-dynamic";

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
            Suite à donner
            <small>Observatoire des pétitions citoyennes</small>
          </a>
          <nav className={styles.siteNav}>
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
                <div className={styles.l}>classées d&apos;office, seuil non atteint</div>
              </div>
              <div className={`${styles.stat} ${styles.statFlag}`}>
                <div className={styles.n}>{stats.fortSoutienSansSuite.toLocaleString("fr-FR")}</div>
                <div className={styles.l}>fort soutien (10&nbsp;000+ signatures), classées sans suite</div>
              </div>
            </div>
          ) : (
            <p className={styles.demoNote} style={{ marginTop: 28 }}>
              {error
                ? "Données indisponibles pour le moment — vérifiez la connexion à Firestore."
                : "Aucun import n'a encore été exécuté (npm run import:petitions)."}
            </p>
          )}
        </section>

        <SearchBar />

        <section className={styles.ledger}>
          <div className={styles.sectionHead}>
            <h2>Fort soutien, classées sans suite visible</h2>
            {stats?.updatedAt && (
              <span className={styles.meta}>maj {formatFrDate(stats.updatedAt.slice(0, 10))}</span>
            )}
          </div>

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
              Pas encore de données à afficher ici — relancez l&apos;import
              (npm run import:petitions) pour calculer ce champ.
            </p>
          )}
        </section>

        <section className={styles.methode} id="methode">
          <h2>Méthode</h2>
          <dl>
            <dt>Source</dt>
            <dd>
              Jeu de données{" "}
              <a href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale">
                Pétitions de l&apos;Assemblée nationale
              </a>
              , publié sur data.gouv.fr sous Licence Ouverte 2.0
            </dd>
            <dt>Mise à jour</dt>
            <dd>Chaque lundi matin côté source ; import dans Suite à donner exécuté manuellement pour l&apos;instant</dd>
            <dt>Statut non mis à jour</dt>
            <dd>
              Nous comparons le champ <code>statut</code> à la{" "}
              <code>date_limite_vote</code>. Quand une pétition est encore
              annoncée « en cours de signature » alors que sa date limite est
              passée, nous le signalons. Le calcul est refait à chaque import.
            </dd>
            <dt>Décision non publiée</dt>
            <dd>
              Le jeu de données comporte un champ{" "}
              <code>decision_commission</code> destiné à motiver le classement.
              Nous listons les pétitions pour lesquelles ce champ est vide.
              C&apos;est un constat brut, pas une interprétation : nous ne
              savons pas si une décision a été prise sans être publiée, ou si
              aucune ne l&apos;a été.
            </dd>
            <dt>Limites</dt>
            <dd>
              Le statut « classée » signifie que la pétition a été examinée par
              le bureau de la commission compétente, pas nécessairement
              débattue en séance : le jeu de données ne documente pas les
              auditions ni les suites parlementaires ultérieures.
            </dd>
          </dl>
        </section>

        <footer className={styles.footer}>
          <span>Suite à donner — projet indépendant, non affilié à l&apos;Assemblée nationale</span>
          <a href="#methode">Sources &amp; méthode</a>
        </footer>
      </div>
    </>
  );
}
