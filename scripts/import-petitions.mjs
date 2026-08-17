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

// Compte des dépôts par année, pour l'index /petitions et la navigation entre
// années. Toutes les pétitions du fichier ont une date de publication ; si une
// ligne en manquait un jour, elle resterait accessible par sa fiche et le
// sitemap, simplement absente des listes annuelles.
function compterParAnnee(documents) {
  const compte = new Map();
  for (const d of documents) {
    const annee = d.datePublication?.slice(0, 4);
    if (annee) compte.set(annee, (compte.get(annee) ?? 0) + 1);
  }
  return [...compte]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([annee, nb]) => ({ annee, nb }));
}

// --- Journal hebdomadaire ---------------------------------------------------
//
// Ce que le fichier a changé depuis l'import précédent, pétition par pétition.
// Sans ce journal, un import réussi qui n'apporte presque rien est indiscernable
// d'un import manqué — c'est arrivé : la mise à jour du 10/08/2026 avait bien
// tourné, mais une seule pétition avait été ajoutée, et rien ne le disait.
//
// Le journal ne contient que des différences constatées entre deux lectures du
// même fichier officiel : aucune n'est interprétée. « Décision publiée » veut
// dire que le champ était vide et ne l'est plus, rien de plus. Les événements
// sont plafonnés (les listes servent d'échantillon cliquable, le compte fait foi).

const MAX_EVENEMENTS_LISTES = 12;
const NB_IMPORTS_CONSERVES = 12;

// Représentation minimale d'une pétition dans le journal : de quoi la lister,
// et de quoi la relire dans son état d'alors.
function resume(d) {
  return { identifiant: d.identifiant, titre: d.titre, nbVotes: d.nbVotes };
}

function calculerDelta(precedents, documents, aujourdhui, importPrecedentLe) {
  const avant = new Map(precedents.map((p) => [p.identifiant, p]));
  const nouvelles = [];
  const seuilFranchi = [];
  const recueilsClos = [];
  const decisionsPubliees = [];
  const statutsChanges = [];
  let signaturesGagnees = 0;

  for (const d of documents) {
    const p = avant.get(d.identifiant);
    if (!p) {
      nouvelles.push(resume(d));
      continue;
    }
    if (d.nbVotes !== null && p.nbVotes !== null && d.nbVotes > p.nbVotes) {
      signaturesGagnees += d.nbVotes - p.nbVotes;
    }
    if (d.seuilAtteint === true && p.seuilAtteint !== true) seuilFranchi.push(resume(d));
    if (d.recueilTermine && !p.recueilTermine) recueilsClos.push(resume(d));
    if (d.decisionTexte && !p.decisionTexte) {
      decisionsPubliees.push({ ...resume(d), decisionTexte: d.decisionTexte });
    }
    if (d.statutSource !== p.statutSource) {
      statutsChanges.push({ ...resume(d), de: p.statutSource, vers: d.statutSource });
    }
  }

  const tri = (a, b) => (b.nbVotes ?? -1) - (a.nbVotes ?? -1);
  const borner = (liste) => liste.sort(tri).slice(0, MAX_EVENEMENTS_LISTES);

  return {
    calculeLe: aujourdhui,
    // null au tout premier import : il n'y a rien à quoi comparer, et le
    // journal ne doit pas prétendre que 4 000 pétitions sont « nouvelles ».
    depuis: importPrecedentLe,
    total: documents.length,
    nbNouvelles: nouvelles.length,
    nbSeuilFranchi: seuilFranchi.length,
    nbRecueilsClos: recueilsClos.length,
    nbDecisionsPubliees: decisionsPubliees.length,
    nbStatutsChanges: statutsChanges.length,
    signaturesGagnees,
    nouvelles: borner(nouvelles),
    seuilFranchi: borner(seuilFranchi),
    recueilsClos: borner(recueilsClos),
    decisionsPubliees: borner(decisionsPubliees),
    statutsChanges: borner(statutsChanges),
  };
}

// L'état précédent est lu dans la collection elle-même, juste avant d'être
// écrasé : c'est la seule source qui contienne les champs dérivés d'alors, et
// 4 000 lectures par semaine ne pèsent rien.
async function lireEtatPrecedent(db) {
  const snap = await db.collection("petitions").select(
    "identifiant", "nbVotes", "seuilAtteint", "recueilTermine", "decisionTexte", "statutSource"
  ).get();
  const precedents = snap.docs.map((d) => d.data());
  const stats = await db.collection("meta").doc("stats").get();
  return { precedents, importPrecedentLe: stats.exists ? (stats.data().calculeLe ?? null) : null };
}

async function ecrireFirestore(documents, stats, aujourdhui) {
  const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: "suiteadonner" });
  }
  const db = getFirestore();

  // Le delta se calcule AVANT d'écraser la collection ; s'il échoue, l'import
  // continue sans journal — la mise à jour des données passe avant le récit.
  let delta = null;
  try {
    const { precedents, importPrecedentLe } = await lireEtatPrecedent(db);
    if (precedents.length) delta = calculerDelta(precedents, documents, aujourdhui, importPrecedentLe);
    console.log(
      delta
        ? `Delta depuis ${delta.depuis} : +${delta.nbNouvelles} pétitions · ${delta.nbSeuilFranchi} seuil(s) franchi(s) · ` +
          `${delta.nbRecueilsClos} recueil(s) clos · ${delta.nbDecisionsPubliees} décision(s) publiée(s) · ` +
          `${delta.nbStatutsChanges} statut(s) changé(s) · +${delta.signaturesGagnees} signatures`
        : "Premier import : pas d'état précédent, journal non calculé."
    );
  } catch (err) {
    console.error("Journal non calculé (l'import continue) :", err.message);
  }

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

  // Un document unique porte la liste des identifiants et les années de dépôt :
  // le sitemap et l'index /petitions se servent en une lecture, au lieu
  // d'énumérer la collection à chaque passage de robot. ~30 Ko pour 4 000
  // identifiants, loin de la limite de 1 Mo par document.
  await db.collection("meta").doc("sitemap").set({
    calculeLe: stats.calculeLe,
    identifiants: documents.map((d) => d.identifiant),
    annees: compterParAnnee(documents),
    updatedAt: Timestamp.now(),
  });

  // Le journal garde les derniers imports, le plus récent en tête : l'accueil
  // n'affiche que le premier, l'historique borné évite que le document grossisse
  // sans fin. Un import relancé le même jour remplace son entrée au lieu de la
  // dupliquer.
  if (delta) {
    const ref = db.collection("meta").doc("journal");
    const existant = await ref.get();
    const anciens = existant.exists ? (existant.data().imports ?? []) : [];
    const imports = [delta, ...anciens.filter((i) => i.calculeLe !== delta.calculeLe)].slice(
      0,
      NB_IMPORTS_CONSERVES
    );
    await ref.set({ imports, updatedAt: Timestamp.now() });
  }
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

  console.log("\nÉcriture dans Firestore (collection `petitions` + `meta/stats` + `meta/sitemap` + `meta/journal`)...");
  await ecrireFirestore(documents, stats, aujourdhui);
  await synchroniserAlgolia(documents);
  console.log("\nImport terminé.");
}

main().catch((err) => {
  console.error("Échec de l'import :", err);
  process.exitCode = 1;
});
