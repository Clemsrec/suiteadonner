import styles from "./page.module.css";
import {
  acteCommission,
  formatFrDate,
  urlCompteRendu,
  type ReunionCommission,
} from "@/lib/petitions";

// La frise des passages en commission, partagée par l'accueil, la page
// /passages-en-commission et la fiche d'une pétition. Le même bloc y était
// recopié trois fois : chaque évolution était trois occasions de diverger.
//
// Composant de rendu pur, sans état ni interactivité — donc Server Component.
// Le repli du texte officiel repose sur <details>, qui fonctionne sans
// JavaScript.

// Comment la commission a désigné la pétition. Les trois voies sont d'égale
// certitude : dans les trois cas, c'est elle qui nomme, jamais nous qui
// déduisons. On dit laquelle a servi pour que le lecteur puisse vérifier.
const PROVENANCE: Record<ReunionCommission["appariement"], string> = {
  numero: "La commission cite le numéro de la pétition",
  titre:
    "L’ordre du jour reprend le titre de la pétition — rapprochement écarté si plusieurs pétitions le partagent",
  "compte-rendu": "Le compte rendu de la réunion cite le numéro de la pétition",
};

export function FriseReunions({ reunions }: { reunions: ReunionCommission[] }) {
  return (
    <ol className={styles.frise}>
      {reunions.map((r) => {
        const lienCompteRendu = urlCompteRendu(r.compteRenduRef);

        return (
          <li key={`${r.date}-${r.compteRenduRef ?? r.intitule.slice(0, 20)}`}>
            <span className={styles.friseDate}>{formatFrDate(r.date)}</span>
            <span className={styles.friseActe}>{acteCommission(r.intitule)}</span>
            <span className={styles.preuve}>{PROVENANCE[r.appariement]}</span>

            {r.decision && (
              <blockquote className={styles.friseDecision}>
                {r.decision.citation}
                <span className={styles.friseDecisionSource}>
                  Compte rendu de la réunion, reproduit sans modification.
                  {r.decision.referent === "unique" &&
                    " La commission ne répète pas le numéro dans cette phrase. Son ordre du jour ne désignait que cette pétition, par son numéro, et aucune autre n’est citée dans ce compte rendu."}
                </span>
              </blockquote>
            )}

            <details className={styles.friseDetail}>
              <summary>Texte officiel</summary>
              <p>{r.intitule}</p>
              {r.compteRenduRef && (
                <p className={styles.friseCr}>
                  Compte rendu de la réunion&nbsp;: {r.compteRenduRef}
                  {lienCompteRendu && (
                    <>
                      {" "}
                      <a
                        className={styles.friseCrLien}
                        href={lienCompteRendu}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lire le compte rendu →
                      </a>
                    </>
                  )}
                </p>
              )}
            </details>
          </li>
        );
      })}
    </ol>
  );
}
