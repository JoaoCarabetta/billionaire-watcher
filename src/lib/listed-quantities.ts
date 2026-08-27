/**
 * Formulário share quantity at seed × class grain for the public graph.
 *
 * Issue #129: build public/grafo-quantidades.json from committed sources.
 * Hop qty (Energisa IR 14 Aug 2026 table 6.1) wins; else CVM FRE item 17.1 CSV.
 * Only ordinaria / preferencial classes that also have a Brasil Bolsa Balcão quote.
 * Once per seed per class — not per incoming holder hop. No unit / ENGI11 qty.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PUBLIC_QTY_RELATIVE_PATH = join('public', 'grafo-quantidades.json');
export const LISTED_QTY_CSV_RELATIVE = join('metrics', 'listed_capital_quantities.csv');
export const ENERGISA_EDGES_RELATIVE = join('transform', 'seeds', 'energisa_edges_fixture.csv');
export const B3_PRICES_RELATIVE = join('transform', 'seeds', 'b3_listed_prices.csv');
export const PUBLIC_GRAPH_RELATIVE = join('public', 'grafo-publico.json');
export const LISTED_IDS_RELATIVE = join('src', 'lib', 'grafo-panel.ts');

export type ListedQuantityClasse = 'ordinaria' | 'preferencial';

export type ListedQuantityRow = {
  id: string;
  cnpj_basico: string;
  ticker: string;
  classe: ListedQuantityClasse;
  quantidade: number;
  source_doc: string;
  source_locator: string;
};

export type ListedQuantitiesFile = {
  rows: ListedQuantityRow[];
};

type QtySource = {
  quantidade: number;
  source_doc: string;
  source_locator: string;
};

type PricedClass = {
  cnpj_basico: string;
  ticker: string;
  classe: ListedQuantityClasse;
};

type GraphNode = {
  id: string;
  kind: string;
};

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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

function parseCsv(text: string): Record<string, string>[] {
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

function loadCsv(repoRoot: string, relative: string): Record<string, string>[] {
  return parseCsv(readFileSync(join(repoRoot, relative), 'utf8'));
}

function normalizeBasico(value: string | undefined): string | undefined {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length >= 14) {
    return digits.slice(0, 8);
  }
  if (digits.length === 8) {
    return digits;
  }
  return undefined;
}

function asListedClass(classe: string | undefined): ListedQuantityClasse | undefined {
  const normalized = (classe ?? '').trim().toLowerCase();
  if (normalized === 'ordinaria' || normalized === 'ordinarias' || normalized === 'on') {
    return 'ordinaria';
  }
  if (normalized === 'preferencial' || normalized === 'preferenciais' || normalized === 'pn') {
    return 'preferencial';
  }
  return undefined;
}

function qtyKey(basico: string, classe: ListedQuantityClasse): string {
  return `${basico}\t${classe}`;
}

function loadListedCompanyIds(repoRoot: string): string[] {
  const text = readFileSync(join(repoRoot, LISTED_IDS_RELATIVE), 'utf8');
  const marker = 'export const LISTED_COMPANY_IDS';
  const start = text.indexOf(marker);
  if (start < 0) {
    return [];
  }
  const block = text.slice(start, text.indexOf(']', start) + 1);
  return [...block.matchAll(/'([0-9]{14})'/g)].map((match) => match[1]);
}

function loadPricedClasses(repoRoot: string): PricedClass[] {
  const seen = new Set<string>();
  const rows: PricedClass[] = [];
  for (const row of loadCsv(repoRoot, B3_PRICES_RELATIVE)) {
    const basico = normalizeBasico(row.cnpj_basico);
    const classe = asListedClass(row.classe);
    const ticker = (row.ticker ?? '').trim();
    if (!basico || !classe || !ticker) {
      continue;
    }
    const key = qtyKey(basico, classe);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({ cnpj_basico: basico, ticker, classe });
  }
  return rows;
}

function putClassQty(
  target: Map<string, QtySource>,
  basico: string,
  classe: ListedQuantityClasse,
  quantidade: number | undefined,
  source_doc: string,
  source_locator: string
): void {
  if (quantidade === undefined || quantidade === 0) {
    return;
  }
  target.set(qtyKey(basico, classe), { quantidade, source_doc, source_locator });
}

function loadCsvClassQty(repoRoot: string): Map<string, QtySource> {
  const qty = new Map<string, QtySource>();
  for (const row of loadCsv(repoRoot, LISTED_QTY_CSV_RELATIVE)) {
    const basico = normalizeBasico(row.cnpj_basico);
    if (!basico) {
      continue;
    }
    putClassQty(
      qty,
      basico,
      'ordinaria',
      parseOptionalNumber(row.qty_ordinarias),
      row.source_doc ?? '',
      row.source_locator ?? ''
    );
    putClassQty(
      qty,
      basico,
      'preferencial',
      parseOptionalNumber(row.qty_preferenciais),
      row.source_doc ?? '',
      row.source_locator ?? ''
    );
  }
  return qty;
}

function applyHopQty(repoRoot: string, qty: Map<string, QtySource>): void {
  for (const row of loadCsv(repoRoot, ENERGISA_EDGES_RELATIVE)) {
    const basico = normalizeBasico(row.to_id ?? row.cnpj_basico);
    if (!basico) {
      continue;
    }
    const source_doc = row.source_doc ?? '';
    const source_locator = row.source_locator ?? '';
    putClassQty(qty, basico, 'ordinaria', parseOptionalNumber(row.qty_ordinarias), source_doc, source_locator);
    putClassQty(
      qty,
      basico,
      'preferencial',
      parseOptionalNumber(row.qty_preferenciais),
      source_doc,
      source_locator
    );
  }
}

function loadGraphCompanyIds(repoRoot: string): Set<string> {
  const graph = JSON.parse(readFileSync(join(repoRoot, PUBLIC_GRAPH_RELATIVE), 'utf8')) as {
    nodes: GraphNode[];
  };
  return new Set(
    graph.nodes.filter((node) => node.kind === 'company' && /^\d{14}$/.test(node.id)).map((node) => node.id)
  );
}

function listedIdForBasico(
  basico: string,
  companyIds: Set<string>,
  listedIds: readonly string[]
): string | undefined {
  const fromList = listedIds.find((id) => id.slice(0, 8) === basico && companyIds.has(id));
  if (fromList) {
    return fromList;
  }
  for (const id of companyIds) {
    if (id.slice(0, 8) === basico) {
      return id;
    }
  }
  return undefined;
}

export function buildListedQuantityRows(options?: { repoRoot?: string }): ListedQuantityRow[] {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const qty = loadCsvClassQty(repoRoot);
  applyHopQty(repoRoot, qty);
  const companyIds = loadGraphCompanyIds(repoRoot);
  const listedIds = loadListedCompanyIds(repoRoot);
  const rows: ListedQuantityRow[] = [];

  for (const priced of loadPricedClasses(repoRoot)) {
    const source = qty.get(qtyKey(priced.cnpj_basico, priced.classe));
    if (!source) {
      continue;
    }
    const id = listedIdForBasico(priced.cnpj_basico, companyIds, listedIds);
    if (!id) {
      continue;
    }
    rows.push({
      id,
      cnpj_basico: priced.cnpj_basico,
      ticker: priced.ticker,
      classe: priced.classe,
      quantidade: source.quantidade,
      source_doc: source.source_doc,
      source_locator: source.source_locator,
    });
  }

  rows.sort(
    (a, b) => a.id.localeCompare(b.id) || a.classe.localeCompare(b.classe) || a.ticker.localeCompare(b.ticker)
  );
  return rows;
}

export function listedQuantitiesFile(options?: { repoRoot?: string }): ListedQuantitiesFile {
  return { rows: buildListedQuantityRows(options) };
}

export function writeListedQuantitiesSidecar(options?: { repoRoot?: string; outPath?: string }): string {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const outPath = options?.outPath ?? join(repoRoot, PUBLIC_QTY_RELATIVE_PATH);
  const payload = listedQuantitiesFile({ repoRoot });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return outPath;
}
