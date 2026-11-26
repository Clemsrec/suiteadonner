"use client";

import { useSyncExternalStore } from "react";
import styles from "./theme.module.css";
import { appliquerTheme, CLE_THEME, lireTheme, type ChoixTheme } from "@/lib/theme";

const EVENEMENT = "suiteadonner-theme";

function suivre(rappel: () => void): () => void {
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE_THEME) {
      appliquerTheme(lireTheme());
      rappel();
    }
  };
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", surStockage);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", surStockage);
  };
}

const CHOIX: { valeur: ChoixTheme; libelle: string; aide: string; icone: React.ReactNode }[] = [
  {
    valeur: "clair",
    libelle: "Clair",
    aide: "Couleurs claires",
    icone: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </>
    ),
  },
  {
    valeur: "sombre",
    libelle: "Sombre",
    aide: "Couleurs sombres",
    icone: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  },
  {
    valeur: "auto",
    libelle: "Auto",
    aide: "Comme votre appareil",
    icone: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" />
      </>
    ),
  },
];

// Trois boutons plutôt qu'une bascule : « Auto » (suivre l'appareil) n'a pas
// de contraire évident, et un visiteur doit voir d'un coup d'œil lequel est
// actif. Le libellé écrit s'efface sur petit écran, l'icône et le nom
// accessible restent.
export default function BoutonTheme() {
  const actif = useSyncExternalStore<ChoixTheme | null>(suivre, lireTheme, () => null);

  function choisir(valeur: ChoixTheme) {
    appliquerTheme(valeur);
    window.dispatchEvent(new Event(EVENEMENT));
  }

  return (
    <div className={styles.groupe} role="group" aria-label="Couleurs du site">
      {CHOIX.map((c) => (
        <button
          key={c.valeur}
          type="button"
          className={styles.choix}
          aria-pressed={actif === c.valeur}
          aria-label={`${c.libelle} : ${c.aide.toLowerCase()}`}
          title={c.aide}
          onClick={() => choisir(c.valeur)}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {c.icone}
          </svg>
          <span className={styles.libelle}>{c.libelle}</span>
        </button>
      ))}
    </div>
  );
}
