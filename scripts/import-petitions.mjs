#!/usr/bin/env node
// Importe le jeu de données ouvertes des pétitions de l'Assemblée nationale
// (data.gouv.fr) dans Firestore, puis synchronise l'index de recherche.
//
// Toute la lecture, la normalisation et la classification vivent dans
// scripts/lib/petitions-source.mjs, partagé avec scripts/verifier-coherence.mjs :
// une règle ne peut pas diverger entre ce qui est importé et ce qui est testé.
//
// Usage :
//   node scripts/import-petitions.mjs            # vérifie puis importe
//   node scripts/import-petitions.mjs --dry-run  # analyse et résume, sans écrire
//
// Auth Firestore : credentials Google Cloud ayant accès au projet
// "suiteadonner" — `gcloud auth application-default login` ou la variable
// GOOGLE_APPLICATION_CREDENTIALS pointant vers une clé de compte de service.
//
// Auth Algolia : NEXT_PUBLIC_ALGOLIA_APP_ID et ALGOLIA_ADMIN_KEY (clé Admin,
// jamais la clé Search côté client). Absentes, la synchronisation est ignorée.

import { parse } from "csv-parse/sync";
import {
  CSV_URL,
  MOTIFS,
  calculerStats,
  lirePetitions,
} from "./lib/petitions-source.mjs";

const dryRun = process.argv.includes("--dry-run");

// Libellé affiché. Il décrit un fait vérifiable et jamais ce que la plateforme
// montre — vérification faite le 27/07/2026, elle affiche « Acceptées » et la
// date limite, sans employer « en cours de signature ».
function libelleStatut(p) {
  if (p.motifClassement === MOTIFS.SEUIL) return "Classée d'office (seuil non atteint)";
  if (p.statutSource === "ouverte") return p.recueilTermine ? "Recueil terminé" : "En cours de signature";
  if (p.statutSource === "classee") return "Classée";
  if (p.statutSource === "archivee") return "Classée d'office";
  if (p.statutSource === "expiree") return "Expirée";
  return p.statutSource;
}

async function telecharger() {
  console.log(`Source canonique : ${CSV_URL}`);
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`Téléchargement du CSV échoué : ${res.status} ${res.statusText}`);
  }
  return parse(await res.text(), {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
  });
}

// Document Firestore : les champs bruts d'abord, les catégories dérivées
// ensuite, chacune renvoyant à sa règle documentée dans le module source.
function versDocument(p, calculeLe) {
  return {
    identifiant: p.identifiant,
    titre: p.titre,
    description: p.description,
    url: p.url,
    datePublication: p.datePublication,
    dateLimiteVote: p.dateLimiteVote,
    // null et non 0 : 22 pétitions n'ont pas de nombre de signatures dans le
    // fichier. Écrire 0 reviendrait à affirmer « aucun soutien ».
    nbVotes: p.nbVotes,
    statutSource: p.statutSource,
    commissionSource: p.commissionSource,
    legislature: p.legislature,
    decisionTexte: p.decisionTexte,

    recueilTermine: p.recueilTermine,
    motifClassement: p.motifClassement,
    seuilAtteint: p.seuilAtteint,
    ecartStatutDates: p.ecartStatutDates,
    clotureGroupee: p.clotureGroupee,

    statutLabel: libelleStatut(p),
    sourceCsv: CSV_URL,
    calculeLe,
  };
}

async function ecrireFirestore(documents, stats) {
  const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: "suiteadonner" });
  }
  const db = getFirestore();

  const TAILLE_LOT = 450;
  for (let i = 0; i < documents.length; i += TAILLE_LOT) {
    const lot = db.batch();
    for (const d of documents.slice(i, i + TAILLE_LOT)) {
      lot.set(db.collection("petitions").doc(d.identifiant), d);
    }
    await lot.commit();
    console.log(`  importé ${Math.min(i + TAILLE_LOT, documents.length)}/${documents.length}`);
  }

  await db.collection("meta").doc("stats").set({ ...stats, updatedAt: Timestamp.now() });
}

async function synchroniserAlgolia(documents) {
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
      searchableAttributes: ["titre", "commissionSource", "unordered(description)"],
      attributesForFaceting: ["statutSource", "motifClassement"],
      // nbVotes peut être null : Algolia range alors ces objets en fin de tri,
      // ce qui est le comportement voulu.
      customRanking: ["desc(nbVotes)"],
    },
  });

  const records = documents.map((d) => ({
    objectID: d.identifiant,
    titre: d.titre,
    description: d.description.slice(0, 2000),
    statutSource: d.statutSource,
    statutLabel: d.statutLabel,
    motifClassement: d.motifClassement,
    commissionSource: d.commissionSource,
    nbVotes: d.nbVotes,
    datePublication: d.datePublication,
    url: d.url,
  }));

  console.log(`\nSynchronisation Algolia (index "${indexName}")...`);
  await client.saveObjects({ indexName, objects: records, waitForTasks: false });
  console.log(`  ${records.length} objets envoyés.`);
}

async function main() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const records = await telecharger();
  const { petitions, clotures } = lirePetitions(records, aujourdhui);
  const stats = calculerStats(petitions, clotures, aujourdhui);
  const documents = petitions.map((p) => versDocument(p, aujourdhui));

  console.log(`\n${petitions.length} pétitions lues et normalisées.`);
  console.log("Agrégats :", stats);
  console.log(
    `\nÉcarts constatés et conservés tels quels : ` +
      `${stats.ecartStatutDates} statut/dates · ${stats.signaturesInconnues} sans nombre de signatures.`
  );

  if (dryRun) {
    console.log("\n--dry-run : aucune écriture.");
    console.log("Exemple de document :", documents[0]);
    return;
  }

  console.log("\nÉcriture dans Firestore (collection `petitions` + `meta/stats`)...");
  await ecrireFirestore(documents, stats);
  await synchroniserAlgolia(documents);
  console.log("\nImport terminé.");
}

main().catch((err) => {
  console.error("Échec de l'import :", err);
  process.exitCode = 1;
});
