#!/usr/bin/env node
// Relève les pétitions publiées sur la plateforme de l'Assemblée nationale
// mais absentes du fichier de données ouvertes, et écrit le constat dans
// Firestore (meta/absentes) pour la page /absentes-du-fichier.
//
// Cause amont, signalée le 10/11/2026 :
// https://github.com/datagouv/datagouvfr_data_pipelines/issues/839
// Le pipeline de data.gouv.fr tient pour « inutilisé » tout numéro inférieur au
// plus grand numéro déjà vu et absent du fichier, et ne le relit plus jamais.
// Un numéro attribué avant la publication, puis dépassé, n'entre donc jamais
// dans le fichier. Au relevé du 10/11/2026 : 863 pétitions, 1,46 million de
// signatures.
//
// Ce relevé ne corrige rien et n'alimente pas la collection `petitions` : le
// fichier reste la seule source canonique (voir scripts/lib/petitions-source.mjs).
// La plateforme sert ici de comparaison, comme le prévoit ce principe.
//
// Méthode, identique à celle du pipeline amont : une requête HEAD par numéro
// absent ; une redirection vers l'accueil signifie « non publié ». Les fiches
// publiées sont lues aux mêmes endroits que l'amont (titre, signatures, dates,
// statut, commission, législature, texte de décision), remises au format d'une
// ligne du fichier, puis passées par mapLigne() : les règles dérivées (recueil
// terminé, motif du classement, seuil énoncé) sont exactement celles du fichier.
// La description n'est pas conservée : elle ferait dépasser au document la
// limite de 1 Mo de Firestore.
//
// Usage :
//   node scripts/relever-absentes.mjs              # relève et écrit meta/absentes
//   node scripts/relever-absentes.mjs --dry-run    # relève et résume, sans écrire
//   node scripts/relever-absentes.mjs --force      # relève même si déjà fait aujourd'hui pour ce fichier
//   node scripts/relever-absentes.mjs --dry-run --limite 50   # ne teste que 50 numéros (essai)
//   node scripts/relever-absentes.mjs --numeros 3603,5820     # ne lit que ces fiches, sans écrire
//
// Auth Firestore : identique à scripts/import-petitions.mjs.

import { parse } from "csv-parse/sync";
import { CSV_URL, libelleStatut, mapLigne, normaliserTexte } from "./lib/petitions-source.mjs";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const indexLimite = process.argv.indexOf("--limite");
const limite = indexLimite > -1 ? Number(process.argv[indexLimite + 1]) : null;
const indexNumeros = process.argv.indexOf("--numeros");
const numerosEssai = indexNumeros > -1 ? process.argv[indexNumeros + 1].split(",").map(Number) : null;

const PLATEFORME = "https://petitions.assemblee-nationale.fr";
const ENTETES = { "User-Agent": "suiteadonner/1.0" };
// Quatre requêtes à la fois : environ 3 500 HEAD et 900 lectures par semaine,
// soit la charge que l'amont jugeait déjà acceptable, étalée sur quelques minutes.
const CONCURRENCE = 4;
const DELAI_MS = 20000;
// Au-delà, la plateforme est probablement en panne ou a changé : mieux vaut
// garder le relevé précédent que publier une liste fausse.
const TAUX_ERREUR_MAX = 0.05;
// Firestore refuse un document de plus de 1 Mo.
const TAILLE_MAX = 900_000;

function decoderEntites(texte) {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function nettoyer(fragment) {
  return normaliserTexte(decoderEntites(fragment.replace(/<[^>]*>/g, " ")));
}

// JJ/MM/AAAA -> AAAA-MM-JJ, ou null si le format n'est pas reconnu.
function dateIso(texte) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texte);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Les trois formes de décision que l'amont reconnaît, aux mêmes endroits.
const MARQUES_DECISION = ["En application de l'article 148", "Conformément à la décision"];

function lireDecision(html) {
  for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = nettoyer(m[1]);
    if (MARQUES_DECISION.some((marque) => t.includes(marque))) return t;
  }
  for (const m of html.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>/g)) {
    const t = nettoyer(m[1]);
    if (t.includes("Cette pétition a été rejetée")) return t;
  }
  return "";
}

// Même ordre de priorité que build_status() en amont.
function lireStatut(html) {
  if (/class="[^"]*archive-header/.test(html)) return "archivee";
  if (/class="alert label initiative-status/.test(html)) return "classee";
  if (/class="warning label initiative-status/.test(html)) return "expiree";
  return "ouverte";
}

// Une fiche de la plateforme, sous la forme d'une ligne du fichier ouvert.
function lireLigne(html, numero, url) {
  const premier = (re) => re.exec(html)?.[1] ?? "";
  const libelles = [...html.matchAll(/href="\/initiatives\?filter[^"]*"[^>]*>([^<]*)</g)].map((m) =>
    nettoyer(m[1])
  );
  const legislature = libelles.find((t) => t.startsWith("Législature")) ?? "";
  return {
    identifiant: String(numero),
    titre: nettoyer(premier(/<h2 class="heading2"[^>]*>([\s\S]*?)<\/h2>/)),
    description: "",
    date_publication: dateIso(premier(/class="publish-date">([\s\S]*?)<\/div>/)) ?? "",
    nb_votes: premier(/class="progress__bar__number">([^<]*)</).replace(/\s/g, ""),
    statut: lireStatut(html),
    date_limite_vote: dateIso(premier(/class="phase-date"[^>]*>([\s\S]*?)<\//)) ?? "",
    commission: libelles.find((t) => t.startsWith("Commission")) ?? "",
    legislature: legislature.replace("Législature ", ""),
    decision_commission: lireDecision(html),
    url,
  };
}

// Ce que le site affiche d'une pétition absente : les champs de la ligne et
// les règles dérivées utiles à la page et à la fiche.
function versAbsente(ligne, aujourdhui) {
  const p = mapLigne(ligne, aujourdhui);
  return {
    identifiant: p.identifiant,
    titre: p.titre,
    nbVotes: p.nbVotes,
    datePublication: p.datePublication,
    dateLimiteVote: p.dateLimiteVote,
    commission: p.commissionSource,
    legislature: p.legislature,
    statutSource: p.statutSource,
    statutLabel: libelleStatut(p),
    recueilTermine: p.recueilTermine,
    motifClassement: p.motifClassement,
    decisionTexte: p.decisionTexte,
    url: p.url,
  };
}

async function requete(url, options) {
  for (let essai = 1; ; essai++) {
    try {
      return await fetch(url, { ...options, headers: ENTETES, signal: AbortSignal.timeout(DELAI_MS) });
    } catch (err) {
      if (essai >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// "publiee" | "non_publiee" | "erreur"
async function sonder(numero, aujourdhui) {
  const url = `${PLATEFORME}/initiatives/i-${numero}`;
  try {
    const res = await requete(url, { method: "HEAD", redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const cible = res.headers.get("location") ?? "";
      return cible.replace(/\/$/, "") === PLATEFORME ? { etat: "non_publiee" } : { etat: "erreur", detail: `redirection vers ${cible}` };
    }
    if (res.status !== 200) return { etat: "erreur", detail: `HTTP ${res.status}` };
    const page = await requete(url, { method: "GET" });
    if (!page.ok) return { etat: "erreur", detail: `HTTP ${page.status} à la lecture` };
    const ligne = lireLigne(await page.text(), numero, url);
    if (!ligne.titre) return { etat: "erreur", detail: "titre introuvable dans la page" };
    return { etat: "publiee", petition: versAbsente(ligne, aujourdhui) };
  } catch (err) {
    return { etat: "erreur", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function enParallele(elements, n, travail) {
  const resultats = new Array(elements.length);
  let suivant = 0;
  let faits = 0;
  async function ouvrier() {
    while (suivant < elements.length) {
      const i = suivant++;
      resultats[i] = await travail(elements[i]);
      faits++;
      if (faits % 500 === 0) console.log(`  ${faits}/${elements.length} numéros testés`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, elements.length) }, ouvrier));
  return resultats;
}

async function lireNumerosDuFichier() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Téléchargement du CSV échoué : ${res.status} ${res.statusText}`);
  const sourceModifieLe = res.headers.get("last-modified");
  const records = parse(await res.text(), { delimiter: ";", columns: true, skip_empty_lines: true });
  const numeros = new Set();
  for (const row of records) {
    const id = normaliserTexte(row.identifiant);
    if (/^\d+$/.test(id)) numeros.add(Number(id));
  }
  return { numeros, sourceModifieLe, nbLignes: records.length };
}

async function connecterFirestore() {
  const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: "suiteadonner" });
  }
  return getFirestore();
}

async function main() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (numerosEssai) {
    for (const n of numerosEssai) console.log(n, JSON.stringify(await sonder(n, aujourdhui), null, 2));
    return;
  }
  const { numeros, sourceModifieLe, nbLignes } = await lireNumerosDuFichier();
  if (!numeros.size) throw new Error("Aucun identifiant numérique dans le fichier : relevé impossible.");
  const numeroMax = Math.max(...numeros);
  console.log(`Fichier déposé le ${sourceModifieLe ?? "date inconnue"} : ${nbLignes} lignes, numéro max ${numeroMax}.`);

  const db = dryRun ? null : await connecterFirestore();
  if (db && !force) {
    const prec = await db.collection("meta").doc("absentes").get();
    if (prec.exists && prec.data().releveLe === aujourdhui && prec.data().sourceModifieLe === sourceModifieLe) {
      console.log("Relevé déjà fait aujourd'hui pour ce fichier : aucune écriture.");
      return;
    }
  }

  let manquants = [];
  for (let k = 1; k < numeroMax; k++) if (!numeros.has(k)) manquants.push(k);
  console.log(`${manquants.length} numéros absents du fichier sous le n° ${numeroMax}.`);
  if (limite) {
    manquants = manquants.slice(0, limite);
    console.log(`--limite : seuls les ${manquants.length} premiers sont testés.`);
  }

  const resultats = await enParallele(manquants, CONCURRENCE, (n) => sonder(n, aujourdhui));

  // Une seconde lecture pour les compteurs illisibles : le 10/11/2026, les
  // n° 5842 et 5856, dont le recueil se terminait ce jour-là, n'en affichaient
  // pas ; ils étaient lisibles le lendemain.
  for (let i = 0; i < resultats.length; i++) {
    const r = resultats[i];
    if (r.etat === "publiee" && r.petition.nbVotes === null) {
      const relu = await sonder(manquants[i], aujourdhui);
      if (relu.etat === "publiee" && relu.petition.nbVotes !== null) resultats[i] = relu;
    }
  }
  const publiees = resultats.filter((r) => r.etat === "publiee").map((r) => r.petition);
  const erreurs = resultats
    .map((r, i) => ({ ...r, numero: manquants[i] }))
    .filter((r) => r.etat === "erreur");
  const nbNonPubliees = resultats.filter((r) => r.etat === "non_publiee").length;
  const decidees = publiees.filter((p) => p.statutSource !== "ouverte" || p.recueilTermine);
  const nbSansDecision = decidees.filter((p) => !p.decisionTexte).length;

  publiees.sort((a, b) => (b.nbVotes ?? -1) - (a.nbVotes ?? -1) || Number(a.identifiant) - Number(b.identifiant));
  const totalSoutiens = publiees.reduce((s, p) => s + (p.nbVotes ?? 0), 0);
  const soutiensInconnus = publiees.filter((p) => p.nbVotes === null).length;

  console.log(
    `\nPubliées mais absentes : ${publiees.length} · non publiées : ${nbNonPubliees} · erreurs : ${erreurs.length}` +
      `\nSignatures cumulées : ${totalSoutiens.toLocaleString("fr-FR")} (${soutiensInconnus} compteur(s) illisible(s))`
  );
  for (const e of erreurs.slice(0, 10)) console.log(`  erreur n° ${e.numero} : ${e.detail}`);
  console.log(`Sort décidé ou recueil terminé : ${decidees.length}, dont ${nbSansDecision} sans texte de décision.`);
  for (const p of publiees.slice(0, 5)) {
    console.log(`  n° ${p.identifiant} · ${p.nbVotes ?? "?"} · ${p.statutLabel} · ${p.titre}`);
  }

  if (erreurs.length > manquants.length * TAUX_ERREUR_MAX) {
    console.error(
      `\n${erreurs.length} erreurs sur ${manquants.length} numéros (plus de ${TAUX_ERREUR_MAX * 100} %) : ` +
        "relevé abandonné, le précédent reste en place."
    );
    process.exitCode = 1;
    return;
  }

  const document = {
    releveLe: aujourdhui,
    sourceModifieLe: sourceModifieLe ?? null,
    numeroMax,
    nbNumerosTestes: manquants.length,
    nbNonPubliees,
    nbErreurs: erreurs.length,
    nbPubliees: publiees.length,
    totalSoutiens,
    soutiensInconnus,
    nbDecidees: decidees.length,
    nbSansDecision,
    petitions: publiees,
  };

  const taille = Buffer.byteLength(JSON.stringify(document));
  console.log(`Taille du document : ${Math.round(taille / 1000)} ko.`);
  if (taille > TAILLE_MAX) {
    console.error(`Document trop lourd pour Firestore (${taille} octets) : relevé abandonné.`);
    process.exitCode = 1;
    return;
  }

  if (dryRun || limite) {
    console.log(`\n${dryRun ? "--dry-run" : "--limite"} : aucune écriture.`);
    return;
  }

  await db.collection("meta").doc("absentes").set(document);
  console.log("\nmeta/absentes écrit.");
}

main().catch((err) => {
  console.error("Échec du relevé :", err);
  process.exitCode = 1;
});
