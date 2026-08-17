import Link from "next/link";
import styles from "./semaine.module.css";
import { formatFrDate, formatSignatures, type ImportDelta, type PetitionResume } from "@/lib/petitions";

// Un import réussi qui n'apporte presque rien ressemble à un import manqué :
// ce bloc lève l'ambiguïté en disant, chiffres à l'appui, ce que le fichier
// officiel a changé depuis la lecture précédente — y compris « rien ».
//
// Au-delà de ce délai sans import, on le dit tel quel : la page continue de
// servir les dernières données, mais annoncer « cette semaine » serait faux.
const JOURS_AVANT_ALERTE = 9;

function joursDepuis(iso: string): number {
  return Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? plusieurs : un}`;
}

function Liste({ items, total }: { items: PetitionResume[]; total: number }) {
  if (!items.length) return null;
  return (
    <ul className={styles.liste}>
      {items.map((p) => (
        <li key={p.identifiant}>
          <Link href={`/petition/${p.identifiant}`}>{p.titre}</Link>
          <span className={styles.n}>{formatSignatures(p.nbVotes)}</span>
        </li>
      ))}
      {total > items.length && (
        <li className={styles.reste}>… et {pluriel(total - items.length, "autre", "autres")}</li>
      )}
    </ul>
  );
}

export default function CetteSemaine({ delta }: { delta: ImportDelta | null }) {
  // Pas de journal (premier import, ou lecture impossible) : rien à raconter,
  // et surtout rien à inventer.
  if (!delta) return null;

  const age = joursDepuis(delta.calculeLe);
  const perime = age > JOURS_AVANT_ALERTE;
  const rienDeNeuf =
    delta.nbNouvelles + delta.nbSeuilFranchi + delta.nbRecueilsClos + delta.nbDecisionsPubliees + delta.nbStatutsChanges === 0;

  const faits: string[] = [];
  if (delta.nbNouvelles) faits.push(`${pluriel(delta.nbNouvelles, "nouvelle pétition déposée", "nouvelles pétitions déposées")}`);
  if (delta.nbSeuilFranchi) faits.push(`${pluriel(delta.nbSeuilFranchi, "pétition a franchi", "pétitions ont franchi")} le seuil des 10 000 signatures`);
  if (delta.nbRecueilsClos) faits.push(`${pluriel(delta.nbRecueilsClos, "recueil de signatures clos", "recueils de signatures clos")}`);
  if (delta.nbDecisionsPubliees) faits.push(`${pluriel(delta.nbDecisionsPubliees, "décision de commission publiée", "décisions de commission publiées")}`);
  if (delta.nbStatutsChanges) faits.push(`${pluriel(delta.nbStatutsChanges, "changement de statut", "changements de statut")}`);

  return (
    <section className={`${styles.semaine} ${perime ? styles.perime : ""}`} aria-labelledby="semaine-titre">
      <div className={styles.tete}>
        <h2 id="semaine-titre">
          {perime ? "Dernière mise à jour connue" : "Cette semaine"}
        </h2>
        <span className={styles.date}>
          fichier lu le {formatFrDate(delta.calculeLe)}
          {delta.depuis ? ` · comparé au ${formatFrDate(delta.depuis)}` : ""}
        </span>
      </div>

      {perime && (
        <p className={styles.alerte}>
          Aucune mise à jour depuis {age} jours. Les chiffres de cette page restent ceux
          du {formatFrDate(delta.calculeLe)}&nbsp;; l&apos;Assemblée republie normalement le
          fichier chaque lundi.
        </p>
      )}

      {rienDeNeuf ? (
        <p className={styles.resume}>
          Le fichier officiel a été relu&nbsp;: <strong>aucune pétition ajoutée, aucun
          statut ni aucune décision modifiés</strong> depuis la lecture précédente
          {delta.signaturesGagnees > 0
            ? ` — seuls les compteurs de signatures ont bougé (+${delta.signaturesGagnees.toLocaleString("fr-FR")}).`
            : "."}
        </p>
      ) : (
        <p className={styles.resume}>
          Depuis la lecture précédente&nbsp;: <strong>{faits.join(", ")}</strong>
          {delta.signaturesGagnees > 0
            ? `, et ${delta.signaturesGagnees.toLocaleString("fr-FR")} signatures supplémentaires au total.`
            : "."}
        </p>
      )}

      <div className={styles.details}>
        {delta.nbSeuilFranchi > 0 && (
          <div>
            <h3>Seuil des 10 000 franchi</h3>
            <Liste items={delta.seuilFranchi} total={delta.nbSeuilFranchi} />
          </div>
        )}
        {delta.nbDecisionsPubliees > 0 && (
          <div>
            <h3>Décisions publiées</h3>
            <Liste items={delta.decisionsPubliees} total={delta.nbDecisionsPubliees} />
          </div>
        )}
        {delta.nbNouvelles > 0 && (
          <div>
            <h3>Nouvelles pétitions</h3>
            <Liste items={delta.nouvelles} total={delta.nbNouvelles} />
          </div>
        )}
        {delta.nbRecueilsClos > 0 && (
          <div>
            <h3>Recueils clos</h3>
            <Liste items={delta.recueilsClos} total={delta.nbRecueilsClos} />
          </div>
        )}
      </div>

      <p className={styles.note}>
        Différences constatées entre deux lectures du même fichier officiel, sans
        interprétation. Une «&nbsp;décision publiée&nbsp;» signifie seulement que le
        champ prévu à cet effet, vide jusque-là, a été renseigné.
      </p>
    </section>
  );
}
