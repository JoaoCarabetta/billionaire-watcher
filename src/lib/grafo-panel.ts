/**
 * Builds the /grafo side-panel view-model from committed JSON.
 *
 * Reads only label, kind, pct_capital, pct_votos, source (plus id / from / to).
 * No money, no path product, no invented fields.
 */

import type { GrafoData, GrafoEdge, GrafoNode } from './grafo-elements';

export type PanelHop = {
  other_id: string;
  other_label: string;
  direction: 'in' | 'out';
  kind: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type NodePanelView = {
  mode: 'node';
  label: string;
  kind: string;
  id: string;
  hops: PanelHop[];
};

export type EdgePanelView = {
  mode: 'edge';
  from_label: string;
  to_label: string;
  kind: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type PanelView = NodePanelView | EdgePanelView | null;

export type PanelSelection =
  | { nodeId: string }
  | { from: string; to: string }
  | null;

function nodeById(data: GrafoData, id: string): GrafoNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

function labelOf(data: GrafoData, id: string): string {
  return nodeById(data, id)?.label ?? id;
}

function presentNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

function hopFromEdge(
  data: GrafoData,
  edge: GrafoEdge,
  direction: 'in' | 'out'
): PanelHop {
  const otherId = direction === 'out' ? edge.to : edge.from;
  const hop: PanelHop = {
    other_id: otherId,
    other_label: labelOf(data, otherId),
    direction,
    kind: edge.kind,
  };

  if (presentNumber(edge.pct_capital)) {
    hop.pct_capital = edge.pct_capital;
  }
  if (presentNumber(edge.pct_votos)) {
    hop.pct_votos = edge.pct_votos;
  }
  if (edge.source) {
    hop.source = edge.source;
  }

  return hop;
}

function buildNodePanel(data: GrafoData, nodeId: string): NodePanelView | null {
  const node = nodeById(data, nodeId);
  if (!node) {
    return null;
  }

  const hops: PanelHop[] = [];
  for (const edge of data.edges) {
    if (edge.from === nodeId) {
      hops.push(hopFromEdge(data, edge, 'out'));
    }
    if (edge.to === nodeId) {
      hops.push(hopFromEdge(data, edge, 'in'));
    }
  }

  return {
    mode: 'node',
    label: node.label,
    kind: node.kind,
    id: node.id,
    hops,
  };
}

function buildEdgePanel(
  data: GrafoData,
  from: string,
  to: string
): EdgePanelView | null {
  const edge = data.edges.find((item) => item.from === from && item.to === to);
  if (!edge) {
    return null;
  }

  const view: EdgePanelView = {
    mode: 'edge',
    from_label: labelOf(data, from),
    to_label: labelOf(data, to),
    kind: edge.kind,
  };

  if (presentNumber(edge.pct_capital)) {
    view.pct_capital = edge.pct_capital;
  }
  if (presentNumber(edge.pct_votos)) {
    view.pct_votos = edge.pct_votos;
  }
  if (edge.source) {
    view.source = edge.source;
  }

  return view;
}

export function buildPanelView(data: GrafoData, selection: PanelSelection): PanelView {
  if (!selection) {
    return null;
  }
  if ('nodeId' in selection) {
    return buildNodePanel(data, selection.nodeId);
  }
  return buildEdgePanel(data, selection.from, selection.to);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function factLine(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return '<p><span class="grafo-panel-field">' + escapeHtml(name) + '</span> ' +
    escapeHtml(String(value)) + '</p>';
}

function renderHop(hop: PanelHop): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(hop.other_label) + '</strong>' +
      factLine('kind', hop.kind) +
      factLine('pct_capital', hop.pct_capital) +
      factLine('pct_votos', hop.pct_votos) +
      factLine('source', hop.source) +
    '</li>'
  );
}

function renderHopGroup(title: string, hops: PanelHop[]): string {
  if (hops.length === 0) {
    return '';
  }
  return (
    '<section>' +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<ul>' + hops.map(renderHop).join('') + '</ul>' +
    '</section>'
  );
}

export function renderPanelHtml(view: PanelView): string {
  if (!view) {
    return '';
  }

  if (view.mode === 'node') {
    const outgoing = view.hops.filter((hop) => hop.direction === 'out');
    const incoming = view.hops.filter((hop) => hop.direction === 'in');
    return (
      '<div class="grafo-panel-body">' +
        '<h2>' + escapeHtml(view.label) + '</h2>' +
        factLine('kind', view.kind) +
        factLine('id', view.id) +
        renderHopGroup('saida', outgoing) +
        renderHopGroup('entrada', incoming) +
      '</div>'
    );
  }

  return (
    '<div class="grafo-panel-body">' +
      '<h2>' + escapeHtml(view.from_label) + ' - ' + escapeHtml(view.to_label) + '</h2>' +
      factLine('kind', view.kind) +
      factLine('pct_capital', view.pct_capital) +
      factLine('pct_votos', view.pct_votos) +
      factLine('source', view.source) +
    '</div>'
  );
}
