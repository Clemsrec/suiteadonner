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
// Cette référence de compte rendu ouvre à son tour le texte intégral de la
// réunion, où la décision figure en toutes lettres — souvent là où le fichier
// public, lui, laisse le champ `decision_commission` vide. L'extraction de
// cette décision vit dans scripts/lib/comptes-rendus.mjs, qui documente les
// deux filtres évitant de prendre l'avis d'un groupe pour une décision.
//
// Sources : https://data.assemblee-nationale.fr/reunions/reunions
//           Agenda.json.zip — un fichier JSON par réunion, avec organe réuni,
//           date, ordre du jour en texte clair et référence du compte rendu.
//           https://www.assemblee-nationale.fr/dyn/opendata/<référence>.html
//           — le compte rendu intégral de chaque réunion de commission.
//
// Usage :
//   node scripts/fetch-reunions.mjs           # analyse et écrit le JSON local
//   node scripts/fetch-reunions.mjs --push    # écrit aussi dans Firestore
//   node scripts/fetch-reunions.mjs --sans-comptes-rendus   # saute la collecte
//                                             # des comptes rendus (itération)
//
// Sortie : .corpus/reunions.json, et collection `reunions` avec --push.

import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { parseNombre } from "./lib/petitions-source.mjs";
import {
  CRAWL_DELAY_MS,
  estCompteRenduCommission,
  extraireClassementsEnBloc,
  extraireDecisions,
  urlCompteRendu,
} from "./lib/comptes-rendus.mjs";
import { dossiersUrl, lireRapport } from "./lib/rapports.mjs";

// Le fichier des pétitions couvre plusieurs législatures — 2017-2022,
// 2022-2024 et l'actuelle. Ne lire que la 17e revenait à publier des totaux
// (« un seul rapport », « 266 pétitions classées en bloc ») calculés sur un
// sous-ensemble, sans le dire. La 15e n'est pas servie à cette adresse : son
// absence est déclarée sur la page méthodologie plutôt que passée sous silence.
const LEGISLATURES = ["17", "16"];

const agendaUrl = (legislature) =>
  `https://data.assemblee-nationale.fr/static/openData/repository/${legislature}/vp/reunions/Agenda.json.zip`;
const PETITIONS_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/c94c9dfe-23eb-45aa-acd1-7438c4e977db";

const CORPUS_DIR = path.resolve(".corpus");
const cacheAgenda = (legislature) =>
  path.join(CORPUS_DIR, "cache", `Agenda-L${legislature}.json.zip`);
const CACHE_CR = path.join(CORPUS_DIR, "cache", "comptes-rendus");
const cacheDossiers = (legislature) =>
  path.join(CORPUS_DIR, "cache", `Dossiers_Legislatifs-L${legislature}.json.zip`);

const push = process.argv.includes("--push");
const sansComptesRendus = process.argv.includes("--sans-comptes-rendus");

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

async function chargerAgenda(legislature) {
  const cache = cacheAgenda(legislature);
  let buf;
  if (existsSync(cache)) {
    buf = await readFile(cache);
  } else {
    console.log(`Téléchargement de l'agenda (législature ${legislature})`);
    const res = await fetch(agendaUrl(legislature), {
      headers: { "User-Agent": "suiteadonner/1.0" },
    });
    if (!res.ok) throw new Error(`Téléchargement de l'agenda L${legislature} échoué : ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    await writeFile(cache, buf);
  }
  return lireZip(buf).filter((f) => f.nom.endsWith(".json"));
}

async function chargerTousLesAgendas() {
  const fichiers = [];
  for (const legislature of LEGISLATURES) {
    fichiers.push(...(await chargerAgenda(legislature)));
  }
  return fichiers;
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
      // parseNombre, et non `parseFloat(...) || 0` : 23 lignes du fichier ont
      // un nombre de signatures vide, et écrire zéro y affirmerait « aucun
      // soutien » là où la source ne dit rien. La n° 2760 s'affichait ainsi
      // « 0 soutiens » sur le site, en contradiction avec sa méthodologie.
      nbVotes: parseNombre(r.nb_votes),
      statut: r.statut.trim(),
      commission: r.commission.trim(),
      decisionPubliee: r.decision_commission.trim().length > 0,
      // Conservé mot pour mot : quand un compte rendu donne une décision, la
      // fiche affiche les deux textes en regard et laisse le lecteur juger.
      decisionTexte: r.decision_commission.trim() || null,
      url: r.url.trim(),
    });
  }
  return map;
}

// --- Comptes rendus de réunion -------------------------------------------

// Le compte rendu d'une réunion ne change plus une fois publié : un cache
// disque par référence suffit, et il évite de repayer le Crawl-delay de 30 s
// imposé par robots.txt à chaque exécution. Vider .corpus/cache/ force la
// recollecte, comme pour l'agenda et les débats.
async function chargerCompteRendu(ref) {
  const fichier = path.join(CACHE_CR, `${ref}.html`);
  if (existsSync(fichier)) return readFile(fichier, "utf8");

  const url = urlCompteRendu(ref);
  const res = await fetch(url, { headers: { "User-Agent": "suiteadonner/1.0" } });
  // Un compte rendu annoncé par l'agenda mais pas encore publié répond 404.
  // C'est un état normal, pas une panne : on le signale et on continue.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Compte rendu ${ref} : ${res.status} ${res.statusText}`);
  const html = await res.text();
  await writeFile(fichier, html);
  return html;
}

// Lit les comptes rendus et attache chaque décision à la pétition que la
// commission nomme elle-même. Une même réunion statue souvent sur plusieurs
// pétitions : le rattachement se fait sur le numéro cité dans la phrase de
// décision, jamais sur la position du paragraphe.
//
// Le compte rendu ouvre une troisième voie d'appariement, à côté du numéro et
// du titre lus dans l'ordre du jour. Elle est du même ordre de certitude : la
// commission écrit « La commission adopte la proposition de classement de la
// pétition n° 4553 » — c'est elle qui désigne, nous ne déduisons rien.
async function collecterDecisions(resultats, petitions, reunionsParCR) {
  if (!reunionsParCR.size) {
    return { lus: 0, absents: 0, decisions: 0, parCompteRendu: 0, classementsEnBloc: [] };
  }

  await mkdir(CACHE_CR, { recursive: true });
  console.log(`\nComptes rendus de commission à lire : ${reunionsParCR.size}`);

  const parReference = new Map();
  const classementsEnBloc = [];
  let lus = 0;
  let absents = 0;
  let attente = false;

  for (const ref of reunionsParCR.keys()) {
    // robots.txt impose Crawl-delay: 30. Un fichier déjà en cache ne déclenche
    // aucune requête, donc aucune attente.
    if (!existsSync(path.join(CACHE_CR, `${ref}.html`))) {
      if (attente) await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
      attente = true;
    }

    const html = await chargerCompteRendu(ref);
    if (html === null) {
      absents += 1;
      console.log(`  ${ref} — pas encore publié`);
      continue;
    }
    lus += 1;
    // Une décision qui ne nomme pas sa pétition n'est rattachée que si l'ordre
    // du jour de la réunion n'en désignait qu'une seule par son numéro.
    const nommees = reunionsParCR.get(ref)?.nommees ?? new Set();
    const unique = nommees.size === 1 ? [...nommees][0] : null;
    parReference.set(ref, extraireDecisions(html, unique));

    // Le classement en bloc ne concerne aucune pétition nommément : il est
    // relevé par séance, à côté des décisions individuelles.
    for (const bloc of extraireClassementsEnBloc(html)) {
      classementsEnBloc.push({
        date: reunionsParCR.get(ref).reunion.date,
        compteRenduRef: ref,
        url: urlCompteRendu(ref),
        ...bloc,
      });
    }
  }
  classementsEnBloc.sort((a, b) => a.date.localeCompare(b.date));

  const parIdentifiant = new Map(resultats.map((r) => [r.identifiant, r]));
  let decisions = 0;
  let parCompteRendu = 0;

  for (const [ref, trouvees] of parReference) {
    for (const d of trouvees) {
      const p = petitions.get(d.numero);
      // Le compte rendu peut trancher sur une pétition absente du fichier
      // public — c'est arrivé pour la n° 3603. Sans ligne au CSV, aucune fiche
      // à enrichir : on ne l'invente pas.
      if (!p) continue;

      let entree = parIdentifiant.get(d.numero);
      if (!entree) {
        entree = {
          identifiant: p.identifiant,
          titre: p.titre,
          nbVotes: p.nbVotes,
          statut: p.statut,
          commission: p.commission,
          decisionPubliee: p.decisionPubliee,
          decisionTexte: p.decisionTexte,
          url: p.url,
          nbReunions: 0,
          premiereReunion: null,
          derniereReunion: null,
          derniereDecision: null,
          reunions: [],
        };
        parIdentifiant.set(d.numero, entree);
        resultats.push(entree);
      }

      let reunion = entree.reunions.find((x) => x.compteRenduRef === ref);
      if (!reunion) {
        reunion = {
          ...reunionsParCR.get(ref).reunion,
          appariement: "compte-rendu",
          decision: null,
        };
        entree.reunions.push(reunion);
        parCompteRendu += 1;
      }
      reunion.decision = {
        sens: d.sens,
        citation: d.citation,
        referent: d.referent,
        url: urlCompteRendu(ref),
      };
      decisions += 1;
    }
  }

  for (const r of resultats) {
    r.reunions.sort((a, b) => a.date.localeCompare(b.date));
    r.nbReunions = r.reunions.length;
    r.premiereReunion = r.reunions[0]?.date ?? null;
    r.derniereReunion = r.reunions.at(-1)?.date ?? null;
    const derniere = r.reunions.filter((x) => x.decision).at(-1) ?? null;
    // Règle 2 : sans décision extractible, le champ reste null.
    r.derniereDecision = derniere
      ? { ...derniere.decision, date: derniere.date, compteRenduRef: derniere.compteRenduRef }
      : null;
  }

  return { lus, absents, decisions, parCompteRendu, classementsEnBloc };
}

// --- Rapports de commission ----------------------------------------------

// Le jeu des dossiers législatifs est régénéré chaque jour et pèse 10 Mo. Il
// est mis en cache comme l'agenda : vider .corpus/cache/ force la recollecte.
async function chargerDossiers(legislature) {
  const cache = cacheDossiers(legislature);
  if (existsSync(cache)) return lireZip(await readFile(cache));
  console.log(`Téléchargement des dossiers législatifs (législature ${legislature})`);
  const res = await fetch(dossiersUrl(legislature), {
    headers: { "User-Agent": "suiteadonner/1.0" },
  });
  if (!res.ok) throw new Error(`Téléchargement des dossiers L${legislature} échoué : ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cache, buf);
  return lireZip(buf);
}

// Attache à chaque pétition le rapport que la commission a déposé sur elle.
// Le rapport peut exister sans qu'aucune réunion n'ait été appariée : c'est
// une trace de plein droit, pas un complément des réunions.
async function collecterRapports(resultats, petitions) {
  const fichiers = [];
  for (const legislature of LEGISLATURES) {
    fichiers.push(...(await chargerDossiers(legislature)));
  }
  const rapports = [];

  for (const f of fichiers) {
    if (!f.nom.includes("/document/") || !f.nom.endsWith(".json")) continue;
    // Le JSON échappe les accents (« p\u00e9tition ») : chercher le mot en
    // clair dans les octets ne trouve rien. On filtre sur le code de
    // classification, seul marqueur fiable, quitte à parser un peu plus.
    if (!f.data.includes("PETITION")) continue;

    const rapport = lireRapport(JSON.parse(f.data.toString("utf8")));
    if (rapport) rapports.push(rapport);
  }

  const parIdentifiant = new Map(resultats.map((r) => [r.identifiant, r]));
  let rattaches = 0;

  for (const rapport of rapports) {
    const p = petitions.get(rapport.numeroPetition);
    // Un rapport sur une pétition absente du fichier public ne peut enrichir
    // aucune fiche : on ne fabrique pas la pétition manquante.
    if (!p) continue;

    let entree = parIdentifiant.get(rapport.numeroPetition);
    if (!entree) {
      entree = {
        identifiant: p.identifiant,
        titre: p.titre,
        nbVotes: p.nbVotes,
        statut: p.statut,
        commission: p.commission,
        decisionPubliee: p.decisionPubliee,
        decisionTexte: p.decisionTexte,
        url: p.url,
        nbReunions: 0,
        premiereReunion: null,
        derniereReunion: null,
        derniereDecision: null,
        rapport: null,
        reunions: [],
      };
      parIdentifiant.set(p.identifiant, entree);
      resultats.push(entree);
    }
    entree.rapport = rapport;
    rattaches += 1;
  }

  return { lus: rapports.length, rattaches };
}

// Ce que l'accueil met en tête. Calculé ici, à côté des données qui le
// fondent, et relu d'un seul document `meta/reunions` : la page n'a pas à
// charger les fiches pour compter, et aucun de ces chiffres ne peut être écrit
// en dur — deux constats de l'accueil l'avaient été, et ont fini par mentir.
function construireSynthese(resultats, classementsEnBloc = []) {
  const decidees = resultats.filter((r) => r.derniereDecision);
  const avecRapport = resultats.filter((r) => r.rapport);

  // Une commission qui vote l'examen d'une pétition s'engage à l'examiner, et
  // cet examen se conclut par un rapport. Entre les deux, rien n'a de date
  // limite : ces pétitions sont donc en attente, et c'est le seul délai que le
  // site puisse mesurer sur une obligation que l'Assemblée s'est donnée.
  const attenteRapport = resultats
    .filter((r) => r.derniereDecision?.sens === "examen" && !r.rapport)
    .map((r) => ({
      identifiant: r.identifiant,
      titre: r.titre,
      nbVotes: r.nbVotes,
      statut: r.statut,
      dateExamen: r.derniereDecision.date,
      citation: r.derniereDecision.citation,
      url: r.derniereDecision.url,
    }))
    .sort((a, b) => a.dateExamen.localeCompare(b.dateExamen));
  const absentesDuFichier = decidees.filter((r) => !r.decisionTexte);
  const divergentes = decidees.filter((r) => r.decisionTexte);

  // La plus signée de celles dont le fichier ne dit rien : c'est le cas qui
  // montre l'écart le mieux, et il change tout seul quand un plus gros arrive.
  const emblematique = absentesDuFichier
    .filter((r) => r.nbVotes !== null)
    .sort((a, b) => b.nbVotes - a.nbVotes)[0];

  // Une réunion dont l'ordre du jour annonce une décision, mais dont le compte
  // rendu n'est pas encore publié : la décision est prise, le texte pas encore
  // lisible. L'attente est un fait, pas une absence de fait.
  const attendues = resultats.filter(
    (r) =>
      !r.derniereDecision &&
      r.reunions.some((x) => !x.compteRenduRef && /^[\s\-–—•]*d[ée]cision/i.test(x.intitule))
  );

  const resume = (r) => ({
    identifiant: r.identifiant,
    titre: r.titre,
    nbVotes: r.nbVotes,
    statut: r.statut,
    sens: r.derniereDecision?.sens ?? null,
    date: r.derniereDecision?.date ?? null,
    decisionTexte: r.decisionTexte,
    citation: r.derniereDecision?.citation ?? null,
  });

  return {
    nbPetitions: resultats.length,
    nbDecisions: decidees.length,
    nbDecisionsAbsentesDuFichier: absentesDuFichier.length,
    // Somme des soutiens derrière une décision que le fichier ne publie pas.
    // Les nombres absents sont exclus, pas comptés pour zéro.
    signaturesDecisionsAbsentes: absentesDuFichier.reduce((t, r) => t + (r.nbVotes ?? 0), 0),
    emblematique: emblematique ? resume(emblematique) : null,
    nbDivergences: divergentes.length,
    divergence: divergentes.length ? resume(divergentes[0]) : null,
    nbDecisionsAttendues: attendues.length,
    signaturesDecisionsAttendues: attendues.reduce((t, r) => t + (r.nbVotes ?? 0), 0),
    // Le classement en bloc : le sort le plus courant, et le seul qui ne
    // laisse aucune trace au nom de la pétition concernée.
    classementsEnBloc,
    nbClassementsEnBloc: classementsEnBloc.length,
    petitionsClasseesEnBloc: classementsEnBloc.reduce((t, c) => t + c.nombre, 0),
    // Le rapport est la seule suite écrite, argumentée et signée qu'une
    // pétition puisse recevoir. Il y en a très peu : c'est le constat.
    // Le délai en mois n'est pas figé ici : il vieillirait entre deux
    // collectes. Seule la date de l'examen est stockée, le site compte à
    // partir d'elle au moment où il rend la page.
    attenteRapport,
    nbAttenteRapport: attenteRapport.length,
    signaturesAttenteRapport: attenteRapport.reduce((t, r) => t + (r.nbVotes ?? 0), 0),
    nbRapports: avecRapport.length,
    // `titre` reste celui du rapport, tel que le document le porte ; le titre
    // de la pétition a son champ à lui, pour qu'aucun des deux n'écrase l'autre.
    // Triés du plus ancien au plus récent : l'accueil met en avant le dernier
    // déposé, et l'ordre par signatures faisait remonter un rapport de 2023
    // comme s'il était le plus récent.
    rapports: avecRapport
      .map((r) => ({
        identifiant: r.identifiant,
        titrePetition: r.titre,
        nbVotes: r.nbVotes,
        ...r.rapport,
      }))
      .sort((a, b) => (a.dateDepot ?? "").localeCompare(b.dateDepot ?? "")),
  };
}

// Un nombre de signatures absent n'est pas un petit nombre : ces pétitions se
// rangent en fin de liste plutôt que de passer pour les moins soutenues.
function parSoutienDecroissant(a, b) {
  if (a.nbVotes === null || b.nbVotes === null) {
    return a.nbVotes === b.nbVotes ? 0 : a.nbVotes === null ? 1 : -1;
  }
  return b.nbVotes - a.nbVotes;
}

// Une décision publiée engage le site : elle affirme, citation à l'appui, ce
// qu'une commission a voté. Ces contrôles cassent plutôt que de laisser passer
// un rattachement douteux — même logique que verifier-coherence.mjs sur le CSV.
function verifierDecisions(resultats) {
  const echecs = [];

  for (const r of resultats) {
    for (const x of r.reunions) {
      if (!x.decision) continue;
      const ou = `n°${r.identifiant} · ${x.date}`;

      if (!x.decision.citation?.trim()) {
        echecs.push(`${ou} : décision sans citation.`);
      }
      if (!["examen", "classement"].includes(x.decision.sens)) {
        echecs.push(`${ou} : sens inattendu «${x.decision.sens}».`);
      }
      // Le garde-fou central. Deux rattachements sont admis, et un seul autre
      // serait une déduction : soit la phrase nomme la pétition, soit elle ne
      // la nomme pas mais le compte rendu ne traite que d'elle — auquel cas la
      // citation ne doit contenir aucun autre numéro de pétition.
      if (!["cite", "unique"].includes(x.decision.referent)) {
        echecs.push(`${ou} : mode de rattachement inattendu «${x.decision.referent}».`);
      }
      const citation = x.decision.citation ?? "";
      if (x.decision.referent === "cite" && !new RegExp(`\\b${r.identifiant}\\b`).test(citation)) {
        echecs.push(`${ou} : la citation ne cite pas le numéro de la pétition.`);
      }
      if (x.decision.referent === "unique") {
        const autres = [...citation.matchAll(/p[ée]titions?\s*n[°o]\s*(\d{3,5})/gi)]
          .map((m) => m[1])
          .filter((n) => n !== r.identifiant);
        if (autres.length) {
          echecs.push(`${ou} : référent réputé unique mais la citation nomme n°${autres[0]}.`);
        }
      }
      if (!x.decision.url?.startsWith("https://www.assemblee-nationale.fr/dyn/opendata/")) {
        echecs.push(`${ou} : lien de compte rendu inattendu.`);
      }
    }

    const derniere = r.reunions.filter((x) => x.decision).at(-1) ?? null;
    if (Boolean(r.derniereDecision) !== Boolean(derniere)) {
      echecs.push(`n°${r.identifiant} : derniereDecision incohérente avec les réunions.`);
    }
  }

  if (echecs.length) {
    for (const e of echecs) console.error(`  ✗ ${e}`);
    throw new Error(`${echecs.length} décision(s) non conforme(s) : rien n'a été écrit.`);
  }
}

// --- Traitement -----------------------------------------------------------

function itemsOrdreDuJour(reunion) {
  const odj = reunion.ODJ?.convocationODJ?.item ?? reunion.ODJ?.resumeODJ?.item ?? [];
  return (Array.isArray(odj) ? odj : [odj]).filter(Boolean);
}

async function main() {
  await mkdir(path.join(CORPUS_DIR, "cache"), { recursive: true });
  const [fichiers, petitions] = await Promise.all([chargerTousLesAgendas(), chargerPetitions()]);
  console.log(`Agenda : ${fichiers.length} réunions · Pétitions : ${petitions.size}`);

  const ambigus = titresAmbigus(petitions);
  const rejets = [];
  const parPetition = new Map();
  // Référence de compte rendu → la réunion qu'elle documente. Sert à rattacher
  // une décision à sa date même quand l'ordre du jour ne nommait pas la pétition.
  const reunionsParCR = new Map();
  let reunionsCommission = 0;
  let itemsMentionnantPetition = 0;

  for (const f of fichiers) {
    const r = JSON.parse(f.data.toString("utf8")).reunion;
    const estCommission = r["@xsi:type"] === "reunionCommission_type";
    if (estCommission) reunionsCommission += 1;

    for (const item of itemsOrdreDuJour(r)) {
      if (!/p[ée]tition/i.test(item)) continue;
      itemsMentionnantPetition += 1;

      const reunion = {
        date: (r.timeStampDebut ?? "").slice(0, 10),
        etat: r.cycleDeVie?.etat ?? null,
        organeRef: r.organeReuniRef ?? null,
        compteRenduRef: r.compteRenduRef ?? null,
        intitule: item.replace(/\s+/g, " ").trim(),
        estCommission,
      };

      const apparies = apparier(item, petitions, ambigus, rejets);

      // Toute réunion parlant de pétitions vaut d'être lue, même si son ordre
      // du jour n'en nomme aucune précisément : le compte rendu, lui, cite les
      // numéros. La commission du 14/01/2026 annonçait « les pétitions
      // renvoyées à la commission » et son compte rendu tranche nommément sur
      // les n° 3603 et 4553.
      //
      // On retient aussi les pétitions que l'ordre du jour désigne par leur
      // numéro : quand il n'y en a qu'une, une décision énoncée sans la nommer
      // lui revient sans ambiguïté possible.
      if (estCompteRenduCommission(reunion.compteRenduRef)) {
        // La réunion et les pétitions qu'elle nomme restent deux champs
        // distincts : `nommees` est un Set de travail, qui n'a rien à faire
        // dans le document écrit en base.
        const connue = reunionsParCR.get(reunion.compteRenduRef);
        const nommees = connue?.nommees ?? new Set();
        for (const [id, voie] of apparies) if (voie === "numero") nommees.add(id);
        if (!connue) reunionsParCR.set(reunion.compteRenduRef, { reunion, nommees });
      }

      for (const [id, voie] of apparies) {
        if (!parPetition.has(id)) parPetition.set(id, []);
        parPetition.get(id).push({ ...reunion, appariement: voie });
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
        decisionTexte: p.decisionTexte,
        url: p.url,
        nbReunions: uniques.length,
        premiereReunion: uniques[0].date,
        derniereReunion: uniques.at(-1).date,
        // Renseignée par collecterDecisions() : la décision la plus récente
        // qu'un compte rendu officiel énonce pour cette pétition, s'il y en a.
        derniereDecision: null,
        // Le rapport que la commission publie au terme d'un examen, s'il existe.
        rapport: null,
        // Le référentiel des organes n'est pas fourni dans cette archive : on
        // conserve l'identifiant brut pour la traçabilité et on affiche la
        // commission déjà connue par la fiche de pétition.
        reunions: uniques.map((x) => ({ ...x, decision: null })),
      };
    })
    .sort(parSoutienDecroissant);

  console.log(`Réunions de commission : ${reunionsCommission}`);
  console.log(`Points d'ordre du jour mentionnant une pétition : ${itemsMentionnantPetition}`);

  // La lecture des comptes rendus peut ajouter des pétitions et des réunions :
  // elle passe donc avant tout décompte.
  let cr = null;
  if (sansComptesRendus) {
    console.log("\nComptes rendus : collecte sautée (--sans-comptes-rendus).\n");
  } else {
    cr = await collecterDecisions(resultats, petitions, reunionsParCR);
    const rap = await collecterRapports(resultats, petitions);
    console.log(
      `Rapports de commission sur pétition : ${rap.lus} publié(s), ${rap.rattaches} rattaché(s)`
    );
    resultats.sort(parSoutienDecroissant);
  }

  const parVoie = { numero: 0, titre: 0, "compte-rendu": 0 };
  for (const r of resultats) for (const x of r.reunions) parVoie[x.appariement] += 1;

  console.log(
    `\nPétitions appariées : ${resultats.length} ` +
      `(${parVoie.numero} correspondances par numéro, ${parVoie.titre} par titre, ` +
      `${parVoie["compte-rendu"]} par le compte rendu)`
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

  if (cr) {
    console.log(
      `\nComptes rendus lus : ${cr.lus}` +
        (cr.absents ? ` · pas encore publiés : ${cr.absents}` : "") +
        ` · décisions rattachées avec certitude : ${cr.decisions}`
    );

    // Le constat que ces décisions rendent possible : la commission a tranché,
    // le fichier réutilisable n'en dit rien.
    const decidees = resultats.filter((r) => r.derniereDecision);
    const muettes = decidees.filter((r) => !r.decisionPubliee);
    const divergentes = decidees.filter((r) => r.decisionPubliee);
    console.log(
      `  dont le fichier public ne publie aucune décision : ${muettes.length}/${decidees.length}`
    );
    if (divergentes.length) {
      // Deux sources officielles publient chacune une décision. On ne conclut
      // pas : on garde les deux textes pour les afficher en regard.
      console.log(`  dont le fichier publie un texte de son côté : ${divergentes.length}`);
      for (const r of divergentes) {
        console.log(`    n°${r.identifiant} — compte rendu : ${r.derniereDecision.sens}`);
        console.log(`      fichier : ${r.decisionTexte.slice(0, 90)}`);
      }
    }
  }

  for (const r of resultats.slice(0, 8)) {
    const soutiens = r.nbVotes === null ? "non renseigné" : `${r.nbVotes.toLocaleString("fr-FR")} sig`;
    console.log(`\n[${r.identifiant}] ${soutiens} · ${r.titre.slice(0, 62)}`);
    console.log(`  statut : ${r.statut} · décision publiée : ${r.decisionPubliee ? "oui" : "NON"}`);
    for (const x of r.reunions) {
      console.log(`  → ${x.date} [${x.appariement}] CR=${x.compteRenduRef ?? "—"}`);
      console.log(`     ${x.intitule.slice(0, 110)}`);
      if (x.decision) console.log(`     décision [${x.decision.sens}] « ${x.decision.citation} »`);
    }
  }

  verifierDecisions(resultats);

  const synthese = construireSynthese(resultats, cr?.classementsEnBloc ?? []);
  console.log(
    `\nSynthèse : ${synthese.nbDecisionsAbsentesDuFichier} décision(s) absente(s) du fichier, ` +
      `${(synthese.signaturesDecisionsAbsentes ?? 0).toLocaleString("fr-FR")} signatures cumulées` +
      (synthese.nbDecisionsAttendues ? `, ${synthese.nbDecisionsAttendues} attendue(s)` : "")
  );

  const sortie = path.join(CORPUS_DIR, "reunions.json");
  await writeFile(
    sortie,
    JSON.stringify({ genere: resultats.length, synthese, resultats }, null, 2)
  );
  console.log(`→ ${sortie}`);

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
      ...synthese,
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
