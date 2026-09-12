// Vérifie que chaque erratum publié correspond à une phrase que ce site a
// réellement affichée.
//
// POURQUOI CE CONTRÔLE EXISTE
//
// La page /corrections promet de citer chaque phrase fautive « telle qu'elle
// était affichée ». Rien ne le garantissait : les entrées étaient écrites de
// mémoire, et quatre des seize paraphrasaient au lieu de citer — dont une
// rédigée le jour même. Une page d'aveux dont les aveux sont approximatifs
// vaut moins que pas de page du tout : elle donne le crédit de la
// transparence sans en payer le prix.
//
// L'historique git est la seule trace datée de ce que le site a affiché. Ce
// contrôle s'en sert : chaque erratum porte une `empreinte`, un fragment de la
// phrase tel qu'il figurait dans le code, et le contrôle exige de le retrouver
// dans un commit passé. Une erreur qu'on ne retrouve pas dans l'historique est
// une erreur inventée.
//
// TROIS NATURES DE CORRECTION
//
//   texte   la phrase écrite a changé. L'empreinte doit exister dans
//           l'historique et avoir disparu du code affiché aujourd'hui.
//   code    la phrase est restée, c'est le code qui a changé pour la rendre
//           vraie — la durée d'un cookie, l'ordre de deux opérations. Elle doit
//           donc être encore présente, et porter une `preuve` désignant ce qui
//           la tient désormais.
//   rendu   la phrase fautive n'a jamais été écrite : elle était produite par
//           le code à partir des données — « 0 soutiens » là où le fichier ne
//           renseignait rien. Rien à chercher dans l'historique du texte ; la
//           `preuve` désigne le garde-fou qui l'empêche de revenir.
//
// Les commentaires sont ignorés dans la recherche « absent aujourd'hui » : une
// correction laisse souvent derrière elle un commentaire qui cite la phrase
// fautive pour expliquer pourquoi elle a disparu, et ce commentaire ne doit pas
// faire échouer le contrôle.
//
// Usage : node scripts/verifier-errata.mjs
// Sortie : code 1 si un erratum ne se retrouve pas dans l'historique.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const ERRATA_TS = path.resolve("src/lib/errata.ts");
// L'historique du texte affiché se cherche dans les pages, jamais dans le
// fichier des errata lui-même : il contient les phrases fautives par
// construction, et les y trouver ne prouverait rien.
const PORTEE = ["--", "src/", ":!src/lib/errata.ts"];

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return "";
  }
}

// Nombre de commits où l'empreinte est apparue ou a disparu. `-S` compte les
// changements d'occurrences : un résultat non nul prouve que la chaîne a existé
// dans un état passé du dépôt.
function presenteDansLHistorique(empreinte) {
  return git(["log", "--format=%H", "-S", empreinte, ...PORTEE]).trim().split("\n").filter(Boolean);
}

// Lignes de commentaire à ignorer. On ne cherche pas à analyser la syntaxe :
// une ligne dont le premier caractère non blanc ouvre ou prolonge un
// commentaire ne compte pas comme du texte affiché.
const COMMENTAIRE = /^\s*(\/\/|\/\*|\*)/;

function afficheeAujourdhui(empreinte) {
  const fichiers = git(["grep", "-l", "-F", empreinte, ...PORTEE]).trim().split("\n").filter(Boolean);
  const porteuses = [];
  for (const f of fichiers) {
    const lignes = git(["grep", "-n", "-F", empreinte, "--", f]).split("\n");
    for (const l of lignes) {
      const contenu = l.slice(l.indexOf(":", l.indexOf(":") + 1) + 1);
      if (contenu && !COMMENTAIRE.test(contenu)) porteuses.push(f);
    }
  }
  return [...new Set(porteuses)];
}

// Extraction des entrées depuis le module TypeScript. On lit le source plutôt
// que d'importer : ce script tourne sans compilation, comme les autres
// contrôles du dépôt.
function lireErrata(source) {
  const entrees = [];
  const blocs = source.split(/\n {2}\{\n/).slice(1);
  for (const bloc of blocs) {
    const champ = (nom) => {
      const m = bloc.match(new RegExp(`${nom}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : null;
    };
    const date = champ("date");
    if (!date) continue;
    const preuve = bloc.match(/preuve:\s*\{\s*fichier:\s*"([^"]+)",\s*contient:\s*"((?:[^"\\]|\\.)*)"/);
    entrees.push({
      date,
      ou: champ("ou"),
      affirmait: champ("affirmait"),
      empreinte: champ("empreinte"),
      corrigee: champ("corrigee"),
      preuve: preuve ? { fichier: preuve[1], contient: preuve[2].replace(/\\"/g, '"') } : null,
    });
  }
  return entrees;
}

const source = await readFile(ERRATA_TS, "utf8");
const errata = lireErrata(source);
const echecs = [];

for (const e of errata) {
  const ou = `[${e.date}] ${e.ou ?? "?"}`;

  if (!e.corrigee) {
    echecs.push(`${ou} : nature de correction absente (texte, code ou rendu).`);
    continue;
  }

  if (e.corrigee === "rendu") {
    if (!e.preuve) echecs.push(`${ou} : une correction de rendu doit porter une preuve.`);
  } else {
    if (!e.empreinte) {
      echecs.push(`${ou} : empreinte absente — impossible de retrouver la phrase dans l'historique.`);
      continue;
    }
    const commits = presenteDansLHistorique(e.empreinte);
    if (commits.length === 0) {
      echecs.push(
        `${ou} : « ${e.empreinte} » ne figure dans aucun commit. La phrase citée n'a ` +
          `jamais été affichée sous cette forme, ou l'empreinte est mal découpée ` +
          `(le JSX coupe les phrases en fin de ligne : prendre un fragment court).`
      );
      continue;
    }
    const aujourdhui = afficheeAujourdhui(e.empreinte);
    if (e.corrigee === "texte" && aujourdhui.length > 0) {
      echecs.push(
        `${ou} : « ${e.empreinte} » est toujours affichée dans ${aujourdhui.join(", ")}. ` +
          `Soit la correction n'a pas été faite, soit elle est de nature « code ».`
      );
    }
    if (e.corrigee === "code") {
      if (aujourdhui.length === 0) {
        echecs.push(
          `${ou} : « ${e.empreinte} » a disparu du site. Une correction « code » garde ` +
            `sa phrase et change ce qui la rend vraie — celle-ci est de nature « texte ».`
        );
      }
      if (!e.preuve) {
        echecs.push(`${ou} : une correction « code » doit porter une preuve de ce qui la tient.`);
      }
    }
  }

  if (e.preuve) {
    const chemin = path.resolve(e.preuve.fichier);
    if (!existsSync(chemin)) {
      echecs.push(`${ou} : preuve introuvable — ${e.preuve.fichier}`);
    } else {
      const contenu = await readFile(chemin, "utf8");
      if (!contenu.includes(e.preuve.contient)) {
        echecs.push(`${ou} : « ${e.preuve.contient} » absent de ${e.preuve.fichier}`);
      }
    }
  }
}

const parNature = errata.reduce((acc, e) => {
  acc[e.corrigee ?? "sans nature"] = (acc[e.corrigee ?? "sans nature"] ?? 0) + 1;
  return acc;
}, {});

console.log(`Errata publiés : ${errata.length}`);
console.log(
  `  ${Object.entries(parNature)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ")}`
);

if (echecs.length) {
  console.error(`\n✗ ${echecs.length} erratum(s) que l'historique ne confirme pas :\n`);
  for (const m of echecs) console.error(`  ${m}`);
  console.error(
    "\nUn erratum cite une phrase que le site a affichée. Si l'historique ne la\n" +
      "retrouve pas, c'est la citation qu'il faut corriger — jamais l'empreinte\n" +
      "qu'il faut élargir jusqu'à ce que le contrôle passe."
  );
  process.exit(1);
}

console.log("\n✓ chaque erratum se retrouve dans l'historique du dépôt.");
