import Link from "next/link";
import styles from "./page.module.css";
import theme from "./theme.module.css";
import BoutonTheme from "./BoutonTheme";
import SearchBar from "./SearchBar";
import TableauPetitions, { type LignePetition } from "./TableauPetitions";
import EmpreinteCarbone from "./EmpreinteCarbone";
import CetteSemaine from "./CetteSemaine";
import { PointsForts } from "./PointsForts";
import {
  getDernierImport,
  getFlagshipPetitions,
  getSyntheseCommission,
  getStats,
  formatFrDate,
  type ImportDelta,
  type SyntheseCommission,
  type Petition,
  type Stats,
} from "@/lib/petitions";
import { LEGAL } from "@/lib/site";
import { nombre } from "@/lib/nombre";

// Les données source ne changent qu'une fois par semaine (republication du
// lundi côté data.gouv.fr) : rendre la page à chaque visite faisait 20 lectures
// Firestore par visiteur pour un résultat identique. En ISR, la page est servie
// depuis le cache et régénérée au plus une fois par heure — le trafic n'a plus
// d'effet sur Firestore, et une seule instance encaisse n'importe quel pic.
export const revalidate = 3600;

type PageData = {
  stats: Stats | null;
  flagship: Petition[];
  synthese: SyntheseCommission | null;
  dernierImport: ImportDelta | null;
  error: boolean;
};

// allSettled et non all : chaque bloc de la page dépend d'une requête distincte,
// et un index Firestore encore en construction ne doit pas vider les sections
// qui, elles, fonctionnent. Chaque bloc dégrade indépendamment.
async function loadData(): Promise<PageData> {
  const [stats, flagship, synthese, dernierImport] = await Promise.allSettled([
    getStats(),
    getFlagshipPetitions(6),
    getSyntheseCommission(),
    getDernierImport(),
  ]);

  for (const r of [stats, flagship, synthese, dernierImport]) {
    if (r.status === "rejected") console.error("Lecture Firestore impossible :", r.reason);
  }

  return {
    stats: stats.status === "fulfilled" ? stats.value : null,
    flagship: flagship.status === "fulfilled" ? flagship.value : [],
    synthese: synthese.status === "fulfilled" ? synthese.value : null,
    dernierImport: dernierImport.status === "fulfilled" ? dernierImport.value : null,
    error: stats.status === "rejected",
  };
}

export default async function Home() {
  const { stats, flagship, synthese, dernierImport, error } = await loadData();

  return (
    <>
      <header className={styles.site}>
        <div className={styles.siteInner}>
          <div className={theme.ligne}>
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
          <BoutonTheme />
          </div>
          <nav className={styles.siteNav}>
            <a href="#recherche">Rechercher</a>
            <Link href="/petitions">Les pétitions</Link>
            <Link href="/passages-en-commission">En commission</Link>
            <Link href="/decisions-non-publiees">Sans décision</Link>
            <Link href="/fichier-non-a-jour">Fichier non à jour</Link>
            <Link href="/chiffres-en-detail">Les chiffres</Link>
            <Link href="/methodologie">Méthode</Link>
          </nav>
        </div>
      </header>

      <div className={styles.wrap}>
        <main id="contenu" tabIndex={-1}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Pétitions à l&apos;Assemblée nationale</p>
          <h1>Que devient votre pétition après la signature&nbsp;?</h1>
          <p className={styles.lede}>
            Chaque semaine, nous regardons ce que deviennent les pétitions déposées à
            l&apos;Assemblée nationale&nbsp;: quelle commission les reçoit, ce qu&apos;elle a
            décidé, et ce qui manque. Nos chiffres viennent des documents que l&apos;Assemblée
            publie elle-même.
          </p>

          <SearchBar />

          {stats ? (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.n}>{nombre(stats.total)}</div>
                <div className={styles.l}>pétitions suivies</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.n}>{nombre(stats.archivee + stats.expiree)}</div>
                <div className={styles.l}>classées d&apos;office</div>
              </div>
              <div className={`${styles.stat} ${styles.statFlag}`}>
                <div className={styles.n}>{nombre(stats.seuilAtteint)}</div>
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

        {/* Le parcours ne dit que ce que le site établit ailleurs, sources à
            l'appui (méthodologie, passages en commission) : aucune règle de
            droit n'est ajoutée ici. */}
        <section className={styles.parcours} aria-labelledby="parcours">
          <h2 id="parcours">Le parcours d&apos;une pétition</h2>
          <ol className={styles.etapes}>
            <li className={styles.etape}>
              <span className={styles.etapeN}>1</span>
              <h3>Vous signez</h3>
              <p>La pétition est déposée et signée sur la plateforme officielle de l&apos;Assemblée nationale.</p>
              <p className={styles.etapeNous}>Nous relevons son nombre de signatures chaque semaine.</p>
            </li>
            <li className={styles.etape}>
              <span className={styles.etapeN}>2</span>
              <h3>Une commission la reçoit</h3>
              <p>Elle est confiée à la commission de députés qui traite son sujet&nbsp;: les lois, les affaires sociales, la culture…</p>
              <p className={styles.etapeNous}>Nous indiquons laquelle, d&apos;après le fichier officiel.</p>
            </li>
            <li className={styles.etape}>
              <span className={styles.etapeN}>3</span>
              <h3>La commission décide</h3>
              <p>
                Elle la classe, c&apos;est-à-dire n&apos;y donne pas suite, ou elle l&apos;examine.
                Restée six mois sous le nombre de signatures fixé par sa commission, une
                pétition peut être classée d&apos;office, sans examen.
              </p>
              <p className={styles.etapeNous}>Nous cherchons la décision dans le fichier officiel et dans les comptes rendus de réunion.</p>
            </li>
            <li className={styles.etape}>
              <span className={styles.etapeN}>4</span>
              <h3>Un rapport, ou pas</h3>
              <p>Si la commission l&apos;examine, elle nomme un député rapporteur, et un rapport peut être publié.</p>
              <p className={styles.etapeNous}>Nous cherchons les rapports qui citent son numéro.</p>
            </li>
          </ol>
        </section>

        <PointsForts synthese={synthese} />

        <section className={styles.explorer} aria-labelledby="explorer">
          <h2 id="explorer">Ce que nous avons vu</h2>
          <div className={styles.cartes}>
            {stats ? (
              <Link className={styles.carte} href="/decisions-non-publiees">
                <span className={styles.carteN}>{nombre(stats.classeesHorsSeuilSansTexte)}</span>
                <span className={styles.carteTitre}>Classées sans explication</span>
                <span className={styles.carteTexte}>
                  pétitions classées&nbsp;: le fichier officiel prévoit une case pour expliquer
                  la décision, et elle est restée vide.
                </span>
              </Link>
            ) : null}
            {stats ? (
              <Link className={styles.carte} href="/fichier-non-a-jour">
                <span className={styles.carteN}>{nombre(stats.ecartStatutDates)}</span>
                <span className={styles.carteTitre}>Un fichier pas à jour</span>
                <span className={styles.carteTexte}>
                  pétitions encore marquées «&nbsp;ouverte&nbsp;» dans le fichier officiel, alors
                  que leur date limite de signature est passée.
                </span>
              </Link>
            ) : null}
            <Link className={styles.carte} href="/passages-en-commission">
              <span className={styles.carteTitre}>En commission</span>
              <span className={styles.carteTexte}>
                Les réunions où une commission a parlé d&apos;une pétition, avec la phrase
                officielle et le lien vers le texte complet.
              </span>
            </Link>
            <Link className={styles.carte} href="/chiffres-en-detail">
              <span className={styles.carteTitre}>Les chiffres en détail</span>
              <span className={styles.carteTexte}>
                Le constat complet, la comparaison avec la plateforme officielle, et ce que
                ces chiffres ne disent pas.
              </span>
            </Link>
          </div>
        </section>

        <CetteSemaine delta={dernierImport} />

        <section className={styles.ledger}>
          <div className={styles.sectionHead}>
            <h2 id="tres-signees">Très signées, puis classées</h2>
            {stats?.updatedAt && (
              <span className={styles.meta}>maj {formatFrDate(stats.updatedAt.slice(0, 10))}</span>
            )}
          </div>
          {stats ? (
            <p className={styles.extrait}>
              Les {flagship.length} plus signées parmi les {nombre(stats.classee)} pétitions
              classées. Vous trouverez les autres avec la recherche, en haut de la page.
            </p>
          ) : null}

          {flagship.length > 0 && (
            <TableauPetitions
              enteteDate="Déposée le"
              complet={false}
              titreId="tres-signees"
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

        <section className={styles.methode} id="methode">
          <h2>Comment nous travaillons</h2>
          <p className={styles.methodeLede}>
            Nous ne donnons pas d&apos;avis. Nous lisons les documents publiés par
            l&apos;Assemblée nationale et nous montrons ce qu&apos;ils contiennent, ou ce qui
            y manque. Chaque chiffre renvoie à sa source, et nos erreurs sont publiées sur la{" "}
            <Link href="/corrections">page des corrections</Link>.
          </p>
          <p className={styles.methodeLede}>
            <Link href="/methodologie">Notre méthode, règle par règle →</Link>
          </p>
        </section>

        <section className={styles.contribuer} id="contribuer">
          <h2>Une erreur&nbsp;? Une contribution&nbsp;?</h2>
          <p>
            Ce site n&apos;a d&apos;intérêt que s&apos;il est exact. Si vous
            repérez un chiffre faux, un rapprochement abusif ou une formulation
            qui va plus loin que ce que les données démontrent, écrivez-nous&nbsp;:
            la correction sera faite et signalée sur la{" "}
            <Link href="/corrections">page des corrections</Link>, où figurent
            déjà celles que nous avons dû faire.
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
        </main>

        <footer className={styles.footer}>
          <span>Suite à donner — projet indépendant, non affilié à l&apos;Assemblée nationale</span>
          <EmpreinteCarbone />
          <nav className={styles.footerNav}>
            <Link href="/petitions">Toutes les pétitions</Link>
            <Link href="/chiffres-en-detail">Les chiffres en détail</Link>
            <Link href="/methodologie">Méthodologie</Link>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Confidentialité</Link>
            <Link href="/politique-cookies">Cookies</Link>
            <Link href="/accessibilite">Accessibilité : non conforme</Link>
            <Link href="/empreinte-carbone">Empreinte carbone</Link>
            <Link href="/plan-du-site">Plan du site</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
