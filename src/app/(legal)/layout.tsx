import Link from "next/link";
import styles from "./legal.module.css";
import { LEGAL, SITE_NAME } from "@/lib/site";

// En-tête et pied communs aux trois pages réglementaires. Le groupe de routes
// (legal) n'ajoute aucun segment d'URL : les pages restent à la racine.
export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className={styles.site}>
        <div className={styles.siteInner}>
          <Link className={styles.wordmark} href="/">
            <svg
              className={styles.mark}
              viewBox="0 0 32 32"
              width="24"
              height="24"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2.4"
                strokeDasharray="4.2 3.34"
                strokeDashoffset="2.1"
              />
              <line x1="10.5" y1="16" x2="21.5" y2="16" stroke="var(--accent)" strokeWidth="2.2" />
            </svg>
            {SITE_NAME}
          </Link>
          <Link className={styles.retour} href="/">
            ← Retour au site
          </Link>
        </div>
      </header>

      <div className={styles.wrap}>
        <main className={styles.doc}>{children}</main>

        <footer className={styles.footer}>
          <span>
            {SITE_NAME} — édité par {LEGAL.denomination}, projet indépendant, non affilié à
            l&apos;Assemblée nationale
          </span>
          <nav className={styles.footerNav}>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Confidentialité</Link>
            <Link href="/politique-cookies">Cookies</Link>
            <Link href="/plan-du-site">Plan du site</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
