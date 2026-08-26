/**
 * Union hop JSON into the live public graph (issue #145).
 *
 * Live nodes and live edges win on id / (from, to) collision.
 * Hop nodes and edges whose keys are new are appended. Hop-tree roots are
 * the 14-digit company nodes listed before the four hole companies in
 * data/hops/valor-universo.json — not holdings, closed slugs, or holes.
 */

import type { GrafoData, GrafoEdge, GrafoNode } from './grafo-elements';

const HOLE_COMPANY_IDS = new Set([
  '21240146000184',
  '00000208000100',
  '76535764000143',
  '33412081000196',
]);

function edgeKey(edge: GrafoEdge): string {
  return `${edge.from}\t${edge.to}`;
}

function cloneNode(node: GrafoNode): GrafoNode {
  const cloned: GrafoNode = {
    id: node.id,
    kind: node.kind,
    label: node.label,
  };
  if (node.partners) {
    cloned.partners = node.partners.map((partner) => ({ ...partner }));
  }
  return cloned;
}

function cloneEdge(edge: GrafoEdge): GrafoEdge {
  const cloned: GrafoEdge = {
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    source: edge.source,
  };
  if (edge.pct_capital !== undefined) {
    cloned.pct_capital = edge.pct_capital;
  }
  if (edge.pct_votos !== undefined) {
    cloned.pct_votos = edge.pct_votos;
  }
  return cloned;
}

export function hopTreeRootIds(hops: GrafoData): string[] {
  const roots: string[] = [];
  for (const node of hops.nodes) {
    if (HOLE_COMPANY_IDS.has(node.id)) {
      break;
    }
    if (node.kind === 'company' && /^\d{14}$/.test(node.id)) {
      roots.push(node.id);
    }
  }
  return roots;
}

export function unionGrafo(live: GrafoData, hops: GrafoData): GrafoData {
  const nodes: GrafoNode[] = live.nodes.map(cloneNode);
  const liveIds = new Set(nodes.map((node) => node.id));

  for (const node of hops.nodes) {
    if (liveIds.has(node.id)) {
      continue;
    }
    nodes.push(cloneNode(node));
    liveIds.add(node.id);
  }

  const edges: GrafoEdge[] = live.edges.map(cloneEdge);
  const seen = new Set(edges.map(edgeKey));

  for (const edge of hops.edges) {
    const key = edgeKey(edge);
    if (seen.has(key)) {
      continue;
    }
    if (!liveIds.has(edge.from) || !liveIds.has(edge.to)) {
      continue;
    }
    edges.push(cloneEdge(edge));
    seen.add(key);
  }

  return { nodes, edges };
}
