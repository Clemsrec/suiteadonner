// Compare les services tiers déclarés aux domaines que la CSP autorise.
//
// POURQUOI CE CONTRÔLE EXISTE
//
// La politique de confidentialité promet que tout nouveau service tiers sera
// déclaré. C'était un engagement sur parole : ajouter un domaine à la CSP de
// next.config.ts ne demande qu'une ligne, et rien n'obligeait à toucher la page
// que le visiteur lit. Il aurait continué à lire une liste exacte la veille.
//
// La CSP fait autorité sur ce qu'un navigateur a le droit d'appeler depuis ce
// site. src/lib/tiers.ts fait autorité sur ce que les pages légales déclarent.
// Les deux doivent coïncider :
//
//   - un domaine autorisé mais non déclaré, c'est un service dont le visiteur
//     n'est pas informé ;
//   - un domaine déclaré mais absent de la CSP, c'est une liste qui décrit un
//     site qui n'existe plus.
//
// Le contrôle casse dans les deux sens. Ni l'un ni l'autre ne se rattrape en
// retirant une ligne de la déclaration : c'est la page que le visiteur lit.
//
// Usage : node scripts/verifier-tiers.mjs
// Sortie : code 1 dès qu'un domaine n'est pas des deux côtés.

import { readFile } from "node:fs/promises";
import path from "node:path";

const CONFIG = path.resolve("next.config.ts");
const TIERS_TS = path.resolve("src/lib/tiers.ts");

// Les directives qui peuvent faire sortir une requête du site. `form-action`,
// `frame-ancestors` et `base-uri` n'ouvrent aucun appel réseau vers un tiers :
// les lire ici produirait du bruit, pas une garantie.
const DIRECTIVES_SORTANTES = [
  "script-src",
  "connect-src",
  "img-src",
  "font-src",
  "style-src",
  "frame-src",
  "media-src",
  "worker-src",
];

const config = await readFile(CONFIG, "utf8");
const tiersSource = await readFile(TIERS_TS, "utf8");

// Les domaines de la CSP. On lit les chaînes du tableau CSP plutôt que
// d'évaluer le module : ce script tourne sans compilation, comme les autres
// contrôles du dépôt.
const bloc = config.match(/const CSP = \[([\s\S]*?)\]\.join/);
if (!bloc) {
  console.error("✗ tableau CSP introuvable dans next.config.ts — le contrôle ne peut rien garantir.");
  process.exit(1);
}

const autorises = new Set();
for (const ligne of bloc[1].split("\n")) {
  const contenu = ligne.trim();
  if (!contenu || contenu.startsWith("//")) continue;
  const directive = DIRECTIVES_SORTANTES.find((d) => contenu.includes(`${d} `));
  if (!directive) continue;
  // `$` ferme le motif : une directive est écrite en gabarit de chaîne, et
  // « https://*.googletagmanager.com${devEval} » doit se lire comme le domaine
  // seul, sans l'interpolation qui le suit.
  for (const m of contenu.matchAll(/https:\/\/[^\s"'`;$]+/g)) autorises.add(m[0]);
}

// Les domaines déclarés. Même lecture textuelle, sur les tableaux `domaines`.
const declares = new Map();
for (const entree of tiersSource.split(/\n {2}\{\n/).slice(1)) {
  const nom = entree.match(/nom:\s*"([^"]+)"/)?.[1];
  const liste = entree.match(/domaines:\s*\[([\s\S]*?)\]/)?.[1];
  if (!nom || !liste) continue;
  for (const m of liste.matchAll(/"([^"]+)"/g)) declares.set(m[1], nom);
}

const nonDeclares = [...autorises].filter((d) => !declares.has(d)).sort();
const fantomes = [...declares.keys()].filter((d) => !autorises.has(d)).sort();

console.log(`Domaines tiers autorisés par la CSP : ${autorises.size}`);
console.log(`  déclarés dans src/lib/tiers.ts : ${declares.size}`);

if (nonDeclares.length === 0 && fantomes.length === 0) {
  const services = new Set(declares.values());
  console.log(`  ${services.size} service(s) : ${[...services].join(", ")}`);
  console.log("\n✓ la CSP et la déclaration disent la même chose.");
  process.exit(0);
}

if (nonDeclares.length) {
  console.error(`\n✗ ${nonDeclares.length} domaine(s) autorisé(s) sans être déclaré(s) :\n`);
  for (const d of nonDeclares) console.error(`  ${d}`);
  console.error(
    "\nUn domaine qu'un navigateur peut appeler doit figurer dans src/lib/tiers.ts,\n" +
      "et donc sur les pages que le visiteur lit. Si ce domaine n'est plus utile,\n" +
      "retirez-le de la CSP plutôt que de le déclarer pour faire taire le contrôle."
  );
}

if (fantomes.length) {
  console.error(`\n✗ ${fantomes.length} domaine(s) déclaré(s) mais absent(s) de la CSP :\n`);
  for (const d of fantomes) console.error(`  ${d} — déclaré pour « ${declares.get(d)} »`);
  console.error(
    "\nLa déclaration décrit un site qui n'existe plus. Corrigez src/lib/tiers.ts :\n" +
      "les pages légales annoncent un service que le navigateur ne peut plus joindre."
  );
}

process.exit(1);
