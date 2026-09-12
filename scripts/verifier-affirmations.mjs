#!/usr/bin/env node
// Contrôle des affirmations absolues affichées par le site.
//
// POURQUOI CE SCRIPT EXISTE
//
// Les chiffres de ce site sont calculés, et se corrigent donc tout seuls quand
// la source change. Les phrases, elles, sont écrites à la main — et c'est là
// que se sont logées toutes les erreurs relevées le 11/09/2026 lors de la revue
// des affirmations :
//
//   « une seule suite écrite »          — sur un corpus lu à un tiers
//   « aucun délai n'est fixé »          — sur un texte jamais ouvert
//   « le compte rendu ne donne jamais » — sur trente-quatre documents lus
//   « la seule situation où… »          — sur une catégorie définie par elle-même
//
// Aucun test ne les voyait. verifier-coherence.mjs garde le CSV, ce script
// garde les phrases.
//
// LE PARTAGE QU'IL FAUT TENIR
//
// Un absolu sur NOTRE comportement — « nous n'écrivons jamais 0 » — est
// vérifiable dans le code : il est légitime. Un absolu sur l'Assemblée, sur la
// procédure ou sur le monde — « le compte rendu ne publie jamais la liste » —
// porte sur un objet qu'on n'observe que partiellement. Il doit être soit
// adossé à une source citée, soit borné : « sur les trente-quatre comptes
// rendus que nous avons lus ».
//
// COMMENT IL PROCÈDE
//
// Il lit le HTML réellement produit par `npm run build`, et non les fichiers
// source : une affirmation se lit dans ce que le visiteur reçoit, pas dans le
// JSX, où une phrase est coupée par les balises et passe inaperçue. C'est en
// relisant ce HTML que les erreurs ci-dessus ont été trouvées, jamais en
// relisant le code.
//
// Il ne juge pas les phrases : il les compare à celles déjà connues. Toute
// phrase NOUVELLE portant un absolu casse le contrôle, et doit être inscrite
// dans affirmations-connues.json avec la raison qui la fonde. Les phrases
// héritées d'avant ce contrôle y figurent en dette, comptée à chaque passage.
//
// Usage :
//   npm run build && node scripts/verifier-affirmations.mjs
//   node scripts/verifier-affirmations.mjs --ajouter    # inscrit les nouvelles
//   node scripts/verifier-affirmations.mjs --nettoyer   # retire celles dont la
//                                                       # phrase n'existe plus
//
// Sortie : code 1 si une affirmation non déclarée est affichée.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RENDU = path.resolve(".next/server/app");
const REFERENCE = path.resolve("scripts/affirmations-connues.json");
const ajouter = process.argv.includes("--ajouter");
const nettoyer = process.argv.includes("--nettoyer");

// Les marqueurs d'une affirmation universelle. Ce sont ceux qui figuraient dans
// chacune des erreurs de la revue — la liste vient des faits, pas d'une
// intuition sur ce qui pourrait mal tourner.
const ABSOLUS =
  /(?<![\w-])(jamais|toujours|aucune?|toutes?|tous|la seule|le seul|systématiquement)(?![\w-])/i;

// --- Lecture du rendu -----------------------------------------------------

async function pagesRendues(racine) {
  const fichiers = [];
  for (const entree of await readdir(racine, { withFileTypes: true })) {
    const complet = path.join(racine, entree.name);
    if (entree.isDirectory()) fichiers.push(...(await pagesRendues(complet)));
    else if (entree.name.endsWith(".html")) fichiers.push(complet);
  }
  return fichiers;
}

function texteVisible(html) {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
      // Ce contrôle porte sur ce que le site AFFIRME, pas sur ce qu'il cite.
      // Les blockquote portent les textes officiels reproduits, et les liens
      // vers une fiche portent le titre d'une pétition : ces mots sont ceux de
      // l'Assemblée ou d'un pétitionnaire, et « pour tous ! » dans un titre de
      // pétition n'engage personne ici.
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ")
      .replace(/<a[^>]+href="\/petition\/[^"]*"[^>]*>[\s\S]*?<\/a>/gi, " ")
      .replace(/<(h1|title)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;| /g, " ")
    .replace(/&apos;|&#x27;|&#39;/g, "'")
    .replace(/&laquo;|&#171;/g, "«")
    .replace(/&raquo;|&#187;/g, "»")
    .replace(/&amp;/g, "&")
      .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ")
      .replace(/\s+/g, " ")
  );
}

// Une phrase, et non un paragraphe : c'est l'unité qu'un lecteur cite, et donc
// celle sur laquelle le site peut être pris en défaut.
function phrases(texte) {
  return texte
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 5 && ABSOLUS.test(p));
}

// --- Contrôle -------------------------------------------------------------

async function main() {
  if (!existsSync(RENDU)) {
    throw new Error(
      "Aucun rendu à contrôler : lancez `npm run build` avant ce script — il lit ce que le visiteur reçoit, pas le code source."
    );
  }

  const trouvees = new Map();
  for (const f of await pagesRendues(RENDU)) {
    for (const p of phrases(texteVisible(await readFile(f, "utf8")))) {
      if (!trouvees.has(p)) trouvees.set(p, path.relative(RENDU, f));
    }
  }

  const connues = existsSync(REFERENCE)
    ? JSON.parse(await readFile(REFERENCE, "utf8"))
    : { affirmations: [] };
  const index = new Map(connues.affirmations.map((a) => [a.texte, a]));

  const nouvelles = [...trouvees.keys()].filter((t) => !index.has(t));
  const disparues = connues.affirmations.filter((a) => !trouvees.has(a.texte));
  const dette = connues.affirmations.filter((a) => a.fonde === "heritee").length;
  const aConfirmer = connues.affirmations.filter((a) => a.fonde === "nous-a-confirmer").length;

  console.log(`Affirmations absolues affichées : ${trouvees.size}`);
  console.log(`  déclarées : ${trouvees.size - nouvelles.length} · nouvelles : ${nouvelles.length}`);
  if (dette) {
    console.log(
      `  dont ${dette} portant sur l'Assemblée ou la procédure, jamais justifiées — ` +
        `à borner ou à sourcer, une par une.`
    );
  }
  if (aConfirmer) {
    console.log(`  et ${aConfirmer} décrivant notre comportement, à confirmer dans le code.`);
  }
  if (disparues.length) {
    console.log(`\n${disparues.length} déclaration(s) sans phrase correspondante (texte réécrit ?) :`);
    for (const a of disparues.slice(0, 5)) console.log(`  – ${a.texte.slice(0, 90)}`);
  }

  // Une phrase corrigée laisse sa déclaration derrière elle. Sans purge, la
  // dette se compte en fantômes et cesse d'être lisible.
  if (nettoyer && disparues.length) {
    connues.affirmations = connues.affirmations.filter((a) => trouvees.has(a.texte));
    await writeFile(REFERENCE, `${JSON.stringify(connues, null, 2)}\n`);
    console.log(`\n→ ${disparues.length} déclaration(s) retirée(s) : leur phrase n'est plus affichée.`);
    return;
  }

  if (ajouter && nouvelles.length) {
    connues.affirmations.push(
      ...nouvelles.map((texte) => {
        // Tri initial, et non justification : une phrase qui se donne pour
        // sujet le site relève probablement de notre propre comportement,
        // donc vérifiable dans le code. Elle reste à confirmer une par une —
        // le contrôle ne décide pas à la place d'un relecteur.
        const parleDeNous = /\b(nous|notre|nos|ce site|le site)\b/i.test(texte);
        return {
          texte,
          page: trouvees.get(texte),
          fonde: parleDeNous ? "nous-a-confirmer" : "heritee",
          note: parleDeNous
            ? "Semble décrire notre propre comportement : confirmer que le code le garantit."
            : "Porte sur l'Assemblée ou la procédure : borner la portée, ou citer la source.",
        };
      })
    );
    connues.affirmations.sort((a, b) => a.texte.localeCompare(b.texte, "fr"));
    await writeFile(REFERENCE, `${JSON.stringify(connues, null, 2)}\n`);
    console.log(`\n→ ${nouvelles.length} affirmation(s) inscrite(s) dans ${path.basename(REFERENCE)}.`);
    return;
  }

  if (nouvelles.length) {
    console.error(`\n✗ ${nouvelles.length} affirmation(s) absolue(s) non déclarée(s) :\n`);
    for (const t of nouvelles) {
      console.error(`  [${trouvees.get(t)}]`);
      console.error(`  ${t}\n`);
    }
    console.error(
      "Chacune porte un absolu — jamais, toujours, aucun, le seul. Si elle décrit\n" +
        "notre propre comportement, elle est vérifiable dans le code : déclarez-la\n" +
        "avec fonde: \"nous\". Si elle porte sur l'Assemblée ou sur la procédure,\n" +
        "citez la source qui l'établit (fonde: \"source\"), ou bornez-la : « sur les\n" +
        "trente-quatre comptes rendus que nous avons lus ».\n\n" +
        "Puis : node scripts/verifier-affirmations.mjs --ajouter"
    );
    process.exitCode = 1;
    return;
  }

  console.log("\n✓ aucune affirmation absolue non déclarée.");
}

main().catch((err) => {
  console.error("Échec du contrôle des affirmations :", err);
  process.exitCode = 1;
});
