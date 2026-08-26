import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { MetricsEdge, MetricsGraph } from '../metrics/compute';
import {
  computeMoneyUnderControl,
  findNodeTotal,
  formatMoneyReport,
  lastHopRowsFor,
  listedValuesFromPrices,
  loadGraphFile,
  loadPriceRows,
  loadQtyRowsFromEdgesFixture,
  outputContainsCpf,
  partitionPriceRows,
  sumNodeTotalsIfNotNested,
} from '../metrics/money';

const ROOT = path.join(__dirname, '..');
const TINY_GRAPH = path.join(ROOT, 'metrics', 'fixtures', 'tiny-money-graph.json');
const TINY_PRICES = path.join(ROOT, 'metrics', 'fixtures', 'tiny-money-prices.csv');
const LIVE_PATH = path.join(ROOT, 'public', 'grafo-publico.json');
const LISTED_PRICES = path.join(ROOT, 'transform', 'seeds', 'listed_prices_fixture.csv');
const ENERGISA_QTY = path.join(ROOT, 'transform', 'seeds', 'energisa_edges_fixture.csv');

const ALPHA = '12345678000100';
const BETA = '87654321000100';
const IVAN = 'p-cdbc8c4e';
const ENERGISA = '00864214000106';

function loadTiny(): MetricsGraph {
  return JSON.parse(fs.readFileSync(TINY_GRAPH, 'utf8'));
}

function tinyResult() {
  return computeMoneyUnderControl(loadTiny(), {
    pricesPath: TINY_PRICES,
    allowNonArchivePrices: true,
    repoRoot: ROOT,
  });
}

function rowTotal(
  result: ReturnType<typeof computeMoneyUnderControl>,
  nodeId: string,
  seedId = ALPHA,
  date = '2026-08-21'
) {
  const found = result.node_totals.find(
    (item) => item.node_id === nodeId && item.listed_seed_id === seedId && item.date === date
  );
  return found;
}

function edgeBetween(graph: MetricsGraph, from: string, to: string): MetricsEdge {
  const found = graph.edges.find((edge) => edge.from === from && edge.to === to);
  expect(found, `expected edge ${from} → ${to}`).toBeDefined();
  return found as MetricsEdge;
}

function nodeByLabel(graph: MetricsGraph, pattern: RegExp): { id: string; label: string } {
  const found = graph.nodes.find((node) => pattern.test(node.label));
  expect(found, `expected node matching ${pattern}`).toBeDefined();
  return found as { id: string; label: string };
}

describe('Dinheiro sob controle (issue #116)', () => {
  describe('tiny fixture', () => {
    const result = tinyResult();
    const V = 10 * 100 + 5 * 20;

    it('products a two-hop cited path times dated listed value in both columns', () => {
      expect(V).toBe(1100);
      const ana = rowTotal(result, 'p-aaa11111');
      expect(ana).toBeDefined();
      expect(ana!.slice_capital).toBeCloseTo(20, 10);
      expect(ana!.slice_votos).toBeCloseTo(12.5, 10);
      expect(ana!.money_economic).toBeCloseTo(220, 2);
      expect(ana!.money_control).toBeCloseTo(137.5, 2);
      expect(ana!.last_hop_count).toBe(1);
    });

    it('yields no money when a hop on the path is a hole', () => {
      expect(rowTotal(result, 'p-ccc33333')).toBeUndefined();
      expect(
        result.last_hop_rows.some((row) => row.node_id === 'p-ccc33333' && !row.refused)
      ).toBe(false);
    });

    it('yields no money for Outros and tesouraria', () => {
      expect(rowTotal(result, 'outros-alpha')).toBeUndefined();
      expect(rowTotal(result, 'tesouraria-alpha')).toBeUndefined();
      expect(result.last_hop_rows.some((row) => row.node_id.startsWith('outros-'))).toBe(false);
      expect(result.last_hop_rows.some((row) => row.node_id.startsWith('tesouraria-'))).toBe(false);
    });

    it('treats person + holding on the same seed as nested, not a published sum', () => {
      const bruno = rowTotal(result, 'p-bbb22222');
      const hold = rowTotal(result, 'hold-1');
      expect(bruno).toBeDefined();
      expect(hold).toBeDefined();
      expect(bruno!.slice_capital).toBeCloseTo(35, 10);
      expect(bruno!.slice_votos).toBeCloseTo(22.5, 10);
      expect(hold!.slice_capital).toBeCloseTo(50, 10);
      expect(hold!.slice_votos).toBeCloseTo(25, 10);

      const viaHold = result.last_hop_rows.find(
        (row) => row.node_id === 'p-bbb22222' && row.via_last_hop_id === 'hold-1'
      );
      expect(viaHold?.nested).toBe(true);
      expect(viaHold?.parent_on_same_seed_id).toBe('hold-1');

      const summed = sumNodeTotalsIfNotNested(bruno!, hold!);
      expect(summed.ok).toBe(false);
      if (!summed.ok) {
        expect(summed.nested).toBe(true);
      }
    });

    it('skips a recorded fixture quote even when the tiny graph has that listed seed', () => {
      expect(rowTotal(result, 'p-bbb22222', BETA)).toBeUndefined();
      expect(result.node_totals.some((row) => row.listed_seed_id === BETA)).toBe(false);
      expect(result.skipped_fixture_quotes.some((row) => row.cnpj_basico === '87654321')).toBe(true);
    });

    it('report string has no fortuna, no richest, no Cadastro, and Wealth REFUSED', () => {
      const report = formatMoneyReport(result);
      expect(report).not.toMatch(/fortuna/i);
      expect(report).not.toMatch(/richest/i);
      expect(report).toMatch(/Wealth REFUSED/);
      expect(outputContainsCpf(report)).toBe(false);
      expect(report).toMatch(/issue 123/);
      expect(report).not.toMatch(/until issue 115/);
    });
  });

  describe('live Energisa from file + fixture (not frozen graph size)', () => {
    const graph = loadGraphFile(LIVE_PATH, ROOT);
    const result = computeMoneyUnderControl(graph, {
      pricesPath: LISTED_PRICES,
      qtyPath: ENERGISA_QTY,
      date: '2026-08-21',
      repoRoot: ROOT,
      cwd: ROOT,
    });

    it('uses whatever node and edge counts the file has', () => {
      expect(result.graph.node_count).toBe(graph.nodes.length);
      expect(result.graph.edge_count).toBe(graph.edges.length);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('does not hardcode graph size in the money source', () => {
      const source = fs.readFileSync(path.join(ROOT, 'metrics', 'money.ts'), 'utf8');
      const runner = fs.readFileSync(path.join(ROOT, 'metrics', 'money-run.ts'), 'utf8');
      const tests = fs.readFileSync(__filename, 'utf8');
      for (const text of [source, runner, tests]) {
        expect(text).not.toMatch(/\b111\b/);
        expect(text).not.toMatch(/\b130\b/);
        expect(text).not.toMatch(/\b403\b/);
        expect(text).not.toMatch(/\b492\b/);
      }
    });

    it('prints archive money only for Energisa, not recorded fixture quotes', () => {
      expect(result.graph.priced_listed_seed_ids).toEqual([ENERGISA]);
      expect(result.node_totals.every((row) => row.listed_seed_id === ENERGISA)).toBe(true);
      expect(result.last_hop_rows.every((row) => row.listed_seed_id === ENERGISA)).toBe(true);

      const vale = graph.nodes.find((node) => /^VALE/i.test(node.label));
      const weg = graph.nodes.find((node) => /WEG/i.test(node.label) && node.kind === 'company');
      const ambev = graph.nodes.find((node) => /AMBEV/i.test(node.label));
      for (const node of [vale, weg, ambev]) {
        if (!node) {
          continue;
        }
        expect(result.node_totals.some((row) => row.listed_seed_id === node.id)).toBe(false);
      }
      expect(result.skipped_fixture_quotes.length).toBeGreaterThan(0);
      expect(result.skipped_fixture_quotes.every((row) => /recorded fixture quote/i.test(row.source))).toBe(
        true
      );
      const report = formatMoneyReport(result);
      expect(report).toMatch(/Recorded fixture quote/);
      expect(report).toMatch(/skipped/i);
      expect(report).not.toMatch(/VALE3[^\n]*[0-9]+\.[0-9]{2} reais/);
    });

    it('sums Ivan last-hop groups as the person total (product through Gipar, not 100%)', () => {
      const ivanNode = graph.nodes.find((node) => node.id === IVAN);
      expect(ivanNode).toBeDefined();
      const gipar = nodeByLabel(graph, /^Gipar S\.A\.$/i);
      const nova = nodeByLabel(graph, /Nova Gipar/i);
      const multi = nodeByLabel(graph, /MULTISETOR/i);
      const itacatu = nodeByLabel(graph, /Itacatu/i);

      const direct = edgeBetween(graph, IVAN, ENERGISA);
      const ivanMulti = edgeBetween(graph, IVAN, multi.id);
      const multiEnergisa = edgeBetween(graph, multi.id, ENERGISA);
      const itacatuEnergisa = edgeBetween(graph, itacatu.id, ENERGISA);
      const multiItacatu = edgeBetween(graph, multi.id, itacatu.id);
      const multiNova = edgeBetween(graph, multi.id, nova.id);
      const itacatuNova = edgeBetween(graph, itacatu.id, nova.id);
      const novaGipar = edgeBetween(graph, nova.id, gipar.id);
      const giparEnergisa = edgeBetween(graph, gipar.id, ENERGISA);

      const viaSelfCap = direct.pct_capital as number;
      const viaSelfVot = direct.pct_votos as number;
      const viaMultiCap = ((ivanMulti.pct_capital as number) * (multiEnergisa.pct_capital as number)) / 100;
      const viaMultiVot = ((ivanMulti.pct_votos as number) * (multiEnergisa.pct_votos as number)) / 100;
      const ivanOfItacatuCap =
        ((ivanMulti.pct_capital as number) * (multiItacatu.pct_capital as number)) / 100;
      const ivanOfItacatuVot = ((ivanMulti.pct_votos as number) * (multiItacatu.pct_votos as number)) / 100;
      const viaItacatuCap = (ivanOfItacatuCap * (itacatuEnergisa.pct_capital as number)) / 100;
      const viaItacatuVot = (ivanOfItacatuVot * (itacatuEnergisa.pct_votos as number)) / 100;
      const ivanOfNovaCap =
        ((ivanMulti.pct_capital as number) * (multiNova.pct_capital as number)) / 100 +
        (ivanOfItacatuCap * (itacatuNova.pct_capital as number)) / 100;
      const ivanOfNovaVot =
        ((ivanMulti.pct_votos as number) * (multiNova.pct_votos as number)) / 100 +
        (ivanOfItacatuVot * (itacatuNova.pct_votos as number)) / 100;
      const ivanOfGiparCap = (ivanOfNovaCap * (novaGipar.pct_capital as number)) / 100;
      const ivanOfGiparVot = (ivanOfNovaVot * (novaGipar.pct_votos as number)) / 100;
      const viaGiparCap = (ivanOfGiparCap * (giparEnergisa.pct_capital as number)) / 100;
      const viaGiparVot = (ivanOfGiparVot * (giparEnergisa.pct_votos as number)) / 100;

      const expectedCap = viaSelfCap + viaMultiCap + viaItacatuCap + viaGiparCap;
      const expectedVot = viaSelfVot + viaMultiVot + viaItacatuVot + viaGiparVot;

      const hops = lastHopRowsFor(result, IVAN, ENERGISA, '2026-08-21');
      const self = hops.find((row) => row.via_last_hop_id === IVAN);
      const viaM = hops.find((row) => row.via_last_hop_id === multi.id);
      const viaI = hops.find((row) => row.via_last_hop_id === itacatu.id);
      const viaG = hops.find((row) => row.via_last_hop_id === gipar.id);
      expect(self?.slice_capital).toBeCloseTo(viaSelfCap, 6);
      expect(self?.slice_votos).toBeCloseTo(viaSelfVot, 6);
      expect(viaM?.slice_capital).toBeCloseTo(viaMultiCap, 6);
      expect(viaM?.slice_votos).toBeCloseTo(viaMultiVot, 6);
      expect(viaI?.slice_capital).toBeCloseTo(viaItacatuCap, 6);
      expect(viaI?.slice_votos).toBeCloseTo(viaItacatuVot, 6);
      expect(viaG?.slice_capital).toBeCloseTo(viaGiparCap, 6);
      expect(viaG?.slice_votos).toBeCloseTo(viaGiparVot, 6);

      const ivan = findNodeTotal(result, IVAN, ENERGISA, '2026-08-21');
      expect(ivan).toBeDefined();
      expect(ivan!.last_hop_count).toBe(hops.length);
      expect(ivan!.slice_capital).toBeCloseTo(expectedCap, 6);
      expect(ivan!.slice_votos).toBeCloseTo(expectedVot, 6);
      expect(ivan!.slice_capital).toBeCloseTo(
        hops.reduce((acc, row) => acc + row.slice_capital, 0),
        10
      );

      expect(ivan!.slice_votos).not.toBeCloseTo(giparEnergisa.pct_votos as number, 3);
      expect(ivanOfGiparVot).toBeLessThan(100);
      expect(ivan!.slice_votos / (giparEnergisa.pct_votos as number)).toBeCloseTo(
        ivanOfGiparVot / 100,
        5
      );

      const prices = loadPriceRows(LISTED_PRICES, ROOT);
      const qty = loadQtyRowsFromEdgesFixture(ENERGISA_QTY, ROOT);
      const values = listedValuesFromPrices(
        prices.filter((row) => row.cnpj_basico === '00864214' && row.preco_date === '2026-08-21'),
        qty
      );
      expect(values).toHaveLength(1);
      expect(values[0].listed_value).toBeCloseTo(31727935941.15, 2);
      expect(ivan!.listed_value).toBeCloseTo(values[0].listed_value, 2);
      expect(ivan!.money_economic).toBeCloseTo((values[0].listed_value * expectedCap) / 100, 2);
      expect(ivan!.money_control).toBeCloseTo((values[0].listed_value * expectedVot) / 100, 2);
      expect(ivan!.slice_votos).toBeCloseTo(35.32, 1);
      expect(ivan!.money_control / ivan!.listed_value).toBeCloseTo(0.3532, 3);
      expect(ivan!.money_control / ivan!.listed_value).not.toBeCloseTo(
        (giparEnergisa.pct_votos as number) / 100,
        3
      );

      const giparTotal = findNodeTotal(result, gipar.id, ENERGISA, '2026-08-21');
      expect(giparTotal).toBeDefined();
      const nested = sumNodeTotalsIfNotNested(ivan!, giparTotal!);
      expect(nested.ok).toBe(false);
      if (!nested.ok) {
        expect(nested.nested).toBe(true);
      }
    });
  });

  describe('price gate', () => {
    it('keeps Brasil Bolsa Balcão Energisa and skips recorded fixture quotes', () => {
      const prices = loadPriceRows(LISTED_PRICES, ROOT);
      const { archive, skipped } = partitionPriceRows(prices);
      expect(archive.every((row) => row.cnpj_basico === '00864214')).toBe(true);
      expect(archive.every((row) => /brasil bolsa balc/i.test(row.source ?? ''))).toBe(true);
      expect(skipped.length).toBeGreaterThan(0);
      expect(skipped.some((row) => row.ticker === 'VALE3')).toBe(true);
      expect(skipped.some((row) => row.ticker === 'WEGE3')).toBe(true);
      expect(skipped.some((row) => row.ticker === 'ABEV3')).toBe(true);
    });
  });

  describe('CLI', () => {
    it('runs the documented command and prints Ivan person total on Energisa', () => {
      const output = execSync('npm run money -- public/grafo-publico.json --date 2026-08-21', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(output).toMatch(/Wealth REFUSED/);
      expect(output).toMatch(/p-cdbc8c4e/);
      expect(output).toMatch(/Person total/);
      expect(output).toMatch(/issue 123/);
      expect(output).not.toMatch(/fortuna/i);
      expect(output).not.toMatch(/(?<![\d.])\d{11}(?![\d.])/);
    });

    it('refuses a wealth-rank flag', () => {
      try {
        execSync('npm run money -- public/grafo-publico.json --wealth', {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        throw new Error('expected wealth flag to fail');
      } catch (error) {
        const err = error as { status?: number; stderr?: string; stdout?: string };
        expect(err.status).not.toBe(0);
        expect(`${err.stderr ?? ''}${err.stdout ?? ''}`).toMatch(/Wealth REFUSED/);
      }
    });
  });
});
