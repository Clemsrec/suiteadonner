import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Une seule route publique aujourd'hui. Quand des pages par pétition seront
// ajoutées, c'est ici qu'il faudra les énumérer depuis Firestore — attention
// alors au coût en lectures, le sitemap étant rappelé à chaque passage de robot.
export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: maintenant,
      changeFrequency: "weekly", // les données source sont republiées le lundi
      priority: 1,
    },
    ...["mentions-legales", "politique-de-confidentialite", "politique-cookies"].map(
      (chemin) => ({
        url: `${SITE_URL}/${chemin}`,
        lastModified: maintenant,
        changeFrequency: "yearly" as const,
        priority: 0.3,
      })
    ),
  ];
}
