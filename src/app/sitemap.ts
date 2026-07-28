import type { MetadataRoute } from "next";
import { getSitemapMeta } from "@/lib/petitions";
import { SITE_URL } from "@/lib/site";

// Le sitemap énumère les 4 000 fiches pétition sans énumérer Firestore : la
// liste des identifiants est écrite dans un document unique (meta/sitemap) par
// scripts/import-petitions.mjs à chaque import. Une lecture par régénération,
// quel que soit le zèle des robots.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const maintenant = new Date();

  const fixes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: maintenant,
      changeFrequency: "weekly", // les données source sont republiées le lundi
      priority: 1,
    },
    {
      url: `${SITE_URL}/petitions`,
      lastModified: maintenant,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...["decisions-non-publiees", "passages-en-commission", "fichier-non-a-jour"].map((chemin) => ({
      url: `${SITE_URL}/${chemin}`,
      lastModified: maintenant,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    {
      url: `${SITE_URL}/methodologie`,
      lastModified: maintenant,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/plan-du-site`,
      lastModified: maintenant,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...["mentions-legales", "politique-de-confidentialite", "politique-cookies"].map((chemin) => ({
      url: `${SITE_URL}/${chemin}`,
      lastModified: maintenant,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  // Le document peut manquer (premier déploiement avant import) ou la lecture
  // échouer : le sitemap dégrade alors sur les seules routes fixes plutôt que
  // de répondre en erreur aux robots.
  const meta = await getSitemapMeta().catch((err) => {
    console.error("Sitemap : lecture de meta/sitemap impossible :", err);
    return null;
  });
  if (!meta) return fixes;

  // Toutes les fiches sont réécrites à chaque import hebdomadaire : la date du
  // dernier calcul est donc leur dernière modification réelle.
  const calculeLe = /^\d{4}-\d{2}-\d{2}$/.test(meta.calculeLe)
    ? new Date(`${meta.calculeLe}T00:00:00Z`)
    : maintenant;

  return [
    ...fixes,
    ...meta.annees.map((a) => ({
      url: `${SITE_URL}/petitions/${a.annee}`,
      lastModified: calculeLe,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...meta.identifiants.map((identifiant) => ({
      url: `${SITE_URL}/petition/${identifiant}`,
      lastModified: calculeLe,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
