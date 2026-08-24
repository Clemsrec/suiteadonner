#!/usr/bin/env node
// Contrôles de cohérence sur la source canonique. Sort en code 1 au moindre
// échec, pour pouvoir être enchaîné avant un import ou un déploiement.
//
// POURQUOI CE SCRIPT EXISTE
//
// Le 27/07/2026, nous avons découvert qu'un miroir du CSV circulait avec un
// mois de retard — 3 819 lignes au lieu de 4 002 — sans que rien ne le
// signale. Un pipeline qui télécharge en silence peut produire des chiffres
// périmés sur le site pendant des semaines. Ces contrôles rendent ce scénario
// bruyant : ils cassent au lieu de laisser passer.
//
// Usage :
//   node scripts/verifier-coherence.mjs
//   npm run verifier

import { parse } from "csv-parse/sync";
import { CSV_URL, SEUIL_SIGNATURES, lirePetitions, calculerStats, MOTIFS } from "./lib/petitions-source.mjs";

// Le jeu est republié chaque lundi entre 00h50 et 01h15 UTC. Au-delà de huit
// jours sans nouveau dépôt du fichier, quelque chose ne va pas : source figée,
// miroir périmé, ou pipeline amont interrompu.
//
// Ce contrôle porte sur la date de dépôt du fichier (en-tête `last-modified`
// du stockage qui le sert), et non sur la date de la dernière pétition publiée.
// Les deux ont été confondues jusqu'au 24/08/2026, où l'import a été bloqué à
// tort : aucune pétition n'avait été déposée depuis le 09/08 — c'est l'été —
// mais le fichier du jour était bien là, et 708 lignes y avaient changé depuis
// la semaine précédente. Une plateforme sans nouveau dépôt est un fait à
// signaler, pas une source défaillante ; le contrôle bloquant, lui, doit porter
// sur ce qui trahit vraiment un pipeline mort.
const FRAICHEUR_MAX_JOURS = 8;

// Au-delà, on le dit sans bloquer : c'est plausible en intersession.
const SANS_NOUVELLE_PETITION_JOURS = 8;

// Garde-fou volumétrique : le nombre de pétitions ne peut que croître. Une
// chute signale un fichier tronqué ou un mauvais miroir.
const VOLUME_PLANCHER = 3900;

const echecs = [];
const avertissements = [];

function verifier(nom, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(`${nom} — ${detail}`);
    console.log(`  ✗ ${nom} — ${detail}`);
  }
}

function signaler(nom, detail) {
  avertissements.push(`${nom} — ${detail}`);
  console.log(`  ⚠ ${nom} — ${detail}`);
}

async function main() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  console.log(`Source : ${CSV_URL}`);

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Téléchargement impossible : ${res.status}`);
  const deposeLe = res.headers.get("last-modified");
  const texte = await res.text();
  const records = parse(texte, { delimiter: ";", columns: true, skip_empty_lines: true });
  const { petitions, clotures } = lirePetitions(records, aujourdhui);
  const stats = calculerStats(petitions, clotures, aujourdhui);

  console.log(`\n--- Intégrité de la source ---`);

  const colonnes = Object.keys(records[0] ?? {});
  const attendues = [
    "titre", "description", "date_publication", "nb_votes", "statut",
    "date_limite_vote", "commission", "legislature", "decision_commission",
    "url", "identifiant",
  ];
  verifier(
    "les 11 colonnes attendues sont présentes",
    attendues.every((c) => colonnes.includes(c)),
    `manquantes : ${attendues.filter((c) => !colonnes.includes(c)).join(", ")}`
  );

  verifier(
    `volume au-dessus du plancher (${VOLUME_PLANCHER})`,
    petitions.length >= VOLUME_PLANCHER,
    `${petitions.length} pétitions — fichier tronqué ou miroir périmé ?`
  );

  const ids = new Set(petitions.map((p) => p.identifiant));
  verifier("identifiants uniques", ids.size === petitions.length,
    `${petitions.length - ids.size} doublon(s)`);

  // En-tête absent : on ne peut pas conclure, et on ne bloque pas sur une
  // absence de preuve — les autres contrôles restent en place.
  const ageFichier = deposeLe
    ? Math.round((Date.now() - Date.parse(deposeLe)) / 86400000)
    : null;
  if (ageFichier === null) {
    signaler("dépôt du fichier", "en-tête `last-modified` absent — fraîcheur invérifiable");
  } else {
    verifier(
      `fraîcheur du fichier (déposé il y a ${ageFichier} j)`,
      ageFichier <= FRAICHEUR_MAX_JOURS,
      `${deposeLe} — au-delà de ${FRAICHEUR_MAX_JOURS} j, la source est probablement figée`
    );
  }

  const derniere = petitions
    .map((p) => p.datePublication)
    .filter(Boolean)
    .sort()
    .at(-1);
  const ageJours = Math.round(
    (Date.parse(aujourdhui) - Date.parse(derniere)) / 86400000
  );
  verifier(
    "une pétition au moins porte une date de publication",
    Boolean(derniere),
    "aucune date de publication exploitable dans le fichier"
  );

  console.log(`\n--- Invariants de forme ---`);

  verifier("toutes les dates sont en ISO ou absentes",
    petitions.every((p) => p.datePublication !== null || !records.length),
    "une date de publication n'a pas pu être analysée");

  const incoherentes = petitions.filter(
    (p) => p.dateLimiteVote && p.datePublication && p.dateLimiteVote < p.datePublication
  );
  verifier("aucune date limite antérieure à la publication",
    incoherentes.length === 0,
    `${incoherentes.length} cas`);

  verifier("les statuts appartiennent au domaine connu",
    petitions.every((p) => ["ouverte", "archivee", "classee", "expiree"].includes(p.statutSource)),
    `valeurs inattendues : ${[...new Set(petitions.map((p) => p.statutSource))].join(", ")}`);

  console.log(`\n--- Invariants des règles dérivées ---`);

  verifier("« sans objet » est réservé aux pétitions réellement en cours",
    petitions
      .filter((p) => p.motifClassement === MOTIFS.SANS_OBJET)
      .every((p) => !p.recueilTermine && p.statutSource === "ouverte"),
    "une pétition dont le sort est décidé ne peut pas être « sans objet »");

  // Ce contrôle est né d'un écart réel : le compteur affiché et la requête qui
  // alimentait la liste divergeaient d'une pétition.
  const classeesSansTexte = petitions.filter(
    (p) => p.statutSource === "classee" && !p.decisionTexte
  ).length;
  const classeesMotifAbsent = petitions.filter(
    (p) => p.statutSource === "classee" && p.motifClassement === MOTIFS.ABSENT
  ).length;
  verifier("le compteur des classées sans texte égale la requête qui les liste",
    classeesSansTexte === classeesMotifAbsent,
    `${classeesSansTexte} sans texte contre ${classeesMotifAbsent} en motif « absent »`);

  verifier("seuilAtteint est null si et seulement si nbVotes est inconnu",
    petitions.every((p) => (p.seuilAtteint === null) === (p.nbVotes === null)),
    "R3 mal appliquée");

  verifier("aucun nbVotes négatif",
    petitions.every((p) => p.nbVotes === null || p.nbVotes >= 0),
    "valeur négative détectée");

  verifier("tout écart statut/dates concerne bien une pétition « ouverte »",
    petitions.filter((p) => p.ecartStatutDates).every((p) => p.statutSource === "ouverte"),
    "R5 mal appliquée");

  const sommeMotifs =
    stats.motifSeuil + stats.motifConstat + stats.motifAbsent + stats.motifSansObjet;
  verifier("les quatre motifs couvrent exactement le jeu",
    sommeMotifs === stats.total,
    `${sommeMotifs} classés pour ${stats.total} pétitions`);

  console.log(`\n--- Écarts documentés, non bloquants ---`);

  if (derniere && ageJours > SANS_NOUVELLE_PETITION_JOURS) {
    signaler(
      `aucune nouvelle pétition depuis ${ageJours} j`,
      `dernière publication le ${derniere} — plausible en intersession, à surveiller si cela dure`
    );
  }

  if (stats.ecartStatutDates > 0) {
    signaler("statut « ouverte » alors que le recueil est terminé",
      `${stats.ecartStatutDates} pétition(s) — écart entre le fichier et les dates, signalé sur le site`);
  }
  if (stats.signaturesInconnues > 0) {
    signaler("nombre de signatures absent",
      `${stats.signaturesInconnues} pétition(s) — affichées « non renseigné », jamais zéro`);
  }
  const classeeOffice = petitions.filter(
    (p) => p.statutSource === "classee" && p.motifClassement === MOTIFS.SEUIL
  ).length;
  if (classeeOffice > 0) {
    signaler("statut « classee » contredit par le texte de décision",
      `${classeeOffice} pétition(s) dont le texte invoque un classement d'office`);
  }
  const sansCommission = petitions.filter((p) => !p.commissionSource).length;
  if (sansCommission > 0) {
    signaler("commission non renseignée", `${sansCommission} pétition(s)`);
  }

  console.log(`\n--- Chiffres publiés sur le site ---`);
  for (const [cle, valeur] of [
    ["total", stats.total],
    ["classées hors motif de seuil", stats.classeesHorsSeuil],
    ["… dont sans aucun texte", stats.classeesHorsSeuilSansTexte],
    ["formulations distinctes", stats.formulationsDistinctes],
    ["textes de décision", stats.textesDecision],
    ["recueil terminé sans texte", stats.motifAbsent],
    [`au-delà de ${SEUIL_SIGNATURES} signatures`, stats.seuilAtteint],
    ["clôturées en groupe", stats.clotureGroupee],
    ["plus grosse vague", `${stats.nbClotureMasse} le ${stats.dateClotureMasse}`],
  ]) {
    console.log(`  ${String(valeur).padStart(8)}  ${cle}`);
  }

  console.log(
    `\n${echecs.length} échec(s), ${avertissements.length} écart(s) documenté(s).`
  );
  if (echecs.length) {
    console.error("\nÉCHEC — la source ne satisfait pas les contrôles :");
    for (const e of echecs) console.error(`  • ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Vérification impossible :", err);
  process.exitCode = 1;
});
