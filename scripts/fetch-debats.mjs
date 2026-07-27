#!/usr/bin/env node
// Aspire les comptes rendus intégraux des séances publiques de l'Assemblée
// nationale (flux XML de la DILA) et en extrait un corpus d'interventions
// exploitable hors ligne.
//
// Pourquoi aspirer plutôt qu'interroger une API : il n'existe aucun moteur de
// recherche plein texte fiable sur les interventions parlementaires.
// L'endpoint /recherche de NosDéputés.fr renvoie une 500, et sa variante
// object_name=Intervention ramène ~612 000 résultats pour un mot courant —
// inutilisable comme signal de précision. On construit donc notre propre index.
//
// Source : https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/
//   <année>/AN_<AAAANNN>.taz          archives closes
//   Annee_en_cours/AN_<AAAANNN>.taz   année courante, mise à jour en continu
// Chaque .taz est un tar gzippé contenant deux XML :
//   CRI_*.xml  « cahier blanc » — le compte rendu intégral des débats  <- ce qu'on veut
//   AAA_*.xml  « cahier bleu »  — articles, amendements, annexes
//
// Usage :
//   node scripts/fetch-debats.mjs                    # années par défaut (17e législature)
//   node scripts/fetch-debats.mjs 2024 2025          # années explicites
//   node scripts/fetch-debats.mjs --limit 3 2025     # n'aspire que 3 archives (test)
//
// Sortie : .corpus/debats-<année>.jsonl (une intervention par ligne), plus un
// cache des archives brutes dans .corpus/cache/ pour éviter de retélécharger.

import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE_URL = "https://echanges.dila.gouv.fr/OPENDATA/Debats/AN";
const CORPUS_DIR = path.resolve(".corpus");
const CACHE_DIR = path.join(CORPUS_DIR, "cache");

// 17e législature : élue en juillet 2024, toujours en cours. On remonte à 2024
// pour couvrir les pétitions clôturées depuis, avec une marge avant.
const ANNEES_PAR_DEFAUT = ["2024", "2025", "Annee_en_cours"];

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : Infinity;
const annees = args.filter(
  (a, i) => !a.startsWith("--") && !(limitIdx >= 0 && i === limitIdx + 1)
);
const cibles = annees.length ? annees : ANNEES_PAR_DEFAUT;

// --- Téléchargement -------------------------------------------------------

async function listerArchives(annee) {
  const url = `${BASE_URL}/${annee}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Index ${annee} inaccessible : ${res.status}`);
  const html = await res.text();
  const noms = [...html.matchAll(/<a href="(AN_[^"]+\.taz)"/g)].map((m) => m[1]);
  return noms.map((nom) => ({ nom, url: `${url}${nom}` }));
}

async function telecharger({ nom, url }) {
  const cache = path.join(CACHE_DIR, nom);
  if (existsSync(cache)) return readFile(cache);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement ${nom} échoué : ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cache, buf);
  return buf;
}

// --- Décompression --------------------------------------------------------

// Le .taz est un tar gzippé, mais la DILA le sert avec Content-Encoding: gzip :
// fetch() le décompresse déjà de son côté et nous rend un tar nu. On teste donc
// les octets magiques plutôt que de supposer l'un ou l'autre.
function degzip(buffer) {
  return buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer;
}

// Plutôt que d'ajouter une dépendance pour deux fichiers par archive, on lit les
// en-têtes tar à la main : blocs de 512 octets, nom sur les 100 premiers,
// taille en octal aux offsets 124-136.
function extraireTar(buffer) {
  const fichiers = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const entete = buffer.subarray(offset, offset + 512);
    const nom = entete.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!nom) break; // bloc vide = fin d'archive
    const taille = Number.parseInt(
      entete.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim() || "0",
      8
    );
    const typeflag = entete[156];
    offset += 512;
    if (typeflag === 0x30 || typeflag === 0) {
      fichiers.push({ nom, contenu: buffer.subarray(offset, offset + taille) });
    }
    offset += Math.ceil(taille / 512) * 512;
  }
  return fichiers;
}

// Les archives des années closes sont doublement emballées : le .taz contient un
// .tar qui contient les XML, là où Annee_en_cours expose les XML directement.
// On déballe donc jusqu'à tomber sur autre chose qu'une archive.
function extraireRecursif(buffer, profondeurMax = 3) {
  const sortie = [];
  for (const f of extraireTar(degzip(buffer))) {
    if (profondeurMax > 0 && /\.(tar|taz|gz)$/i.test(f.nom)) {
      sortie.push(...extraireRecursif(f.contenu, profondeurMax - 1));
    } else {
      sortie.push(f);
    }
  }
  return sortie;
}

// --- Parsing du compte rendu ---------------------------------------------

const ENTITES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decoder(texte) {
  return texte
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      // La DILA utilise U+0080 comme espace fine insécable typographique.
      return cp < 0x20 || cp === 0x80 ? " " : String.fromCodePoint(cp);
    })
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&(\w+);/g, (m, nom) => ENTITES[nom] ?? m);
}

// Retire les balises internes (Italique, Exposant, LienInterneDocRef…) et les
// instructions de traitement typographiques (<?A3B2 bk?>, <?Folio 42?>) pour
// ne garder que le texte prononcé.
function texteBrut(fragment) {
  return decoder(
    fragment
      .replace(/<\?[^>]*\?>/g, "")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extraireMeta(xml) {
  const champ = (nom) => xml.match(new RegExp(`<${nom}>([^<]*)</${nom}>`))?.[1]?.trim() ?? null;
  return {
    dateSeance: champ("dateSeance"),
    legislature: champ("LegislatureNumero"),
    session: champ("SessionParlementaire"),
    parution: champ("parution"),
  };
}

// Le <Sommaire> en tête de document répète tous les intitulés : on démarre
// l'extraction après lui, sinon chaque titre apparaît deux fois.
function corpsUtile(xml) {
  const fin = xml.lastIndexOf("</Sommaire>");
  return fin >= 0 ? xml.slice(fin + "</Sommaire>".length) : xml;
}

const JETON = /<Intitule\b[^>]*>([\s\S]*?)<\/Intitule>|<Para\b([^>]*)>([\s\S]*?)<\/Para>/g;
const ORATEUR = /^<Orateur\b[^>]*>\s*<Nom>([\s\S]*?)<\/Nom>\s*<\/Orateur>/;

function parserCompteRendu(xml, source) {
  const meta = extraireMeta(xml);
  const corps = corpsUtile(xml);
  const interventions = [];
  let sujet = null;
  let orateurCourant = null;

  for (const m of corps.matchAll(JETON)) {
    if (m[1] !== undefined) {
      sujet = texteBrut(m[1]) || sujet;
      continue;
    }
    const attrs = m[2] ?? "";
    const contenu = m[3] ?? "";
    const debut = contenu.match(ORATEUR);

    // Un <Para> sans <Orateur> prolonge la prise de parole précédente
    // (paragraphes multiples d'une même intervention).
    if (debut) orateurCourant = texteBrut(debut[1]).replace(/[.\s]+$/, "");
    const texte = texteBrut(debut ? contenu.slice(debut[0].length) : contenu);
    if (!texte) continue;

    // Une prise de parole longue est découpée en plusieurs <Para> partageant le
    // même idsyceron : on les recolle pour compter des interventions et non des
    // paragraphes — sinon toute mesure de « combien de fois ce sujet a été
    // abordé » est gonflée par la mise en page.
    const precedent = interventions.at(-1);
    if (precedent && m[2]?.includes(`idsyceron="${precedent.idsyceron}"`)) {
      precedent.texte += " " + texte;
      continue;
    }

    interventions.push({
      date: meta.dateSeance,
      legislature: meta.legislature,
      session: meta.session,
      sujet,
      orateur: orateurCourant,
      texte,
      idsyceron: attrs.match(/idsyceron="(\d+)"/)?.[1] ?? null,
      source,
    });
  }
  return interventions;
}

// --- Orchestration --------------------------------------------------------

async function traiterAnnee(annee) {
  const archives = (await listerArchives(annee)).slice(0, limit);
  console.log(`\n${annee} : ${archives.length} archive(s) à traiter`);

  const interventions = [];
  let n = 0;
  for (const archive of archives) {
    const taz = await telecharger(archive);
    const fichiers = extraireRecursif(taz);
    for (const f of fichiers) {
      if (!path.basename(f.nom).startsWith("CRI_")) continue;
      interventions.push(...parserCompteRendu(f.contenu.toString("utf8"), path.basename(f.nom)));
    }
    if (++n % 10 === 0 || n === archives.length) {
      console.log(`  ${n}/${archives.length} — ${interventions.length} interventions`);
    }
  }

  const sortie = path.join(CORPUS_DIR, `debats-${annee}.jsonl`);
  await writeFile(sortie, interventions.map((i) => JSON.stringify(i)).join("\n") + "\n");
  const octets = interventions.reduce((s, i) => s + i.texte.length, 0);
  console.log(`  → ${sortie} (${(octets / 1e6).toFixed(1)} Mo de texte)`);
  return interventions.length;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  let total = 0;
  for (const annee of cibles) total += await traiterAnnee(annee);
  console.log(`\nCorpus constitué : ${total} interventions.`);
}

main().catch((err) => {
  console.error("Échec de l'aspiration :", err);
  process.exitCode = 1;
});
