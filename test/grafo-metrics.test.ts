import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';
import {
  classifyNode,
  computeMetrics,
  formatReport,
  loadGraphFile,
  loadListedCompanyIds,
  outputContainsCpf,
  presentNumber,
  type MetricsGraph,
} from '../metrics/compute';

const ROOT = path.join(__dirname, '..');
const TINY_PATH = path.join(ROOT, 'metrics', 'fixtures', 'tiny-graph.json');
const LIVE_PATH = path.join(ROOT, 'public', 'grafo-publico.json');

function loadTiny(): MetricsGraph {
  return JSON.parse(fs.readFileSync(TINY_PATH, 'utf8'));
}

function loadLive(): MetricsGraph {
  return JSON.parse(fs.readFileSync(LIVE_PATH, 'utf8'));
}

function row<T extends { id: string }>(rows: T[], id: string): T {
  const found = rows.find((item) => item.id === id);
  expect(found, `expected row ${id}`).toBeDefined();
  return found as T;
}

describe('Grafo relevance metrics (issue #107)', () => {
  describe('tiny fixture: exact numbers', () => {
    const graph = loadTiny();
    const result = computeMetrics(graph);

    it('reads the fixture size from the file, not a frozen graph size', () => {
      expect(result.graph.node_count).toBe(graph.nodes.length);
      expect(result.graph.edge_count).toBe(graph.edges.length);
      expect(graph.nodes.length).toBeGreaterThan(8);
      expect(graph.nodes.length).toBeLessThan(20);
    });

    it('detects listed seeds from listed:true, not from today\'s live names', () => {
      expect(result.graph.listed_seed_ids.sort()).toEqual(['seed-alpha', 'seed-beta']);
      expect(result.typology.counts.listed_seed).toBe(2);
      expect(result.typology.counts.person).toBe(3);
      expect(result.typology.counts.tesouraria).toBe(1);
      expect(result.typology.counts.outros).toBe(1);
      expect(result.typology.counts.foreign).toBe(1);
      expect(result.typology.counts.state).toBe(1);
    });

    it('classifies person, tesouraria, outros, foreign x-, União, listed, company', () => {
      const listed = new Set(result.graph.listed_seed_ids);
      const byId = new Map(graph.nodes.map((node) => [node.id, node]));
      expect(classifyNode(byId.get('p-aaa11111')!, listed)).toBe('person');
      expect(classifyNode(byId.get('tesouraria-seed-al')!, listed)).toBe('tesouraria');
      expect(classifyNode(byId.get('outros-seed-al')!, listed)).toBe('outros');
      expect(classifyNode(byId.get('x-foreign-co')!, listed)).toBe('foreign');
      expect(classifyNode(byId.get('uniao-federal-1')!, listed)).toBe('state');
      expect(classifyNode(byId.get('seed-alpha')!, listed)).toBe('listed_seed');
      expect(classifyNode(byId.get('hold-1')!, listed)).toBe('company');
      expect(classifyNode(byId.get('hole-co')!, listed)).toBe('company');
    });

    it('counts out-degree and weighted out-degree only on cited percents', () => {
      const ana = row(result.out_degree, 'p-aaa11111');
      const bruno = row(result.out_degree, 'p-bbb22222');
      const carla = row(result.out_degree, 'p-ccc33333');
      const ctrl = row(result.out_degree, 'ctrl-one');
      const hole = row(result.out_degree, 'hole-co');

      expect(ana.out_degree).toBe(1);
      expect(ana.weighted_out_capital).toBe(40);
      expect(ana.weighted_out_votos).toBe(40);

      expect(bruno.out_degree).toBe(2);
      expect(bruno.weighted_out_capital).toBe(30);

      expect(carla.out_degree).toBe(1);
      expect(carla.weighted_out_capital).toBe(0);
      expect(carla.weighted_out_votos).toBe(0);

      expect(ctrl.out_degree).toBe(2);
      expect(ctrl.weighted_out_capital).toBe(10);
      expect(hole.out_degree).toBe(1);
      expect(hole.weighted_out_capital).toBe(10);
    });

    it('counts listed seeds reached on the directed control graph', () => {
      expect(row(result.out_degree, 'p-aaa11111').seeds_reached).toBe(1);
      expect(row(result.out_degree, 'p-aaa11111').seed_ids).toEqual(['seed-alpha']);
      expect(row(result.out_degree, 'p-bbb22222').seeds_reached).toBe(2);
      expect(row(result.out_degree, 'ctrl-one').seeds_reached).toBe(2);
      expect(row(result.out_degree, 'p-ccc33333').seeds_reached).toBe(1);
    });

    it('products cited percents on complete paths and leaves incomplete paths empty', () => {
      const anaAlpha = result.cited_slices.find(
        (item) => item.id === 'p-aaa11111' && item.seed_id === 'seed-alpha'
      );
      expect(anaAlpha).toBeDefined();
      expect(anaAlpha!.pct_capital).toBe(20);
      expect(anaAlpha!.pct_votos).toBe(20);
      expect(anaAlpha!.complete_path_count).toBe(1);
      expect(anaAlpha!.incomplete_path_count).toBe(0);

      const brunoAlpha = result.cited_slices.find(
        (item) => item.id === 'p-bbb22222' && item.seed_id === 'seed-alpha'
      );
      expect(brunoAlpha!.pct_capital).toBe(10);

      const carlaAlpha = result.cited_slices.find(
        (item) => item.id === 'p-ccc33333' && item.seed_id === 'seed-alpha'
      );
      expect(carlaAlpha).toBeDefined();
      expect(carlaAlpha!.complete_path_count).toBe(0);
      expect(carlaAlpha!.incomplete_path_count).toBe(1);
      expect(carlaAlpha!.pct_capital).toBeUndefined();
      expect(carlaAlpha!.pct_votos).toBeUndefined();
    });

    it('never equal-splits a hole: missing residual is the unpublished remainder', () => {
      const alpha = result.seed_capital.find((item) => item.seed_id === 'seed-alpha');
      const beta = result.seed_capital.find((item) => item.seed_id === 'seed-beta');
      expect(alpha).toBeDefined();
      expect(beta).toBeDefined();

      expect(alpha!.cited_incoming_capital).toBe(100);
      expect(alpha!.missing_residual).toBe(0);
      expect(alpha!.direct.brazilian_person).toBe(10);
      expect(alpha!.direct.brazilian_company).toBe(65);
      expect(alpha!.direct.tesouraria).toBe(5);
      expect(alpha!.direct.outros).toBe(20);
      expect(alpha!.direct.foreign).toBe(0);
      expect(alpha!.direct.state).toBe(0);
      expect(alpha!.direct.missing).toBe(0);

      expect(beta!.cited_incoming_capital).toBe(80);
      expect(beta!.missing_residual).toBe(20);
      expect(beta!.direct.brazilian_person).toBe(20);
      expect(beta!.direct.foreign).toBe(30);
      expect(beta!.direct.state).toBe(25);
      expect(beta!.direct.brazilian_company).toBe(5);
      expect(beta!.direct.missing).toBe(20);
      expect(beta!.direct.outros).toBe(0);

      expect(alpha!.complete_path.brazilian_person).toBe(30);
      expect(alpha!.complete_path.missing).toBe(30);
      expect(alpha!.complete_path.tesouraria).toBe(5);
      expect(alpha!.complete_path.outros).toBe(20);
      expect(alpha!.complete_path.brazilian_company).toBe(15);
      expect(alpha!.complete_path.unattributed).toBe(0);

      const carla = row(result.out_degree, 'p-ccc33333');
      expect(carla.weighted_out_capital).toBe(0);
      expect(alpha!.complete_path.brazilian_person).toBe(10 + 20);
      expect(alpha!.complete_path.brazilian_person).not.toBe(40);
    });

    it('lists only Bruno as a person on more than one seed path', () => {
      expect(result.people_on_more_than_one_seed_path).toHaveLength(1);
      expect(result.people_on_more_than_one_seed_path[0].id).toBe('p-bbb22222');
      expect(result.people_on_more_than_one_seed_path[0].seed_count).toBe(2);
    });

    it('defines power as seeds reached plus cited outgoing capital / 100 and refuses wealth', () => {
      const bruno = row(result.power_people, 'p-bbb22222');
      expect(bruno.power_score).toBe(2 + 30 / 100);
      expect(result.wealth_rank.refused).toBe(true);
      expect(result.wealth_rank.reason.toLowerCase()).toMatch(/cannot rank|recusa|não/);
      const report = formatReport(result);
      expect(report).toMatch(/REFUSED/);
      expect(report).not.toMatch(/fortuna\s*=/);
      expect(outputContainsCpf(report)).toBe(false);
    });

    it('keeps directed betweenness and drops articulation with a reason', () => {
      expect(row(result.betweenness, 'hold-1').directed_betweenness).toBeGreaterThan(0);
      expect(row(result.betweenness, 'hole-co').directed_betweenness).toBeGreaterThan(0);
      expect(row(result.betweenness, 'tesouraria-seed-al').directed_betweenness).toBe(0);
      expect(result.dropped_metrics.some((item) => item.metric === 'articulation_points')).toBe(
        true
      );
    });
  });

  describe('live public grafo-publico.json (structural, no frozen size)', () => {
    const graph = loadLive();
    const result = computeMetrics(graph);
    const listedFromRepo = loadListedCompanyIds(ROOT);
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    it('uses whatever node and edge counts the file has', () => {
      expect(result.graph.node_count).toBe(graph.nodes.length);
      expect(result.graph.edge_count).toBe(graph.edges.length);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('does not hardcode today\'s graph size in the metrics source', () => {
      const source = fs.readFileSync(path.join(ROOT, 'metrics', 'compute.ts'), 'utf8');
      const runner = fs.readFileSync(path.join(ROOT, 'metrics', 'run.ts'), 'utf8');
      const tests = fs.readFileSync(path.join(__filename), 'utf8');
      for (const text of [source, runner, tests]) {
        expect(text).not.toMatch(/\b111\b/);
        expect(text).not.toMatch(/\b130\b/);
        expect(text).not.toMatch(/\b403\b/);
        expect(text).not.toMatch(/\b492\b/);
      }
    });

    it('takes listed seeds from LISTED_COMPANY_IDS present in the file', () => {
      const expected = LISTED_COMPANY_IDS.filter((id) => nodeIds.has(id));
      expect(listedFromRepo).toEqual([...LISTED_COMPANY_IDS]);
      expect(result.graph.listed_seed_ids).toEqual(expected);
      expect(result.graph.listed_seed_count).toBe(expected.length);
      expect(expected.length).toBeGreaterThan(0);
    });

    it('classifies live prefixes without freezing company names', () => {
      const listed = new Set(result.graph.listed_seed_ids);
      const persons = graph.nodes.filter((node) => classifyNode(node, listed) === 'person');
      const tesouraria = graph.nodes.filter((node) => classifyNode(node, listed) === 'tesouraria');
      const outros = graph.nodes.filter((node) => classifyNode(node, listed) === 'outros');
      const foreign = graph.nodes.filter((node) => classifyNode(node, listed) === 'foreign');
      const state = graph.nodes.filter((node) => classifyNode(node, listed) === 'state');

      expect(persons.length).toBe(graph.nodes.filter((node) => node.kind === 'person').length);
      expect(persons.every((node) => /^p-[0-9a-f]{8}$/.test(node.id))).toBe(true);
      expect(tesouraria.every((node) => node.id.startsWith('tesouraria-'))).toBe(true);
      expect(outros.every((node) => node.id.startsWith('outros-'))).toBe(true);
      expect(foreign.every((node) => node.id.startsWith('x-'))).toBe(true);
      expect(state.every((node) => /uni[aã]o federal/i.test(node.label) || /^Estado de /i.test(node.label) || /Secretaria da Fazenda do Estado/i.test(node.label))).toBe(true);
      expect(result.typology.counts.person).toBe(persons.length);
      expect(result.typology.counts.tesouraria).toBe(tesouraria.length);
      expect(result.typology.counts.outros).toBe(outros.length);
      expect(result.typology.counts.foreign).toBe(foreign.length);
      expect(result.typology.counts.state).toBe(state.length);
      expect(result.typology.counts.listed_seed).toBe(result.graph.listed_seed_count);
    });

    it('keeps missing residual non-negative and never equal-splits hole edges', () => {
      for (const row of result.seed_capital) {
        expect(row.missing_residual, row.seed_id).toBeGreaterThanOrEqual(0);
        const cited = row.cited_incoming_capital;
        expect(row.missing_residual).toBeCloseTo(Math.max(0, 100 - cited), 10);
        const directSum = Object.values(row.direct).reduce((acc, value) => acc + value, 0);
        expect(directSum).toBeCloseTo(cited + row.missing_residual, 8);
      }

      const holeEdges = graph.edges.filter(
        (edge) => !presentNumber(edge.pct_capital) && !presentNumber(edge.pct_votos)
      );
      for (const edge of holeEdges) {
        const owner = result.out_degree.find((item) => item.id === edge.from);
        expect(owner, edge.from).toBeDefined();
        const citedOut = graph.edges.filter(
          (item) => item.from === edge.from && presentNumber(item.pct_capital)
        );
        const expectedWeight = citedOut.reduce((acc, item) => acc + (item.pct_capital as number), 0);
        expect(owner!.weighted_out_capital).toBeCloseTo(expectedWeight, 10);
      }
    });

    it('edges are owner from → owned to; hole edges stay without a percent', () => {
      const ids = new Set(graph.nodes.map((node) => node.id));
      for (const edge of graph.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      }
      const hole = graph.edges.filter((edge) => !presentNumber(edge.pct_capital));
      expect(hole.length).toBeGreaterThan(0);
      for (const edge of hole) {
        expect(presentNumber(edge.pct_votos)).toBe(false);
      }
    });

    it('prints no Cadastro de Pessoas Físicas and refuses a wealth rank', () => {
      const report = formatReport(result);
      expect(outputContainsCpf(report)).toBe(false);
      expect(report).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(result.wealth_rank.refused).toBe(true);
      for (const person of graph.nodes.filter((node) => node.kind === 'person')) {
        expect(person.id).toMatch(/^p-[0-9a-f]{8}$/);
      }
      const json = JSON.stringify(result);
      expect(outputContainsCpf(json)).toBe(false);
      expect(json).not.toMatch(/"wealth_rank":\s*\{[^}]*"refused":\s*false/);
    });

    it('does not invent percents on incomplete live paths', () => {
      for (const slice of result.cited_slices) {
        if (slice.complete_path_count === 0) {
          expect(slice.pct_capital).toBeUndefined();
          expect(slice.pct_votos).toBeUndefined();
        }
        if (slice.pct_capital !== undefined) {
          expect(slice.complete_path_count).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('CLI', () => {
    it('runs the documented command on the tiny fixture', () => {
      const output = execSync('npm run metrics -- metrics/fixtures/tiny-graph.json', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(output).toMatch(/nodes 12/);
      expect(output).toMatch(/REFUSED/);
      expect(output).toContain('p-bbb22222');
      expect(output).not.toMatch(/(?<![\d.])\d{11}(?![\d.])/);
    });

    it('refuses a wealth-rank flag', () => {
      try {
        execSync('npm run metrics -- metrics/fixtures/tiny-graph.json --wealth', {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        throw new Error('expected wealth flag to fail');
      } catch (error) {
        const err = error as { status?: number; stderr?: string; stdout?: string };
        expect(err.status).not.toBe(0);
        expect(`${err.stderr ?? ''}${err.stdout ?? ''}`).toMatch(/REFUSED/);
      }
    });
  });
});
