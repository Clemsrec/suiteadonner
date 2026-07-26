"use client";

import { useRef, useState } from "react";
import styles from "./page.module.css";
import { searchPetitions, STATUS_LABELS, STATUS_TAG_CLASS, type Petition, type SearchFilter } from "@/lib/petitions";

const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: "toutes", label: "Toutes" },
  { key: "classee", label: "Classées" },
  { key: "archivee", label: "Archivées" },
  { key: "ouverte", label: "En cours" },
];

const TAG_STYLE_CLASS = {
  pending: styles.tagPending,
  none: styles.tagNone,
  examined: styles.tagExamined,
};

function formatFrDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default function SearchBar() {
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("toutes");
  const [results, setResults] = useState<Petition[] | null>(null);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Deux recherches peuvent partir en parallèle (clic filtre + soumission
  // rapprochés) et se résoudre dans le désordre : on ignore toute réponse
  // qui n'est plus la plus récente demandée.
  const requestId = useRef(0);

  async function runSearch(filter: SearchFilter, q: string) {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const { results: found, scanned: n } = await searchPetitions(filter, q);
      if (id !== requestId.current) return;
      setResults(found);
      setScanned(n);
    } catch (err) {
      if (id !== requestId.current) return;
      console.error("Recherche impossible :", err);
      setError(true);
      setResults([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(activeFilter, keyword);
  }

  function handleFilter(f: SearchFilter) {
    setActiveFilter(f);
    runSearch(f, keyword);
  }

  const hasSearched = results !== null;

  return (
    <div className={styles.search} id="recherche">
      <form className={styles.searchForm} role="search" onSubmit={handleSubmit}>
        <label htmlFor="q" className="sr-only">
          Rechercher une pétition
        </label>
        <input
          id="q"
          type="search"
          name="q"
          placeholder="Chercher par mot-clé, thème, commission…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Recherche…" : "Chercher"}
        </button>
      </form>
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={activeFilter === f.key}
            onClick={() => handleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {hasSearched && (
        <div className={styles.searchResults}>
          {error ? (
            <p className={styles.searchHint}>Recherche indisponible pour le moment, réessayez.</p>
          ) : results.length === 0 ? (
            <p className={styles.searchHint}>
              Aucune pétition ne correspond{keyword ? ` à « ${keyword} »` : ""} pour ce filtre.
            </p>
          ) : (
            <>
              <p className={styles.searchMeta}>
                {results.length} résultat{results.length > 1 ? "s" : ""} (sur {scanned.toLocaleString("fr-FR")}{" "}
                pétitions examinées{activeFilter !== "toutes" ? " pour ce statut" : ""})
              </p>
              {results.map((p) => (
                <a className={styles.petition} href={p.url} target="_blank" rel="noopener noreferrer" key={p.identifiant}>
                  <div className={styles.petitionTop}>
                    <div className={styles.petitionTitle}>{p.titre}</div>
                    <span className={`${styles.tag} ${TAG_STYLE_CLASS[STATUS_TAG_CLASS[p.statut]]}`}>
                      {STATUS_LABELS[p.statut]}
                    </span>
                  </div>
                  <div className={styles.petitionMeta}>
                    <span>
                      <span className={styles.n}>{p.nbVotes.toLocaleString("fr-FR")}</span> soutiens
                    </span>
                    <span>{p.commission || "Commission non précisée"}</span>
                    <span>{formatFrDate(p.datePublication)}</span>
                  </div>
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
