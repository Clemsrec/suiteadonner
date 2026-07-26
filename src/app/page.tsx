import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import { demoPetitions } from "@/lib/demo-petitions";

const TAG_CLASS: Record<string, string> = {
  debattue: styles.tagDone,
  adoptee: styles.tagDone,
  "sans-suite": styles.tagNone,
  "en-attente": styles.tagPending,
};

export default function Home() {
  const total = 1284;
  const avecSuite = 312;
  const sansSuite = 624;

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

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.n}>{total.toLocaleString("fr-FR")}</div>
              <div className={styles.l}>pétitions suivies</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.n}>{avecSuite.toLocaleString("fr-FR")}</div>
              <div className={styles.l}>avec suite (débat ou vote)</div>
            </div>
            <div className={`${styles.stat} ${styles.statFlag}`}>
              <div className={styles.n}>{sansSuite.toLocaleString("fr-FR")}</div>
              <div className={styles.l}>classées sans suite visible</div>
            </div>
          </div>
        </section>

        <SearchBar />

        <section className={styles.ledger}>
          <div className={styles.sectionHead}>
            <h2>Dernières pétitions traitées</h2>
            <span className={styles.meta}>maj 20 juil. 2026</span>
          </div>

          {demoPetitions.map((p) => (
            <a className={styles.petition} href={`/petitions/${p.slug}`} key={p.slug}>
              <div className={styles.petitionTop}>
                <div className={styles.petitionTitle}>{p.titre}</div>
                <span className={`${styles.tag} ${TAG_CLASS[p.statut]}`}>
                  {p.statutLabel}
                </span>
              </div>
              <div className={styles.petitionMeta}>
                <span>
                  <span className={styles.n}>{p.soutiens.toLocaleString("fr-FR")}</span> soutiens
                </span>
                <span>{p.commission}</span>
                <span>{p.date}</span>
              </div>
            </a>
          ))}

          <div className={styles.ledgerFoot}>
            <a href="/petitions">Voir les {total.toLocaleString("fr-FR")} pétitions →</a>
          </div>
        </section>

        <section className={styles.methode} id="methode">
          <h2>Méthode</h2>
          <dl>
            <dt>Source</dt>
            <dd>Jeu de données ouvertes des pétitions, data.assemblee-nationale.fr</dd>
            <dt>Mise à jour</dt>
            <dd>Chaque lundi, par import automatisé</dd>
            <dt>Limites</dt>
            <dd>
              Le statut affiché reflète le dernier événement enregistré dans
              l&apos;open data ; certains délais internes à l&apos;Assemblée ne
              sont pas horodatés avec précision.
            </dd>
          </dl>
          <p className={styles.demoNote}>
            Maquette de démonstration — les chiffres et pétitions ci-dessus
            sont illustratifs, le connecteur vers l&apos;open data
            n&apos;est pas encore branché.
          </p>
        </section>

        <footer className={styles.footer}>
          <span>Suite à donner — projet indépendant, non affilié à l&apos;Assemblée nationale</span>
          <a href="#methode">Sources &amp; méthode</a>
        </footer>
      </div>
    </>
  );
}
