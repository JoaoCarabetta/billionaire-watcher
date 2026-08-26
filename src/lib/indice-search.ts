/**
 * Wiki-index search over public graph nodes plus minted fichas.
 *
 * Reuses grafo-search accent/case-insensitive substring (label + id).
 * A minted ficha lands on /pessoa/ or /empresa/. A graph node without a
 * ficha is grafo-only. Nowhere is not in the archive.
 */

import { searchGrafoNodes, type GrafoSearchNode } from './grafo-search';

export const INDICE_EMPTY_GRAFO_ONLY = 'no grafo apenas';
export const INDICE_EMPTY_NOT_IN_ARCHIVE = 'não está no arquivo';

export type MintedFicha = {
  id: string;
  label: string;
  kind: 'person' | 'company';
};

export type IndiceHit = {
  id: string;
  label: string;
  kind: 'person' | 'company';
  classification: 'ficha' | 'grafo_only';
  href: string | null;
};

export type IndiceQueryKind = 'empty' | 'ficha' | 'grafo_only' | 'not_in_archive';

export type IndiceQueryResult = {
  kind: IndiceQueryKind;
  href: string | null;
  hits: IndiceHit[];
};

export function fichaHref(kind: 'person' | 'company', id: string): string {
  return kind === 'person' ? `/pessoa/${id}/` : `/empresa/${id}/`;
}

export function searchIndice(
  query: string,
  nodes: readonly GrafoSearchNode[],
  minted: readonly MintedFicha[]
): IndiceHit[] {
  const mintedById = new Map(minted.map((ficha) => [ficha.id, ficha]));
  const seen = new Set(nodes.map((node) => node.id));
  const corpus: GrafoSearchNode[] = [...nodes];
  for (const ficha of minted) {
    if (seen.has(ficha.id)) {
      continue;
    }
    seen.add(ficha.id);
    corpus.push({ id: ficha.id, label: ficha.label, kind: ficha.kind });
  }

  return searchGrafoNodes(corpus, query).map((hit) => {
    const ficha = mintedById.get(hit.id);
    if (ficha) {
      return {
        id: hit.id,
        label: hit.label,
        kind: hit.kind,
        classification: 'ficha' as const,
        href: fichaHref(ficha.kind, ficha.id),
      };
    }
    return {
      id: hit.id,
      label: hit.label,
      kind: hit.kind,
      classification: 'grafo_only' as const,
      href: null,
    };
  });
}

export function classifyIndiceQuery(
  query: string,
  nodes: readonly GrafoSearchNode[],
  minted: readonly MintedFicha[]
): IndiceQueryResult {
  if (!query.trim()) {
    return { kind: 'empty', href: null, hits: [] };
  }
  const hits = searchIndice(query, nodes, minted);
  if (hits.length === 0) {
    return { kind: 'not_in_archive', href: null, hits };
  }
  const ficha = hits.find((hit) => hit.classification === 'ficha');
  if (ficha) {
    return { kind: 'ficha', href: ficha.href, hits };
  }
  return { kind: 'grafo_only', href: null, hits };
}
