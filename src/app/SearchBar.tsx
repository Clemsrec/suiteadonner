"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { STATUS_LABELS, STATUS_TAG_CLASS } from "@/lib/petitions";
import { algoliaConfigured, searchPetitionsIndex, type AlgoliaPetitionHit, type SearchFilter } from "@/lib/algolia";

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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [results, setResults] = useState<AlgoliaPetitionHit[] | null>(null);
  const [nbHits, setNbHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!hasInteracted) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const { hits, nbHits: n } = await searchPetitionsIndex(activeFilter, keyword);
        if (id !== requestId.current) return;
        setResults(hits);
        setNbHits(n);
      } catch (err) {
        if (id !== requestId.current) return;
        console.error("Recherche impossible :", err);
        setError(true);
        setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [activeFilter, keyword, hasInteracted]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHasInteracted(true);
  }

  function handleFilter(f: SearchFilter) {
    setHasInteracted(true);
    setActiveFilter(f);
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
          onChange={(e) => {
            setHasInteracted(true);
            setKeyword(e.target.value);
          }}
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

      {!algoliaConfigured ? (
        <div className={styles.searchResults}>
          <p className={styles.searchHint}>Recherche indisponible : Algolia n&apos;est pas configuré.</p>
        </div>
      ) : (
        hasSearched && (
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
                  {nbHits.toLocaleString("fr-FR")} résultat{nbHits > 1 ? "s" : ""}
                  {results.length < nbHits ? ` (${results.length} affichés)` : ""}
                </p>
                {results.map((p) => (
                  <a
                    className={styles.petition}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={p.objectID}
                  >
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
        )
      )}
    </div>
  );
}
