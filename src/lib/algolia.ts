import { liteClient } from "algoliasearch/lite";
import type { PetitionStatut } from "./petitions";

export const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "petitions";

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const algoliaConfigured = Boolean(appId && searchKey);

const searchClient = algoliaConfigured ? liteClient(appId!, searchKey!) : null;

export type AlgoliaPetitionHit = {
  objectID: string;
  titre: string;
  description: string;
  statut: PetitionStatut;
  statutLabel: string;
  commission: string;
  nbVotes: number;
  datePublication: string | null;
  url: string;
};

export type SearchFilter = PetitionStatut | "toutes";

export async function searchPetitionsIndex(
  filter: SearchFilter,
  keyword: string
): Promise<{ hits: AlgoliaPetitionHit[]; nbHits: number }> {
  if (!searchClient) {
    throw new Error("Algolia n'est pas configuré (variables NEXT_PUBLIC_ALGOLIA_* manquantes).");
  }

  const { results } = await searchClient.searchForHits<AlgoliaPetitionHit>({
    requests: [
      {
        indexName: ALGOLIA_INDEX_NAME,
        query: keyword,
        filters: filter === "toutes" ? undefined : `statut:${filter}`,
        hitsPerPage: 30,
      },
    ],
  });

  const result = results[0];
  if (!("hits" in result)) return { hits: [], nbHits: 0 };
  return { hits: result.hits, nbHits: result.nbHits ?? result.hits.length };
}
