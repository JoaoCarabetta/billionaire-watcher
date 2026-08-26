/**
 * Civic ownership-graph relevance metrics.
 *
 * Input: grafo-publico.json (nodes + edges), whatever size it has.
 * Listed seeds: LISTED_COMPANY_IDS in src/lib/grafo-panel.ts, plus any node
 * the file flags (listed: true or kind listed). No frozen name list.
 *
 * Missing cited percent stays missing. Never equal-split. Never fortuna.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type MetricsNode = {
  id: string;
  kind: string;
  label: string;
  listed?: boolean;
};

export type MetricsEdge = {
  from: string;
  to: string;
  kind?: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type MetricsGraph = {
  nodes: MetricsNode[];
  edges: MetricsEdge[];
};

export type NodeType =
  | 'person'
  | 'listed_seed'
  | 'tesouraria'
  | 'outros'
  | 'foreign'
  | 'state'
  | 'company';

export const TERMINAL_OWNER_TYPES: ReadonlyArray<NodeType> = [
  'person',
  'foreign',
  'state',
  'tesouraria',
  'outros',
];

export type CapitalBucket =
  | 'foreign'
  | 'state'
  | 'brazilian_person'
  | 'brazilian_company'
  | 'tesouraria'
  | 'outros'
  | 'missing'
  | 'unattributed';

const BUCKETS: CapitalBucket[] = [
  'foreign',
  'state',
  'brazilian_person',
  'brazilian_company',
  'tesouraria',
  'outros',
  'missing',
  'unattributed',
];

export type NodeDegreeRow = {
  id: string;
  label: string;
  type: NodeType;
  out_degree: number;
  weighted_out_capital: number;
  weighted_out_votos: number;
  seeds_reached: number;
  seed_ids: string[];
  power_score: number;
};

export type CitedSliceRow = {
  id: string;
  label: string;
  type: NodeType;
  seed_id: string;
  seed_label: string;
  pct_capital?: number;
  pct_votos?: number;
  complete_path_count: number;
  incomplete_path_count: number;
};

export type SeedCapitalRow = {
  seed_id: string;
  seed_label: string;
  cited_incoming_capital: number;
  missing_residual: number;
  incoming_edge_count: number;
  cited_edge_count: number;
  hole_incoming_count: number;
  direct: Record<CapitalBucket, number>;
  complete_path: Record<CapitalBucket, number>;
};

export type PersonMultiSeedRow = {
  id: string;
  label: string;
  seed_count: number;
  seed_ids: string[];
  seed_labels: string[];
};

export type BetweennessRow = {
  id: string;
  label: string;
  type: NodeType;
  directed_betweenness: number;
};

export type MetricsResult = {
  graph: {
    node_count: number;
    edge_count: number;
    listed_seed_count: number;
    listed_seed_ids: string[];
  };
  typology: {
    counts: Record<NodeType, number>;
    not_detectable: string[];
  };
  dropped_metrics: Array<{ metric: string; reason: string }>;
  cannot_measure: string[];
  wealth_rank: {
    refused: true;
    reason: string;
  };
  out_degree: NodeDegreeRow[];
  cited_slices: CitedSliceRow[];
  seed_capital: SeedCapitalRow[];
  capital_share_direct: Record<CapitalBucket, number>;
  capital_share_complete_path: Record<CapitalBucket, number>;
  people_on_more_than_one_seed_path: PersonMultiSeedRow[];
  betweenness: BetweennessRow[];
  power_people: NodeDegreeRow[];
  power_companies: NodeDegreeRow[];
};

const METRICS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(METRICS_DIR, '..');

export function presentNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function emptyBuckets(): Record<CapitalBucket, number> {
  return {
    foreign: 0,
    state: 0,
    brazilian_person: 0,
    brazilian_company: 0,
    tesouraria: 0,
    outros: 0,
    missing: 0,
    unattributed: 0,
  };
}

function addBuckets(
  target: Record<CapitalBucket, number>,
  source: Record<CapitalBucket, number>,
  scale = 1
): void {
  for (const key of BUCKETS) {
    target[key] += source[key] * scale;
  }
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function loadListedCompanyIds(repoRoot = REPO_ROOT): string[] {
  const panelPath = join(repoRoot, 'src', 'lib', 'grafo-panel.ts');
  const text = readFileSync(panelPath, 'utf8');
  const marker = 'export const LISTED_COMPANY_IDS';
  const start = text.indexOf(marker);
  if (start < 0) {
    return [];
  }
  const block = text.slice(start, text.indexOf(']', start) + 1);
  return [...block.matchAll(/'([0-9]{14})'/g)].map((match) => match[1]);
}

export function loadGraphFile(filePath: string, cwd = process.cwd()): MetricsGraph {
  const resolved = isAbsolute(filePath) ? filePath : join(cwd, filePath);
  const parsed = JSON.parse(readFileSync(resolved, 'utf8')) as MetricsGraph;
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('graph file must have nodes and edges arrays');
  }
  return parsed;
}

function isPersonId(id: string): boolean {
  return /^p-[0-9a-f]{8}$/.test(id);
}

function isStateLabel(label: string): boolean {
  const folded = stripAccents(label).toLowerCase().trim();
  if (folded === 'uniao federal') {
    return true;
  }
  if (folded.startsWith('estado de ')) {
    return true;
  }
  if (folded.includes('secretaria da fazenda do estado')) {
    return true;
  }
  return false;
}

export function classifyNode(
  node: MetricsNode,
  listedIds: Set<string>
): NodeType {
  if (node.kind === 'person' || isPersonId(node.id)) {
    return 'person';
  }
  if (node.id.startsWith('tesouraria-') || /acoes em tesouraria/i.test(stripAccents(node.label))) {
    return 'tesouraria';
  }
  if (node.id.startsWith('outros-') || /outros acionistas/i.test(node.label)) {
    return 'outros';
  }
  if (node.id.startsWith('x-') || node.kind === 'foreign') {
    return 'foreign';
  }
  if (listedIds.has(node.id) || node.listed === true || node.kind === 'listed') {
    return 'listed_seed';
  }
  if (node.kind === 'state' || isStateLabel(node.label)) {
    return 'state';
  }
  return 'company';
}

export function resolveListedSeedIds(
  graph: MetricsGraph,
  listedFromRepo: readonly string[]
): string[] {
  const present = new Set(graph.nodes.map((node) => node.id));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of listedFromRepo) {
    if (present.has(id) && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  for (const node of graph.nodes) {
    if ((node.listed === true || node.kind === 'listed') && !seen.has(node.id)) {
      ids.push(node.id);
      seen.add(node.id);
    }
  }
  return ids;
}

function typeToDirectBucket(type: NodeType): CapitalBucket {
  switch (type) {
    case 'foreign':
      return 'foreign';
    case 'state':
      return 'state';
    case 'person':
      return 'brazilian_person';
    case 'tesouraria':
      return 'tesouraria';
    case 'outros':
      return 'outros';
    default:
      return 'brazilian_company';
  }
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

function outgoingMap(graph: MetricsGraph): Map<string, MetricsEdge[]> {
  const map = new Map<string, MetricsEdge[]>();
  for (const node of graph.nodes) {
    map.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = map.get(edge.from);
    if (list) {
      list.push(edge);
    } else {
      map.set(edge.from, [edge]);
    }
  }
  return map;
}

function incomingMap(graph: MetricsGraph): Map<string, MetricsEdge[]> {
  const map = new Map<string, MetricsEdge[]>();
  for (const node of graph.nodes) {
    map.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = map.get(edge.to);
    if (list) {
      list.push(edge);
    } else {
      map.set(edge.to, [edge]);
    }
  }
  return map;
}

function reachableListedSeeds(
  startId: string,
  listedSet: Set<string>,
  outgoing: Map<string, MetricsEdge[]>
): string[] {
  const reached: string[] = [];
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const edge of outgoing.get(id) ?? []) {
      if (seen.has(edge.to)) {
        continue;
      }
      seen.add(edge.to);
      if (listedSet.has(edge.to) && edge.to !== startId) {
        reached.push(edge.to);
      }
      queue.push(edge.to);
    }
  }
  return reached;
}

type PathWalk = {
  capitalSum: number;
  votosSum: number;
  capitalPathCount: number;
  votosPathCount: number;
  completePathCount: number;
  incompletePathCount: number;
};

function walkCitedPaths(
  fromId: string,
  seedId: string,
  outgoing: Map<string, MetricsEdge[]>
): PathWalk {
  const result: PathWalk = {
    capitalSum: 0,
    votosSum: 0,
    capitalPathCount: 0,
    votosPathCount: 0,
    completePathCount: 0,
    incompletePathCount: 0,
  };
  if (fromId === seedId) {
    return result;
  }

  const dfs = (
    nodeId: string,
    visited: Set<string>,
    capitalHops: Array<number | null | undefined>,
    votoHops: Array<number | null | undefined>
  ): void => {
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (visited.has(edge.to)) {
        continue;
      }
      const nextCapital = [...capitalHops, edge.pct_capital];
      const nextVotos = [...votoHops, edge.pct_votos];
      if (edge.to === seedId) {
        const capital = productOfPercents(nextCapital);
        const votos = productOfPercents(nextVotos);
        if (capital === undefined && votos === undefined) {
          result.incompletePathCount += 1;
        } else {
          result.completePathCount += 1;
          if (capital !== undefined) {
            result.capitalSum += capital;
            result.capitalPathCount += 1;
          }
          if (votos !== undefined) {
            result.votosSum += votos;
            result.votosPathCount += 1;
          }
        }
        continue;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(edge.to);
      dfs(edge.to, nextVisited, nextCapital, nextVotos);
    }
  };

  dfs(fromId, new Set([fromId]), [], []);
  return result;
}

function directedBetweenness(graph: MetricsGraph): Map<string, number> {
  const nodes = graph.nodes.map((node) => node.id);
  const outgoing = outgoingMap(graph);
  const score = new Map<string, number>();
  for (const id of nodes) {
    score.set(id, 0);
  }

  for (const source of nodes) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const id of nodes) {
      predecessors.set(id, []);
      sigma.set(id, 0);
      dist.set(id, -1);
    }
    sigma.set(source, 1);
    dist.set(source, 0);
    const queue = [source];
    while (queue.length > 0) {
      const v = queue.shift() as string;
      stack.push(v);
      for (const edge of outgoing.get(v) ?? []) {
        const w = edge.to;
        if ((dist.get(w) ?? -1) < 0) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          predecessors.get(w)?.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const id of nodes) {
      delta.set(id, 0);
    }
    while (stack.length > 0) {
      const w = stack.pop() as string;
      for (const v of predecessors.get(w) ?? []) {
        const share =
          ((sigma.get(v) ?? 0) / (sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + share);
      }
      if (w !== source) {
        score.set(w, (score.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  return score;
}

function attributeCompletePath(
  nodeId: string,
  typeOf: Map<string, NodeType>,
  incoming: Map<string, MetricsEdge[]>,
  visiting: Set<string>
): Record<CapitalBucket, number> {
  const type = typeOf.get(nodeId) ?? 'company';
  if (TERMINAL_OWNER_TYPES.includes(type)) {
    const buckets = emptyBuckets();
    buckets[typeToDirectBucket(type)] = 100;
    return buckets;
  }
  if (visiting.has(nodeId)) {
    const buckets = emptyBuckets();
    buckets.unattributed = 100;
    return buckets;
  }

  const ins = incoming.get(nodeId) ?? [];
  const citedEdges = ins.filter((edge) => presentNumber(edge.pct_capital));
  if (ins.length === 0 || citedEdges.length === 0) {
    const buckets = emptyBuckets();
    buckets.brazilian_company = 100;
    return buckets;
  }

  visiting.add(nodeId);
  const acc = emptyBuckets();
  let cited = 0;
  for (const edge of citedEdges) {
    cited += edge.pct_capital as number;
    const up = attributeCompletePath(edge.from, typeOf, incoming, visiting);
    addBuckets(acc, up, (edge.pct_capital as number) / 100);
  }
  visiting.delete(nodeId);
  acc.missing += Math.max(0, 100 - cited);
  return acc;
}

export function computeMetrics(
  graph: MetricsGraph,
  options?: { listedIds?: readonly string[]; repoRoot?: string }
): MetricsResult {
  const listedFromRepo = options?.listedIds ?? loadListedCompanyIds(options?.repoRoot);
  const listedIds = resolveListedSeedIds(graph, listedFromRepo);
  const listedSet = new Set(listedIds);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const typeOf = new Map<string, NodeType>();
  const typologyCounts: Record<NodeType, number> = {
    person: 0,
    listed_seed: 0,
    tesouraria: 0,
    outros: 0,
    foreign: 0,
    state: 0,
    company: 0,
  };
  for (const node of graph.nodes) {
    const type = classifyNode(node, listedSet);
    typeOf.set(node.id, type);
    typologyCounts[type] += 1;
  }

  const outgoing = outgoingMap(graph);
  const incoming = incomingMap(graph);
  const betweenness = directedBetweenness(graph);

  const degreeRows: NodeDegreeRow[] = graph.nodes.map((node) => {
    const outs = outgoing.get(node.id) ?? [];
    let weightedCapital = 0;
    let weightedVotos = 0;
    for (const edge of outs) {
      if (presentNumber(edge.pct_capital)) {
        weightedCapital += edge.pct_capital;
      }
      if (presentNumber(edge.pct_votos)) {
        weightedVotos += edge.pct_votos;
      }
    }
    const seedIds = reachableListedSeeds(node.id, listedSet, outgoing);
    const type = typeOf.get(node.id) ?? 'company';
    return {
      id: node.id,
      label: node.label,
      type,
      out_degree: outs.length,
      weighted_out_capital: weightedCapital,
      weighted_out_votos: weightedVotos,
      seeds_reached: seedIds.length,
      seed_ids: seedIds,
      power_score: seedIds.length + weightedCapital / 100,
    };
  });

  degreeRows.sort((a, b) => {
    if (b.out_degree !== a.out_degree) {
      return b.out_degree - a.out_degree;
    }
    if (b.weighted_out_capital !== a.weighted_out_capital) {
      return b.weighted_out_capital - a.weighted_out_capital;
    }
    return a.id.localeCompare(b.id);
  });

  const citedSlices: CitedSliceRow[] = [];
  for (const node of graph.nodes) {
    for (const seedId of listedIds) {
      if (node.id === seedId) {
        continue;
      }
      const walk = walkCitedPaths(node.id, seedId, outgoing);
      if (walk.completePathCount === 0 && walk.incompletePathCount === 0) {
        continue;
      }
      const row: CitedSliceRow = {
        id: node.id,
        label: node.label,
        type: typeOf.get(node.id) ?? 'company',
        seed_id: seedId,
        seed_label: nodeById.get(seedId)?.label ?? seedId,
        complete_path_count: walk.completePathCount,
        incomplete_path_count: walk.incompletePathCount,
      };
      if (walk.capitalPathCount > 0) {
        row.pct_capital = walk.capitalSum;
      }
      if (walk.votosPathCount > 0) {
        row.pct_votos = walk.votosSum;
      }
      citedSlices.push(row);
    }
  }

  citedSlices.sort((a, b) => {
    const aCap = a.pct_capital ?? -1;
    const bCap = b.pct_capital ?? -1;
    if (bCap !== aCap) {
      return bCap - aCap;
    }
    return a.id.localeCompare(b.id) || a.seed_id.localeCompare(b.seed_id);
  });

  const seedCapital: SeedCapitalRow[] = listedIds.map((seedId) => {
    const ins = incoming.get(seedId) ?? [];
    const direct = emptyBuckets();
    let cited = 0;
    let citedEdges = 0;
    let holeIncoming = 0;
    for (const edge of ins) {
      if (!presentNumber(edge.pct_capital)) {
        holeIncoming += 1;
        continue;
      }
      cited += edge.pct_capital;
      citedEdges += 1;
      const ownerType = typeOf.get(edge.from) ?? 'company';
      direct[typeToDirectBucket(ownerType)] += edge.pct_capital;
    }
    const missing = Math.max(0, 100 - cited);
    direct.missing = missing;
    const complete = attributeCompletePath(seedId, typeOf, incoming, new Set());
    return {
      seed_id: seedId,
      seed_label: nodeById.get(seedId)?.label ?? seedId,
      cited_incoming_capital: cited,
      missing_residual: missing,
      incoming_edge_count: ins.length,
      cited_edge_count: citedEdges,
      hole_incoming_count: holeIncoming,
      direct,
      complete_path: complete,
    };
  });

  const capitalShareDirect = emptyBuckets();
  const capitalShareComplete = emptyBuckets();
  for (const row of seedCapital) {
    addBuckets(capitalShareDirect, row.direct);
    addBuckets(capitalShareComplete, row.complete_path);
  }

  const peopleMulti: PersonMultiSeedRow[] = degreeRows
    .filter((row) => row.type === 'person' && row.seeds_reached > 1)
    .map((row) => ({
      id: row.id,
      label: row.label,
      seed_count: row.seeds_reached,
      seed_ids: row.seed_ids,
      seed_labels: row.seed_ids.map((id) => nodeById.get(id)?.label ?? id),
    }))
    .sort((a, b) => b.seed_count - a.seed_count || a.id.localeCompare(b.id));

  const betweennessRows: BetweennessRow[] = graph.nodes
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: typeOf.get(node.id) ?? 'company',
      directed_betweenness: betweenness.get(node.id) ?? 0,
    }))
    .sort((a, b) => b.directed_betweenness - a.directed_betweenness || a.id.localeCompare(b.id));

  const byPower = (rows: NodeDegreeRow[]) =>
    [...rows].sort(
      (a, b) =>
        b.power_score - a.power_score ||
        b.seeds_reached - a.seeds_reached ||
        b.weighted_out_capital - a.weighted_out_capital ||
        a.id.localeCompare(b.id)
    );

  const powerPeople = byPower(degreeRows.filter((row) => row.type === 'person'));
  const powerCompanies = byPower(
    degreeRows.filter((row) => row.type !== 'person' && row.type !== 'tesouraria' && row.type !== 'outros')
  );

  return {
    graph: {
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      listed_seed_count: listedIds.length,
      listed_seed_ids: listedIds,
    },
    typology: {
      counts: typologyCounts,
      not_detectable: [
        'holding/vehicle: public JSON does not mark holdings; they classify as company unless listed/tesouraria/outros/foreign/state',
        'gestora/fund: public JSON kind is company; Alaska/Dynamo-style gestoras are companies',
        'Receita hole company: no type field; hole is an edge without a cited percent, not a node type',
      ],
    },
    dropped_metrics: [
      {
        metric: 'articulation_points',
        reason:
          'The public control graph is a set of directed ownership trees. Almost every internal holding is an articulation on the undirected projection, so the count is not a civic signal beyond "this node is not a leaf". Directed betweenness is kept instead.',
      },
    ],
    cannot_measure: [
      'fortuna / wealth / richest: the file has cited hop slices on complete paths, not a fortune',
      'full ultimate beneficial owner: walk stops at holes, outros, tesouraria, foreign x- leaves, and unopened companies',
      'fund cotistas behind gestoras: gestoras are company nodes; cotistas are not in this file',
      'equal-split of holes: unpublished remainder is the missing bucket',
      'Cadastro de Pessoas Físicas: person id is p- plus eight hex plus display name',
      'companies not on the live page / not in this JSON',
    ],
    wealth_rank: {
      refused: true,
      reason:
        'This archive cannot rank who is richest. Power is graph position (listed seeds reached + cited outgoing capital / 100). A cited hop slice on a complete path is not a fortune.',
    },
    out_degree: degreeRows,
    cited_slices: citedSlices,
    seed_capital: seedCapital,
    capital_share_direct: capitalShareDirect,
    capital_share_complete_path: capitalShareComplete,
    people_on_more_than_one_seed_path: peopleMulti,
    betweenness: betweennessRows,
    power_people: powerPeople,
    power_companies: powerCompanies,
  };
}

function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return value.toFixed(digits);
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length), 3)
  );
  const line = (cells: string[]) =>
    '| ' + cells.map((cell, index) => pad(cell, widths[index])).join(' | ') + ' |';
  const rule =
    '| ' + widths.map((width) => '-'.repeat(width)).join(' | ') + ' |';
  return [line(headers), rule, ...rows.map(line)].join('\n');
}

export function formatReport(result: MetricsResult): string {
  const lines: string[] = [];
  lines.push('# Ownership-graph relevance metrics (civic archive)');
  lines.push('');
  lines.push(
    `nodes ${result.graph.node_count} | edges ${result.graph.edge_count} | listed seeds ${result.graph.listed_seed_count}`
  );
  lines.push('Input: grafo-publico.json (nodes + edges). Counts are read from the file.');
  lines.push('');
  lines.push('## Cannot measure');
  for (const item of result.cannot_measure) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Wealth rank');
  lines.push(`REFUSED. ${result.wealth_rank.reason}`);
  lines.push('');
  lines.push('## Typology the file supports');
  lines.push(
    table(
      ['type', 'count'],
      (Object.entries(result.typology.counts) as Array<[NodeType, number]>).map(
        ([type, count]) => [type, String(count)]
      )
    )
  );
  lines.push('');
  for (const item of result.typology.not_detectable) {
    lines.push(`- not detectable: ${item}`);
  }
  lines.push('');
  lines.push('## Dropped metrics');
  for (const item of result.dropped_metrics) {
    lines.push(`- ${item.metric}: ${item.reason}`);
  }
  lines.push('');
  lines.push('## 1. Companies that control most other companies (out-degree)');
  lines.push(
    'Out-degree = outgoing control edges (owner → owned). Weighted out-degree sums only edges with a cited percent.'
  );
  const companyOut = result.out_degree.filter(
    (row) => row.type === 'company' || row.type === 'listed_seed' || row.type === 'state' || row.type === 'foreign'
  );
  lines.push(
    table(
      ['id', 'label', 'type', 'out', 'w_capital', 'w_votos', 'seeds'],
      companyOut.slice(0, 20).map((row) => [
        row.id,
        row.label,
        row.type,
        String(row.out_degree),
        fmt(row.weighted_out_capital),
        fmt(row.weighted_out_votos),
        String(row.seeds_reached),
      ])
    )
  );
  lines.push('');
  lines.push('## 2. Listed seeds reached on the directed control graph');
  const reach = [...result.out_degree]
    .filter((row) => row.seeds_reached > 0)
    .sort((a, b) => b.seeds_reached - a.seeds_reached || a.id.localeCompare(b.id));
  lines.push(
    table(
      ['id', 'label', 'type', 'seeds_reached'],
      reach.slice(0, 20).map((row) => [
        row.id,
        row.label,
        row.type,
        String(row.seeds_reached),
      ])
    )
  );
  lines.push('');
  lines.push('## 3. Complete-path cited slice (product of cited percents)');
  lines.push(
    'Only fully cited paths. If any hop lacks a percent, that path is incomplete and has no product.'
  );
  const slices = result.cited_slices.filter((row) => row.complete_path_count > 0);
  lines.push(
    table(
      ['id', 'label', 'seed', 'pct_capital', 'pct_votos', 'complete', 'incomplete'],
      slices.slice(0, 25).map((row) => [
        row.id,
        row.label,
        row.seed_label,
        row.pct_capital === undefined ? '' : fmt(row.pct_capital, 6),
        row.pct_votos === undefined ? '' : fmt(row.pct_votos, 6),
        String(row.complete_path_count),
        String(row.incomplete_path_count),
      ])
    )
  );
  lines.push('');
  lines.push('## 4. Directed betweenness (unweighted)');
  lines.push(
    table(
      ['id', 'label', 'type', 'betweenness'],
      result.betweenness.slice(0, 20).map((row) => [
        row.id,
        row.label,
        row.type,
        fmt(row.directed_betweenness, 4),
      ])
    )
  );
  lines.push('');
  lines.push('## 5. Incoming cited capital to listed seeds');
  lines.push(
    'Direct = classify the owner of each cited edge into the seed. Complete-path = push through companies only while every hop is cited; remainder is missing, never Outros, never equal-split.'
  );
  const shareHeaders = ['bucket', 'direct_sum', 'complete_path_sum'];
  lines.push(
    table(
      shareHeaders,
      BUCKETS.map((bucket) => [
        bucket,
        fmt(result.capital_share_direct[bucket]),
        fmt(result.capital_share_complete_path[bucket]),
      ])
    )
  );
  lines.push('');
  lines.push(
    table(
      ['seed', 'cited_in', 'missing', 'foreign_d', 'state_d', 'person_d', 'company_d', 'outros_d', 'tes_d'],
      result.seed_capital.map((row) => [
        row.seed_label,
        fmt(row.cited_incoming_capital),
        fmt(row.missing_residual),
        fmt(row.direct.foreign),
        fmt(row.direct.state),
        fmt(row.direct.brazilian_person),
        fmt(row.direct.brazilian_company),
        fmt(row.direct.outros),
        fmt(row.direct.tesouraria),
      ])
    )
  );
  lines.push('');
  lines.push('## 6. People sitting on more than one listed-seed path');
  lines.push(`count ${result.people_on_more_than_one_seed_path.length}`);
  if (result.people_on_more_than_one_seed_path.length > 0) {
    lines.push(
      table(
        ['id', 'label', 'seed_count', 'seeds'],
        result.people_on_more_than_one_seed_path.map((row) => [
          row.id,
          row.label,
          String(row.seed_count),
          row.seed_labels.join('; '),
        ])
      )
    );
  }
  lines.push('');
  lines.push('## 7. Power (graph position), not rich');
  lines.push(
    'power_score = seeds_reached + weighted_out_capital / 100. Wealth rank refused above.'
  );
  lines.push('People:');
  lines.push(
    table(
      ['id', 'label', 'power', 'seeds', 'w_capital', 'out'],
      result.power_people.slice(0, 15).map((row) => [
        row.id,
        row.label,
        fmt(row.power_score, 4),
        String(row.seeds_reached),
        fmt(row.weighted_out_capital),
        String(row.out_degree),
      ])
    )
  );
  lines.push('');
  lines.push('Companies (excluding tesouraria/outros leaves):');
  lines.push(
    table(
      ['id', 'label', 'type', 'power', 'seeds', 'w_capital', 'out'],
      result.power_companies.slice(0, 15).map((row) => [
        row.id,
        row.label,
        row.type,
        fmt(row.power_score, 4),
        String(row.seeds_reached),
        fmt(row.weighted_out_capital),
        String(row.out_degree),
      ])
    )
  );
  lines.push('');
  return lines.join('\n');
}

export function outputContainsCpf(text: string): boolean {
  if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(text)) {
    return true;
  }
  // Cadastro is 11 digits standing alone. Do not treat a decimal fraction
  // (path product) or a 14-digit company number as Cadastro.
  return /(?<![\d.])\d{11}(?![\d.])/.test(text);
}
