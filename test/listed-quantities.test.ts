import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildListedQuantityRows,
  PUBLIC_QTY_RELATIVE_PATH,
  type ListedQuantityRow,
} from '../src/lib/listed-quantities';
import {
  computeMoneyUnderControl,
  DEFAULT_QTY_RELATIVE_PATHS,
  loadGraphFile,
  loadQtyRows,
} from '../metrics/money';
import { outputContainsCpf } from '../metrics/compute';

const ROOT = path.join(__dirname, '..');
const LIVE_GRAPH_PATH = path.join(ROOT, 'public', 'grafo-publico.json');
const SIDECAR_PATH = path.join(ROOT, PUBLIC_QTY_RELATIVE_PATH);
const B3_PRICES = path.join(ROOT, 'transform', 'seeds', 'b3_listed_prices.csv');
const ENERGISA_ID = '00864214000106';
const ENERGISA_BASICO = '00864214';
const CLARO_ID = '07043628000113';
const CLARO_BASICO = '07043628';
const WEG_ID = '84429695000111';
const AMBEV_ID = '07526557000100';
const RAIZEN_ID = '33453598000123';
const MONEY_DATE = '2025-05-16';

type PublicGraph = {
  nodes: Array<{ id: string; kind: string }>;
  edges: Array<{ from: string; to: string }>;
};

function loadSidecarText(): string {
  return fs.readFileSync(SIDECAR_PATH, 'utf8');
}

function loadSidecarRows(): ListedQuantityRow[] {
  const parsed = JSON.parse(loadSidecarText()) as { rows?: ListedQuantityRow[] } | ListedQuantityRow[];
  return Array.isArray(parsed) ? parsed : (parsed.rows ?? []);
}

function rowsById(rows: ListedQuantityRow[], id: string): ListedQuantityRow[] {
  return rows.filter((row) => row.id === id || row.cnpj_basico === id.slice(0, 8));
}

function assertEnergisaGrain(rows: ListedQuantityRow[], incomingHopCount: number): void {
  const energisa = rowsById(rows, ENERGISA_ID);
  expect(incomingHopCount).toBeGreaterThan(2);
  expect(energisa).toHaveLength(2);
  expect(energisa).not.toHaveLength(incomingHopCount);
  const classes = energisa.map((row) => row.classe).sort();
  expect(classes).toEqual(['ordinaria', 'preferencial']);
  const ordinarias = energisa.find((row) => row.classe === 'ordinaria');
  const preferenciais = energisa.find((row) => row.classe === 'preferencial');
  expect(ordinarias?.quantidade).toBe(609526325);
  expect(ordinarias?.ticker).toBe('ENGI3');
  expect(preferenciais?.quantidade).toBe(89144004);
  expect(preferenciais?.ticker).toBe('ENGI4');
  expect(energisa.every((row) => row.id === ENERGISA_ID)).toBe(true);
  expect(energisa.every((row) => row.cnpj_basico === ENERGISA_BASICO)).toBe(true);
  expect(energisa.some((row) => row.classe === 'unit' || row.ticker === 'ENGI11')).toBe(false);
  for (const row of energisa) {
    const cited = `${row.source_doc} ${row.source_locator}`;
    expect(cited).toMatch(/Energisa IR 14 Aug(ust)? 2026/);
    expect(cited).toMatch(/table 6\.1/);
  }
}

function assertSharedLiterals(rows: ListedQuantityRow[], graph: PublicGraph): void {
  expect(rowsById(rows, CLARO_ID)).toHaveLength(0);
  expect(rows.some((row) => row.cnpj_basico === CLARO_BASICO)).toBe(false);
  expect(rows.some((row) => row.ticker === 'ENGI11' || row.classe === 'unit')).toBe(false);

  const weg = rowsById(rows, WEG_ID);
  expect(weg).toHaveLength(1);
  expect(weg[0].classe).toBe('ordinaria');
  expect(weg[0].quantidade).toBe(4197317998);
  expect(weg[0].id).toBe(WEG_ID);
  expect(weg[0].cnpj_basico).toBe('84429695');

  const ambev = rowsById(rows, AMBEV_ID);
  expect(ambev).toHaveLength(1);
  expect(ambev[0].classe).toBe('ordinaria');
  expect(ambev[0].quantidade).toBe(15761638756);
  expect(ambev[0].id).toBe(AMBEV_ID);

  const raizen = rowsById(rows, RAIZEN_ID);
  expect(raizen).toHaveLength(1);
  expect(raizen[0].classe).toBe('preferencial');
  expect(raizen[0].quantidade).toBe(1358936900);
  expect(raizen[0].ticker).toBe('RAIZ4');
  expect(raizen.some((row) => row.classe === 'ordinaria')).toBe(false);

  const companyIds = new Set(
    graph.nodes.filter((node) => node.kind === 'company').map((node) => node.id)
  );
  for (const row of rows) {
    expect(row.id).toMatch(/^\d{14}$/);
    expect(row.cnpj_basico).toMatch(/^\d{8}$/);
    expect(row.id.slice(0, 8)).toBe(row.cnpj_basico);
    expect(companyIds.has(row.id)).toBe(true);
    expect(row.classe === 'ordinaria' || row.classe === 'preferencial').toBe(true);
  }

  const issuers = new Set(rows.map((row) => row.cnpj_basico));
  expect(issuers.size).toBe(32);
  expect(issuers.has(ENERGISA_BASICO)).toBe(true);
}

describe('Public listed quantities sidecar (issue #129)', () => {
  const graph = JSON.parse(fs.readFileSync(LIVE_GRAPH_PATH, 'utf8')) as PublicGraph;
  const energisaIncoming = graph.edges.filter((edge) => edge.to === ENERGISA_ID).length;

  describe('helper from committed CSV + Energisa fixture + prices + public listed ids', () => {
    const rows = buildListedQuantityRows({ repoRoot: ROOT });

    it('emits Energisa hop qty once per class, not once per incoming hop', () => {
      assertEnergisaGrain(rows, energisaIncoming);
    });

    it('keeps WEG and Ambev, omits Claro and ENGI11, and uses priced-class grain for Raízen', () => {
      assertSharedLiterals(rows, graph);
    });
  });

  describe('committed public/grafo-quantidades.json', () => {
    it('exists next to grafo-publico.json', () => {
      expect(fs.existsSync(SIDECAR_PATH)).toBe(true);
    });

    it('matches the helper rows and the cited literals', () => {
      const helperRows = buildListedQuantityRows({ repoRoot: ROOT });
      const sidecarRows = loadSidecarRows();
      expect(sidecarRows).toEqual(helperRows);
      assertEnergisaGrain(sidecarRows, energisaIncoming);
      assertSharedLiterals(sidecarRows, graph);
    });

    it('does not rewrite grafo-publico.json node or edge counts', () => {
      expect(graph.nodes).toHaveLength(2189);
      expect(graph.edges).toHaveLength(2640);
    });

    it('has no fortuna, richest, UBO, dono, equal-split, or eleven-digit Cadastro', () => {
      const text = loadSidecarText();
      expect(text).not.toMatch(/fortuna/i);
      expect(text).not.toMatch(/richest/i);
      expect(text).not.toMatch(/UBO/i);
      expect(text).not.toMatch(/dono/i);
      expect(text).not.toMatch(/equal-split/i);
      expect(text).not.toMatch(/qty_unit/);
      // Share counts may be 11 digits (Ambev). Cadastro is an isolated 11-digit
      // person id, not a 14-digit listed id and not a quantidade field.
      const withoutIdsAndQty = text.replace(/\d{14}/g, '').replace(/"quantidade":\s*\d+/g, '');
      expect(withoutIdsAndQty).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(outputContainsCpf(withoutIdsAndQty)).toBe(false);
    });
  });

  describe('money loader reads the sidecar', () => {
    const graphFile = loadGraphFile(LIVE_GRAPH_PATH, ROOT);

    it('lists public/grafo-quantidades.json on DEFAULT_QTY_RELATIVE_PATHS', () => {
      const paths = DEFAULT_QTY_RELATIVE_PATHS.map((relative) => relative.replace(/\\/g, '/'));
      expect(paths).toContain(PUBLIC_QTY_RELATIVE_PATH);
    });

    it('loads Energisa ON/PN from the sidecar without a unit class', () => {
      const qty = loadQtyRows(SIDECAR_PATH, ROOT);
      const energisa = qty.find((row) => row.cnpj_basico === ENERGISA_BASICO);
      expect(energisa).toBeDefined();
      expect(energisa!.qty_ordinarias).toBe(609526325);
      expect(energisa!.qty_preferenciais).toBe(89144004);
      expect(energisa!.qty_unit).toBeUndefined();
      expect(qty.filter((row) => row.cnpj_basico === ENERGISA_BASICO)).toHaveLength(1);
      expect(qty.some((row) => row.cnpj_basico === CLARO_BASICO)).toBe(false);
    });

    it('prices Energisa V from sidecar qty only: 8200040462.25; skips ENGI11 and Claro', () => {
      const result = computeMoneyUnderControl(graphFile, {
        pricesPath: B3_PRICES,
        qtyPath: SIDECAR_PATH,
        date: MONEY_DATE,
        repoRoot: ROOT,
        cwd: ROOT,
      });
      const energisa = result.listed_values.find((row) => row.cnpj_basico === ENERGISA_BASICO);
      expect(energisa).toBeDefined();
      expect(energisa!.listed_value).toBeCloseTo(8200040462.25, 2);
      expect(energisa!.class_produtos.find((row) => row.ticker === 'ENGI3')?.quantidade).toBe(609526325);
      expect(energisa!.class_produtos.find((row) => row.ticker === 'ENGI4')?.quantidade).toBe(89144004);
      expect(energisa!.class_produtos.some((row) => row.ticker === 'ENGI11' || row.classe === 'unit')).toBe(
        false
      );
      expect(result.listed_values.some((row) => row.cnpj_basico === CLARO_BASICO)).toBe(false);
      expect(result.graph.priced_listed_seed_ids.some((id) => id.startsWith(CLARO_BASICO))).toBe(false);
    });
  });
});
