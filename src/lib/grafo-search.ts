/**
 * In-browser search over public graph nodes (label and id only).
 * Case-insensitive, accent-insensitive substring. People first, then companies.
 */

export type GrafoSearchNode = {
  id: string;
  label: string;
  kind: string;
};

export type GrafoSearchHit = {
  id: string;
  label: string;
  kind: 'person' | 'company';
};

const KIND_RANK: Record<string, number> = {
  person: 0,
  company: 1,
};

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function searchGrafoNodes(
  nodes: readonly GrafoSearchNode[],
  query: string
): GrafoSearchHit[] {
  const needle = fold(query.trim());
  if (!needle) {
    return [];
  }

  const hits: GrafoSearchHit[] = [];
  for (const node of nodes) {
    if (node.kind !== 'person' && node.kind !== 'company') {
      continue;
    }
    if (!fold(node.label).includes(needle) && !fold(node.id).includes(needle)) {
      continue;
    }
    hits.push({
      id: node.id,
      label: node.label,
      kind: node.kind,
    });
  }

  hits.sort((a, b) => {
    const kindDelta = (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99);
    if (kindDelta !== 0) {
      return kindDelta;
    }
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  return hits.slice(0, 20);
}
