import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Tout est indexable : le site n'a qu'une route publique et aucune zone privée.
// L'absence de ce fichier revenait déjà à « tout autoriser », mais sans déclarer
// le sitemap ni bloquer les aspirateurs de contenu commerciaux.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Ces robots aspirent le contenu pour revente ou entraînement sans
      // apporter de trafic. Les moteurs de recherche et les assistants qui
      // citent leurs sources (Google, Bing, ChatGPT-User, PerplexityBot) ne
      // sont pas concernés : on veut être trouvé et cité.
      { userAgent: ["SemrushBot", "AhrefsBot", "MJ12bot", "DotBot"], disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
