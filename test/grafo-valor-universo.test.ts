import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildCytoscapeElements } from '../src/lib/grafo-elements';
import { LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';
import { searchGrafoNodes } from '../src/lib/grafo-search';
import { lookupPersonMoney } from '../src/lib/grafo-money';
import { unionGrafo, hopTreeRootIds } from '../src/lib/union-grafo';
import type { GrafoData, GrafoEdge, GrafoNode } from '../src/lib/grafo-elements';

const ROOT = path.join(__dirname, '..');
const LIVE_GRAPH_PATH = path.join(ROOT, 'public', 'grafo-publico.json');
const HOP_GRAPH_PATH = path.join(ROOT, 'data', 'hops', 'valor-universo.json');
const MONEY_PATH = path.join(ROOT, 'public', 'grafo-dinheiro.json');
const GRAFO_PAGE_PATH = path.join(ROOT, 'src', 'pages', 'grafo.astro');
const PANEL_PATH = path.join(ROOT, 'src', 'lib', 'grafo-panel.ts');

/** The 33 listed seeds already live on origin/main before this draw. */
const LIVE_LISTED_COMPANY_IDS = [
  '00864214000106', // Energisa
  '07689002000189', // Embraer
  '33592510000154', // Vale
  '03220438000173', // Equatorial
  '34274233000102', // Vibra
  '07415333000120', // Simpar
  '01838723000127', // BRF
  '17155730000164', // Cemig
  '01083200000118', // Neoenergia
  '43776517000180', // Sabesp
  '06057223000171', // Assaí / Sendas
  '02916265000160', // JBS
  '33453598000123', // Raízen
  '07043628000113', // Claro
  '33611500000119', // Gerdau
  '50746577000115', // Cosan
  '06047087000139', // Rede D'Or
  '02558157000162', // Telefônica
  '61585865000151', // RD Saúde
  '42150391000170', // Braskem
  '47960950000121', // Magalu
  '33042730000104', // CSN
  '33256439000139', // Ultrapar
  '67620377000114', // Minerva
  '16404287000155', // Suzano
  '02429144000193', // CPFL
  '00001180000126', // Axia
  '16670085000155', // Localiza
  '33000167000101', // Petrobras
  '03853896000140', // Marfrig
  '24990777000109', // Mateus
  '84429695000111', // WEG
  '07526557000100', // Ambev
] as const;

const DEXCO_ID = '97837181000147';
const ITAUSA_ID = '61532644000115';
const VOTORANTIM_CIMENTOS_ID = '01637895000132';
const VOTORANTIM_SA_ID = '03407049000151';
const HELIO_SEIBEL_ID = 'p-fafd441b';
const SALO_SEIBEL_ID = 'p-05eceeb6';
const ALEX_SEIBEL_ID = 'p-e2f8ff07';
const CLOSED_SLUGS = ['folha', 'globo', 'havan', 'record'] as const;
const HOLE_IDS = [
  '21240146000184', // AgroGalaxy
  '00000208000100', // BRB
  '76535764000143', // Oi
  '33412081000196', // Refit
] as const;
const SKIP_SEVEN_ALREADY_ON_GRAPH = [
  '33592510000154', // Vale
  '17155730000164', // Cemig
  '02916265000160', // JBS
  '33611500000119', // Gerdau
  '50746577000115', // Cosan
  '33042730000104', // CSN
  '00001180000126', // Axia
] as const;
const GESTORA_IDS = [
  '11752203000150',
  '72116353000162',
  '41020034000125',
  '05395883000108',
  '33857830000199',
  '09267871000140',
  '14406534000127',
] as const;
const JOAQUIM_ID = 'p-da3e3836';
const EDUARDO_ID = 'p-e1365405';
const IVAN_ID = 'p-cdbc8c4e';
const MUFFATO_ID = 'p-faf6d605';
const WEG_ID = '84429695000111';
const AMBEV_ID = '07526557000100';
const ENERGISA_ID = '00864214000106';

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadCommittedGrafo(): GrafoData {
  return loadJson(LIVE_GRAPH_PATH) as GrafoData;
}

function loadHopGrafo(): GrafoData {
  return loadJson(HOP_GRAPH_PATH) as GrafoData;
}

function incoming(json: GrafoData, id: string): GrafoEdge[] {
  return json.edges.filter((edge) => edge.to === id);
}

function incomingCapital(json: GrafoData, id: string): number {
  return incoming(json, id).reduce((sum, edge) => sum + (edge.pct_capital || 0), 0);
}

function isTaggedListed(el: { data: { listed?: boolean | string; seed?: string } }): boolean {
  return el.data.listed === true || el.data.listed === 'true' || el.data.seed === 'listed';
}

function withoutFortunaDenial(text: string): string {
  return text.replace(/Não é uma fortuna\./g, '');
}

describe('unionGrafo helper (issue #145)', () => {
  it('keeps live nodes and edges, adds hop ids that are new, and live wins on collision', () => {
    const live: GrafoData = {
      nodes: [
        {
          id: 'seed-live',
          kind: 'company',
          label: 'Live Seed',
          partners: [{ nome: 'Kept Partner', qualificacao: '22', qualificacao_label: 'Sócio' }],
        },
        { id: 'p-aaaa1111', kind: 'person', label: 'Live Person' },
      ],
      edges: [
        {
          from: 'p-aaaa1111',
          to: 'seed-live',
          kind: 'person_owns',
          pct_capital: 100,
          pct_votos: 100,
          source: 'FRE Live 1',
        },
      ],
    };
    const hops: GrafoData = {
      nodes: [
        { id: 'seed-live', kind: 'company', label: 'Hop pretends to replace live' },
        { id: 'new-co', kind: 'company', label: 'New Co' },
        { id: 'p-bbbb2222', kind: 'person', label: 'Hop Person' },
      ],
      edges: [
        {
          from: 'p-aaaa1111',
          to: 'seed-live',
          kind: 'person_owns',
          pct_capital: 50,
          pct_votos: 50,
          source: 'FRE Hop should lose',
        },
        {
          from: 'p-bbbb2222',
          to: 'new-co',
          kind: 'person_owns',
          pct_capital: 100,
          pct_votos: 100,
          source: 'FRE New 2',
        },
      ],
    };

    const unioned = unionGrafo(live, hops);
    expect(unioned.nodes.map((node) => node.id)).toEqual([
      'seed-live',
      'p-aaaa1111',
      'new-co',
      'p-bbbb2222',
    ]);
    const liveSeed = unioned.nodes.find((node) => node.id === 'seed-live');
    expect(liveSeed?.label).toBe('Live Seed');
    expect(liveSeed?.partners).toEqual([
      { nome: 'Kept Partner', qualificacao: '22', qualificacao_label: 'Sócio' },
    ]);
    expect(unioned.edges).toHaveLength(2);
    expect(unioned.edges[0]).toEqual(live.edges[0]);
    expect(unioned.edges[1].from).toBe('p-bbbb2222');
  });
});

describe('Valor universo draw into public/grafo-publico.json (issue #145)', () => {
  const committed = loadCommittedGrafo();
  const hops = loadHopGrafo();
  const unioned = unionGrafo(committed, hops);
  const nodeById = new Map(committed.nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodeById.keys());

  it('public graph is the union of itself with data/hops/valor-universo.json (idempotent after draw)', () => {
    expect(committed.nodes.map((node) => node.id)).toEqual(unioned.nodes.map((node) => node.id));
    expect(committed.edges).toEqual(unioned.edges);
    for (const node of hops.nodes) {
      expect(nodeIds.has(node.id), `hop node ${node.id} must be on the public graph`).toBe(true);
    }
  });

  it('keeps all 33 live LISTED_COMPANY_IDS as company nodes with their live incoming hops', () => {
    expect(LIVE_LISTED_COMPANY_IDS).toHaveLength(33);
    for (const id of LIVE_LISTED_COMPANY_IDS) {
      const node = nodeById.get(id);
      expect(node, `live listed ${id} must still exist`).toBeDefined();
      expect(node!.kind).toBe('company');
      expect(LISTED_COMPANY_IDS, `must keep live listed id ${id}`).toContain(id);
      const capital = incomingCapital(committed, id);
      expect(capital, `live incoming hops to ${id} must stay in 99.5..100.5`).toBeGreaterThanOrEqual(99.5);
      expect(capital, `live incoming hops to ${id} must stay in 99.5..100.5`).toBeLessThanOrEqual(100.5);
    }

    expect(incoming(committed, ENERGISA_ID)).toHaveLength(22);
    expect(Math.round(incomingCapital(committed, ENERGISA_ID) * 1000) / 1000).toBe(99.999);
    expect(incoming(committed, WEG_ID)).toHaveLength(52);
    expect(Math.round(incomingCapital(committed, WEG_ID) * 1000) / 1000).toBe(100);
    expect(incoming(committed, AMBEV_ID)).toHaveLength(5);
    expect(Math.round(incomingCapital(committed, AMBEV_ID) * 1000) / 1000).toBe(99.999);
  });

  it('LISTED_COMPANY_IDS keeps the live 33 and adds hop-tree roots, not closed slugs or holes', () => {
    const roots = hopTreeRootIds(hops);
    expect(roots).toHaveLength(141);
    expect(roots).toContain(DEXCO_ID);
    expect(roots).toContain(ITAUSA_ID);
    for (const slug of CLOSED_SLUGS) {
      expect(roots).not.toContain(slug);
      expect(LISTED_COMPANY_IDS as readonly string[]).not.toContain(slug);
    }
    for (const holeId of HOLE_IDS) {
      expect(roots).not.toContain(holeId);
      expect(LISTED_COMPANY_IDS as readonly string[]).not.toContain(holeId);
    }

    expect(LISTED_COMPANY_IDS).toHaveLength(33 + roots.length);
    for (const id of LIVE_LISTED_COMPANY_IDS) {
      expect(LISTED_COMPANY_IDS).toContain(id);
    }
    for (const id of roots) {
      expect(LISTED_COMPANY_IDS).toContain(id);
    }

    const elements = buildCytoscapeElements(committed);
    const listedNodes = elements.filter((el) => el.data.source === undefined && isTaggedListed(el));
    expect(listedNodes.map((el) => el.data.id).sort()).toEqual([...LISTED_COMPANY_IDS].sort());
  });

  it('Dexco is a company node and is not nested under Votorantim as its id', () => {
    const dexco = nodeById.get(DEXCO_ID);
    expect(dexco, 'Dexco 97837181000147 must exist').toBeDefined();
    expect(dexco!.kind).toBe('company');
    expect(dexco!.label).toMatch(/DEXCO/i);
    expect(dexco!.id).not.toBe(VOTORANTIM_CIMENTOS_ID);
    expect(dexco!.id).not.toBe(VOTORANTIM_SA_ID);
    expect(incoming(committed, DEXCO_ID).some((edge) => edge.from === VOTORANTIM_CIMENTOS_ID)).toBe(
      false
    );
    expect(incoming(committed, DEXCO_ID).some((edge) => edge.from === VOTORANTIM_SA_ID)).toBe(false);
  });

  it('Itaúsa is present and at least one Seibel p- hop is cited', () => {
    const itausa = nodeById.get(ITAUSA_ID);
    expect(itausa, 'Itaúsa 61532644000115 must exist').toBeDefined();
    expect(itausa!.kind).toBe('company');
    const seibelIds = [HELIO_SEIBEL_ID, SALO_SEIBEL_ID, ALEX_SEIBEL_ID];
    for (const id of seibelIds) {
      const node = nodeById.get(id);
      if (node) {
        expect(node.kind).toBe('person');
      }
    }
    expect(seibelIds.some((id) => nodeIds.has(id))).toBe(true);
    const cited = committed.edges.some(
      (edge) => seibelIds.includes(edge.from) && (edge.to === ITAUSA_ID || edge.to === DEXCO_ID)
    );
    expect(cited, 'a Seibel p- hop must be cited toward Itaúsa or Dexco').toBe(true);
  });

  it('Folha/Globo/Havan/Record are company slugs with empty or absent partners and no Hang/Macedo/Frias dono', () => {
    for (const slug of CLOSED_SLUGS) {
      const node = nodeById.get(slug);
      expect(node, `${slug} must exist as a company node`).toBeDefined();
      expect(node!.kind).toBe('company');
      expect(node!.partners ?? []).toEqual([]);
      const related = committed.edges.filter((edge) => edge.from === slug || edge.to === slug);
      expect(related).toHaveLength(0);
    }
    const donoNames = committed.nodes.filter(
      (node) =>
        node.kind === 'person' &&
        /^(hang|edir macedo|jo[aã]o doria|frias|ot[aá]vio frias)\b/i.test(node.label)
    );
    expect(donoNames).toEqual([]);
    expect(committed.edges.some((edge) => /dono|UBO/i.test(edge.kind) || /dono|UBO/i.test(edge.source))).toBe(
      false
    );
  });

  it('AgroGalaxy, BRB, Oi, and Refit exist as company nodes', () => {
    expect(nodeById.get('21240146000184')?.kind).toBe('company');
    expect(nodeById.get('21240146000184')?.label).toMatch(/AgroGalaxy/i);
    expect(nodeById.get('00000208000100')?.kind).toBe('company');
    expect(nodeById.get('00000208000100')?.label).toMatch(/BRB/i);
    expect(nodeById.get('76535764000143')?.kind).toBe('company');
    expect(nodeById.get('76535764000143')?.label).toMatch(/Oi/i);
    expect(nodeById.get('33412081000196')?.kind).toBe('company');
    expect(nodeById.get('33412081000196')?.label).toMatch(/Refit/i);
  });

  it('does not invent Natura or Seabra person or company nodes', () => {
    const invented = committed.nodes.filter((node) => {
      const blob = `${node.id} ${node.label}`;
      if (/gas natural/i.test(blob)) {
        return false;
      }
      return /natura cosm|natura &co|\bseabra\b/i.test(blob);
    });
    expect(invented).toEqual([]);
  });

  it('does not duplicate Vale/JBS/Cemig/Gerdau/Cosan/CSN/Axia node ids', () => {
    const counts = new Map<string, number>();
    for (const node of committed.nodes) {
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
    }
    for (const id of SKIP_SEVEN_ALREADY_ON_GRAPH) {
      expect(counts.get(id), `${id} must appear once`).toBe(1);
    }
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
  });

  it('keeps #98 gestora partners and Joaquim / Eduardo person nodes', () => {
    const squadra = nodeById.get('09267871000140') as GrafoNode;
    expect(squadra.partners).toHaveLength(11);
    expect(squadra.partners?.some((partner) => partner.nome === 'GUILHERME MEXIAS ACHE')).toBe(true);
    expect(nodeById.get(JOAQUIM_ID)?.kind).toBe('person');
    expect(nodeById.get(EDUARDO_ID)?.kind).toBe('person');
    for (const id of GESTORA_IDS) {
      expect(nodeById.get(id)?.kind).toBe('company');
    }
  });

  it('keeps tesouraria/outros as company nodes; a person node only when the hop file already has that p- id', () => {
    const tesouraria = committed.nodes.filter((node) => node.id.startsWith('tesouraria-'));
    const outros = committed.nodes.filter((node) => node.id.startsWith('outros-'));
    expect(tesouraria.length).toBeGreaterThan(25);
    expect(outros.length).toBeGreaterThan(0);
    for (const node of [...tesouraria, ...outros]) {
      expect(node.kind, `${node.id} stays company`).toBe('company');
    }
    const hopPersonIds = new Set(
      hops.nodes.filter((node) => node.kind === 'person').map((node) => node.id)
    );
    const newPersons = committed.nodes.filter(
      (node) =>
        node.kind === 'person' &&
        node.id !== JOAQUIM_ID &&
        node.id !== EDUARDO_ID &&
        node.id !== IVAN_ID &&
        node.id !== MUFFATO_ID
    );
    for (const node of newPersons) {
      if (!hopPersonIds.has(node.id)) {
        expect(node.id).toMatch(/^p-[0-9a-f]{8}$/);
      }
    }
  });

  it('searchGrafoNodes still finds ivan, weg, muffato', () => {
    expect(searchGrafoNodes(committed.nodes, 'ivan')).toContainEqual({
      id: IVAN_ID,
      label: 'IVAN MÜLLER BOTELHO',
      kind: 'person',
    });
    expect(searchGrafoNodes(committed.nodes, 'weg')).toContainEqual({
      id: WEG_ID,
      label: 'WEG S.A.',
      kind: 'company',
    });
    expect(searchGrafoNodes(committed.nodes, 'muffato')).toContainEqual({
      id: MUFFATO_ID,
      label: 'EVERTON MUFFATO',
      kind: 'person',
    });
    expect(nodeById.get(MUFFATO_ID)?.kind).toBe('person');
  });

  it('lookupPersonMoney Ivan totals are unchanged from grafo-dinheiro.json', () => {
    const money = loadJson(MONEY_PATH);
    const row = lookupPersonMoney(money, IVAN_ID);
    expect(row).not.toBeNull();
    expect(row!.money_economic).toBe(1300458655.36);
    expect(row!.money_control).toBe(2896272224.98);
    expect(row!.date).toBe('2025-05-16');
  });

  it('has zero eleven-digit Cadastro in grafo-publico.json', () => {
    const jsonText = fs.readFileSync(LIVE_GRAPH_PATH, 'utf-8');
    expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
  });

  it('grafo.astro / grafo-panel have no fortuna claim except the existing denial line', () => {
    const page = fs.readFileSync(GRAFO_PAGE_PATH, 'utf-8');
    const panel = fs.readFileSync(PANEL_PATH, 'utf-8');
    expect(withoutFortunaDenial(page)).not.toMatch(/fortuna/i);
    expect(withoutFortunaDenial(panel)).not.toMatch(/fortuna/i);
    expect(panel).toContain('Não é uma fortuna.');
    expect(page).toContain(`${committed.nodes.length} nós, ${committed.edges.length} arestas`);
  });

  it('does not invent /0001 suffixes or equal-split hops', () => {
    for (const node of committed.nodes) {
      expect(node.id).not.toMatch(/\/0001/);
    }
    expect(committed.edges.some((edge) => /equal-split/i.test(edge.kind) || /equal-split/i.test(edge.source))).toBe(
      false
    );
  });
});
