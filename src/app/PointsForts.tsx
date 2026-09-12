import Link from "next/link";
import styles from "./page.module.css";
import {
  formatDelaiMois,
  formatFrDate,
  formatSignatures,
  moisDepuis,
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
  // Le plus récent des rapports, quand il y en a. La carte parle au singulier
  // tant qu'il n'y en a qu'un — c'est le cas depuis le début de la législature.
  const rapport = synthese.rapports?.at(-1) ?? null;
  // La plus ancienne des attentes : c'est le délai qui parle, pas le dernier
  // examen voté. La liste arrive triée par date d'examen croissante.
  const attente = synthese.attenteRapport?.[0] ?? null;

  return (
    <section className={styles.pointsForts} aria-labelledby="etabli">
      <p className={styles.eyebrow}>Ce que nous avons établi</p>
      <h2 id="etabli">
        <span className={styles.pfChiffre}>
          {synthese.signaturesDecisionsAbsentes.toLocaleString("fr-FR")}
        </span>{" "}
        signatures portent une pétition sur laquelle une commission s&apos;est prononcée
        — sans que le fichier public en dise un mot.
      </h2>

      <p className={styles.pfLede}>
        {nb === 1 ? "Une pétition est concernée." : `${nb} pétitions sont concernées.`} Pour
        chacune, la commission a écrit sa décision dans le compte rendu de sa réunion, et le
        champ prévu pour la motiver dans le jeu de données ouvert est resté vide. Nous
        reproduisons la phrase officielle et donnons le lien vers le texte intégral —{" "}
        <Link href="/passages-en-commission">voir les décisions et leurs sources</Link>.
      </p>
      {synthese.perimetre && (
        <p className={styles.pfPerimetre}>
          Ces chiffres portent sur{" "}
          {synthese.perimetre.legislatures.length === 1
            ? "une législature"
            : `${synthese.perimetre.legislatures.length} législatures`}{" "}
          et sur les {synthese.perimetre.comptesRendusLus} comptes rendus que nous en avons
          lus. Les pétitions de la législature {synthese.perimetre.legislatureNonCouverte}{" "}
          comptent dans nos autres chiffres, mais l&apos;Assemblée ne publie pas ces corpus
          pour elle&nbsp;: aucune décision de commission ne peut leur être rattachée —{" "}
          <Link href="/methodologie">notre périmètre et ses limites</Link>.
        </p>
      )}

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

        {synthese.nbRapports > 0 && rapport && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Pétitions ayant obtenu un rapport</p>
            <p className={styles.pfCarteChiffre}>{synthese.nbRapports.toLocaleString("fr-FR")}</p>
            <p className={styles.pfCarteTexte}>
              {synthese.nbRapports === 1 ? "rapport publié" : "rapports publiés"} sur une
              pétition, dans les corpus que nous lisons. Le plus récent est le rapport
              n<sup>o</sup> {rapport.numero} du {formatFrDate(rapport.dateDepot)}, sur{" "}
              <Link href={`/petition/${rapport.identifiant}`}>{rapport.titrePetition}</Link>
              {pointFinal(rapport.titrePetition)} Ni le fichier de données ouvertes, ni la page
              où elle a été signée n&apos;y renvoient —{" "}
              <a href={rapport.url} target="_blank" rel="noopener noreferrer">
                lire le rapport
              </a>
              .
            </p>
          </article>
        )}

        {attente && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Examen voté, aucun rapport trouvé</p>
            <p className={styles.pfCarteChiffre}>
              {formatDelaiMois(moisDepuis(attente.dateExamen))}
            </p>
            <p className={styles.pfCarteTexte}>
              que la commission a voté l&apos;examen de la pétition{" "}
              <Link href={`/petition/${attente.identifiant}`}>{attente.titre}</Link>
              {pointFinal(attente.titre)} Nous n&apos;avons trouvé aucun rapport la
              concernant dans les corpus que nous lisons. Le décompte ne porte que sur les
              pétitions dont le recueil est clos&nbsp;: une pétition encore ouverte à la
              signature n&apos;attend rien.{" "}
              {synthese.nbAttenteRapport > 1
                ? `${synthese.nbAttenteRapport} pétitions sont dans ce cas.`
                : ""}
            </p>
          </article>
        )}

        {synthese.petitionsClasseesEnBloc > 0 && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Classement d&apos;office, en bloc</p>
            <p className={styles.pfCarteChiffre}>
              {synthese.petitionsClasseesEnBloc.toLocaleString("fr-FR")}
            </p>
            <p className={styles.pfCarteTexte}>
              pétitions visées par un classement d&apos;office en{" "}
              {synthese.nbClassementsEnBloc === 1
                ? "une seule séance"
                : `${synthese.nbClassementsEnBloc} séances`}
              , d&apos;après les effectifs que les comptes rendus annoncent. Selon les séances,
              le compte rendu constate le classement ou le voit proposé par un rapporteur&nbsp;:
              chaque séance indique lequel des deux. Il donne rarement la liste des pétitions
              concernées —{" "}
              <Link href="/passages-en-commission#en-bloc">voir ces séances</Link>.
            </p>
          </article>
        )}

        {divergence && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Deux textes officiels, à comparer</p>
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
              Les deux émanent de l&apos;Assemblée nationale et portent sur la même pétition.
              Nous les publions côte à côte sans les comparer ni en départager aucun&nbsp;: à
              vous de lire.
            </p>
          </article>
        )}

        {attendues > 0 && (
          <article className={styles.pfCarte}>
            <p className={styles.pfCarteTitre}>Décision inscrite, compte rendu introuvable</p>
            <p className={styles.pfCarteChiffre}>{attendues.toLocaleString("fr-FR")}</p>
            <p className={styles.pfCarteTexte}>
              {attendues === 1
                ? "pétition dont une réunion de commission annonçait la décision à son ordre du jour, sans qu’aucun compte rendu ne soit référencé pour cette réunion"
                : "pétitions dont une réunion de commission annonçait la décision à son ordre du jour, sans qu’aucun compte rendu ne soit référencé pour ces réunions"}
              {synthese.signaturesDecisionsAttendues > 0
                ? ` — ${synthese.signaturesDecisionsAttendues.toLocaleString("fr-FR")} signatures en attente d’une réponse lisible.`
                : "."}{" "}
              Nous ignorons si la réunion s&apos;est tenue et si une décision a été prise&nbsp;:
              nous constatons qu&apos;aucun texte n&apos;est disponible.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
