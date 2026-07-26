import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import { getFlagshipPetitions, getStats, type Petition, type Stats } from "@/lib/petitions";

export const dynamic = "force-dynamic";

function formatFrDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

async function loadData(): Promise<{ stats: Stats | null; flagship: Petition[]; error: boolean }> {
  try {
    const [stats, flagship] = await Promise.all([getStats(), getFlagshipPetitions(6)]);
    return { stats, flagship, error: false };
  } catch (err) {
    console.error("Lecture Firestore impossible :", err);
    return { stats: null, flagship: [], error: true };
  }
}

export default async function Home() {
  const { stats, flagship, error } = await loadData();

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
