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
  // Volontairement sans motif : « seuil non atteint » serait faux pour les
  // pétitions interrompues en bloc, dont plusieurs dépassaient largement le
  // seuil (263 867 signatures pour la plus signée d'entre elles). Le motif réel,
  // quand il est écrit, est repris depuis le texte de décision (classementDOffice).
  archivee: "Classée d'office",
  // « après examen » n'est pas vérifiable : le jeu de données n'atteste aucun
  // examen. On se contente de constater le classement.
  classee: "Classée",
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

// Date de référence figée au lancement de l'import : les champs dérivés
// ci-dessous sont un instantané, pas une vérité perpétuelle. Ils se
// rafraîchissent au prochain `npm run import:petitions`.
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

function mapRow(row) {
  const decisionCommission = row.decision_commission.trim();
  const dateLimiteVote = toIsoDate(row.date_limite_vote);
  const statut = row.statut.trim();
  // Le recueil de signatures est terminé quand la date limite est passée,
  // indépendamment de ce que raconte le champ `statut`.
  const signaturesCloses = Boolean(dateLimiteVote && dateLimiteVote < AUJOURDHUI);

  // Le statut seul ne dit pas la vérité : 890 pétitions marquées « classee »
  // portent un texte de décision qui indique explicitement un classement
  // d'office faute d'avoir atteint le seuil de signatures. Les étiqueter
  // « classée après examen » serait faux — leur propre décision dit le
  // contraire. On lit donc le motif dans le texte plutôt que de le déduire.
  const classementDOffice =
    /office/i.test(decisionCommission) || /n'a pas atteint le nombre de signatures/i.test(decisionCommission);

  return {
    identifiant: row.identifiant.trim(),
    titre: row.titre.trim(),
    description: row.description.trim(),
    datePublication: toIsoDate(row.date_publication),
    dateLimiteVote,
    nbVotes: toNumber(row.nb_votes),
    statut,
    statutLabel: classementDOffice
      ? "Classée d’office (seuil non atteint)"
      : (STATUS_LABELS[statut] ?? statut),
    classementDOffice,
    commission: row.commission.trim(),
    legislature: row.legislature.trim(),
    decisionCommission,
    // Le fait le plus dur du jeu de données : une pétition peut être examinée
    // puis classée sans qu'aucune motivation ne soit publiée. Aucune inférence
    // ici, c'est le champ officiel qui est vide. Stocké en booléen pour être
    // interrogeable côté Firestore, qui ne sait pas filtrer sur « chaîne vide ».
    decisionPubliee: decisionCommission.length > 0,
    signaturesCloses,
    // Le statut officiel dit « en cours de signature » alors que la date limite
    // est passée depuis des mois. Sans ce champ, ces pétitions échappent à
    // toutes nos requêtes — et ce sont les deux plus signées du jeu de données,
    // dont Duplomb et ses 2,1 millions de signatures.
    statutObsolete: statut === "ouverte" && signaturesCloses,
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
    sansDecision: 0, // classée sans aucune motivation publiée
    signaturesSansDecision: 0, // total des signatures concernées
    statutObsolete: 0, // recueil terminé, statut resté « en cours de signature »
    signaturesStatutObsolete: 0,
    signaturesTotal: 0,
    seuilDixMille: 0, // pétitions ayant franchi 10 000 signatures
    sansTexteDecision: 0, // aucun texte de décision, tous statuts confondus
    textesDecision: 0, // pétitions avec un texte de décision
    formulationsDistinctes: 0, // nombre de rédactions différentes parmi ces textes
    clotureesEnMasse: 0, // pétitions closes le même jour que des centaines d'autres
    dateClotureMasse: null, // la plus grosse de ces dates
    nbClotureMasse: 0, // combien de pétitions à cette date
    // Le cœur du constat, énoncé de façon vérifiable : parmi les pétitions
    // classées SANS que le motif du seuil soit invoqué, combien n'ont aucune
    // décision publiée. Dire « aucune pétition n'a de motivation » serait faux :
    // 1 550 portent un texte qui donne bien un motif, celui du seuil non atteint.
    classeesHorsSeuil: 0,
    classeesHorsSeuilSansTexte: 0,
    // Sans texte de décision ET dont le recueil est terminé. Le total brut des
    // champs vides (2 443) inclut les 1 366 pétitions encore ouvertes, qui n'ont
    // pas de décision pour la simple raison qu'elles sont en cours : les
    // compter reviendrait à gonfler le constat.
    closesSansTexte: 0,
  };

  // Une date de clôture PASSÉE partagée par des centaines de pétitions n'est
  // pas une échéance individuelle : c'est une fin de législature qui les
  // interrompt toutes le même jour, quel que soit leur nombre de signatures.
  // On les détecte par leur nombre plutôt qu'en codant les dates en dur.
  //
  // Le filtre sur `signaturesCloses` est indispensable : sans lui, les 1 366
  // pétitions encore ouvertes — qui partagent toutes la fin de la législature
  // à venir — étaient comptées comme interrompues.
  const SEUIL_MASSE = 100;
  const parDateLimite = new Map();
  const formulations = new Set();

  for (const p of petitions) {
    if (p.dateLimiteVote && p.signaturesCloses) {
      parDateLimite.set(p.dateLimiteVote, (parDateLimite.get(p.dateLimiteVote) ?? 0) + 1);
    }
    if (p.decisionPubliee) {
      formulations.add(p.decisionCommission.replace(/\s+/g, " ").trim());
    }
  }
  stats.formulationsDistinctes = formulations.size;

  for (const [date, n] of parDateLimite) {
    if (n >= SEUIL_MASSE && n > stats.nbClotureMasse) {
      stats.nbClotureMasse = n;
      stats.dateClotureMasse = date;
    }
  }

  for (const p of petitions) {
    if (stats[p.statut] !== undefined) stats[p.statut] += 1;
    if (p.statut === "classee" && p.nbVotes >= 10000) stats.fortSoutienSansSuite += 1;
    if (p.statut === "classee" && !p.decisionPubliee) {
      stats.sansDecision += 1;
      stats.signaturesSansDecision += p.nbVotes;
    }
    if (p.statutObsolete) {
      stats.statutObsolete += 1;
      stats.signaturesStatutObsolete += p.nbVotes;
    }
    if (p.statut === "classee" && !p.classementDOffice) {
      stats.classeesHorsSeuil += 1;
      if (!p.decisionPubliee) stats.classeesHorsSeuilSansTexte += 1;
    }
    stats.signaturesTotal += p.nbVotes;
    if (p.nbVotes >= 10000) stats.seuilDixMille += 1;
    if (p.decisionPubliee) stats.textesDecision += 1;
    else {
      stats.sansTexteDecision += 1;
      if (p.statut !== "ouverte") stats.closesSansTexte += 1;
    }
    if (
      p.signaturesCloses &&
      (parDateLimite.get(p.dateLimiteVote) ?? 0) >= SEUIL_MASSE
    ) {
      stats.clotureesEnMasse += 1;
    }
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
