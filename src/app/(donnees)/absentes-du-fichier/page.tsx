import type { Metadata } from "next";
import Link from "next/link";
import styles from "../donnees.module.css";
import TableauPetitions, { type LignePetition } from "@/app/TableauPetitions";
import { formatFrDate, getReleveAbsentes } from "@/lib/petitions";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

const ISSUE_URL = "https://github.com/datagouv/datagouvfr_data_pipelines/issues/839";

export const metadata: Metadata = {
  title: `Pétitions absentes du fichier public — ${SITE_NAME}`,
  description:
    "Les pétitions publiées sur la plateforme de l'Assemblée nationale qui n'ont jamais figuré dans le fichier de données ouvertes de data.gouv.fr, avec leurs signatures.",
  alternates: { canonical: "/absentes-du-fichier" },
  openGraph: {
    type: "article",
    locale: "fr_FR",
    url: "/absentes-du-fichier",
    siteName: SITE_NAME,
    title: "Pétitions absentes du fichier public",
    description:
      "Des pétitions publiées, parfois très signées, que le fichier de données ouvertes ne contient pas.",
  },
};

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
  const n = (v: number) => v.toLocaleString("fr-FR");

  return (
    <>
      <header className={styles.entete}>
        <p className={styles.eyebrow}>
          <Link href="/petitions">Les pétitions</Link>
          {" · "}par constat
        </p>
        <h1>Des pétitions publiées manquent au fichier public</h1>
        <p className={styles.lede}>
          {releve ? (
            <>
              Au relevé du {formatFrDate(releve.releveLe)},{" "}
              <strong>{n(releve.nbPubliees)} pétitions</strong> publiées sur la plateforme
              de l&apos;Assemblée nationale sont absentes du fichier de données ouvertes.
              Elles totalisent {n(releve.totalSoutiens)} signatures.
            </>
          ) : (
            <>
              Certaines pétitions publiées sur la plateforme de l&apos;Assemblée
              nationale n&apos;entrent jamais dans le fichier de données ouvertes.
            </>
          )}
        </p>
        <p className={styles.encadre}>
          Précision importante&nbsp;: <strong>ces pétitions sont bien en ligne sur la
          plateforme officielle</strong>, et on peut les signer. Seul le fichier
          réutilisable les ignore, c&apos;est-à-dire celui dont se servent les
          chercheurs, les journalistes et ce site. Elles n&apos;apparaissent donc ni
          dans nos statistiques ni dans notre recherche.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Pourquoi elles manquent</h2>
        <p>
          Le fichier est produit chaque semaine par un programme de data.gouv.fr qui
          lit les pétitions numéro par numéro. Ce programme tient pour inutilisé tout
          numéro absent du fichier précédent et inférieur au plus grand numéro déjà
          vu, et ne le relit plus. Or un numéro peut être attribué avant que la
          pétition soit publiée. Si un numéro plus élevé paraît entre-temps, la
          pétition reste hors du fichier, même une fois en ligne.
        </p>
        <p>
          Le défaut a été signalé aux mainteneurs le 10&nbsp;novembre&nbsp;2026{" "}
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
            sur le dépôt du programme
          </a>
          . S&apos;il est corrigé, cette liste se videra d&apos;elle-même au relevé
          suivant.
        </p>
      </section>

      <section className={styles.section}>
        <h2>La liste</h2>
        {releve && releve.petitions.length ? (
          <TableauPetitions
            enteteDate="Publiée le"
            complet
            legende="Liste complète. Titre, signatures, commission et date sont lus sur la plateforme officielle le jour du relevé, faute de figurer dans le fichier."
            lignes={releve.petitions.map(
              (p): LignePetition => ({
                identifiant: p.identifiant,
                titre: p.titre,
                tagLabel: "Absente du fichier",
                tagType: "none",
                nbVotes: p.nbVotes,
                commission: p.commission,
                date: p.datePublication,
              })
            )}
          />
        ) : (
          <p>
            Aucune pétition dans ce cas au dernier relevé, ou données momentanément
            inaccessibles.
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
