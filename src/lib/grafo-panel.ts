/**
 * Builds the /grafo side-panel view-model from committed JSON.
 *
 * Reads only label, kind, partners, pct_capital, pct_votos, source (plus id / from / to).
 * Cited participation is the product of hop percents on complete paths.
 * No invented percents. No money fields.
 */

import type { GrafoData, GrafoEdge, GrafoNode, GrafoPartner } from './grafo-elements';

export type PanelHop = {
  other_id: string;
  other_label: string;
  direction: 'in' | 'out';
  kind: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type CitedHop = {
  from_id: string;
  from_label: string;
  to_id: string;
  to_label: string;
  kind: string;
  pct_capital?: number;
  pct_votos?: number;
  source?: string;
};

export type CitedPath = {
  hops: CitedHop[];
  pct_capital?: number;
  pct_votos?: number;
};

export type CitedParticipation = {
  company_id: string;
  company_label: string;
  pct_capital?: number;
  pct_votos?: number;
  paths: CitedPath[];
};

export type NodePanelView = {
  mode: 'node';
  label: string;
  kind: string;
  id: string;
  hops: PanelHop[];
  participations: CitedParticipation[];
  partners?: GrafoPartner[];
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

  const view: NodePanelView = {
    mode: 'node',
    label: node.label,
    kind: node.kind,
    id: node.id,
    hops,
    participations: buildCitedParticipations(data, nodeId),
  };
  if (node.partners) {
    view.partners = node.partners;
  }
  return view;
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

export const LISTED_COMPANY_IDS = [
  '00864214000106',
  '07689002000189',
  '33592510000154',
  '03220438000173',
  '34274233000102',
  '07415333000120',
  '01838723000127',
  '17155730000164',
  '01083200000118',
  '43776517000180',
  '06057223000171',
  '02916265000160',
  '33453598000123',
  '07043628000113',
  '33611500000119',
  '50746577000115',
  '06047087000139',
  '02558157000162',
  '61585865000151',
  '42150391000170',
  '47960950000121',
  '33042730000104',
  '33256439000139',
  '67620377000114',
  '16404287000155',
  '02429144000193',
  '00001180000126',
  '16670085000155',
  '33000167000101',
  '03853896000140',
  '24990777000109',
  '84429695000111',
  '07526557000100',
] as const;

function isListedCompany(id: string): boolean {
  return (LISTED_COMPANY_IDS as readonly string[]).includes(id);
}

function productOfPercents(values: Array<number | null | undefined>): number | undefined {
  if (values.some((value) => !presentNumber(value))) {
    return undefined;
  }
  let acc = 1;
  for (const value of values as number[]) {
    acc = acc * (value / 100);
  }
  return acc * 100;
}

function citedHopFromEdge(data: GrafoData, edge: GrafoEdge): CitedHop {
  const hop: CitedHop = {
    from_id: edge.from,
    from_label: labelOf(data, edge.from),
    to_id: edge.to,
    to_label: labelOf(data, edge.to),
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

function findPathsTo(
  data: GrafoData,
  fromId: string,
  targetId: string,
  visited: Set<string>
): GrafoEdge[][] {
  const results: GrafoEdge[][] = [];
  for (const edge of data.edges) {
    if (edge.from !== fromId) {
      continue;
    }
    if (visited.has(edge.to)) {
      continue;
    }
    if (edge.to === targetId) {
      results.push([edge]);
      continue;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(edge.to);
    for (const rest of findPathsTo(data, edge.to, targetId, nextVisited)) {
      results.push([edge, ...rest]);
    }
  }
  return results;
}

function pathView(data: GrafoData, edges: GrafoEdge[]): CitedPath {
  const hops = edges.map((edge) => citedHopFromEdge(data, edge));
  const path: CitedPath = { hops };
  const capital = productOfPercents(edges.map((edge) => edge.pct_capital));
  const votes = productOfPercents(edges.map((edge) => edge.pct_votos));
  if (capital !== undefined) {
    path.pct_capital = capital;
  }
  if (votes !== undefined) {
    path.pct_votos = votes;
  }
  return path;
}

function sumPresent(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  return present.reduce((acc, value) => acc + value, 0);
}

function buildCitedParticipations(data: GrafoData, startId: string): CitedParticipation[] {
  const listedIds = data.nodes
    .filter((node) => isListedCompany(node.id) && node.id !== startId)
    .map((node) => node.id);

  const participations: CitedParticipation[] = [];
  for (const companyId of listedIds) {
    const rawPaths = findPathsTo(data, startId, companyId, new Set([startId]));
    if (rawPaths.length === 0) {
      continue;
    }
    const paths = rawPaths.map((edges) => pathView(data, edges));
    const participation: CitedParticipation = {
      company_id: companyId,
      company_label: labelOf(data, companyId),
      paths,
    };
    const capital = sumPresent(paths.map((path) => path.pct_capital));
    const votes = sumPresent(paths.map((path) => path.pct_votos));
    if (capital !== undefined) {
      participation.pct_capital = capital;
    }
    if (votes !== undefined) {
      participation.pct_votos = votes;
    }
    participations.push(participation);
  }
  return participations;
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

function renderCitedHop(hop: CitedHop): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(hop.from_label) + ' - ' + escapeHtml(hop.to_label) + '</strong>' +
      factLine('kind', hop.kind) +
      factLine('pct_capital', hop.pct_capital) +
      factLine('pct_votos', hop.pct_votos) +
      factLine('source', hop.source) +
    '</li>'
  );
}

function renderCitedPath(path: CitedPath): string {
  return (
    '<li>' +
      factLine('pct_capital', path.pct_capital) +
      factLine('pct_votos', path.pct_votos) +
      '<ul>' + path.hops.map(renderCitedHop).join('') + '</ul>' +
    '</li>'
  );
}

function renderParticipation(item: CitedParticipation): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(item.company_label) + '</strong>' +
      factLine('pct_capital', item.pct_capital) +
      factLine('pct_votos', item.pct_votos) +
      '<ul>' + item.paths.map(renderCitedPath).join('') + '</ul>' +
    '</li>'
  );
}

function renderParticipations(items: CitedParticipation[]): string {
  if (items.length === 0) {
    return '';
  }
  return (
    '<section>' +
      '<h3>participacao citada</h3>' +
      '<ul>' + items.map(renderParticipation).join('') + '</ul>' +
    '</section>'
  );
}

function renderPartner(partner: GrafoPartner): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(partner.nome) + '</strong>' +
      factLine('qualificacao_label', partner.qualificacao_label) +
    '</li>'
  );
}

function renderPartners(partners: GrafoPartner[] | undefined): string {
  if (!partners) {
    return '';
  }
  return (
    '<section>' +
      '<h3>sócios</h3>' +
      '<ul>' + partners.map(renderPartner).join('') + '</ul>' +
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
        renderPartners(view.partners) +
        renderHopGroup('saida', outgoing) +
        renderHopGroup('entrada', incoming) +
        renderParticipations(view.participations) +
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
