import type { Metadata } from "next";
import "./globals.css";

import MesureAudience from "./MesureAudience";
import {
  LEGAL,
  SITE_DESCRIPTION as DESCRIPTION,
  GOOGLE_SITE_VERIFICATION,
  SITE_NAME,
  SITE_TITRE as TITRE,
  SITE_URL,
} from "@/lib/site";

// Données structurées schema.org communes à toutes les pages : le site et son
// éditeur, tels que déclarés dans les mentions légales (src/lib/site.ts est la
// source unique — aucune valeur n'est propre à ce fichier). Les fiches
// pétition ajoutent leur propre BreadcrumbList.
const DONNEES_STRUCTUREES = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: "fr",
      publisher: { "@id": `${SITE_URL}/#editeur` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#editeur`,
      name: LEGAL.denomination,
      email: LEGAL.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: LEGAL.adresse[0],
        postalCode: LEGAL.codePostal,
        addressLocality: LEGAL.ville,
        addressCountry: "FR",
      },
      identifier: {
        "@type": "PropertyValue",
        propertyID: "SIREN",
        value: LEGAL.siren.replace(/\s/g, ""),
      },
      vatID: LEGAL.tva,
      logo: `${SITE_URL}/logo/suite-a-donner-symbole.svg`,
    },
  ],
};

export const metadata: Metadata = {
  // Sans metadataBase, les champs d'URL relatifs (Open Graph, canonique) ne
  // peuvent pas être résolus en URLs absolues — Next lève une erreur de build.
  metadataBase: new URL(SITE_URL),
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: SITE_NAME,
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITRE,
    description: DESCRIPTION,
  },
  // Balise émise seulement une fois le jeton renseigné dans site.ts — sinon
  // Next rendrait une balise au contenu vide, que Google refuse.
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DONNEES_STRUCTUREES) }}
        />
        {children}
        <MesureAudience />
      </body>
    </html>
  );
}
