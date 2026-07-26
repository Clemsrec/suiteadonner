#!/usr/bin/env node
// Importe le jeu de données ouvertes des pétitions de l'Assemblée nationale
// (data.gouv.fr) dans Firestore. Lancé à la main pour l'instant ; à brancher
// plus tard sur un Cloud Scheduler + Cloud Function pour l'automatisation
// hebdomadaire (les données source sont mises à jour chaque lundi matin).
//
// Usage :
//   node scripts/import-petitions.mjs            # importe dans Firestore
//   node scripts/import-petitions.mjs --dry-run   # parse et affiche un résumé, sans écrire
//
// Auth Firestore : nécessite des credentials Google Cloud avec accès au
// projet "suiteadonner" — soit `gcloud auth application-default login`, soit
// la variable d'env GOOGLE_APPLICATION_CREDENTIALS pointant vers une clé de
// compte de service.
//
// Auth Algolia (recherche plein texte) : variables d'env ALGOLIA_APP_ID et
// ALGOLIA_ADMIN_KEY (clé Admin, jamais la clé Search côté client). Si
// absentes, la synchronisation Algolia est simplement ignorée.

import { parse } from "csv-parse/sync";

const DATASET_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/c94c9dfe-23eb-45aa-acd1-7438c4e977db";

const STATUS_LABELS = {
  ouverte: "En cours de signature",
  archivee: "Classée d'office (seuil non atteint)",
  classee: "Classée après examen",
  expiree: "Expirée",
};

const dryRun = process.argv.includes("--dry-run");

function toIsoDate(value) {
  if (!value || !value.trim()) return null;
  // Le CSV fournit des dates au format AAAA-MM-JJ.
  return value.trim();
}

function toNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(row) {
  return {
    identifiant: row.identifiant.trim(),
    titre: row.titre.trim(),
    description: row.description.trim(),
    datePublication: toIsoDate(row.date_publication),
    dateLimiteVote: toIsoDate(row.date_limite_vote),
    nbVotes: toNumber(row.nb_votes),
    statut: row.statut.trim(),
    statutLabel: STATUS_LABELS[row.statut.trim()] ?? row.statut.trim(),
    commission: row.commission.trim(),
    legislature: row.legislature.trim(),
    decisionCommission: row.decision_commission.trim(),
    url: row.url.trim(),
  };
}

async function fetchPetitions() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Téléchargement du CSV échoué : ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();
  const records = parse(csvText, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
  });
  return records.map(mapRow).filter((p) => p.identifiant);
}

function computeStats(petitions) {
  const stats = {
    total: petitions.length,
    ouverte: 0,
    archivee: 0,
    classee: 0,
    expiree: 0,
    fortSoutienSansSuite: 0, // classée, mais avec au moins 10 000 signatures
  };
  for (const p of petitions) {
    if (stats[p.statut] !== undefined) stats[p.statut] += 1;
    if (p.statut === "classee" && p.nbVotes >= 10000) stats.fortSoutienSansSuite += 1;
  }
  return stats;
}

async function writeToFirestore(petitions, stats) {
  const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: "suiteadonner",
    });
  }
  const db = getFirestore();

  const BATCH_SIZE = 450;
  for (let i = 0; i < petitions.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const p of petitions.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection("petitions").doc(p.identifiant), p);
    }
    await batch.commit();
    console.log(`  importé ${Math.min(i + BATCH_SIZE, petitions.length)}/${petitions.length}`);
  }

  await db
    .collection("meta")
    .doc("stats")
    .set({ ...stats, updatedAt: Timestamp.now() });
}

async function syncToAlgolia(petitions) {
  // App ID et index name ne sont pas secrets : on réutilise les variables
  // NEXT_PUBLIC_* déjà renseignées pour le client plutôt que d'en dupliquer
  // des équivalentes non préfixées.
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "petitions";

  if (!appId || !adminKey) {
    console.log(
      "\nAlgolia non configuré (NEXT_PUBLIC_ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY absents) — synchronisation ignorée."
    );
    return;
  }

  const { algoliasearch } = await import("algoliasearch");
  const client = algoliasearch(appId, adminKey);

  await client.setSettings({
    indexName,
    indexSettings: {
      searchableAttributes: ["titre", "commission", "unordered(description)"],
      attributesForFaceting: ["statut"],
      customRanking: ["desc(nbVotes)"],
    },
  });

  const records = petitions.map((p) => ({
    objectID: p.identifiant,
    titre: p.titre,
    description: p.description.slice(0, 2000),
    statut: p.statut,
    statutLabel: p.statutLabel,
    commission: p.commission,
    nbVotes: p.nbVotes,
    datePublication: p.datePublication,
    url: p.url,
  }));

  console.log(`\nSynchronisation Algolia (index "${indexName}")...`);
  await client.saveObjects({ indexName, objects: records, waitForTasks: false });
  console.log(`  ${records.length} objets envoyés.`);
}

async function main() {
  console.log(`Téléchargement du jeu de données : ${DATASET_URL}`);
  const petitions = await fetchPetitions();
  const stats = computeStats(petitions);

  console.log(`\n${petitions.length} pétitions parsées.`);
  console.log("Répartition par statut :", stats);

  if (dryRun) {
    console.log("\n--dry-run : aucune écriture dans Firestore.");
    console.log("Exemple :", petitions[0]);
    return;
  }

  console.log("\nÉcriture dans Firestore (collection `petitions` + `meta/stats`)...");
  await writeToFirestore(petitions, stats);

  await syncToAlgolia(petitions);

  console.log("\nImport terminé.");
}

main().catch((err) => {
  console.error("Échec de l'import :", err);
  process.exitCode = 1;
});
