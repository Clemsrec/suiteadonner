import Link from "next/link";
import styles from "../../donnees.module.css";
import cartes from "@/app/page.module.css";
import { FriseReunions } from "@/app/FriseReunions";
import {
  formatFrDate,
  formatSignatures,
  type PassageEnCommission,
  type PetitionAbsente,
} from "@/lib/petitions";

// Fiche d'une pétition publiée sur la plateforme mais absente du fichier
// ouvert. Elle montre ce que le relevé a lu sur la plateforme, et ce que les
// comptes rendus de commission disent d'elle (scripts/fetch-reunions.mjs, qui
// rapproche aussi ces numéros). Aucun champ du fichier : il ne la contient pas.
// Page en noindex (voir generateMetadata) : la fiche officielle reste la seule
// complète.
export function FicheAbsente({
  p,
  releveLe,
  passages,
}: {
  p: PetitionAbsente;
  releveLe: string;
  passages: PassageEnCommission | null;
}) {
  const decisionLue = passages?.derniereDecision ?? null;

  return (
    <article className={styles.article}>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/absentes-du-fichier">Absentes du fichier</Link>
          {" · "}n°{p.identifiant}
        </p>
        <h1>{p.titre}</h1>
        <div className={styles.etat}>
          <span className={`${cartes.tag} ${cartes.tagNone}`}>Absente du fichier officiel</span>
          {p.statutLabel && <span>{p.statutLabel}</span>}
          <span>
            <span className={styles.n}>{formatSignatures(p.nbVotes)}</span> soutiens
          </span>
          <span>{p.commission || "Commission non précisée"}</span>
          {p.datePublication && <span>publiée le {formatFrDate(p.datePublication)}</span>}
        </div>
      </header>

      <div className={styles.corps}>
        <p className={styles.encadre}>
          <strong>Cette pétition n&apos;a jamais figuré dans le fichier de données
          ouvertes.</strong>{" "}
          Elle est pourtant publiée sur la plateforme de l&apos;Assemblée nationale.
          Les informations de cette page y ont été lues lors de notre relevé du{" "}
          {formatFrDate(releveLe)}. Faute de fichier, elle n&apos;entre pas dans nos
          chiffres.{" "}
          <Link href="/absentes-du-fichier">Pourquoi elle manque</Link>.
        </p>

        <section className={styles.section}>
          <h2>La décision de la commission</h2>
          {p.decisionTexte ? (
            <>
              <p>Voici le texte de décision que la plateforme affiche, reproduit tel quel.</p>
              <blockquote className={styles.citation}>
                {p.decisionTexte}
                <span className={styles.citationSource}>
                  Plateforme de l&apos;Assemblée nationale, lue le {formatFrDate(releveLe)}.
                </span>
              </blockquote>
            </>
          ) : p.recueilTermine ? (
            <p>
              Le recueil des signatures est terminé
              {p.dateLimiteVote ? ` depuis le ${formatFrDate(p.dateLimiteVote)}` : ""}, et la
              plateforme n&apos;affiche aucun texte de décision.
            </p>
          ) : p.statutSource ? (
            <p>
              Le recueil des signatures est en cours
              {p.dateLimiteVote ? ` jusqu'au ${formatFrDate(p.dateLimiteVote)}` : ""}&nbsp;:
              aucune décision n&apos;est attendue pour l&apos;instant.
            </p>
          ) : null}

          {decisionLue && (
            <>
              <h3>Ce que le compte rendu de la commission indique</h3>
              <p>
                Le compte rendu de la réunion du {formatFrDate(decisionLue.date)}, publié
                par l&apos;Assemblée nationale, énonce la décision en ces termes.
              </p>
              <blockquote className={styles.citation}>
                {decisionLue.citation}
                <span className={styles.citationSource}>
                  Compte rendu {decisionLue.compteRenduRef}, phrase reproduite intégralement —{" "}
                  <a href={decisionLue.url} target="_blank" rel="noopener noreferrer">
                    lire le compte rendu intégral
                  </a>
                  .
                </span>
              </blockquote>
            </>
          )}

          <p>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              Voir la pétition sur la plateforme de l&apos;Assemblée nationale →
            </a>
          </p>
        </section>

        {passages && passages.reunions.length > 0 && (
          <section className={styles.section}>
            <h2>Ce que la commission a fait</h2>
            <p>
              La commission a désigné cette pétition elle-même, par son numéro, à son
              ordre du jour ou dans le compte rendu de sa réunion. Chaque étape indique
              laquelle des deux, avec le texte officiel intégral.
            </p>
            <FriseReunions reunions={passages.reunions} />
          </section>
        )}
      </div>
    </article>
  );
}
