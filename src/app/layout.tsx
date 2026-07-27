import type { Metadata } from "next";
import "./globals.css";

import { SITE_DESCRIPTION as DESCRIPTION, SITE_NAME, SITE_TITRE as TITRE, SITE_URL } from "@/lib/site";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
