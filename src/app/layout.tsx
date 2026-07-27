import type { Metadata } from "next";
import "./globals.css";

import MesureAudience from "./MesureAudience";
import {
  SITE_DESCRIPTION as DESCRIPTION,
  GOOGLE_SITE_VERIFICATION,
  SITE_NAME,
  SITE_TITRE as TITRE,
  SITE_URL,
} from "@/lib/site";

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
        {children}
        <MesureAudience />
      </body>
    </html>
  );
}
