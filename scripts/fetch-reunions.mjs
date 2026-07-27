#!/usr/bin/env node
// Aspire l'agenda des réunions de l'Assemblée nationale et en extrait les
// occurrences où une pétition figure à l'ordre du jour d'une commission.
//
// POURQUOI CE SCRIPT EXISTE
//
// Le sort d'une pétition ne se joue pas en séance publique mais en commission :
// un rapporteur y propose soit un débat avec rapport, soit le classement.
// scripts/fetch-debats.mjs n'aspire que le compte rendu de séance publique —
// il regarde donc à côté de l'endroit où les pétitions sont réellement traitées.
//
// Surtout, ce corpus-ci apporte ce qui manquait : quand une commission inscrit
// une pétition à son ordre du jour, elle la désigne par SON NUMÉRO ou son titre
// exact. Le rapprochement cesse d'être un recoupement thématique pour devenir
// une correspondance certaine, avec date de réunion et référence de compte rendu.
//
// Source : https://data.assemblee-nationale.fr/reunions/reunions
//          Agenda.json.zip — un fichier JSON par réunion, avec organe réuni,
//          date, ordre du jour en texte clair et référence du compte rendu.
//
// Usage :
//   node scripts/fetch-reunions.mjs           # analyse et écrit le JSON local
//   node scripts/fetch-reunions.mjs --push    # écrit aussi dans Firestore
//
// Sortie : .corpus/reunions.json, et collection `reunions` avec --push.

import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const AGENDA_URL =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/vp/reunions/Agenda.json.zip";
const PETITIONS_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/c94c9dfe-23eb-45aa-acd1-7438c4e977db";

const CORPUS_DIR = path.resolve(".corpus");
const CACHE = path.join(CORPUS_DIR, "cache", "Agenda.json.zip");

const push = process.argv.includes("--push");

// --- Lecture ZIP ----------------------------------------------------------

// Comme pour le tar de fetch-debats.mjs, on lit le format à la main plutôt que
// d'ajouter une dépendance. On passe par le répertoire central (et non les
// en-têtes locaux) car ceux-ci peuvent annoncer une taille nulle lorsque
// l'archive utilise un descripteur de données.
function lireZip(buf) {
  const FIN_CENTRAL = 0x06054b50;
  const ENTREE_CENTRALE = 0x02014b50;

  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === FIN_CENTRAL) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive ZIP illisible : fin de répertoire central introuvable.");

  const nbEntrees = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const fichiers = [];

  for (let n = 0; n < nbEntrees; n++) {
    if (buf.readUInt32LE(p) !== ENTREE_CENTRALE) break;
    const methode = buf.readUInt16LE(p + 10);
    const tailleCompressee = buf.readUInt32LE(p + 20);
    const lNom = buf.readUInt16LE(p + 28);
    const lExtra = buf.readUInt16LE(p + 30);
    const lComm = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nom = buf.subarray(p + 46, p + 46 + lNom).toString("utf8");

    // L'en-tête local a ses propres longueurs de nom et d'extra, souvent
    // différentes de celles du répertoire central : il faut les relire.
    const lNomLocal = buf.readUInt16LE(offsetLocal + 26);
    const lExtraLocal = buf.readUInt16LE(offsetLocal + 28);
    const debut = offsetLocal + 30 + lNomLocal + lExtraLocal;
    const brut = buf.subarray(debut, debut + tailleCompressee);

    if (!nom.endsWith("/")) {
      fichiers.push({ nom, data: methode === 0 ? brut : inflateRawSync(brut) });
    }
    p += 46 + lNom + lExtra + lComm;
  }
  return fichiers;
}

// --- Normalisation --------------------------------------------------------

function normaliser(t) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Appariement ----------------------------------------------------------

// Deux voies, volontairement distinctes pour pouvoir dire laquelle a servi.
// Le numéro est sans ambiguïté. Le titre l'est presque autant, à condition
// d'exiger une longueur minimale : « Loi Duplomb » apparaîtrait partout, alors
// que « non a la loi duplomb pour la sante la securite » ne peut désigner
// qu'une seule pétition.
const LONGUEUR_TITRE_MINIMALE = 28;
const NUMERO = /n[°os]\s*(\d{3,5})/gi;

// Un point d'ordre du jour agrège souvent plusieurs sujets sans rapport,
// séparés par des puces ou des tirets doubles. Raisonner sur le point entier
// faisait attribuer à une pétition un numéro appartenant à un autre objet :
// « n° 1430 » désignait une proposition de résolution européenne, dans une puce
// distincte de celle qui évoquait des pétitions. On segmente donc d'abord.
function segmenter(item) {
  return item
    .split(/[•;]|\s--+\s|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Titres partagés par plusieurs pétitions. Un appariement par titre sur l'un
// d'eux serait indécidable : on préfère ne rien affirmer.
function titresAmbigus(petitions) {
  const compte = new Map();
  for (const p of petitions.values()) {
    compte.set(p.titreNorm, (compte.get(p.titreNorm) ?? 0) + 1);
  }
  return new Set([...compte].filter(([, n]) => n > 1).map(([t]) => t));
}

function apparier(item, petitions, ambigus, rejets) {
  const trouves = new Map();

  for (const segment of segmenter(item)) {
    // Un numéro n'est retenu que dans un segment qui parle de pétitions.
    if (!/p[ée]tition/i.test(segment)) continue;

    let numeroTrouve = false;
    for (const m of segment.matchAll(NUMERO)) {
      const p = petitions.get(m[1]);
      if (p) {
        trouves.set(p.identifiant, "numero");
        numeroTrouve = true;
      }
    }

    // GARDE-FOU CONTRE LES TITRES HOMONYMES.
    //
    // Trois pétitions distinctes s'intitulent « Pétition contre la loi
    // Duplomb ». Un appariement par titre les désignait toutes les trois alors
    // que la commission ne visait que la n° 3092, qu'elle nommait. Dès qu'un
    // segment cite un numéro, ce numéro fait foi et le titre n'est plus
    // consulté ; le titre ne sert que lorsque aucun numéro n'est donné.
    if (numeroTrouve) continue;

    const segNorm = normaliser(segment);
    for (const p of petitions.values()) {
      if (p.titreNorm.length < LONGUEUR_TITRE_MINIMALE) continue;
      if (!segNorm.includes(p.titreNorm)) continue;
      // Le titre ne suffit que s'il ne désigne qu'une seule pétition. Trois
      // s'intitulent « Pétition contre la loi Duplomb » : sans numéro pour
      // trancher, l'attribution serait un pari, pas un constat.
      if (ambigus.has(p.titreNorm)) {
        rejets.push({ identifiant: p.identifiant, titre: p.titre, motif: "titre partagé" });
        continue;
      }
      trouves.set(p.identifiant, "titre");
    }
  }
  return trouves;
}

// --- Chargement -----------------------------------------------------------

async function chargerAgenda() {
  let buf;
  if (existsSync(CACHE)) {
    buf = await readFile(CACHE);
  } else {
    console.log(`Téléchargement de l'agenda : ${AGENDA_URL}`);
    const res = await fetch(AGENDA_URL, { headers: { "User-Agent": "suiteadonner/1.0" } });
    if (!res.ok) throw new Error(`Téléchargement échoué : ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    await writeFile(CACHE, buf);
  }
  return lireZip(buf).filter((f) => f.nom.endsWith(".json"));
}

async function chargerPetitions() {
  const res = await fetch(PETITIONS_URL);
  if (!res.ok) throw new Error(`Téléchargement des pétitions échoué : ${res.status}`);
  const lignes = parse(await res.text(), { delimiter: ";", columns: true, skip_empty_lines: true });
  const map = new Map();
  for (const r of lignes) {
    const identifiant = r.identifiant.trim();
    if (!identifiant) continue;
    map.set(identifiant, {
      identifiant,
      titre: r.titre.trim(),
      titreNorm: normaliser(r.titre),
      nbVotes: Number.parseFloat(r.nb_votes) || 0,
      statut: r.statut.trim(),
      commission: r.commission.trim(),
      decisionPubliee: r.decision_commission.trim().length > 0,
      url: r.url.trim(),
    });
  }
  return map;
}

// --- Traitement -----------------------------------------------------------

function itemsOrdreDuJour(reunion) {
  const odj = reunion.ODJ?.convocationODJ?.item ?? reunion.ODJ?.resumeODJ?.item ?? [];
  return (Array.isArray(odj) ? odj : [odj]).filter(Boolean);
}

async function main() {
  await mkdir(path.join(CORPUS_DIR, "cache"), { recursive: true });
  const [fichiers, petitions] = await Promise.all([chargerAgenda(), chargerPetitions()]);
  console.log(`Agenda : ${fichiers.length} réunions · Pétitions : ${petitions.size}`);

  const ambigus = titresAmbigus(petitions);
  const rejets = [];
  const parPetition = new Map();
  let reunionsCommission = 0;
  let itemsMentionnantPetition = 0;

  for (const f of fichiers) {
    const r = JSON.parse(f.data.toString("utf8")).reunion;
    const estCommission = r["@xsi:type"] === "reunionCommission_type";
    if (estCommission) reunionsCommission += 1;

    for (const item of itemsOrdreDuJour(r)) {
      if (!/p[ée]tition/i.test(item)) continue;
      itemsMentionnantPetition += 1;

      for (const [id, voie] of apparier(item, petitions, ambigus, rejets)) {
        if (!parPetition.has(id)) parPetition.set(id, []);
        parPetition.get(id).push({
          date: (r.timeStampDebut ?? "").slice(0, 10),
          etat: r.cycleDeVie?.etat ?? null,
          organeRef: r.organeReuniRef ?? null,
          compteRenduRef: r.compteRenduRef ?? null,
          intitule: item.replace(/\s+/g, " ").trim(),
          appariement: voie,
          estCommission,
        });
      }
    }
  }

  const resultats = [...parPetition.entries()]
    .map(([id, reunions]) => {
      const p = petitions.get(id);
      const uniques = [...new Map(reunions.map((x) => [`${x.date}|${x.intitule}`, x])).values()].sort(
        (a, b) => a.date.localeCompare(b.date)
      );
      return {
        identifiant: id,
        titre: p.titre,
        nbVotes: p.nbVotes,
        statut: p.statut,
        commission: p.commission,
        decisionPubliee: p.decisionPubliee,
        url: p.url,
        nbReunions: uniques.length,
        premiereReunion: uniques[0].date,
        derniereReunion: uniques.at(-1).date,
        // Le référentiel des organes n'est pas fourni dans cette archive : on
        // conserve l'identifiant brut pour la traçabilité et on affiche la
        // commission déjà connue par la fiche de pétition.
        reunions: uniques,
      };
    })
    .sort((a, b) => b.nbVotes - a.nbVotes);

  const parVoie = { numero: 0, titre: 0 };
  for (const r of resultats) for (const x of r.reunions) parVoie[x.appariement] += 1;

  console.log(`Réunions de commission : ${reunionsCommission}`);
  console.log(`Points d'ordre du jour mentionnant une pétition : ${itemsMentionnantPetition}`);
  console.log(
    `Pétitions appariées : ${resultats.length} ` +
      `(${parVoie.numero} correspondances par numéro, ${parVoie.titre} par titre)`
  );
  console.log(`Titres partagés par plusieurs pétitions : ${ambigus.size}`);
  if (rejets.length) {
    // Ces rejets sont volontaires : mieux vaut une lacune qu'une attribution
    // fausse. On les journalise pour qu'ils restent visibles.
    const uniques = [...new Map(rejets.map((r) => [r.identifiant, r])).values()];
    console.log(`Appariements écartés faute de certitude : ${uniques.length}`);
    for (const r of uniques) console.log(`  n°${r.identifiant} — ${r.motif} — ${r.titre.slice(0, 50)}`);
  }

  const sansDecision = resultats.filter((r) => !r.decisionPubliee);
  console.log(
    `  dont la décision reste vide dans le jeu public : ${sansDecision.length}/${resultats.length}`
  );

  for (const r of resultats.slice(0, 8)) {
    console.log(`\n[${r.identifiant}] ${r.nbVotes.toLocaleString("fr-FR")} sig · ${r.titre.slice(0, 62)}`);
    console.log(`  statut : ${r.statut} · décision publiée : ${r.decisionPubliee ? "oui" : "NON"}`);
    for (const x of r.reunions) {
      console.log(`  → ${x.date} [${x.appariement}] CR=${x.compteRenduRef ?? "—"}`);
      console.log(`     ${x.intitule.slice(0, 110)}`);
    }
  }

  const sortie = path.join(CORPUS_DIR, "reunions.json");
  await writeFile(sortie, JSON.stringify({ genere: resultats.length, resultats }, null, 2));
  console.log(`\n→ ${sortie}`);

  if (push) {
    console.log("\nÉcriture dans Firestore (collection `reunions`)...");
    const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
    const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: "suiteadonner" });
    }
    const db = getFirestore();
    const batch = db.batch();
    for (const r of resultats) batch.set(db.collection("reunions").doc(r.identifiant), r);
    batch.set(db.collection("meta").doc("reunions"), {
      nbPetitions: resultats.length,
      nbSansDecision: sansDecision.length,
      updatedAt: Timestamp.now(),
    });
    await batch.commit();
    console.log(`  ${resultats.length} documents écrits.`);
  }
}

main().catch((err) => {
  console.error("Échec de l'aspiration des réunions :", err);
  process.exitCode = 1;
});
