/**
 * Dinheiro sob controle: dated listed value × cited complete-path slice.
 *
 * Economic column = V × capital_slice (claim on listed equity that date).
 * Control column = V × votes_slice (same reais as a unit for voting power; not cash).
 *
 * Last-hop grouping into the listed seed lives in this file. Do not call the
 * metrics helper that sums every simple complete path: that would double-count
 * diamonds (Ivan through Gipar on Energisa).
 *
 * Missing hop → no money. Outros / tesouraria → no money. No equal-split.
 * Person id is p- plus eight hex. Unlisted vehicles have no V.
 *
 * Prices: issue #123 transform/seeds/b3_listed_prices.csv (Brasil Bolsa Balcão
 * PREULT, date 2025-05-16). Default is never listed_prices_fixture.csv.
 * Recorded fixture quotes are skipped and never printed.
 * Claro (cnpj_basico 07043628) has no Bolsa class. ENGI11 is a unit: no money
 * without a unit quantity (do not invent one). Quantities: public sidecar
 * public/grafo-quantidades.json (Energisa hop qty × ENGI3/ENGI4; other priced
 * classes from CVM FRE item 17.1). Only when a B3 class also has a quantity.
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
// File load + node typology only. Money slices are last-hop grouped below.
import {
  classifyNode,
  loadGraphFile,
  loadListedCompanyIds,
  outputContainsCpf,
  presentNumber,
  resolveListedSeedIds,
  REPO_ROOT,
  type MetricsEdge,
  type MetricsGraph,
  type NodeType,
} from './compute.ts';

export { loadGraphFile, outputContainsCpf, REPO_ROOT };

export type MoneyGraph = MetricsGraph;

export type PriceInputRow = {
  cnpj_basico: string;
  ticker?: string;
  classe: string;
  preco: number;
  quantidade?: number;
  preco_date: string;
  source?: string;
};

export type QtyInputRow = {
  cnpj_basico: string;
  qty_ordinarias?: number;
  qty_preferenciais?: number;
  qty_unit?: number;
  source?: string;
};

export type ListedValue = {
  cnpj_basico: string;
  date: string;
  listed_value: number;
  ticker?: string;
  quote_kind: 'b3_archive' | 'unit_fixture';
  price_source_label: string;
  class_produtos: Array<{
    classe: string;
    ticker?: string;
    preco: number;
    quantidade: number;
    produto: number;
  }>;
  sources: string[];
};

export type SkippedFixtureQuote = {
  cnpj_basico: string;
  date: string;
  ticker?: string;
  classe: string;
  source: string;
};

export type LastHopMoneyRow = {
  node_id: string;
  node_label: string;
  node_type: NodeType;
  listed_seed_id: string;
  listed_seed_label: string;
  date: string;
  via_last_hop_id: string;
  via_last_hop_label: string;
  parent_on_same_seed_id?: string;
  parent_on_same_seed_label?: string;
  nested: boolean;
  slice_capital: number;
  slice_votos: number;
  money_economic: number;
  money_control: number;
  listed_value: number;
  sources: string[];
  refused?: boolean;
  reason?: string;
};

export type NodeMoneyTotal = {
  node_id: string;
  node_label: string;
  node_type: NodeType;
  listed_seed_id: string;
  listed_seed_label: string;
  date: string;
  slice_capital: number;
  slice_votos: number;
  money_economic: number;
  money_control: number;
  listed_value: number;
  last_hop_count: number;
  via_last_hops: string[];
  nested_via: string[];
  sources: string[];
};

export type NestedSumRefusal = {
  ok: false;
  nested: true;
  reason: string;
};

export type NestedSumOk = {
  ok: true;
  money_economic: number;
  money_control: number;
};

export type MoneyResult = {
  graph: {
    node_count: number;
    edge_count: number;
    listed_seed_count: number;
    priced_listed_seed_ids: string[];
    unpriced_listed_seed_ids: string[];
  };
  dates: string[];
  listed_values: ListedValue[];
  skipped_fixture_quotes: SkippedFixtureQuote[];
  last_hop_rows: LastHopMoneyRow[];
  node_totals: NodeMoneyTotal[];
  cannot_measure: string[];
  wealth_rank: {
    refused: true;
    reason: string;
  };
};

export const B3_ARCHIVE_LABEL = 'Brasil Bolsa Balcão';
export const CLARO_CNPJ_BASICO = '07043628';
export const DEFAULT_MONEY_DATE = '2025-05-16';
export const ARCHIVE_BOLSA_SOURCE = /brasil\s+bolsa\s+balc[aã]o/i;
export const RECORDED_FIXTURE_QUOTE = /recorded\s+fixture\s+quote/i;
export const DEFAULT_PRICES_RELATIVE = join('transform', 'seeds', 'b3_listed_prices.csv');
export const DEFAULT_QTY_RELATIVE_PATHS = [
  join('metrics', 'listed_capital_quantities.csv'),
  join('transform', 'seeds', 'energisa_edges_fixture.csv'),
  join('public', 'grafo-quantidades.json'),
];

type SliceGroup = {
  via_last_hop_id: string;
  slice_capital: number;
  slice_votos: number;
  sources: string[];
  refused?: boolean;
  reason?: string;
};

const FORBIDDEN_OUTPUT = /\bfortuna\b|\brichest\b/i;

export function isRecordedFixtureQuote(source?: string): boolean {
  return RECORDED_FIXTURE_QUOTE.test(source ?? '');
}

export function isUnitClass(classe: string): boolean {
  const normalized = classe.trim().toLowerCase();
  return normalized === 'unit' || normalized === 'units' || normalized === 'unt' || normalized === 'unidade';
}

export function isOrdinaryClass(classe: string): boolean {
  const normalized = classe.trim().toLowerCase();
  return normalized === 'ordinaria' || normalized === 'ordinarias' || normalized === 'on';
}

export function isPreferredClass(classe: string): boolean {
  const normalized = classe.trim().toLowerCase();
  return normalized === 'preferencial' || normalized === 'preferenciais' || normalized === 'pn';
}

export function isArchiveBolsaPrice(row: { cnpj_basico: string; classe?: string; source?: string }): boolean {
  if (isRecordedFixtureQuote(row.source)) {
    return false;
  }
  if (row.cnpj_basico === CLARO_CNPJ_BASICO) {
    return false;
  }
  return ARCHIVE_BOLSA_SOURCE.test(row.source ?? '');
}

export function roundReais(value: number): number {
  return Math.round(value * 100) / 100;
}

export function cnpjBasicoFromNodeId(id: string): string | undefined {
  if (!/^\d{14}$/.test(id)) {
    return undefined;
  }
  return id.slice(0, 8);
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function loadCsvFile(filePath: string, cwd = process.cwd()): Record<string, string>[] {
  const resolved = isAbsolute(filePath) ? filePath : join(cwd, filePath);
  return parseCsv(readFileSync(resolved, 'utf8'));
}

export function loadPriceRows(filePath: string, cwd = process.cwd()): PriceInputRow[] {
  return loadCsvFile(filePath, cwd).map((row) => ({
    cnpj_basico: (row.cnpj_basico ?? '').padStart(8, '0'),
    ticker: row.ticker || undefined,
    classe: (row.classe ?? '').toLowerCase(),
    preco: Number(row.preco),
    quantidade: parseOptionalNumber(row.quantidade),
    preco_date: row.preco_date,
    source: row.source || undefined,
  }));
}

function sidecarRawRows(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed as Array<Record<string, unknown>>;
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rows)) {
      return obj.rows as Array<Record<string, unknown>>;
    }
    if (Array.isArray(obj.quantities)) {
      return obj.quantities as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function qtySourceFromSidecarRow(row: Record<string, unknown>): string | undefined {
  const parts = [row.source_doc, row.source_locator, row.source]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function loadQtyRowsFromSidecar(filePath: string, cwd = process.cwd()): QtyInputRow[] {
  const resolved = isAbsolute(filePath) ? filePath : join(cwd, filePath);
  const parsed = JSON.parse(readFileSync(resolved, 'utf8')) as unknown;
  const grouped = new Map<string, QtyInputRow>();
  for (const row of sidecarRawRows(parsed)) {
    const classe = typeof row.classe === 'string' ? row.classe : '';
    if (isUnitClass(classe)) {
      continue;
    }
    const id = typeof row.id === 'string' ? row.id : '';
    const rawBasico = typeof row.cnpj_basico === 'string' ? row.cnpj_basico.replace(/\D/g, '') : '';
    const basico =
      rawBasico.length === 8
        ? rawBasico
        : rawBasico.length >= 14
          ? rawBasico.slice(0, 8)
          : /^\d{14}$/.test(id)
            ? id.slice(0, 8)
            : '';
    if (!/^\d{8}$/.test(basico)) {
      continue;
    }
    const existing = grouped.get(basico) ?? { cnpj_basico: basico };
    const quantidade = parseOptionalNumber(
      row.quantidade === undefined || row.quantidade === null ? undefined : String(row.quantidade)
    );
    if (isOrdinaryClass(classe) && quantidade !== undefined) {
      existing.qty_ordinarias = quantidade;
    } else if (isPreferredClass(classe) && quantidade !== undefined) {
      existing.qty_preferenciais = quantidade;
    }
    const ordinarias = parseOptionalNumber(
      row.qty_ordinarias === undefined || row.qty_ordinarias === null ? undefined : String(row.qty_ordinarias)
    );
    const preferenciais = parseOptionalNumber(
      row.qty_preferenciais === undefined || row.qty_preferenciais === null
        ? undefined
        : String(row.qty_preferenciais)
    );
    if (ordinarias !== undefined) {
      existing.qty_ordinarias = ordinarias;
    }
    if (preferenciais !== undefined) {
      existing.qty_preferenciais = preferenciais;
    }
    const source = qtySourceFromSidecarRow(row);
    if (source) {
      existing.source = source;
    }
    if (
      existing.qty_ordinarias === undefined &&
      existing.qty_preferenciais === undefined &&
      existing.qty_unit === undefined
    ) {
      continue;
    }
    grouped.set(basico, existing);
  }
  return [...grouped.values()];
}

export function loadQtyRowsFromEdgesFixture(filePath: string, cwd = process.cwd()): QtyInputRow[] {
  const grouped = new Map<string, QtyInputRow>();
  for (const row of loadCsvFile(filePath, cwd)) {
    const basico = (row.to_id ?? row.cnpj_basico ?? '').padStart(8, '0');
    if (!/^\d{8}$/.test(basico)) {
      continue;
    }
    const ordinarias = parseOptionalNumber(row.qty_ordinarias);
    const preferenciais = parseOptionalNumber(row.qty_preferenciais);
    const unit = parseOptionalNumber(row.qty_unit);
    if (ordinarias === undefined && preferenciais === undefined && unit === undefined) {
      continue;
    }
    const sourceParts = [row.source_doc, row.source_locator, row.source].filter(
      (part) => part && part.length > 0
    );
    const existing = grouped.get(basico) ?? { cnpj_basico: basico };
    if (ordinarias !== undefined) {
      existing.qty_ordinarias = ordinarias;
    }
    if (preferenciais !== undefined) {
      existing.qty_preferenciais = preferenciais;
    }
    if (unit !== undefined) {
      existing.qty_unit = unit;
    }
    if (sourceParts.length > 0) {
      existing.source = sourceParts.join(' ');
    }
    grouped.set(basico, existing);
  }
  return [...grouped.values()];
}

export function loadQtyRows(filePaths: string | string[], cwd = process.cwd()): QtyInputRow[] {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  const grouped = new Map<string, QtyInputRow>();
  for (const filePath of paths) {
    const fromJson = filePath.replace(/\\/g, '/').endsWith('.json');
    const rows = fromJson ? loadQtyRowsFromSidecar(filePath, cwd) : loadQtyRowsFromEdgesFixture(filePath, cwd);
    for (const row of rows) {
      grouped.set(row.cnpj_basico, row);
    }
  }
  return [...grouped.values()];
}

export function partitionPriceRows(
  prices: PriceInputRow[],
  options?: { allowNonArchivePrices?: boolean }
): { archive: PriceInputRow[]; skipped: SkippedFixtureQuote[] } {
  const archive: PriceInputRow[] = [];
  const skipped: SkippedFixtureQuote[] = [];
  const seenSkip = new Set<string>();
  for (const row of prices) {
    const recorded = isRecordedFixtureQuote(row.source);
    const claro = row.cnpj_basico === CLARO_CNPJ_BASICO;
    const archiveOk = !claro && isArchiveBolsaPrice(row);
    if (!archiveOk) {
      if (options?.allowNonArchivePrices && !recorded && !claro) {
        archive.push(row);
        continue;
      }
      const key = `${row.cnpj_basico}\t${row.preco_date}\t${row.classe}\t${row.ticker ?? ''}`;
      if (seenSkip.has(key)) {
        continue;
      }
      seenSkip.add(key);
      skipped.push({
        cnpj_basico: row.cnpj_basico,
        date: row.preco_date,
        ticker: row.ticker,
        classe: row.classe,
        source: row.source || 'skipped quote',
      });
      continue;
    }
    archive.push(row);
  }
  return { archive, skipped };
}

export function listedValuesFromPrices(
  prices: PriceInputRow[],
  quantities: QtyInputRow[] = []
): ListedValue[] {
  const qtyByBasico = new Map(quantities.map((row) => [row.cnpj_basico, row]));
  const buckets = new Map<string, ListedValue>();

  for (const price of prices) {
    if (!presentNumber(price.preco) || !price.preco_date || !price.cnpj_basico) {
      continue;
    }
    const classe = price.classe;
    if (isUnitClass(classe) && !presentNumber(price.quantidade) && !qtyByBasico.get(price.cnpj_basico)?.qty_unit) {
      // Unit (ENGI11): no money without a unit quantity. Do not use ON/PN counts.
      continue;
    }
    let quantidade = price.quantidade;
    if (!presentNumber(quantidade)) {
      const qty = qtyByBasico.get(price.cnpj_basico);
      if (isOrdinaryClass(classe)) {
        quantidade = qty?.qty_ordinarias;
      } else if (isPreferredClass(classe)) {
        quantidade = qty?.qty_preferenciais;
      } else if (isUnitClass(classe)) {
        quantidade = qty?.qty_unit;
      }
    }
    if (!presentNumber(quantidade) || quantidade === 0) {
      continue;
    }
    const produto = price.preco * quantidade;
    const key = `${price.cnpj_basico}\t${price.preco_date}`;
    const archiveQuote = isArchiveBolsaPrice(price);
    const bucket = buckets.get(key) ?? {
      cnpj_basico: price.cnpj_basico,
      date: price.preco_date,
      listed_value: 0,
      ticker: isUnitClass(classe) ? undefined : price.ticker,
      quote_kind: archiveQuote ? 'b3_archive' : 'unit_fixture',
      price_source_label: archiveQuote
        ? B3_ARCHIVE_LABEL
        : 'unit fixture (algorithm test; not archive value)',
      class_produtos: [],
      sources: [],
    };
    if (price.ticker && !bucket.ticker && !isUnitClass(classe)) {
      bucket.ticker = price.ticker;
    }
    bucket.class_produtos.push({
      classe,
      ticker: price.ticker,
      preco: price.preco,
      quantidade,
      produto,
    });
    bucket.listed_value += produto;
    const qtySource = qtyByBasico.get(price.cnpj_basico)?.source;
    for (const source of [price.source, qtySource]) {
      if (!source || bucket.sources.includes(source) || isRecordedFixtureQuote(source)) {
        continue;
      }
      bucket.sources.push(source);
    }
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date) || a.cnpj_basico.localeCompare(b.cnpj_basico));
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
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

function isNoMoneyType(type: NodeType | undefined): boolean {
  return type === 'outros' || type === 'tesouraria';
}

function percentsAgree(edges: MetricsEdge[]): boolean {
  const first = edges[0];
  return edges.every(
    (edge) => edge.pct_capital === first.pct_capital && edge.pct_votos === first.pct_votos
  );
}

function sumGroups(groups: SliceGroup[]): { capital: number; votos: number; sources: string[] } | undefined {
  const usable = groups.filter((group) => !group.refused);
  if (usable.length === 0) {
    return undefined;
  }
  let capital = 0;
  let votos = 0;
  const sources: string[] = [];
  for (const group of usable) {
    capital += group.slice_capital;
    votos += group.slice_votos;
    sources.push(...group.sources);
  }
  return { capital, votos, sources: uniqueStrings(sources) };
}

type SliceCtx = {
  incoming: Map<string, MetricsEdge[]>;
  typeOf: Map<string, NodeType>;
  cache: Map<string, SliceGroup[]>;
};

function lastHopGroups(fromId: string, targetId: string, ctx: SliceCtx, stack: string[]): SliceGroup[] {
  // Group by the last hop into `targetId`. Recurse for the prefix N→D.
  // Do not raw-sum every simple complete path (that double-counts diamonds).
  if (fromId === targetId) {
    return [];
  }
  if (stack.includes(targetId)) {
    return [];
  }
  const key = `${fromId}\t${targetId}\t${stack.join('|')}`;
  const cached = ctx.cache.get(key);
  if (cached) {
    return cached;
  }

  const nextStack = [...stack, targetId];
  const incoming = ctx.incoming.get(targetId) ?? [];
  const byOwner = new Map<string, MetricsEdge[]>();
  for (const edge of incoming) {
    const list = byOwner.get(edge.from) ?? [];
    list.push(edge);
    byOwner.set(edge.from, list);
  }

  const groups: SliceGroup[] = [];
  for (const [ownerId, edges] of byOwner) {
    if (isNoMoneyType(ctx.typeOf.get(ownerId))) {
      continue;
    }
    const complete = edges.filter(
      (edge) => presentNumber(edge.pct_capital) && presentNumber(edge.pct_votos)
    );
    if (complete.length === 0) {
      continue;
    }
    const sources = uniqueStrings(complete.map((edge) => edge.source ?? '').filter(Boolean));
    if (!percentsAgree(complete)) {
      groups.push({
        via_last_hop_id: ownerId,
        slice_capital: 0,
        slice_votos: 0,
        sources,
        refused: true,
        reason: 'last-hop cited percents disagree',
      });
      continue;
    }
    const lastCapital = complete[0].pct_capital as number;
    const lastVotos = complete[0].pct_votos as number;

    if (fromId === ownerId) {
      groups.push({
        via_last_hop_id: ownerId,
        slice_capital: lastCapital,
        slice_votos: lastVotos,
        sources,
      });
      continue;
    }
    if (isNoMoneyType(ctx.typeOf.get(fromId))) {
      continue;
    }

    const prefixGroups = lastHopGroups(fromId, ownerId, ctx, nextStack);
    if (prefixGroups.some((group) => group.refused)) {
      groups.push({
        via_last_hop_id: ownerId,
        slice_capital: 0,
        slice_votos: 0,
        sources,
        refused: true,
        reason: 'prefix last-hop group refused',
      });
      continue;
    }
    const prefix = sumGroups(prefixGroups);
    if (!prefix) {
      continue;
    }
    groups.push({
      via_last_hop_id: ownerId,
      slice_capital: (prefix.capital * lastCapital) / 100,
      slice_votos: (prefix.votos * lastVotos) / 100,
      sources: uniqueStrings([...prefix.sources, ...sources]),
    });
  }

  ctx.cache.set(key, groups);
  return groups;
}

export function sumNodeTotalsIfNotNested(
  a: NodeMoneyTotal,
  b: NodeMoneyTotal
): NestedSumOk | NestedSumRefusal {
  if (a.listed_seed_id !== b.listed_seed_id || a.date !== b.date) {
    return {
      ok: true,
      money_economic: roundReais(a.money_economic + b.money_economic),
      money_control: roundReais(a.money_control + b.money_control),
    };
  }
  const aOwnsB = a.via_last_hops.includes(b.node_id);
  const bOwnsA = b.via_last_hops.includes(a.node_id);
  if (aOwnsB || bOwnsA) {
    const parent = aOwnsB ? b : a;
    const child = aOwnsB ? a : b;
    return {
      ok: false,
      nested: true,
      reason: `${child.node_label} last-hop ${parent.node_label} on ${parent.listed_seed_label} is nested; do not add the holding total on top of the person total. The holding reais already contain the through-holding group.`,
    };
  }
  return {
    ok: true,
    money_economic: roundReais(a.money_economic + b.money_economic),
    money_control: roundReais(a.money_control + b.money_control),
  };
}

export function computeMoneyUnderControl(
  graph: MetricsGraph,
  options?: {
    listedIds?: readonly string[];
    repoRoot?: string;
    prices?: PriceInputRow[];
    quantities?: QtyInputRow[];
    pricesPath?: string;
    qtyPath?: string;
    date?: string;
    allDates?: boolean;
    cwd?: string;
    allowNonArchivePrices?: boolean;
  }
): MoneyResult {
  const cwd = options?.cwd ?? process.cwd();
  const repoRoot = options?.repoRoot ?? REPO_ROOT;
  const prices =
    options?.prices ??
    loadPriceRows(options?.pricesPath ?? join(repoRoot, DEFAULT_PRICES_RELATIVE), cwd);
  const { archive: archivePrices, skipped: skippedFixtureQuotes } = partitionPriceRows(prices, {
    allowNonArchivePrices: options?.allowNonArchivePrices,
  });
  const quantities =
    options?.quantities ??
    loadQtyRows(
      options?.qtyPath
        ? [options.qtyPath]
        : DEFAULT_QTY_RELATIVE_PATHS.map((relative) => join(repoRoot, relative)),
      cwd
    );
  const allValues = listedValuesFromPrices(archivePrices, quantities);
  const latestDate = allValues.map((row) => row.date).sort().at(-1);
  const values = allValues.filter((row) => {
    if (options?.allDates) {
      return true;
    }
    if (options?.date) {
      return row.date === options.date;
    }
    if (allValues.some((item) => item.date === DEFAULT_MONEY_DATE)) {
      return row.date === DEFAULT_MONEY_DATE;
    }
    return row.date === latestDate;
  });
  const valueByBasicoDate = new Map(values.map((row) => [`${row.cnpj_basico}\t${row.date}`, row]));
  const pricedBasicos = new Set(values.map((row) => row.cnpj_basico));

  const listedFromRepo = options?.listedIds ?? loadListedCompanyIds(repoRoot);
  const listedIds = resolveListedSeedIds(graph, listedFromRepo);
  const listedSet = new Set(listedIds);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const typeOf = new Map<string, NodeType>();
  for (const node of graph.nodes) {
    typeOf.set(node.id, classifyNode(node, listedSet));
  }

  const pricedSeedIds: string[] = [];
  const unpricedSeedIds: string[] = [];
  for (const id of listedIds) {
    const basico = cnpjBasicoFromNodeId(id);
    if (basico && pricedBasicos.has(basico)) {
      pricedSeedIds.push(id);
    } else {
      unpricedSeedIds.push(id);
    }
  }

  const incoming = incomingMap(graph);
  const ctx: SliceCtx = { incoming, typeOf, cache: new Map() };
  const lastHopRows: LastHopMoneyRow[] = [];

  const dates = uniqueStrings(values.map((row) => row.date)).sort();

  for (const seedId of pricedSeedIds) {
    const seedType = typeOf.get(seedId);
    if (seedType === undefined) {
      continue;
    }
    const basico = cnpjBasicoFromNodeId(seedId);
    if (!basico) {
      continue;
    }
    const seedLabel = nodeById.get(seedId)?.label ?? seedId;
    for (const date of dates) {
      const listed = valueByBasicoDate.get(`${basico}\t${date}`);
      if (!listed) {
        continue;
      }
      const ownersOnSeed = new Set<string>();
      for (const node of graph.nodes) {
        if (node.id === seedId || isNoMoneyType(typeOf.get(node.id))) {
          continue;
        }
        const groups = lastHopGroups(node.id, seedId, ctx, []);
        const usable = groups.filter((group) => !group.refused && (group.slice_capital !== 0 || group.slice_votos !== 0));
        if (usable.length === 0 && !groups.some((group) => group.refused)) {
          continue;
        }
        for (const group of groups) {
          if (group.refused) {
            lastHopRows.push({
              node_id: node.id,
              node_label: node.label,
              node_type: typeOf.get(node.id) ?? 'company',
              listed_seed_id: seedId,
              listed_seed_label: seedLabel,
              date,
              via_last_hop_id: group.via_last_hop_id,
              via_last_hop_label: nodeById.get(group.via_last_hop_id)?.label ?? group.via_last_hop_id,
              nested: false,
              slice_capital: 0,
              slice_votos: 0,
              money_economic: 0,
              money_control: 0,
              listed_value: listed.listed_value,
              sources: uniqueStrings([...group.sources, ...listed.sources]),
              refused: true,
              reason: group.reason,
            });
            continue;
          }
          if (group.slice_capital === 0 && group.slice_votos === 0) {
            continue;
          }
          ownersOnSeed.add(node.id);
          const viaSelf = group.via_last_hop_id === node.id;
          const parentId = viaSelf ? undefined : group.via_last_hop_id;
          lastHopRows.push({
            node_id: node.id,
            node_label: node.label,
            node_type: typeOf.get(node.id) ?? 'company',
            listed_seed_id: seedId,
            listed_seed_label: seedLabel,
            date,
            via_last_hop_id: group.via_last_hop_id,
            via_last_hop_label: nodeById.get(group.via_last_hop_id)?.label ?? group.via_last_hop_id,
            parent_on_same_seed_id: parentId,
            parent_on_same_seed_label: parentId
              ? nodeById.get(parentId)?.label ?? parentId
              : undefined,
            nested: Boolean(parentId),
            slice_capital: group.slice_capital,
            slice_votos: group.slice_votos,
            money_economic: roundReais((listed.listed_value * group.slice_capital) / 100),
            money_control: roundReais((listed.listed_value * group.slice_votos) / 100),
            listed_value: listed.listed_value,
            sources: uniqueStrings([...group.sources, ...listed.sources]),
          });
        }
      }
      for (const row of lastHopRows) {
        if (row.listed_seed_id !== seedId || row.date !== date || !row.parent_on_same_seed_id) {
          continue;
        }
        if (!ownersOnSeed.has(row.parent_on_same_seed_id) && row.parent_on_same_seed_id !== seedId) {
          // Direct owner of the seed always has its own last-hop (self) on this seed
          // if the hop is complete; keep the parent mark either way so a reader
          // does not add the FRE line twice.
          row.nested = true;
        }
      }
    }
  }

  const totalsByKey = new Map<string, NodeMoneyTotal>();
  for (const row of lastHopRows) {
    if (row.refused) {
      continue;
    }
    const key = `${row.node_id}\t${row.listed_seed_id}\t${row.date}`;
    const current = totalsByKey.get(key) ?? {
      node_id: row.node_id,
      node_label: row.node_label,
      node_type: row.node_type,
      listed_seed_id: row.listed_seed_id,
      listed_seed_label: row.listed_seed_label,
      date: row.date,
      slice_capital: 0,
      slice_votos: 0,
      money_economic: 0,
      money_control: 0,
      listed_value: row.listed_value,
      last_hop_count: 0,
      via_last_hops: [],
      nested_via: [],
      sources: [],
    };
    current.slice_capital += row.slice_capital;
    current.slice_votos += row.slice_votos;
    current.last_hop_count += 1;
    if (!current.via_last_hops.includes(row.via_last_hop_id)) {
      current.via_last_hops.push(row.via_last_hop_id);
    }
    if (row.nested && row.parent_on_same_seed_id && !current.nested_via.includes(row.parent_on_same_seed_id)) {
      current.nested_via.push(row.parent_on_same_seed_id);
    }
    current.sources = uniqueStrings([...current.sources, ...row.sources]);
    totalsByKey.set(key, current);
  }

  const nodeTotals = [...totalsByKey.values()].map((row) => ({
    ...row,
    money_economic: roundReais((row.listed_value * row.slice_capital) / 100),
    money_control: roundReais((row.listed_value * row.slice_votos) / 100),
  }));

  nodeTotals.sort(
    (a, b) =>
      b.money_control - a.money_control ||
      b.money_economic - a.money_economic ||
      a.node_id.localeCompare(b.node_id) ||
      a.listed_seed_id.localeCompare(b.listed_seed_id) ||
      a.date.localeCompare(b.date)
  );
  lastHopRows.sort(
    (a, b) =>
      a.node_id.localeCompare(b.node_id) ||
      a.listed_seed_id.localeCompare(b.listed_seed_id) ||
      a.date.localeCompare(b.date) ||
      a.via_last_hop_id.localeCompare(b.via_last_hop_id)
  );

  return {
    graph: {
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      listed_seed_count: listedIds.length,
      priced_listed_seed_ids: pricedSeedIds,
      unpriced_listed_seed_ids: unpricedSeedIds,
    },
    dates,
    listed_values: values,
    skipped_fixture_quotes: skippedFixtureQuotes,
    last_hop_rows: lastHopRows,
    node_totals: nodeTotals,
    cannot_measure: [
      'unlisted vehicles: no listed value; only a cited slice of a priced listed seed',
      'listed seed with a B3 quote but no ordinary/preferred quantity: no money (do not invent shares)',
      'ENGI11 unit: no money without a unit quantity (do not invent that quantity)',
      'Claro Telecom Participações (cnpj_basico 07043628): no Brasil Bolsa Balcão class',
      'hole on a path: that path yields no money',
      'Outros and tesouraria: no money',
      'fund cotistas: not in this file',
      'Cadastro de Pessoas Físicas: person id is p- plus eight hex plus display name',
      'equal-split of holes or of Outros',
      'nested person + holding on the same listed seed: not a published sum',
    ],
    wealth_rank: {
      refused: true,
      reason:
        'This script prints dinheiro sob controle (capital slice and votes slice of a dated listed value), not a ranking of people.',
    },
  };
}

function fmtPct(value: number): string {
  return value.toFixed(3);
}

function fmtReais(value: number): string {
  return value.toFixed(2);
}

function fmtQty(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function fmtBillions(value: number): string {
  return `${(value / 1_000_000_000).toFixed(2)} billion reais`;
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
  const rule = '| ' + widths.map((width) => '-'.repeat(width)).join(' | ') + ' |';
  return [line(headers), rule, ...rows.map(line)].join('\n');
}

export function findNodeTotal(
  result: MoneyResult,
  nodeId: string,
  seedId: string,
  date?: string
): NodeMoneyTotal | undefined {
  const dates = date ? [date] : result.dates.slice().sort();
  const latest = dates[dates.length - 1];
  return result.node_totals.find(
    (row) => row.node_id === nodeId && row.listed_seed_id === seedId && row.date === latest
  );
}

export function lastHopRowsFor(
  result: MoneyResult,
  nodeId: string,
  seedId: string,
  date?: string
): LastHopMoneyRow[] {
  const dates = date ? [date] : result.dates.slice().sort();
  const latest = dates[dates.length - 1];
  return result.last_hop_rows.filter(
    (row) => row.node_id === nodeId && row.listed_seed_id === seedId && row.date === latest && !row.refused
  );
}

function workedExample(result: MoneyResult): string[] {
  const ivanId = 'p-cdbc8c4e';
  const energisaId = '00864214000106';
  const latest = result.dates.slice().sort().at(-1);
  if (!latest) {
    return [];
  }
  const ivan = findNodeTotal(result, ivanId, energisaId, latest);
  if (!ivan) {
    return [];
  }
  const hops = lastHopRowsFor(result, ivanId, energisaId, latest);
  const giparId =
    hops.find((row) => /gipar/i.test(row.via_last_hop_label) && !/nova/i.test(row.via_last_hop_label))
      ?.via_last_hop_id ?? hops.find((row) => row.nested)?.parent_on_same_seed_id;
  const gipar = giparId ? findNodeTotal(result, giparId, energisaId, latest) : undefined;
  const lines: string[] = [];
  lines.push('## Worked example (person total = sum of last-hop groups)');
  lines.push(
    `${ivan.node_label} ${ivan.node_id} → ${ivan.listed_seed_label} ${ivan.listed_seed_id} on ${ivan.date}.`
  );
  lines.push(`V (Brasil Bolsa Balcão ${ivan.date}, ENGI3/ENGI4 × graph_edges quantities) = ${fmtReais(ivan.listed_value)} reais.`);
  lines.push('Direct hop is one group, not the whole total. Product through a holding, not 100% of the holding.');
  lines.push('');
  lines.push(
    table(
      ['via_last_hop', 'slice_capital_%', 'slice_votos_%', 'economic', 'control', 'nested'],
      hops.map((row) => [
        `${row.via_last_hop_label} (${row.via_last_hop_id})`,
        fmtPct(row.slice_capital),
        fmtPct(row.slice_votos),
        fmtReais(row.money_economic),
        fmtReais(row.money_control),
        row.nested ? `yes, via ${row.parent_on_same_seed_label}` : 'no (direct FRE line)',
      ])
    )
  );
  lines.push('');
  lines.push(
    `Person total (sum of last-hop groups): slice_capital ${fmtPct(ivan.slice_capital)}% / slice_votos ${fmtPct(ivan.slice_votos)}%.`
  );
  lines.push(
    `economic ${fmtReais(ivan.money_economic)} reais (${fmtBillions(ivan.money_economic)}); control ${fmtReais(ivan.money_control)} reais (${fmtBillions(ivan.money_control)}).`
  );
  lines.push('Control is voting-power reais, not cash.');
  if (gipar) {
    const nested = sumNodeTotalsIfNotNested(ivan, gipar);
    lines.push('');
    lines.push('## Nested, not additive');
    lines.push(
      `${gipar.node_label} holding total on the same seed: economic ${fmtReais(gipar.money_economic)} (${fmtBillions(gipar.money_economic)}); control ${fmtReais(gipar.money_control)} (${fmtBillions(gipar.money_control)}).`
    );
    if (!nested.ok) {
      lines.push(
        `Do not add ${gipar.node_label} ${fmtBillions(gipar.money_economic)} economic / ${fmtBillions(gipar.money_control)} control on top of ${ivan.node_label} ${fmtBillions(ivan.money_economic)} / ${fmtBillions(ivan.money_control)}. Those holding reais already contain the through-holding group.`
      );
      lines.push(`Helper sumNodeTotalsIfNotNested: REFUSED (${nested.reason})`);
    }
  }
  lines.push('');
  return lines;
}

export function formatMoneyReport(result: MoneyResult): string {
  const lines: string[] = [];
  lines.push('# Dinheiro sob controle (capital and votes)');
  lines.push('');
  lines.push(
    `nodes ${result.graph.node_count} | edges ${result.graph.edge_count} | listed seeds ${result.graph.listed_seed_count} | priced this run ${result.graph.priced_listed_seed_ids.length}`
  );
  lines.push(
    'Input: grafo-publico.json plus dated price rows. Counts are read from the file. Same command when the graph grows.'
  );
  lines.push(
    'Economic = V × capital_slice (claim on listed equity that date). Control = V × votes_slice (same reais as a unit for voting power; not cash).'
  );
  lines.push(
    'Person total on a listed seed = sum of last-hop groups. Direct hop is one group. Nested rows are marked; do not add them.'
  );
  lines.push(
    `Prices: ${B3_ARCHIVE_LABEL} ${DEFAULT_MONEY_DATE} (issue #123). Energisa uses ENGI3/ENGI4 × graph_edges quantities. Unit classes without a unit quantity are skipped. Claro is omitted.`
  );
  lines.push('');
  lines.push('## Wealth');
  lines.push(`Wealth REFUSED. ${result.wealth_rank.reason}`);
  lines.push('');
  lines.push('## Cannot measure');
  for (const item of result.cannot_measure) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Priced listed seeds this run');
  if (result.graph.priced_listed_seed_ids.length === 0) {
    lines.push('None. A listed seed needs a Brasil Bolsa Balcão quote and a quantity.');
  } else {
    const valueRows = result.listed_values.map((row) => [
      row.cnpj_basico,
      row.ticker ?? '',
      row.date,
      fmtReais(row.listed_value),
      row.class_produtos
        .map((item) => `${item.ticker ?? item.classe} ${fmtQty(item.quantidade)}×${item.preco.toFixed(2)}`)
        .join('; '),
      row.price_source_label,
    ]);
    lines.push(table(['cnpj_basico', 'ticker', 'date', 'V', 'class produtos', 'price source'], valueRows));
  }
  if (result.graph.unpriced_listed_seed_ids.length > 0) {
    lines.push('');
    lines.push(
      `Listed seeds without archive money this run: ${result.graph.unpriced_listed_seed_ids.length} (no B3 quote, no quantity, unit without unit qty, or Claro).`
    );
  }
  lines.push('');
  lines.push(...workedExample(result));
  lines.push('## Node totals (sum of last-hop groups per node × listed seed × date)');
  lines.push('Grain: node, listed_seed, date. Nested_via lists holdings already on the same seed.');
  const totalRows = result.node_totals.slice(0, 30).map((row) => [
    row.node_id,
    row.node_label,
    row.listed_seed_label,
    row.date,
    fmtPct(row.slice_capital),
    fmtPct(row.slice_votos),
    fmtReais(row.money_economic),
    fmtReais(row.money_control),
    String(row.last_hop_count),
    row.nested_via.join(',') || '',
  ]);
  lines.push(
    table(
      ['id', 'label', 'seed', 'date', 'cap_%', 'votos_%', 'economic', 'control', 'groups', 'nested_via'],
      totalRows
    )
  );
  lines.push('');
  return lines.join('\n');
}

export function assertSafeMoneyOutput(text: string): void {
  if (FORBIDDEN_OUTPUT.test(text)) {
    throw new Error('refusing to print a Forbes-style rank word');
  }
  if (outputContainsCpf(text)) {
    throw new Error('refusing to print Cadastro de Pessoas Físicas');
  }
}
