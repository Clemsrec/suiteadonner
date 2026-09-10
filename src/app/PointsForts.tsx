import Link from "next/link";
import styles from "./page.module.css";
import {
  formatFrDate,
  formatSignatures,
  pointFinal,
  type SyntheseCommission,
} from "@/lib/petitions";

// Ce que le site a établi de plus marquant, en tête d'accueil. Tout vient du
// document `meta/reunions`, calculé au moment de la collecte : aucun chiffre,
// aucun exemple n'est écrit ici. C'est la leçon des deux constats de l'accueil
// qui avaient été figés dans le code — « pour aucune d'entre elles le fichier
// ne mentionne de décision » a fini par être faux, sans que rien ne le signale.
//
// La section disparaît entièrement tant qu'aucune décision n'a été lue : mieux
// vaut un accueil plus court qu'une rubrique qui s'annonce et ne dit rien.

export function PointsForts({ synthese }: { synthese: SyntheseCommission | null }) {
  if (!synthese?.nbDecisionsAbsentesDuFichier) return null;

  const { emblematique, divergence } = synthese;
  const nb = synthese.nbDecisionsAbsentesDuFichier;
  const attendues = synthese.nbDecisionsAttendues;

  return (
    <section className={styles.pointsForts} aria-labelledby="etabli">
      <p className={styles.eyebrow}>Ce que nous avons établi</p>
      <h2 id="etabli">
        <span className={styles.pfChiffre}>
          {synthese.signaturesDecisionsAbsentes.toLocaleString("fr-FR")}
        </span>{" "}
        signatures portent une pétition dont la commission a voté le sort — sans que
        le fichier public en dise un mot.
      </h2>

      <p className={styles.pfLede}>
        {nb === 1 ? "Une pétition est concernée." : `${nb} pétitions sont concernées.`} Pour
        chacune, la commission a écrit sa décision dans le compte rendu de sa réunion, et le
        champ prévu pour la motiver dans le jeu de données ouvert est resté vide. Nous
        reproduisons la phrase officielle et donnons le lien vers le texte intégral —{" "}
        <Link href="/passages-en-commission">voir les décisions et leurs sources</Link>.
      </p>

      <div className={styles.pfCartes}>
        {emblematique && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Le cas le plus signé</p>
            <p className={styles.pfCarteChiffre}>{formatSignatures(emblematique.nbVotes)}</p>
            <p className={styles.pfCarteTexte}>
              signatures pour{" "}
              <Link href={`/petition/${emblematique.identifiant}`}>{emblematique.titre}</Link>
              {pointFinal(emblematique.titre)} Le {formatFrDate(emblematique.date)}, la commission
              s&apos;est prononcée pour son{" "}
              {emblematique.sens === "examen" ? "examen" : "classement"}. Le fichier public lui
              donne toujours le statut <code>{emblematique.statut}</code> et ne mentionne aucune
              décision.
            </p>
          </article>
        )}

        {divergence && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Deux sources officielles, deux versions</p>
            <p className={styles.pfCarteTexte}>
              Pour{" "}
              <Link href={`/petition/${divergence.identifiant}`}>{divergence.titre}</Link>
              {pointFinal(divergence.titre) ? "," : " —"} le fichier écrit&nbsp;: «&nbsp;
              {divergence.decisionTexte}&nbsp;»
            </p>
            <p className={styles.pfCarteTexte}>
              Le compte rendu du {formatFrDate(divergence.date)} écrit&nbsp;: «&nbsp;
              {divergence.citation}&nbsp;»
            </p>
            <p className={styles.pfCarteTexte}>
              Les deux émanent de l&apos;Assemblée nationale. Nous les publions côte à côte et
              n&apos;en départageons aucun.
            </p>
          </article>
        )}

        {attendues > 0 && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Décisions prises, textes pas encore publiés</p>
            <p className={styles.pfCarteChiffre}>{attendues.toLocaleString("fr-FR")}</p>
            <p className={styles.pfCarteTexte}>
              {attendues === 1
                ? "réunion a été convoquée pour décider du sort d’une pétition, sans que le compte rendu soit encore en ligne"
                : "réunions ont été convoquées pour décider du sort d’une pétition, sans que leur compte rendu soit encore en ligne"}
              {synthese.signaturesDecisionsAttendues > 0
                ? ` — ${synthese.signaturesDecisionsAttendues.toLocaleString("fr-FR")} signatures en attente d’une réponse lisible.`
                : "."}{" "}
              {attendues === 1 ? "Nous la publierons" : "Nous les publierons"} dès leur parution.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
