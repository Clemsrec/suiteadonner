import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import TableauPetitions, { type LignePetition } from "@/app/TableauPetitions";
import {
  STATUT_TAG,
  formatFrDate,
  getReleveAbsentes,
  type PetitionAbsente,
  type StatutSource,
} from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";
import { nombre } from "@/lib/nombre";

export const revalidate = 86400;

const ISSUE_URL = "https://github.com/datagouv/datagouvfr_data_pipelines/issues/839";
const ANNONCE_URL = "https://github.com/datagouv/datagouvfr_data_pipelines/issues/839#issuecomment-6977742826";

export const metadata: Metadata = {
  title: `Pétitions absentes du fichier public — ${SITE_NAME}`,
  description:
    "Les pétitions publiées sur la plateforme de l'Assemblée nationale qui manquent au fichier de données ouvertes de data.gouv.fr, relevées chaque semaine.",
  alternates: { canonical: "/absentes-du-fichier" },
  openGraph: {
    type: "article",
    locale: "fr_FR",
    url: "/absentes-du-fichier",
    siteName: SITE_NAME,
    title: "Pétitions publiées absentes du fichier public",
    description:
      "Le relevé hebdomadaire des pétitions publiées que le fichier de données ouvertes ne contient pas, et l'histoire du défaut qui en a écarté plus de neuf cents.",
  },
};

// Relevés antérieurs au 11/11/2026 : pas de statut lu. Recueil terminé sans
// texte de décision : même étiquette neutre que les décisions non publiées.
function etiquette(p: PetitionAbsente): Pick<LignePetition, "tagLabel" | "tagType"> {
  if (!p.statutSource) return { tagLabel: "Absente du fichier", tagType: "none" };
  const tagLabel = p.statutLabel ?? p.statutSource;
  if (p.recueilTermine && !p.decisionTexte) return { tagLabel, tagType: "none" };
  return { tagLabel, tagType: STATUT_TAG[p.statutSource as StatutSource] ?? "none" };
}

async function loadReleve() {
  try {
    return await getReleveAbsentes();
  } catch (err) {
    console.error("Lecture Firestore impossible :", err);
    return null;
  }
}

export default async function AbsentesDuFichier() {
  const releve = await loadReleve();
  const n = (v: number) => nombre(v);

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}par constat
        </p>
        <h1>Pétitions publiées absentes du fichier public</h1>
        <p className={styles.lede}>
          {releve && releve.nbPubliees === 0 ? (
            <>
              Au relevé du {formatFrDate(releve.releveLe)}, aucun des{" "}
              {n(releve.nbNumerosTestes - releve.nbErreurs)} numéros lus ne correspond à
              une pétition publiée absente du fichier de données ouvertes.
              {releve.nbErreurs > 0 && (
                <>
                  {" "}
                  {n(releve.nbErreurs)} numéros n&apos;ont pas pu être lus sur la plateforme.
                </>
              )}
            </>
          ) : releve ? (
            <>
              Au relevé du {formatFrDate(releve.releveLe)},{" "}
              <strong>{n(releve.nbPubliees)} pétitions</strong> publiées sur la plateforme
              de l&apos;Assemblée nationale sont absentes du fichier de données ouvertes.
              Elles totalisent {n(releve.totalSoutiens)} signatures.
              {releve.nbDecidees !== null && releve.nbSansDecision !== null && (
                <>
                  {" "}Pour {n(releve.nbDecidees)} d&apos;entre elles, le recueil est
                  terminé ou le sort décidé&nbsp;; {n(releve.nbSansDecision)} n&apos;affichent
                  aucun texte de décision sur la plateforme.
                </>
              )}
            </>
          ) : (
            <>
              Le relevé des pétitions publiées absentes du fichier de données ouvertes
              est momentanément inaccessible.
            </>
          )}
        </p>
        {releve && releve.nbPubliees > 0 && (
        <p className={styles.encadre}>
          Précision importante&nbsp;: <strong>ces pétitions sont bien en ligne sur la
          plateforme officielle</strong>, et on peut les signer. Seul le fichier
          réutilisable les ignore, c&apos;est-à-dire celui dont se servent les
          chercheurs, les journalistes et ce site. Elles n&apos;apparaissent donc ni
          dans nos statistiques ni dans notre recherche.
        </p>
        )}
      </header>

      <section className={styles.section}>
        <h2>D&apos;où venait le défaut</h2>
        <p>
          Le fichier est produit chaque semaine par un programme de data.gouv.fr qui
          lit les pétitions numéro par numéro. Jusqu&apos;au 16&nbsp;novembre&nbsp;2026, ce
          programme tenait pour inutilisé tout
          numéro absent du fichier précédent et inférieur au plus grand numéro déjà
          vu, et ne le relisait plus. Or un numéro peut être attribué avant que la
          pétition soit publiée. Si un numéro plus élevé paraissait entre-temps, la
          pétition restait hors du fichier, même une fois en ligne.
        </p>
        <p>
          Le défaut a été signalé aux mainteneurs le 10&nbsp;novembre&nbsp;2026{" "}
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
            sur le dépôt du programme
          </a>
          . Les mainteneurs l&apos;ont corrigé le 16&nbsp;novembre et ont mis le
          fichier à jour le 18&nbsp;novembre&nbsp;:{" "}
          <a href={ANNONCE_URL} target="_blank" rel="noopener noreferrer">
            ils annoncent 933 pétitions de l&apos;Assemblée nationale ajoutées
          </a>
          . Depuis notre import du 23&nbsp;novembre, elles figurent dans nos chiffres et
          dans notre recherche.
        </p>
        <p>
          Nous continuons le relevé chaque lundi. Si une pétition publiée manque de
          nouveau au fichier, elle apparaîtra dans la liste ci-dessous.
        </p>
      </section>

      <section className={styles.section}>
        <h2>La liste</h2>
        {releve && releve.petitions.length ? (
          <TableauPetitions
            enteteDate="Publiée le"
            enteteStatut="Ce qu'en dit la plateforme"
            complet
            legende="Liste complète. Titre, signatures, statut, commission et date sont lus sur la plateforme officielle le jour du relevé, faute de figurer dans le fichier."
            lignes={releve.petitions.map(
              (p): LignePetition => ({
                identifiant: p.identifiant,
                titre: p.titre,
                ...etiquette(p),
                nbVotes: p.nbVotes,
                commission: p.commission,
                date: p.datePublication,
              })
            )}
          />
        ) : (
          <p>
            {releve
              ? `Liste vide au relevé du ${formatFrDate(releve.releveLe)}.`
              : "Relevé momentanément inaccessible."}
          </p>
        )}
      </section>

      <p className={styles.source}>
        Méthode&nbsp;: chaque numéro absent du fichier officiel et inférieur au plus
        grand numéro qu&apos;il contient est testé sur la plateforme de l&apos;Assemblée
        nationale. Une redirection vers l&apos;accueil signifie que le numéro n&apos;est
        pas publié. Les autres fiches sont lues, avec les mêmes repères que le
        programme de data.gouv.fr.
        {releve
          ? ` Dernier relevé le ${formatFrDate(releve.releveLe)} : ${n(releve.nbNumerosTestes)} numéros testés sous le n° ${releve.numeroMax}.`
          : ""}
        {releve && releve.soutiensInconnus
          ? ` Le compteur de signatures n'a pas pu être lu pour ${n(releve.soutiensInconnus)} d'entre elles.`
          : ""}{" "}
        Règles de lecture sur la page <Link href="/methodologie">méthodologie</Link>.
      </p>
    </>
  );
}
