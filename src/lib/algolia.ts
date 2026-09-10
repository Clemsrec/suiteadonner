import { liteClient } from "algoliasearch/lite";
import type { StatutSource } from "./petitions-format";

export const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "petitions";

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const algoliaConfigured = Boolean(appId && searchKey);

const searchClient = algoliaConfigured ? liteClient(appId!, searchKey!) : null;

export type AlgoliaPetitionHit = {
  objectID: string;
  titre: string;
  description: string;
  statutSource: StatutSource;
  statutLabel: string;
  commissionSource: string | null;
  nbVotes: number | null;
  datePublication: string | null;
  url: string;
};

export type SearchFilter = StatutSource | "toutes";

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
        filters: filter === "toutes" ? undefined : `statutSource:${filter}`,
        hitsPerPage: 30,
        // La politique de confidentialité affirme que l'éditeur ne conserve
        // pas les requêtes et ne peut pas les relier à un visiteur. Sans ce
        // drapeau, Algolia les agrège dans sa Search Analytics, consultable
        // depuis le tableau de bord : l'affirmation dépendrait d'un réglage
        // externe au lieu d'être vraie par construction.
        analytics: false,
        // Aucun identifiant de visiteur n'est transmis : ni userToken, ni
        // clickAnalytics, qui supposeraient de suivre un même utilisateur
        // d'une requête à l'autre.
        clickAnalytics: false,
      },
    ],
  });

  const result = results[0];
  if (!("hits" in result)) return { hits: [], nbHits: 0 };
  return { hits: result.hits, nbHits: result.nbHits ?? result.hits.length };
}
