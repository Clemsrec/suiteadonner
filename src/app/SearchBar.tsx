"use client";

import { useState } from "react";
import styles from "./page.module.css";

const FILTERS = [
  { key: "toutes", label: "Toutes" },
  { key: "sans-suite", label: "Sans suite" },
  { key: "debattue", label: "Débattues" },
  { key: "en-attente", label: "En attente" },
] as const;

export default function SearchBar() {
  const [active, setActive] = useState<string>("toutes");

  return (
    <div className={styles.search} id="recherche">
      <form
        className={styles.searchForm}
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <label htmlFor="q" className="sr-only">
          Rechercher une pétition
        </label>
        <input id="q" type="search" name="q" placeholder="Chercher par mot-clé, thème, commission…" />
        <button type="submit">Chercher</button>
      </form>
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={active === f.key}
            onClick={() => setActive(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
