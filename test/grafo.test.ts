import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildCytoscapeElements } from '../src/lib/grafo-elements';
import { buildPanelView, LISTED_COMPANY_IDS, renderPanelHtml } from '../src/lib/grafo-panel';

/** Issue #130: the panel may deny fortune (`Não é uma fortuna.`). Still fail on fortuna-as-claim. */
function withoutFortunaDenial(text: string): string {
  return text.replace(/Não é uma fortuna\./g, '');
}

describe('Grafo Page (issue #74)', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    distPath = path.join(__dirname, '..', 'dist');
    
    // Build with old fixtures (for consistency with other tests)
    try {
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          ALLOW_OLD_FIXTURES: 'true'
        }
      });
    } catch (error: any) {
      buildFailed = true;
      buildError = error.message || String(error);
    }
  });

  describe('Test 1: Committed JSON validation', () => {
    it('should have grafo-publico.json in public/', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      expect(fs.existsSync(jsonPath), 'grafo-publico.json should exist in public/').toBe(true);
    });

    it('should have exactly 529 nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.nodes).toBeDefined();
      expect(json.nodes.length).toBe(529);
    });

    it('should have exactly 199 person nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      expect(personNodes.length).toBe(199);
    });

    it('should have exactly 670 edges', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.edges).toBeDefined();
      expect(json.edges.length).toBe(670);
    });

    it('should have the thirty-three listed company ids', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const nodeIds = new Set(json.nodes.map((n: { id: string }) => n.id));

      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      for (const id of LISTED_COMPANY_IDS) {
        expect(nodeIds.has(id), `listed company ${id} should be present`).toBe(true);
      }
    });

    it('should have all edges resolve to existing nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const nodeIds = new Set(json.nodes.map((n: any) => n.id));
      
      for (const edge of json.edges) {
        expect(
          nodeIds.has(edge.from),
          `Edge from "${edge.from}" should resolve to a node`
        ).toBe(true);
        expect(
          nodeIds.has(edge.to),
          `Edge to "${edge.to}" should resolve to a node`
        ).toBe(true);
      }
    });

    it('should have zero 11-digit CPF sequences in JSON', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      
      // Must not have exactly 11 consecutive digits (CPF) - not 14-digit CNPJ
      // Use negative lookahead/lookbehind to ensure 11 digits are not part of longer sequence
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
    });

    it('should have person ids matching p-{8 hex} pattern', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      
      for (const node of personNodes) {
        expect(
          node.id,
          `Person id "${node.id}" should match p-{8 hex} pattern`
        ).toMatch(/^p-[0-9a-f]{8}$/);
      }
    });

    it('should have unique person ids', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      const personIds = personNodes.map((n: any) => n.id);
      const uniqueIds = new Set(personIds);
      
      expect(uniqueIds.size).toBe(personIds.length);
    });

    it('should have unique person names', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      const personNames = personNodes.map((n: any) => n.label);
      const uniqueNames = new Set(personNames);
      
      expect(uniqueNames.size).toBe(personNames.length);
    });

    it('Maria do Carmo, Cíntia, and Mônica are three distinct nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      
      const mariaDoCarmo = personNodes.find((n: any) => n.label.includes('MARIA DO CARMO RIPPER KOS'));
      const cintia = personNodes.find((n: any) => n.label.includes('CINTIA ALZUGUIR BOTELHO'));
      const monica = personNodes.find((n: any) => n.label.includes('MONICA PEREZ BOTELHO'));
      
      expect(mariaDoCarmo).toBeDefined();
      expect(cintia).toBeDefined();
      expect(monica).toBeDefined();
      
      expect(mariaDoCarmo.id).not.toBe(cintia.id);
      expect(mariaDoCarmo.id).not.toBe(monica.id);
      expect(cintia.id).not.toBe(monica.id);
    });

    it('should have no ***NNN*** person ids', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      
      expect(jsonText).not.toContain('***');
    });

    it('should have no duplicate edge pairs', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const edgePairs = json.edges.map((e: any) => `${e.from}->${e.to}`);
      const uniquePairs = new Set(edgePairs);
      
      expect(uniquePairs.size).toBe(edgePairs.length);
    });
  });

  describe('Test (issue #93): nine vehicle QSA hole edges', () => {
    const MMS_ID = '08542030000131';
    const MULTISETOR_ID = '20286787000107';
    const JSP_ID = '32392209000134';
    const HOLE_COMPANIES = [
      { id: '61563585000142', label: 'MAMS INVESTMENTS LTDA' },
      { id: '02049012000136', label: 'AURORA TEXTIL LTDA' },
      { id: '23349343000161', label: 'MULTIAGRO AGROPECUARIA COMERCIO E INDUSTRIA LTDA' },
      { id: '07544616000172', label: 'RIBEIRA EMPREENDIMENTOS IMOBILIARIOS LTDA' },
      { id: '39513958000111', label: 'RIBEIRA VENDAS E INTERMEDIACAO IMOBILIARIA LTDA' },
      { id: '42601461000160', label: 'GREEN HOLDING LTDA' },
      { id: '43347650000110', label: 'RBRA 6 SPE EMPREENDIMENTO IMOBILIARIO LTDA' },
      { id: '45278506000103', label: 'RIBEIRA INCORPORACOES IMOBILIARIAS LTDA.' },
      { id: '58534632000115', label: 'BSIM PARTICIPACOES E HOLDING LTDA' },
    ] as const;
    const HOLE_EDGES = [
      { from: MMS_ID, to: '61563585000142' },
      { from: MULTISETOR_ID, to: '02049012000136' },
      { from: MULTISETOR_ID, to: '23349343000161' },
      { from: JSP_ID, to: '07544616000172' },
      { from: JSP_ID, to: '39513958000111' },
      { from: JSP_ID, to: '42601461000160' },
      { from: JSP_ID, to: '43347650000110' },
      { from: JSP_ID, to: '45278506000103' },
      { from: JSP_ID, to: '58534632000115' },
    ] as const;
    const FROZEN_PERSON_IDS = [
      'p-010e2551',
      'p-02f52298',
      'p-1282fcb3',
      'p-1348ab32',
      'p-134ca0da',
      'p-392bfe45',
      'p-3d9739a9',
      'p-40894d2d',
      'p-5438e9c8',
      'p-5a3a3ade',
      'p-5c6eb6c7',
      'p-73a733cc',
      'p-74cd4e86',
      'p-7636b07f',
      'p-7f3fc508',
      'p-7fc3be74',
      'p-831e3028',
      'p-848bf0ce',
      'p-887e054b',
      'p-8db5e3f1',
      'p-8f4b2205',
      'p-a382ee76',
      'p-a54160d7',
      'p-a64df172',
      'p-a8c1e5f9',
      'p-b7719454',
      'p-b9db9330',
      'p-cdbc8c4e',
      'p-dbf7401a',
      'p-ea4eb254',
      'p-f3c190ea',
      'p-f8603dda',
      'p-faf6d605',
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isNumericPercent(value: unknown): boolean {
      return typeof value === 'number' && Number.isFinite(value);
    }

    it('adds nine company nodes with the warehouse matriz ids and labels', () => {
      const json = loadCommittedGrafo();
      const companyNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'company');

      expect(json.nodes.length).toBe(529);
      expect(json.edges.length).toBe(670);
      expect(companyNodes.length).toBe(330);

      for (const company of HOLE_COMPANIES) {
        const node = json.nodes.find((n: { id: string }) => n.id === company.id);
        expect(node, `company ${company.id} should exist`).toBeDefined();
        expect(node.kind).toBe('company');
        expect(node.label).toBe(company.label);
      }
    });

    it('adds nine company_owns hole edges with no numeric percent', () => {
      const json = loadCommittedGrafo();

      for (const pair of HOLE_EDGES) {
        const edge = json.edges.find(
          (e: { from: string; to: string }) => e.from === pair.from && e.to === pair.to
        );
        expect(edge, `hole edge ${pair.from} → ${pair.to} should exist`).toBeDefined();
        expect(edge.kind).toBe('company_owns');
        expect(
          isNumericPercent(edge.pct_capital),
          `hole edge ${pair.from} → ${pair.to} must not have numeric pct_capital`
        ).toBe(false);
        expect(
          isNumericPercent(edge.pct_votos),
          `hole edge ${pair.from} → ${pair.to} must not have numeric pct_votos`
        ).toBe(false);
      }
    });

    it('names Receita or Quadro de Sócios on the nine hole edges', () => {
      const json = loadCommittedGrafo();

      for (const pair of HOLE_EDGES) {
        const edge = json.edges.find(
          (e: { from: string; to: string }) => e.from === pair.from && e.to === pair.to
        );
        expect(edge, `hole edge ${pair.from} → ${pair.to} should exist`).toBeDefined();
        expect(String(edge.source)).toMatch(/Receita|Quadro de S[oó]cios/);
        expect(String(edge.source)).toMatch(/2026-01-11/);
      }
    });

    it('keeps the original 33 person nodes, including GUSTAVO KOS BOTELH0', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'person');
      const personIds = new Set(personNodes.map((n: { id: string }) => n.id));

      expect(personNodes.length).toBe(199);
      for (const id of FROZEN_PERSON_IDS) {
        expect(personIds.has(id), `frozen person ${id} should remain`).toBe(true);
      }
      expect(
        personNodes.some((n: { label: string }) => n.label === 'GUSTAVO KOS BOTELH0')
      ).toBe(true);
    });

    it('page copy names 529 nodes and 670 edges', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('529 nós, 670 arestas');
      expect(page).not.toContain('527 nós, 668 arestas');
    });
  });

  describe('Test 2 (issue #80): Energisa incoming sums and hop correctness', () => {
    it('should have capital sum to Energisa between 99.999 and 100.001', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const energisaId = '00864214000106';
      const incomingEdges = json.edges.filter((e: any) => e.to === energisaId);
      
      const capitalSum = incomingEdges.reduce((sum: number, edge: any) => {
        return sum + (edge.pct_capital || 0);
      }, 0);
      const capitalRounded = Math.round(capitalSum * 1000) / 1000;
      
      expect(
        capitalRounded,
        `Capital sum to Energisa should be ~100, got ${capitalSum}`
      ).toBeGreaterThanOrEqual(99.999);
      expect(
        capitalSum,
        `Capital sum to Energisa should be ~100, got ${capitalSum}`
      ).toBeLessThanOrEqual(100.001);
    });

    it('should have votes sum to Energisa between 99.999 and 100.001', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const energisaId = '00864214000106';
      const incomingEdges = json.edges.filter((e: any) => e.to === energisaId);
      
      const votosSum = incomingEdges.reduce((sum: number, edge: any) => {
        return sum + (edge.pct_votos || 0);
      }, 0);
      const votosRounded = Math.round(votosSum * 1000) / 1000;
      
      expect(
        votosRounded,
        `Votes sum to Energisa should be ~100, got ${votosSum}`
      ).toBeGreaterThanOrEqual(99.999);
      expect(
        votosSum,
        `Votes sum to Energisa should be ~100, got ${votosSum}`
      ).toBeLessThanOrEqual(100.001);
    });

    it('Mônica Perez Botelho should point to MCLC with 52.004 capital, not to Energisa', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const monicaId = 'p-ea4eb254';
      const mclcId = '59206795000131';
      const energisaId = '00864214000106';
      
      const monicaToMclc = json.edges.find(
        (e: any) => e.from === monicaId && e.to === mclcId
      );
      
      expect(monicaToMclc, 'Mônica → MCLC edge should exist').toBeDefined();
      expect(monicaToMclc.pct_capital).toBe(52.004);
      
      const monicaToEnergisa52 = json.edges.find(
        (e: any) => e.from === monicaId && e.to === energisaId && e.pct_capital === 52.004
      );
      
      expect(
        monicaToEnergisa52,
        'Mônica should NOT have a 52.004% edge to Energisa directly'
      ).toBeUndefined();
    });

    it('Gipar should point to Energisa with 26.646 capital and 61.162 votes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const giparId = '02260956000158';
      const energisaId = '00864214000106';
      
      const giparToEnergisa = json.edges.find(
        (e: any) => e.from === giparId && e.to === energisaId
      );
      
      expect(giparToEnergisa, 'Gipar → Energisa edge should exist').toBeDefined();
      expect(giparToEnergisa.pct_capital).toBe(26.646);
      expect(giparToEnergisa.pct_votos).toBe(61.162);
    });

    it('Outros acionistas should be a leaf on Energisa (42.467 / 22.429) with no children', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const outrosId = 'outros-00864214';
      const energisaId = '00864214000106';
      
      const outrosToEnergisa = json.edges.find(
        (e: any) => e.from === outrosId && e.to === energisaId
      );
      
      expect(outrosToEnergisa, 'Outros acionistas → Energisa edge should exist').toBeDefined();
      expect(outrosToEnergisa.pct_capital).toBe(42.467);
      expect(outrosToEnergisa.pct_votos).toBe(22.429);
      
      const edgesFromOutros = json.edges.filter((e: any) => e.from === outrosId);
      expect(
        edgesFromOutros.length,
        'Outros acionistas should have exactly one outgoing edge (to Energisa)'
      ).toBe(1);
      
      const edgesToOutros = json.edges.filter((e: any) => e.to === outrosId);
      expect(
        edgesToOutros.length,
        'Outros acionistas should have no incoming edges (is a leaf)'
      ).toBe(0);
    });

    it('each listed company has incoming capital between 99.5 and 100.5', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      for (const listedId of LISTED_COMPANY_IDS) {
        const incoming = json.edges.filter((e: { to: string }) => e.to === listedId);
        const capitalSum = incoming.reduce(
          (sum: number, edge: { pct_capital?: number }) => sum + (edge.pct_capital || 0),
          0
        );
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeGreaterThanOrEqual(99.5);
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeLessThanOrEqual(100.5);
      }
    });
  });

  describe('Test 2: Static URL after build', () => {
    it('should have grafo-publico.json in dist/', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const distJsonPath = path.join(distPath, 'grafo-publico.json');
      expect(
        fs.existsSync(distJsonPath),
        'grafo-publico.json should exist in dist/ after build'
      ).toBe(true);
    });

    it('should match committed JSON in dist/', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const publicJsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const distJsonPath = path.join(distPath, 'grafo-publico.json');
      
      const publicJson = fs.readFileSync(publicJsonPath, 'utf-8');
      const distJson = fs.readFileSync(distJsonPath, 'utf-8');
      
      expect(distJson).toBe(publicJson);
    });
  });

  describe('Test 3: /grafo build output is 200-shaped', () => {
    it('should pass all edges with unique IDs to Cytoscape', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      // Use the SAME function that grafo.astro uses
      const elements = buildCytoscapeElements(json);
      
      // Extract edge elements
      const edges = elements.filter(el => el.data.source !== undefined);
      
      // Assert edge count equals JSON edge count
      expect(
        edges.length,
        `Edge count must equal json.edges.length. Got ${edges.length}, expected ${json.edges.length}`
      ).toBe(json.edges.length);
      
      // Assert all edge IDs are unique
      const edgeIds = edges.map(e => e.data.id);
      const uniqueEdgeIds = new Set(edgeIds);
      expect(
        uniqueEdgeIds.size,
        `Edge IDs must be unique. Got ${edgeIds.length} edges but only ${uniqueEdgeIds.size} unique IDs`
      ).toBe(json.edges.length);
      
      // Assert source/target are the JSON from/to
      edges.forEach((edge, index) => {
        const jsonEdge = json.edges[index];
        expect(
          edge.data.source,
          `Edge ${index} source should be ${jsonEdge.from}`
        ).toBe(jsonEdge.from);
        expect(
          edge.data.target,
          `Edge ${index} target should be ${jsonEdge.to}`
        ).toBe(jsonEdge.to);
      });
    });

    it('when edge has both pct_capital and pct_votos, label contains both numbers', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      // Find Gipar's Energisa edge in the JSON (has both capital and votes)
      const giparEdge = json.edges.find(
        (e: any) => e.from === '02260956000158' && e.to === '00864214000106'
      );
      
      expect(giparEdge).toBeDefined();
      expect(giparEdge.pct_capital).toBe(26.646);
      expect(giparEdge.pct_votos).toBe(61.162);
      
      // Build Cytoscape elements
      const elements = buildCytoscapeElements(json);
      const edges = elements.filter(el => el.data.source !== undefined);
      
      // Find Gipar's edge in Cytoscape elements
      const giparCytoscapeEdge = edges.find(
        (e: any) => e.data.source === '02260956000158' && e.data.target === '00864214000106'
      );
      
      expect(giparCytoscapeEdge).toBeDefined();
      expect(giparCytoscapeEdge!.data.label).toContain('26.646');
      expect(giparCytoscapeEdge!.data.label).toContain('61.162');
    });

    it('should have dist/grafo/index.html', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      expect(
        fs.existsSync(grafoHtmlPath),
        'dist/grafo/index.html should exist'
      ).toBe(true);
    });

    it('should have exactly one h1', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      const h1Matches = html.match(/<h1[^>]*>/g);
      expect(h1Matches).toBeTruthy();
      expect(h1Matches!.length).toBe(1);
    });

    it('should have a graph container', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      // Should have div#cy for the graph
      expect(html).toMatch(/id="cy"/);
    });

    it('should have script tag with Cytoscape', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      // Should have script tag (Astro bundles JS into separate file)
      expect(html).toMatch(/<script/);
      // Check that script is type="module" (bundled by Astro)
      expect(html).toMatch(/<script type="module"/);
    });

    it('should fetch /grafo-publico.json', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      // Should fetch the static JSON URL
      expect(html).toContain('/grafo-publico.json');
    });
  });

  describe('Test 4: CPF redaction in /grafo page', () => {
    it('should not have 11-digit CPF in /grafo HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      // Must not have 11 consecutive digits in the HTML itself
      // (The JSON is loaded client-side, so we check the JSON separately)
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        const bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
        expect(bodyText).not.toMatch(/\d{11}/);
      }
    });

    it('should not have formatted CPF in /grafo HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        const bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
        expect(bodyText).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });
  });

  describe('Test (issue #100): listed seed companies get a third color', () => {
    const GIPAR_ID = '02260956000158';
    const SQUADRA_ID = '09267871000140';
    const TESOURARIA_ENERGISA_ID = 'tesouraria-00864214';
    const MAMS_ID = '61563585000142';
    const HOLE_COMPANY_IDS = [
      '61563585000142',
      '02049012000136',
      '23349343000161',
      '07544616000172',
      '39513958000111',
      '42601461000160',
      '43347650000110',
      '45278506000103',
      '58534632000115',
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isTaggedListed(el: { data: { listed?: boolean | string; seed?: string } }): boolean {
      return el.data.listed === true || el.data.listed === 'true' || el.data.seed === 'listed';
    }

    it('built /grafo has a listed-company style rule', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const pageSource = fs.readFileSync(pagePath, 'utf-8');
      expect(
        pageSource,
        'grafo.astro must include a Cytoscape selector that mentions listed / seed / LISTED'
      ).toMatch(/selector:\s*(['"`]).{0,80}(listed|seed|LISTED)/);

      if (buildFailed) throw new Error(`Build failed: ${buildError}`);

      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
      const blobs = [html];
      for (const match of html.matchAll(/(?:src|href)="([^"]+\.js)"/g)) {
        const rel = match[1].replace(/^\//, '');
        const scriptPath = path.join(distPath, rel);
        if (fs.existsSync(scriptPath)) {
          blobs.push(fs.readFileSync(scriptPath, 'utf-8'));
        }
      }
      expect(
        blobs.some((text) => /listed|seed|LISTED/.test(text)),
        'dist/grafo/index.html or its scripts must mention listed / seed / LISTED'
      ).toBe(true);
    });

    it('buildCytoscapeElements tags exactly the thirty-three listed ids', () => {
      const json = loadCommittedGrafo();
      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const listedNodes = nodes.filter(isTaggedListed);
      const listedIds = listedNodes.map((el) => el.data.id).sort();

      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      expect(listedIds).toEqual([...LISTED_COMPANY_IDS].sort());

      for (const el of listedNodes) {
        expect(el.data.kind, `listed node ${el.data.id} must stay kind=company`).toBe('company');
      }

      const byId = new Map(nodes.map((el) => [el.data.id, el]));
      expect(isTaggedListed(byId.get(GIPAR_ID)!), 'Gipar must stay ordinary company color').toBe(false);
      expect(isTaggedListed(byId.get(SQUADRA_ID)!), 'Squadra must stay ordinary company color').toBe(false);
      expect(
        isTaggedListed(byId.get(TESOURARIA_ENERGISA_ID)!),
        'tesouraria-00864214 must stay ordinary company color'
      ).toBe(false);

      const tesouraria = nodes.filter((el) => el.data.id.startsWith('tesouraria-'));
      expect(tesouraria.length).toBeGreaterThan(0);
      for (const el of tesouraria) {
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }

      const mams = byId.get(MAMS_ID);
      if (mams) {
        expect(isTaggedListed(mams), 'MAMS 61563585000142 must stay ordinary company color').toBe(false);
      }
      for (const holeId of HOLE_COMPANY_IDS) {
        const hole = byId.get(holeId);
        if (!hole) continue;
        expect(isTaggedListed(hole), `hole company ${holeId} must not be tagged listed`).toBe(false);
      }
    });

    it('grafo.astro imports the mapper that uses LISTED_COMPANY_IDS and does not hardcode a second id list', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const mapperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-elements.ts');
      const pageSource = fs.readFileSync(pagePath, 'utf-8');
      const mapperSource = fs.readFileSync(mapperPath, 'utf-8');

      expect(
        mapperSource,
        'grafo-elements.ts must import LISTED_COMPANY_IDS from grafo-panel — do not copy the list'
      ).toMatch(/LISTED_COMPANY_IDS/);
      expect(
        mapperSource,
        'grafo-elements.ts must import from ./grafo-panel'
      ).toMatch(/from ['"]\.\/grafo-panel['"]/);

      const importsMapper =
        /from ['"]\.\.\/lib\/grafo-elements['"]/.test(pageSource) &&
        /buildCytoscapeElements/.test(pageSource);
      const importsListedIds =
        /LISTED_COMPANY_IDS/.test(pageSource) &&
        /from ['"]\.\.\/lib\/grafo-panel['"]/.test(pageSource);
      expect(
        importsMapper || importsListedIds,
        'grafo.astro must import LISTED_COMPANY_IDS or the mapper that already uses that list'
      ).toBe(true);

      for (const id of LISTED_COMPANY_IDS) {
        expect(
          pageSource,
          `grafo.astro must not hardcode listed id ${id}`
        ).not.toContain(id);
      }
    });

    it('new listed-color copy has no fortuna', () => {
      const files = [
        path.join(__dirname, '..', 'src', 'lib', 'grafo-elements.ts'),
        path.join(__dirname, '..', 'src', 'pages', 'grafo.astro'),
      ];
      for (const filePath of files) {
        const text = fs.readFileSync(filePath, 'utf-8');
        expect(text, `${filePath} must not mention fortuna`).not.toMatch(/fortuna/i);
      }
    });
  });

  describe('Test (issue #105): twenty Valor 50 listed trees', () => {
    const EXISTING_ELEVEN = [
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
    ] as const;
    const TWENTY_NEW_LISTED = [
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
    ] as const;
    const GIPAR_ID = '02260956000158';
    const MAMS_ID = '61563585000142';
    const UNIAO_IDS = ['00394460000141', '00394460040950'] as const;
    const HOLE_COMPANY_IDS = [
      '61563585000142',
      '02049012000136',
      '23349343000161',
      '07544616000172',
      '39513958000111',
      '42601461000160',
      '43347650000110',
      '45278506000103',
      '58534632000115',
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isTaggedListed(el: { data: { listed?: boolean | string; seed?: string } }): boolean {
      return el.data.listed === true || el.data.listed === 'true' || el.data.seed === 'listed';
    }

    it('has all twenty listed ids as company nodes', () => {
      const json = loadCommittedGrafo();
      for (const id of TWENTY_NEW_LISTED) {
        const node = json.nodes.find((n: { id: string }) => n.id === id);
        expect(node, `listed company ${id} should exist`).toBeDefined();
        expect(node.kind, `${id} must be kind=company`).toBe('company');
      }
    });

    it('has JBS from #103/#105', () => {
      const json = loadCommittedGrafo();
      const jbs = json.nodes.find((n: { id: string }) => n.id === '02916265000160');
      expect(jbs, 'JBS node 02916265000160 must exist').toBeDefined();
      expect(jbs.kind).toBe('company');
    });

    it('each of the thirty-one listed seeds has incoming capital in [99.5, 100.5]', () => {
      const json = loadCommittedGrafo();
      const listed = [...EXISTING_ELEVEN, ...TWENTY_NEW_LISTED];
      for (const listedId of listed) {
        const incoming = json.edges.filter((e: { to: string }) => e.to === listedId);
        const capitalSum = incoming.reduce(
          (sum: number, edge: { pct_capital?: number }) => sum + (edge.pct_capital || 0),
          0
        );
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeGreaterThanOrEqual(99.5);
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeLessThanOrEqual(100.5);
      }
    });

    it('LISTED_COMPANY_IDS has length 33 and tags exactly those ids as listed companies', () => {
      const json = loadCommittedGrafo();
      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      for (const id of EXISTING_ELEVEN) {
        expect(LISTED_COMPANY_IDS, `must keep existing listed id ${id}`).toContain(id);
      }
      for (const id of TWENTY_NEW_LISTED) {
        expect(LISTED_COMPANY_IDS, `must include new listed id ${id}`).toContain(id);
      }

      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const listedNodes = nodes.filter(isTaggedListed);
      expect(listedNodes.map((el) => el.data.id).sort()).toEqual([...LISTED_COMPANY_IDS].sort());
      for (const el of listedNodes) {
        expect(el.data.kind, `listed node ${el.data.id} must stay kind=company`).toBe('company');
      }
    });

    it('Gipar, tesouraria, hole companies, and x- slugs are not tagged listed', () => {
      const json = loadCommittedGrafo();
      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const byId = new Map(nodes.map((el) => [el.data.id, el]));

      expect(isTaggedListed(byId.get(GIPAR_ID)!), 'Gipar must stay ordinary company color').toBe(false);

      const tesouraria = nodes.filter((el) => el.data.id.startsWith('tesouraria-'));
      expect(tesouraria.length).toBeGreaterThan(0);
      for (const el of tesouraria) {
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }

      const mams = byId.get(MAMS_ID);
      expect(mams, 'MAMS 61563585000142 should be present').toBeDefined();
      expect(isTaggedListed(mams!), 'MAMS must stay ordinary company color').toBe(false);
      for (const holeId of HOLE_COMPANY_IDS) {
        const hole = byId.get(holeId);
        expect(hole, `hole company ${holeId} should exist`).toBeDefined();
        expect(isTaggedListed(hole!), `hole company ${holeId} must not be tagged listed`).toBe(false);
      }

      const xSlugs = nodes.filter((el) => el.data.id.startsWith('x-'));
      expect(xSlugs.length, 'foreign x- slugs should be on the page').toBeGreaterThan(0);
      for (const el of xSlugs) {
        expect(el.data.kind, `${el.data.id} stays kind=company`).toBe('company');
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }
    });

    it('União Federal nodes are companies, not persons', () => {
      const json = loadCommittedGrafo();
      const present = UNIAO_IDS.map((id) => json.nodes.find((n: { id: string }) => n.id === id)).filter(Boolean);
      expect(present.length, 'at least one União Federal node should be present').toBeGreaterThan(0);
      for (const node of present) {
        expect(node.kind, `${node.id} must be kind=company`).toBe('company');
        expect(node.kind).not.toBe('person');
      }
    });

    it('committed JSON has zero eleven-digit Cadastro', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(jsonText).not.toContain('***');
    });

    it('page copy matches the post-union node and edge counts and has no fortuna', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('529 nós, 670 arestas');
      expect(page).not.toMatch(/fortuna/i);
    });
  });

  describe('Test 5: Other pages unchanged (no extra JS)', () => {
    it('should not have script tags on home page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      // Home should NOT have script tags
      expect(html).not.toMatch(/<script/);
    });

    it('should not have script tags on metodologia page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const metodologiaPath = path.join(distPath, 'metodologia', 'index.html');
      const html = fs.readFileSync(metodologiaPath, 'utf-8');
      
      // Metodologia should NOT have script tags
      expect(html).not.toMatch(/<script/);
    });

    it('should not have script tags on doacoes page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const doacoesPath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(doacoesPath, 'utf-8');
      
      // Doacoes should NOT have script tags
      expect(html).not.toMatch(/<script/);
    });

    it('should not have executable script tags on pessoa pages', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const p1Path = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(p1Path, 'utf-8');
      
      // Pessoa pages should NOT have executable script tags
      // (JSON-LD structured data is OK: <script type="application/ld+json">)
      // Remove JSON-LD scripts before checking
      const htmlWithoutJsonLd = html.replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '');
      expect(htmlWithoutJsonLd).not.toMatch(/<script/);
    });
  });

  describe('Test 6 (issue #84): hop-fact side panel', () => {
    const GIPAR_ID = '02260956000158';
    const ENERGISA_ID = '00864214000106';
    const MONICA_ID = 'p-ea4eb254';
    const MCLC_ID = '59206795000131';
    const IVAN_ID = 'p-cdbc8c4e';
    const MULTISETOR_ID = '20286787000107';
    const ITACATU_ID = '23160658000166';
    const NOVA_GIPAR_ID = '16674735000130';
    const HOLE_PERSON_ID = 'p-hole0001';

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function panelCopySources(): Array<{ label: string; text: string }> {
      const helperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts');
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const sources = [
        { label: 'src/lib/grafo-panel.ts', text: fs.readFileSync(helperPath, 'utf-8') },
        { label: 'src/pages/grafo.astro', text: fs.readFileSync(pagePath, 'utf-8') },
      ];

      if (!buildFailed) {
        const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
        const html = fs.readFileSync(grafoHtmlPath, 'utf-8');
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
        const bodyWithoutScripts = (bodyMatch?.[1] ?? html).replace(
          /<script[\s\S]*?<\/script>/gi,
          ''
        );
        sources.push({ label: 'dist/grafo/index.html body', text: bodyWithoutScripts });
      }

      return sources;
    }

    it('dist/grafo/index.html includes a panel element', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);

      const grafoHtmlPath = path.join(distPath, 'grafo', 'index.html');
      const html = fs.readFileSync(grafoHtmlPath, 'utf-8');

      expect(
        html,
        'dist/grafo/index.html must include id="panel" so the click panel exists after build'
      ).toMatch(/id="panel"/);
    });

    it('panel copy has no fortuna, currency symbol, or price field', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);

      for (const { label, text } of panelCopySources()) {
        const withoutInterpolation = text.replace(/\$\{[^}]*\}/g, '');
        expect(
          withoutFortunaDenial(withoutInterpolation),
          `${label} must not mention fortuna as a claim`
        ).not.toMatch(/fortuna/i);
        expect(withoutInterpolation, `${label} must not contain R$`).not.toMatch(/R\$/);
        expect(withoutInterpolation, `${label} must not contain £ or €`).not.toMatch(/[£€]/);
        expect(withoutInterpolation, `${label} must not contain a leftover $ currency mark`).not.toMatch(/\$/);
        expect(withoutInterpolation, `${label} must not have a preço field`).not.toMatch(/preço/i);
        expect(withoutInterpolation, `${label} must not have a price field`).not.toMatch(/\bprice\b/i);
      }
    });

    it('grafo.astro imports the shared panel helper (copying logic must fail)', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const pageSource = fs.readFileSync(pagePath, 'utf-8');

      expect(
        pageSource,
        'grafo.astro must import from ../lib/grafo-panel — same seam as #74 unique-edge helper'
      ).toMatch(/from ['"]\.\.\/lib\/grafo-panel['"]/);
      expect(
        pageSource,
        'grafo.astro must call buildPanelView so dropping the helper fails'
      ).toMatch(/buildPanelView\s*\(/);
    });

    it('Gipar node and Gipar→Energisa edge yield 26.646, 61.162, and the FRE source', () => {
      const json = loadCommittedGrafo();

      const nodeView = buildPanelView(json, { nodeId: GIPAR_ID });
      expect(nodeView, 'Gipar node should open a node panel').not.toBeNull();
      expect(nodeView!.mode).toBe('node');
      if (nodeView!.mode !== 'node') return;

      expect(nodeView.label).toMatch(/Gipar/i);
      expect(nodeView.kind).toBe('company');
      expect(nodeView.id).toBe(GIPAR_ID);

      const energisaHop = nodeView.hops.find(
        (hop) => hop.other_id === ENERGISA_ID || /energisa/i.test(hop.other_label)
      );
      expect(energisaHop, 'Gipar node should list the Energisa hop').toBeDefined();
      expect(energisaHop!.pct_capital).toBe(26.646);
      expect(energisaHop!.pct_votos).toBe(61.162);
      expect(energisaHop!.source).toMatch(/FRE Energisa 160981/);

      const edgeView = buildPanelView(json, { from: GIPAR_ID, to: ENERGISA_ID });
      expect(edgeView, 'Gipar→Energisa should open an edge panel').not.toBeNull();
      expect(edgeView!.mode).toBe('edge');
      if (edgeView!.mode !== 'edge') return;

      expect(edgeView.from_label).toMatch(/Gipar/i);
      expect(edgeView.to_label).toMatch(/energisa/i);
      expect(edgeView.kind).toBe('company_owns');
      expect(edgeView.pct_capital).toBe(26.646);
      expect(edgeView.pct_votos).toBe(61.162);
      expect(edgeView.source).toMatch(/FRE Energisa 160981/);
    });

    it('Mônica node lists MCLC at 52.004 and does not list Energisa at 52.004', () => {
      const json = loadCommittedGrafo();
      const view = buildPanelView(json, { nodeId: MONICA_ID });

      expect(view, 'Mônica node should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;

      const mclcHop = view.hops.find(
        (hop) => hop.other_id === MCLC_ID || /mclc/i.test(hop.other_label)
      );
      expect(mclcHop, 'Mônica should list MCLC').toBeDefined();
      expect(mclcHop!.pct_capital).toBe(52.004);

      const energisaAt52 = view.hops.find(
        (hop) =>
          (hop.other_id === ENERGISA_ID || /energisa/i.test(hop.other_label)) &&
          hop.pct_capital === 52.004
      );
      expect(
        energisaAt52,
        'Mônica must not list Energisa at 52.004 — that hop is MCLC'
      ).toBeUndefined();
    });

    it('Ivan → Energisa capital and votes equal the hop products on the complete path', () => {
      const json = loadCommittedGrafo();
      const hopIds: Array<[string, string]> = [
        [IVAN_ID, MULTISETOR_ID],
        [MULTISETOR_ID, ITACATU_ID],
        [ITACATU_ID, NOVA_GIPAR_ID],
        [NOVA_GIPAR_ID, GIPAR_ID],
        [GIPAR_ID, ENERGISA_ID],
      ];
      const hops = hopIds.map(([from, to]) => {
        const edge = json.edges.find((item: { from: string; to: string }) => item.from === from && item.to === to);
        expect(edge, `committed hop ${from} → ${to} must exist`).toBeDefined();
        return edge;
      });

      const expectedCapital = hops.reduce(
        (acc: number, edge: { pct_capital: number }) => acc * (edge.pct_capital / 100),
        1
      ) * 100;
      const expectedVotes = hops.reduce(
        (acc: number, edge: { pct_votos: number }) => acc * (edge.pct_votos / 100),
        1
      ) * 100;

      const view = buildPanelView(json, { nodeId: IVAN_ID });
      expect(view, 'Ivan node should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;

      const energisa = view.participations.find((item) => item.company_id === ENERGISA_ID);
      expect(energisa, 'Ivan should have cited participation in Energisa').toBeDefined();

      const examplePath = energisa!.paths.find((path) => {
        const ids = path.hops.map((hop) => hop.from_id + '>' + hop.to_id);
        const wanted = hopIds.map(([from, to]) => from + '>' + to);
        return ids.length === wanted.length && ids.every((id, index) => id === wanted[index]);
      });
      expect(examplePath, 'the Ivan → Multisetor → Itacatu → Nova Gipar → Gipar → Energisa path must be listed').toBeDefined();
      expect(examplePath!.pct_capital).toBe(expectedCapital);
      expect(examplePath!.pct_votos).toBe(expectedVotes);
    });

    it('a Receita Federal path with a missing percent does not invent a product', () => {
      const holeGraph = {
        nodes: [
          { id: HOLE_PERSON_ID, kind: 'person' as const, label: 'HOLE PERSON' },
          { id: ENERGISA_ID, kind: 'company' as const, label: 'ENERGISA S.A.' },
        ],
        edges: [
          {
            from: HOLE_PERSON_ID,
            to: ENERGISA_ID,
            kind: 'person_owns',
            source: 'Quadro de Socios Receita',
          },
        ],
      };

      const view = buildPanelView(holeGraph, { nodeId: HOLE_PERSON_ID });
      expect(view, 'hole person should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;

      const cited = view.participations.find((item) => item.company_id === ENERGISA_ID);
      expect(cited, 'hole person should list the reachable listed company').toBeDefined();
      expect(cited!.paths.length).toBeGreaterThan(0);
      expect(cited!.paths[0].hops.length).toBe(1);
      expect(cited!.paths[0].hops[0].source).toMatch(/Receita/);
      expect(cited!.pct_capital, 'must not invent pct_capital on a hole path').toBeUndefined();
      expect(cited!.pct_votos, 'must not invent pct_votos on a hole path').toBeUndefined();
      expect(cited!.paths[0].pct_capital).toBeUndefined();
      expect(cited!.paths[0].pct_votos).toBeUndefined();
    });
  });

  describe('Test (issue #98): gestora partners on the seven nodes', () => {
    type Partner = {
      nome: string;
      qualificacao: string;
      qualificacao_label: string;
    };

    const GESTORA_PARTNERS: Record<string, Partner[]> = {
      '11752203': [
        { nome: 'ACACIO ROBOREDO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'ANGELA REGINA RODRIGUES DE PAULA FREITAS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'DANILO BREDDA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'EDUARDO CHRISTOVAM GALDI MESTIERI', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'GUILHERME YUITI MIAZAQUI', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'HENRIQUE BREDDA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'LUIZ ALVES PAES DE BARROS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'MARCOS TATSUO YAMAMOTO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'NEY ALEXANDRE MIYAMOTO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'PAULA AKEMI RIBEIRO HIROSE', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'RODRIGO ABUD', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'THIAGO COSTA JACINTO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'WILLIAM CORDEIRO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'YAN RODRIGO DE CARVALHO VIEIRA', qualificacao: '22', qualificacao_label: 'Sócio' },
      ],
      '72116353': [
        { nome: 'ANDRE DE ALMEIDA ROSA SOARES', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'BERNARDO ABREU DA COSTA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'BRUNO DE ARAUJO LIMA ROCHA', qualificacao: '38', qualificacao_label: 'Sócio Pessoa Física Residente No Exterior' },
        { nome: 'BRUNO HERMES DA FONSECA RUDGE', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA', qualificacao: '63', qualificacao_label: 'Cotas Em Tesouraria' },
        { nome: 'EDUARDO DE ALMEIDA SANTOS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'EMERSON ADRIANO FERRATO MELO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'FERNANDO JOSE DE OLIVEIRA PIRES DOS SANTOS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'GABRIEL RAPOZO MAROTTI', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'KASSYANA PAULA ALEXANDRA PINAUD', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'LUIZ FELIPE DE ALMEIDA CAMPOS', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'LUIZ ORENSTEIN', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'PEDRO FURTADO MOREIRA MONTEIRO DE BARROS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'THIAGO DI BLASI TEIXEIRA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'TIAGO MOTA MOLISANI FERREIRA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
      ],
      '41020034': [
        { nome: 'ANDRE DE CARVALHO FERREIRA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'FLAVIO AUGUSTO DURAN MANZANO', qualificacao: '5', qualificacao_label: 'Administrador' },
        { nome: 'JOAO DA SILVA FERREIRA NETO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'JOAQUIM DA SILVA FERREIRA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'JULIO DE MORAIS ERSE', qualificacao: '5', qualificacao_label: 'Administrador' },
      ],
      '05395883': [
        { nome: 'ADRIANA CESARIO CARNAVAL', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'ALEXANDRE MUNIZ LISBOA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'ANA CAROLINA DE OLIVEIRA SILVA MOREIRA LIMA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'BRUNO BEIER PALERMO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'BRUNO FERNANDES WAGA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'CARLOS EDUARDO DIAS GOMES', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'CARLOS PACHECO GONCALVES MAXIMINO PEREIRA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'DANIEL VALENTE DANTAS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'DIOGO ALEXANDRE DE MELO BAHIA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'DORIO FERMAN', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'FERNANDO MAURICIO TAVARES GOUVEIA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'GABRIEL MORETTA CHEBAR', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'ITAMAR BENIGNO FILHO', qualificacao: '5', qualificacao_label: 'Administrador' },
        { nome: 'JULIANA KLAIOM DA SILVEIRA MACHADO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'MARCELO SEIXAS CAVALCANTI DE ALBUQUERQUE', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'MICHEL DAHIS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'NORBERTO AGUIAR TOMAZ', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'OPPORTUNITY PARTNERS PARTICIPACOES LTDA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'SANTA LUZIA COMERCIAL E PARTICIPACOES LTDA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'THIAGO KLAIOM DA SILVEIRA MACHADO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'VERONICA VALENTE DANTAS', qualificacao: '38', qualificacao_label: 'Sócio Pessoa Física Residente No Exterior' },
        { nome: 'VINICIUS COUTINHO SALDANHA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'VINICIUS GIERKENS FERREIRA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'VIVIANE D ALMEIDA FERREIRA SILVA', qualificacao: '22', qualificacao_label: 'Sócio' },
      ],
      '33857830': [
        { nome: 'ANDRE STRAUSS VASQUES', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'DIOGO ALEXANDRE DE MELO BAHIA', qualificacao: '5', qualificacao_label: 'Administrador' },
        { nome: 'DORIO FERMAN', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'FELIPE BARROS MAIA VINAGRE', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'FELIPE SANTOS STUDART', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'GABRIEL PICCOLI ARAUJO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'ITAMAR BENIGNO FILHO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'JOAO ANTONIO DE ALBUQUERQUE MEDEIROS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'JOAO CARLOS FRAGA TONON', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'JOAO MANOEL PINHO DE MELLO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'JOAO VICTOR CARRIELLO CELES', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'LUIZA CAVALLEIRO DE MACEDO WEHLING GASPARIAN', qualificacao: '5', qualificacao_label: 'Administrador' },
        { nome: 'NORBERTO AGUIAR TOMAZ', qualificacao: '5', qualificacao_label: 'Administrador' },
        { nome: 'OPPORTUNITY HOLDERS PARTICIPACOES LTDA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'PAULO CESAR DO NASCIMENTO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'PEDRO GUEDES ALVES', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'RODRIGO DOMINGUES VINHA FREITAS', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'THIAGO AUDI CASSEB', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'TIAGO DE ALMEIDA NOEL', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'VERONICA VALENTE DANTAS', qualificacao: '38', qualificacao_label: 'Sócio Pessoa Física Residente No Exterior' },
        { nome: 'VITOR FREITAS LIMA BURJACK', qualificacao: '22', qualificacao_label: 'Sócio' },
      ],
      '09267871': [
        { nome: 'ANTONIO SILVA CORDOVIL', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'BERNARDO FERNANDES DA VEIGA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'EDUARDO COELHO GOMES FERNANDES BASTO', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'EDUARDO VALENTIM DE ARAUJO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'FELIPE DUTRA CANCADO', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'GUILHERME MEXIAS ACHE', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'JOAO CLAUDIO TELLES VIANNA', qualificacao: '22', qualificacao_label: 'Sócio' },
        { nome: 'LUIS AUGUSTO OLIVEIRA GAMBOA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'LUIS FELIPE SARAMAGO STERN', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'LUIZ MAURICIO DE MIRANDA E SILVA', qualificacao: '49', qualificacao_label: 'Sócio-Administrador' },
        { nome: 'MARCELO GONZALEZ PASSOS', qualificacao: '22', qualificacao_label: 'Sócio' },
      ],
      '14406534': [],
    };

    const EXPECTED_COUNTS: Record<string, number> = {
      '11752203': 14,
      '72116353': 15,
      '41020034': 5,
      '05395883': 24,
      '33857830': 21,
      '09267871': 11,
      '14406534': 0,
    };

    const FROZEN_PERSON_IDS_UNION = [
      'p-0054a089', 'p-010e2551', 'p-02f52298', 'p-031cab91', 'p-050ee925',
      'p-06305882', 'p-076d45ba', 'p-0f5c431e', 'p-0fab5b2d', 'p-10813f9e',
      'p-11e495ad', 'p-11f498af', 'p-1282fcb3', 'p-1305d0ba', 'p-1348ab32',
      'p-134ca0da', 'p-1459b3e2', 'p-147c3c83', 'p-147f9b49', 'p-166c2e76',
      'p-16b64a1a', 'p-1b0a077e', 'p-1b38d073', 'p-1b487d80', 'p-1d00cce0',
      'p-1d9e434d', 'p-1dfdd2d0', 'p-1ecc43b8', 'p-1ffa9e7e', 'p-20fd468b',
      'p-2491a4ba', 'p-2504f2c4', 'p-25fe52ce', 'p-27a7f3ee', 'p-27f97b5a',
      'p-282759a0', 'p-29ad3177', 'p-2ab994b8', 'p-2ad67f5f', 'p-2bb4f2eb',
      'p-2bb82ca0', 'p-2c7d71b2', 'p-2cdc324b', 'p-31bac9d8', 'p-32dad2d4',
      'p-33ab3cce', 'p-35b92c94', 'p-3626b31f', 'p-36ac01c2', 'p-392bfe45',
      'p-39dcf5fb', 'p-3cebed6c', 'p-3d9739a9', 'p-3e6b7d53', 'p-3ecbbd0d',
      'p-40894d2d', 'p-40f90cbf', 'p-43b383b5', 'p-4434558b', 'p-45485941',
      'p-456b3f14', 'p-4850ff53', 'p-4906483b', 'p-4cc09360', 'p-4cda88be',
      'p-4f3f270f', 'p-4fb39d12', 'p-518695aa', 'p-5438e9c8', 'p-543bce99',
      'p-561b3bc9', 'p-582ebdb4', 'p-5a0a21d8', 'p-5a3a3ade', 'p-5aebb94f',
      'p-5c6eb6c7', 'p-5cde9c56', 'p-608cdb5e', 'p-6094b0a0', 'p-611d831b',
      'p-617ea2b3', 'p-620c94a1', 'p-62540a56', 'p-6268ea61', 'p-65d1af58',
      'p-6686dd35', 'p-66e24efd', 'p-6ae2426d', 'p-6ef9cde6', 'p-710dd63a',
      'p-7152d85a', 'p-71c9adb5', 'p-73a733cc', 'p-74b6bde7', 'p-74cd4e86',
      'p-7636b07f', 'p-76790c38', 'p-793faab4', 'p-7a7bf0bd', 'p-7b86ae04',
      'p-7c6eb583', 'p-7e21753e', 'p-7edeec49', 'p-7f3fc508', 'p-7fc3be74',
      'p-7fdafcf3', 'p-831e3028', 'p-835a4a65', 'p-848bf0ce', 'p-84b28972',
      'p-859f7d99', 'p-85c0959b', 'p-887e054b', 'p-894d72f9', 'p-8db5e3f1',
      'p-8dd8d5d2', 'p-8e8923a7', 'p-8f4b2205', 'p-8fb82e01', 'p-98140f41',
      'p-9da277e0', 'p-9e358fc7', 'p-9ee93418', 'p-a1a9881b', 'p-a382ee76',
      'p-a54160d7', 'p-a55190d2', 'p-a64df172', 'p-a7b24f91', 'p-a8a4e8c0',
      'p-a8c1e5f9', 'p-a941080d', 'p-a99f0348', 'p-aa39c8e3', 'p-ab5dac7a',
      'p-ab969513', 'p-abccab28', 'p-b01f59e4', 'p-b33b7ca8', 'p-b57fc592',
      'p-b7719454', 'p-b9db9330', 'p-babf54a7', 'p-bb882ad3', 'p-bceb16ac',
      'p-bd91e3be', 'p-beb48096', 'p-bebcf1da', 'p-c053ac2c', 'p-c42eece6',
      'p-c63f4853', 'p-ca22e731', 'p-ca645ca0', 'p-cb00e854', 'p-cbb7fdd7',
      'p-cd7a4b97', 'p-cdbc8c4e', 'p-cf17dea2', 'p-cf538a76', 'p-d02bceb2',
      'p-d02e2ddd', 'p-d09d0ee6', 'p-d3cc9ed4', 'p-d49364c9', 'p-d5231da6',
      'p-d584d2cc', 'p-d5b7fd2a', 'p-d91896df', 'p-d96d26db', 'p-da3e3836',
      'p-dbce5574', 'p-dbf7401a', 'p-dd3cf03b', 'p-dfe70769', 'p-dfef8e07',
      'p-e1365405', 'p-e2ecb2dd', 'p-e31b35c3', 'p-e685cd09', 'p-e8022ca0',
      'p-ea4eb254', 'p-eb101ae8',
      'p-ed3f85fd', 'p-edaa3573', 'p-ee7b22d1', 'p-f25ff412', 'p-f3bdf8a1',
      'p-f3c190ea', 'p-f42e6571', 'p-f48ec877', 'p-f511f986', 'p-f53dc520',
      'p-f5bde2d4', 'p-f5f008f9', 'p-f8603dda', 'p-fad7000a', 'p-faf6d605',
      'p-ff819c3f', 'p-fffd4a1c',
    ] as const;

    const FROZEN_TESOURARIA_IDS = [
      'tesouraria-00864214', 'tesouraria-03220438', 'tesouraria-06057223',
      'tesouraria-07415333', 'tesouraria-07689002', 'tesouraria-17155730',
      'tesouraria-33592510', 'tesouraria-34274233', 'tesouraria-43776517',
      'tesouraria-00001180', 'tesouraria-02558157', 'tesouraria-03853896',
      'tesouraria-06047087', 'tesouraria-16404287', 'tesouraria-16670085',
      'tesouraria-24990777', 'tesouraria-33256439', 'tesouraria-33453598',
      'tesouraria-33611500', 'tesouraria-47960950', 'tesouraria-50746577',
      'tesouraria-61585865', 'tesouraria-67620377',
      'tesouraria-07526557', 'tesouraria-84429695',
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function companyByBasico(json: { nodes: Array<{ id: string }> }, prefix: string) {
      const matches = json.nodes.filter((n) => n.id.startsWith(prefix));
      expect(matches, `prefix ${prefix} must match exactly one existing node`).toHaveLength(1);
      return matches[0] as {
        id: string;
        kind: string;
        label: string;
        partners?: Partner[];
      };
    }

    function allPartnerNames(json: { nodes: Array<{ partners?: Partner[] }> }): string[] {
      return json.nodes.flatMap((n) => (n.partners ?? []).map((p) => p.nome));
    }

    it('Alaska 14, Dynamo 15, Nova Futura 5, Opportunity Asset 24, Opportunity HDF 21, Squadra 11, Lazard 0', () => {
      const json = loadCommittedGrafo();
      for (const [prefix, count] of Object.entries(EXPECTED_COUNTS)) {
        const node = companyByBasico(json, prefix);
        expect(node.kind).toBe('company');
        expect(Array.isArray(node.partners), `${prefix} must have a partners array`).toBe(true);
        expect(node.partners, `${prefix} partner count`).toHaveLength(count);
        expect(node.partners).toEqual(GESTORA_PARTNERS[prefix]);
        for (const partner of node.partners!) {
          expect(Object.keys(partner).sort()).toEqual(['nome', 'qualificacao', 'qualificacao_label']);
          expect(typeof partner.qualificacao).toBe('string');
          expect(partner).not.toHaveProperty('documento');
          expect(partner).not.toHaveProperty('percent');
          expect(partner).not.toHaveProperty('pct_capital');
          expect(partner).not.toHaveProperty('pct_votos');
        }
      }
    });

    it('Squadra partners include GUILHERME MEXIAS ACHE as Sócio-Administrador and the panel HTML lists both', () => {
      const json = loadCommittedGrafo();
      const squadra = companyByBasico(json, '09267871');
      const ache = squadra.partners?.find((p) => p.nome === 'GUILHERME MEXIAS ACHE');
      expect(ache, 'Squadra must list GUILHERME MEXIAS ACHE').toBeDefined();
      expect(ache!.qualificacao_label).toBe('Sócio-Administrador');

      const view = buildPanelView(json, { nodeId: squadra.id });
      expect(view, 'Squadra node should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;

      expect(view.partners).toEqual(GESTORA_PARTNERS['09267871']);
      const html = renderPanelHtml(view);
      expect(html).toContain('GUILHERME MEXIAS ACHE');
      expect(html).toContain('Sócio-Administrador');
    });

    it('Dynamo lists DYNAMO ADMINISTRACAO DE RECURSOS LTDA as Cotas Em Tesouraria without a person or tesouraria node', () => {
      const json = loadCommittedGrafo();
      const dynamo = companyByBasico(json, '72116353');
      const tesourariaRow = dynamo.partners?.find(
        (p) => p.nome === 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA'
      );
      expect(tesourariaRow, 'Dynamo partners must include the tesouraria name').toBeDefined();
      expect(tesourariaRow!.qualificacao).toBe('63');
      expect(tesourariaRow!.qualificacao_label).toBe('Cotas Em Tesouraria');

      const personForName = json.nodes.find(
        (n: { kind: string; label: string }) =>
          n.kind === 'person' && n.label === 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA'
      );
      expect(personForName, 'must not mint a person node for the Dynamo tesouraria name').toBeUndefined();

      const tesourariaNodes = json.nodes.filter((n: { id: string }) =>
        n.id.startsWith('tesouraria-')
      );
      expect(tesourariaNodes.map((n: { id: string }) => n.id).sort()).toEqual(
        [...FROZEN_TESOURARIA_IDS].sort()
      );
      expect(
        tesourariaNodes.some(
          (n: { label: string }) => n.label === 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA'
        )
      ).toBe(false);
    });

    it('keeps 529 nodes, 670 edges, 199 person ids, and draws no partner-name edges', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'person');
      const personIds = personNodes.map((n: { id: string }) => n.id).sort();

      expect(json.nodes.length).toBe(529);
      expect(json.edges.length).toBe(670);
      expect(personNodes.length).toBe(199);
      expect(personIds).toEqual([...FROZEN_PERSON_IDS_UNION].sort());

      const partnerNames = new Set(allPartnerNames(json));
      expect(partnerNames.size).toBeGreaterThan(0);
      for (const edge of json.edges) {
        expect(
          partnerNames.has(edge.from),
          `edge.from must not be a partner name: ${edge.from}`
        ).toBe(false);
        expect(
          partnerNames.has(edge.to),
          `edge.to must not be a partner name: ${edge.to}`
        ).toBe(false);
      }
    });

    it('has zero eleven-digit Cadastro, no fortuna, and other pages still without extra JS', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(jsonText).not.toMatch(/fortuna/i);

      const helperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts');
      const helper = fs.readFileSync(helperPath, 'utf-8');
      expect(withoutFortunaDenial(helper)).not.toMatch(/fortuna/i);

      if (buildFailed) throw new Error(`Build failed: ${buildError}`);

      const homePath = path.join(distPath, 'index.html');
      const metodologiaPath = path.join(distPath, 'metodologia', 'index.html');
      const doacoesPath = path.join(distPath, 'doacoes', 'index.html');
      expect(fs.readFileSync(homePath, 'utf-8')).not.toMatch(/<script/);
      expect(fs.readFileSync(metodologiaPath, 'utf-8')).not.toMatch(/<script/);
      expect(fs.readFileSync(doacoesPath, 'utf-8')).not.toMatch(/<script/);
    });
  });

  describe('Test (issue #113): WEG and Ambev listed trees', () => {
    const WEG_ID = '84429695000111';
    const AMBEV_ID = '07526557000100';
    const PREVIOUS_THIRTY_ONE = [
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
    ] as const;
    const GIPAR_ID = '02260956000158';
    const GESTORA_IDS = [
      '11752203000150',
      '72116353000162',
      '14406534000127',
      '41020034000125',
      '05395883000108',
      '33857830000199',
      '09267871000140',
    ] as const;
    const HOLE_COMPANY_IDS = [
      '61563585000142',
      '02049012000136',
      '23349343000161',
      '07544616000172',
      '39513958000111',
      '42601461000160',
      '43347650000110',
      '45278506000103',
      '58534632000115',
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isTaggedListed(el: { data: { listed?: boolean | string; seed?: string } }): boolean {
      return el.data.listed === true || el.data.listed === 'true' || el.data.seed === 'listed';
    }

    function incomingCapital(json: { edges: Array<{ to: string; pct_capital?: number }> }, id: string) {
      const incoming = json.edges.filter((e) => e.to === id);
      const capitalSum = incoming.reduce(
        (sum: number, edge: { pct_capital?: number }) => sum + (edge.pct_capital || 0),
        0
      );
      const capitalRounded = Math.round(capitalSum * 1000) / 1000;
      return { incoming, capitalSum, capitalRounded };
    }

    it('has WEG S.A. and AMBEV S.A. as company nodes', () => {
      const json = loadCommittedGrafo();
      const weg = json.nodes.find((n: { id: string }) => n.id === WEG_ID);
      const ambev = json.nodes.find((n: { id: string }) => n.id === AMBEV_ID);
      expect(weg, 'WEG 84429695000111 should exist').toBeDefined();
      expect(weg.kind).toBe('company');
      expect(weg.label).toBe('WEG S.A.');
      expect(ambev, 'Ambev 07526557000100 should exist').toBeDefined();
      expect(ambev.kind).toBe('company');
      expect(ambev.label).toBe('AMBEV S.A.');
    });

    it('incoming capital is 100.000 to WEG (52 hops) and 99.999 to Ambev (5 hops)', () => {
      const json = loadCommittedGrafo();
      const weg = incomingCapital(json, WEG_ID);
      expect(weg.incoming.length, 'WEG incoming hop count').toBe(52);
      expect(weg.capitalRounded).toBe(100);
      expect(weg.capitalSum).toBeGreaterThanOrEqual(99.5);
      expect(weg.capitalSum).toBeLessThanOrEqual(100.5);

      const ambev = incomingCapital(json, AMBEV_ID);
      expect(ambev.incoming.length, 'Ambev incoming hop count').toBe(5);
      expect(ambev.capitalRounded).toBe(99.999);
      expect(ambev.capitalSum).toBeGreaterThanOrEqual(99.5);
      expect(ambev.capitalSum).toBeLessThanOrEqual(100.5);
    });

    it('LISTED_COMPANY_IDS has length 33 and tags exactly those ids as listed companies', () => {
      const json = loadCommittedGrafo();
      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      for (const id of PREVIOUS_THIRTY_ONE) {
        expect(LISTED_COMPANY_IDS, `must keep existing listed id ${id}`).toContain(id);
      }
      expect(LISTED_COMPANY_IDS).toContain(WEG_ID);
      expect(LISTED_COMPANY_IDS).toContain(AMBEV_ID);

      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const listedNodes = nodes.filter(isTaggedListed);
      expect(listedNodes.map((el) => el.data.id).sort()).toEqual([...LISTED_COMPANY_IDS].sort());
      for (const el of listedNodes) {
        expect(el.data.kind, `listed node ${el.data.id} must stay kind=company`).toBe('company');
      }
    });

    it('Gipar, tesouraria, hole companies, x- slugs, and the seven gestoras are not tagged listed', () => {
      const json = loadCommittedGrafo();
      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const byId = new Map(nodes.map((el) => [el.data.id, el]));

      expect(isTaggedListed(byId.get(GIPAR_ID)!), 'Gipar must stay ordinary company color').toBe(false);

      const tesouraria = nodes.filter((el) => el.data.id.startsWith('tesouraria-'));
      expect(tesouraria.length).toBeGreaterThan(0);
      for (const el of tesouraria) {
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }

      for (const holeId of HOLE_COMPANY_IDS) {
        const hole = byId.get(holeId);
        expect(hole, `hole company ${holeId} should exist`).toBeDefined();
        expect(isTaggedListed(hole!), `hole company ${holeId} must not be tagged listed`).toBe(false);
      }

      const xSlugs = nodes.filter((el) => el.data.id.startsWith('x-'));
      expect(xSlugs.length, 'foreign x- slugs should be on the page').toBeGreaterThan(0);
      for (const el of xSlugs) {
        expect(el.data.kind, `${el.data.id} stays kind=company`).toBe('company');
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }
      const abInbev = xSlugs.filter((el) => /inbev/i.test(el.data.id) || /inbev/i.test(el.data.label ?? ''));
      expect(abInbev.length, 'AB InBev holdings should be x- slugs').toBeGreaterThan(0);
      for (const el of abInbev) {
        expect(isTaggedListed(el), `${el.data.id} must not be tagged listed`).toBe(false);
      }

      for (const gestoraId of GESTORA_IDS) {
        const gestora = byId.get(gestoraId);
        expect(gestora, `gestora ${gestoraId} should exist`).toBeDefined();
        expect(gestora!.data.kind).toBe('company');
        expect(isTaggedListed(gestora!), `gestora ${gestoraId} must not be tagged listed`).toBe(false);
      }
    });

    it('committed JSON has zero eleven-digit Cadastro', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(jsonText).not.toContain('***');
    });

    it('page copy matches the post-union node and edge counts and has no fortuna', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('529 nós, 670 arestas');
      expect(page).not.toContain('527 nós, 668 arestas');
      expect(page).not.toMatch(/fortuna/i);
    });

    it('keeps #98 gestora partners: Squadra 11, Lazard [], Dynamo tesouraria name', () => {
      const json = loadCommittedGrafo();
      const squadra = json.nodes.find((n: { id: string }) => n.id === '09267871000140');
      const lazard = json.nodes.find((n: { id: string }) => n.id === '14406534000127');
      const dynamo = json.nodes.find((n: { id: string }) => n.id === '72116353000162');

      expect(squadra.partners).toHaveLength(11);
      expect(lazard.partners).toEqual([]);
      const tesourariaRow = dynamo.partners.find(
        (p: { nome: string }) => p.nome === 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA'
      );
      expect(tesourariaRow, 'Dynamo partners must include the tesouraria name').toBeDefined();
      expect(tesourariaRow.qualificacao).toBe('63');
      expect(tesourariaRow.qualificacao_label).toBe('Cotas Em Tesouraria');
      expect(
        json.nodes.some(
          (n: { kind: string; label: string }) =>
            n.kind === 'person' && n.label === 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA'
        )
      ).toBe(false);
    });

    it('each of the 33 listed seeds has incoming capital in [99.5, 100.5]', () => {
      const json = loadCommittedGrafo();
      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      for (const listedId of LISTED_COMPANY_IDS) {
        const { capitalSum } = incomingCapital(json, listedId);
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeGreaterThanOrEqual(99.5);
        expect(
          capitalSum,
          `incoming capital to ${listedId} should be in 99.5..100.5, got ${capitalSum}`
        ).toBeLessThanOrEqual(100.5);
      }
    });
  });

  describe('Test (issue #119): three Opportunity PJ sócias as company nodes', () => {
    const WEG_ID = '84429695000111';
    const AMBEV_ID = '07526557000100';
    const ASSET_ID = '05395883000108';
    const HDF_ID = '33857830000199';
    const SQUADRA_ID = '09267871000140';
    const LAZARD_ID = '14406534000127';
    const DYNAMO_ID = '72116353000162';
    const PARTNERS_ID = '10630748000121';
    const SANTA_LUZIA_ID = '36163277000182';
    const HOLDERS_ID = '00806334000157';
    const PJ_SOCIAS = [
      {
        id: PARTNERS_ID,
        label: 'Opportunity Partners Participações Ltda.',
        to: ASSET_ID,
      },
      {
        id: SANTA_LUZIA_ID,
        label: 'Santa Luzia Comercial e Participações Ltda.',
        to: ASSET_ID,
      },
      {
        id: HOLDERS_ID,
        label: 'Opportunity Holders Participações Ltda.',
        to: HDF_ID,
      },
    ] as const;
    const GESTORA_PREFIXES = [
      '11752203',
      '72116353',
      '41020034',
      '05395883',
      '33857830',
      '09267871',
      '14406534',
    ] as const;
    const PJ_PARTNER_NAMES = new Set([
      'OPPORTUNITY PARTNERS PARTICIPACOES LTDA',
      'SANTA LUZIA COMERCIAL E PARTICIPACOES LTDA',
      'OPPORTUNITY HOLDERS PARTICIPACOES LTDA',
    ]);
    const TSE_PERSON_NAMES = new Set([
      'JOAQUIM DA SILVA FERREIRA',
      'EDUARDO DE ALMEIDA SANTOS',
    ]);
    const DYNAMO_TESOURARIA_NAME = 'DYNAMO ADMINISTRACAO DE RECURSOS LTDA';

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isNumericPercent(value: unknown): boolean {
      return typeof value === 'number' && Number.isFinite(value);
    }

    function isTaggedListed(el: { data: { listed?: boolean | string; seed?: string } }): boolean {
      return el.data.listed === true || el.data.listed === 'true' || el.data.seed === 'listed';
    }

    function incomingCapital(json: { edges: Array<{ to: string; pct_capital?: number }> }, id: string) {
      const incoming = json.edges.filter((e) => e.to === id);
      const capitalSum = incoming.reduce(
        (sum: number, edge: { pct_capital?: number }) => sum + (edge.pct_capital || 0),
        0
      );
      const capitalRounded = Math.round(capitalSum * 1000) / 1000;
      return { incoming, capitalSum, capitalRounded };
    }

    it('adds three company nodes with the warehouse matriz ids and labels', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'person');

      expect(json.nodes.length).toBe(529);
      expect(json.edges.length).toBe(670);
      expect(personNodes.length).toBe(199);

      for (const company of PJ_SOCIAS) {
        const node = json.nodes.find((n: { id: string }) => n.id === company.id);
        expect(node, `company ${company.id} should exist`).toBeDefined();
        expect(node.kind).toBe('company');
        expect(node.label).toBe(company.label);
      }
    });

    it('adds three company_owns hole edges with no numeric percent and a Receita or Quadro de Sócios source', () => {
      const json = loadCommittedGrafo();

      for (const pair of PJ_SOCIAS) {
        const edge = json.edges.find(
          (e: { from: string; to: string }) => e.from === pair.id && e.to === pair.to
        );
        expect(edge, `hole edge ${pair.id} → ${pair.to} should exist`).toBeDefined();
        expect(edge.kind).toBe('company_owns');
        expect(
          isNumericPercent(edge.pct_capital),
          `hole edge ${pair.id} → ${pair.to} must not have numeric pct_capital`
        ).toBe(false);
        expect(
          isNumericPercent(edge.pct_votos),
          `hole edge ${pair.id} → ${pair.to} must not have numeric pct_votos`
        ).toBe(false);
        expect(edge).not.toHaveProperty('pct_capital');
        expect(edge).not.toHaveProperty('pct_votos');
        expect(String(edge.source)).toMatch(/Receita|Quadro de S[oó]cios/);
      }
    });

    it('keeps 199 person nodes and mints no p- node for Ache', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string; id: string; label: string }) => n.kind === 'person');
      const personIds = personNodes.map((n: { id: string }) => n.id);

      expect(personNodes.length).toBe(199);
      expect(personIds).toHaveLength(199);
      for (const id of personIds) {
        expect(id, `person id ${id} must stay p- plus eight hex`).toMatch(/^p-[0-9a-f]{8}$/);
      }

      const achePerson = personNodes.find((n: { label: string }) =>
        /GUILHERME MEXIAS ACHE/i.test(n.label)
      );
      expect(achePerson, 'must not mint a p- node for GUILHERME MEXIAS ACHE').toBeUndefined();
    });

    it('Squadra still has 11 panel partners including GUILHERME MEXIAS ACHE and the panel still renders the name', () => {
      const json = loadCommittedGrafo();
      const squadra = json.nodes.find((n: { id: string }) => n.id === SQUADRA_ID);
      expect(squadra, 'Squadra node should exist').toBeDefined();
      expect(squadra.partners).toHaveLength(11);
      const ache = squadra.partners.find((p: { nome: string }) => p.nome === 'GUILHERME MEXIAS ACHE');
      expect(ache, 'Squadra must list GUILHERME MEXIAS ACHE').toBeDefined();
      expect(ache.qualificacao_label).toBe('Sócio-Administrador');

      const view = buildPanelView(json, { nodeId: SQUADRA_ID });
      expect(view, 'Squadra node should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;
      expect(view.partners).toHaveLength(11);
      const html = renderPanelHtml(view);
      expect(html).toContain('GUILHERME MEXIAS ACHE');
      expect(html).toContain('Sócio-Administrador');
    });

    it('does not mint nodes for the remaining 84 masked PF names; Dynamo tesouraria stays a name; Lazard stays empty', () => {
      const json = loadCommittedGrafo();
      const nodeLabels = new Set(
        json.nodes.map((n: { label: string }) => n.label)
      );
      const nodeIds = new Set(json.nodes.map((n: { id: string }) => n.id));

      const maskedNames: string[] = [];
      for (const prefix of GESTORA_PREFIXES) {
        const node = json.nodes.find((n: { id: string }) => n.id.startsWith(prefix));
        expect(node, `gestora ${prefix} should exist`).toBeDefined();
        for (const partner of node.partners ?? []) {
          if (PJ_PARTNER_NAMES.has(partner.nome)) continue;
          if (partner.nome === DYNAMO_TESOURARIA_NAME) continue;
          if (TSE_PERSON_NAMES.has(partner.nome)) continue;
          maskedNames.push(partner.nome);
        }
      }
      expect(maskedNames).toHaveLength(84);
      for (const nome of maskedNames) {
        expect(
          json.nodes.some(
            (n: { kind: string; label: string }) => n.kind === 'person' && n.label === nome
          ),
          `must not mint a person node for masked partner ${nome}`
        ).toBe(false);
      }

      const dynamo = json.nodes.find((n: { id: string }) => n.id === DYNAMO_ID);
      const tesourariaRow = dynamo.partners.find(
        (p: { nome: string }) => p.nome === DYNAMO_TESOURARIA_NAME
      );
      expect(tesourariaRow, 'Dynamo partners must include the tesouraria name').toBeDefined();
      expect(tesourariaRow.qualificacao).toBe('63');
      expect(nodeLabels.has(DYNAMO_TESOURARIA_NAME)).toBe(false);
      expect(nodeIds.has('tesouraria-72116353')).toBe(false);

      const lazard = json.nodes.find((n: { id: string }) => n.id === LAZARD_ID);
      expect(lazard.partners).toEqual([]);
    });

    it('keeps Opportunity Asset 24 and HDF 21 partner arrays including the three PJ names on the panel', () => {
      const json = loadCommittedGrafo();
      const asset = json.nodes.find((n: { id: string }) => n.id === ASSET_ID);
      const hdf = json.nodes.find((n: { id: string }) => n.id === HDF_ID);

      expect(asset.partners).toHaveLength(24);
      expect(hdf.partners).toHaveLength(21);
      expect(
        asset.partners.some((p: { nome: string }) => p.nome === 'OPPORTUNITY PARTNERS PARTICIPACOES LTDA')
      ).toBe(true);
      expect(
        asset.partners.some((p: { nome: string }) => p.nome === 'SANTA LUZIA COMERCIAL E PARTICIPACOES LTDA')
      ).toBe(true);
      expect(
        hdf.partners.some((p: { nome: string }) => p.nome === 'OPPORTUNITY HOLDERS PARTICIPACOES LTDA')
      ).toBe(true);

      const assetView = buildPanelView(json, { nodeId: ASSET_ID });
      expect(assetView, 'Opportunity Asset should open a node panel').not.toBeNull();
      expect(assetView!.mode).toBe('node');
      if (assetView!.mode !== 'node') return;
      const html = renderPanelHtml(assetView);
      expect(html).toContain('OPPORTUNITY PARTNERS PARTICIPACOES LTDA');
      expect(html).toContain('SANTA LUZIA COMERCIAL E PARTICIPACOES LTDA');
    });

    it('has zero eleven-digit Cadastro and no fortuna', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(jsonText).not.toMatch(/fortuna/i);

      const helperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts');
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      expect(withoutFortunaDenial(fs.readFileSync(helperPath, 'utf-8'))).not.toMatch(/fortuna/i);
      expect(withoutFortunaDenial(fs.readFileSync(pagePath, 'utf-8'))).not.toMatch(/fortuna/i);
    });

    it('keeps LISTED_COMPANY_IDS length 33; the three PJ sócias are ordinary companies; WEG/Ambev incoming stay 100 / 99.999', () => {
      const json = loadCommittedGrafo();
      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      expect(LISTED_COMPANY_IDS).toContain(WEG_ID);
      expect(LISTED_COMPANY_IDS).toContain(AMBEV_ID);
      for (const company of PJ_SOCIAS) {
        expect(
          LISTED_COMPANY_IDS,
          `${company.id} must not be tagged listed`
        ).not.toContain(company.id);
      }

      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const listedNodes = nodes.filter(isTaggedListed);
      expect(listedNodes).toHaveLength(33);
      expect(listedNodes.map((el) => el.data.id).sort()).toEqual([...LISTED_COMPANY_IDS].sort());

      for (const company of PJ_SOCIAS) {
        const el = nodes.find((n) => n.data.id === company.id);
        expect(el, `cytoscape node ${company.id} should exist`).toBeDefined();
        expect(el!.data.kind).toBe('company');
        expect(isTaggedListed(el!), `${company.id} must stay ordinary company color`).toBe(false);
      }

      const weg = incomingCapital(json, WEG_ID);
      expect(weg.capitalRounded).toBe(100);
      const ambev = incomingCapital(json, AMBEV_ID);
      expect(ambev.capitalRounded).toBe(99.999);
    });

    it('page copy names 529 nodes and 670 edges', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('529 nós, 670 arestas');
      expect(page).not.toContain('527 nós, 668 arestas');
    });
  });

  describe('Test (issue #122): two TSE-keyed gestora sócios as person nodes', () => {
    const JOAQUIM_ID = 'p-da3e3836';
    const EDUARDO_ID = 'p-e1365405';
    const NOVA_FUTURA_ID = '41020034000125';
    const DYNAMO_ID = '72116353000162';
    const SQUADRA_ID = '09267871000140';
    const WEG_ID = '84429695000111';
    const AMBEV_ID = '07526557000100';
    const PJ_SOCIAS = [
      { id: '10630748000121', label: 'Opportunity Partners Participações Ltda.' },
      { id: '36163277000182', label: 'Santa Luzia Comercial e Participações Ltda.' },
      { id: '00806334000157', label: 'Opportunity Holders Participações Ltda.' },
    ] as const;
    const TSE_PERSONS = [
      {
        id: JOAQUIM_ID,
        label: 'JOAQUIM DA SILVA FERREIRA',
        to: NOVA_FUTURA_ID,
      },
      {
        id: EDUARDO_ID,
        label: 'EDUARDO DE ALMEIDA SANTOS',
        to: DYNAMO_ID,
      },
    ] as const;

    function loadCommittedGrafo() {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    function isNumericPercent(value: unknown): boolean {
      return typeof value === 'number' && Number.isFinite(value);
    }

    function incomingCapital(json: { edges: Array<{ to: string; pct_capital?: number }> }, id: string) {
      const incoming = json.edges.filter((e) => e.to === id);
      const capitalSum = incoming.reduce(
        (sum: number, edge: { pct_capital?: number }) => sum + (edge.pct_capital || 0),
        0
      );
      return Math.round(capitalSum * 1000) / 1000;
    }

    it('adds Joaquim and Eduardo as person nodes with the public ids already computed', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'person');

      expect(json.nodes.length).toBe(529);
      expect(json.edges.length).toBe(670);
      expect(personNodes.length).toBe(199);

      for (const person of TSE_PERSONS) {
        const node = json.nodes.find((n: { id: string }) => n.id === person.id);
        expect(node, `person ${person.id} should exist`).toBeDefined();
        expect(node.kind).toBe('person');
        expect(node.label).toBe(person.label);
      }
    });

    it('adds two person_owns hole edges with no numeric percent and a Tribunal or Receita / Quadro de Sócios source', () => {
      const json = loadCommittedGrafo();

      for (const pair of TSE_PERSONS) {
        const edge = json.edges.find(
          (e: { from: string; to: string }) => e.from === pair.id && e.to === pair.to
        );
        expect(edge, `hole edge ${pair.id} → ${pair.to} should exist`).toBeDefined();
        expect(edge.kind).toBe('person_owns');
        expect(
          isNumericPercent(edge.pct_capital),
          `hole edge ${pair.id} → ${pair.to} must not have numeric pct_capital`
        ).toBe(false);
        expect(
          isNumericPercent(edge.pct_votos),
          `hole edge ${pair.id} → ${pair.to} must not have numeric pct_votos`
        ).toBe(false);
        expect(edge).not.toHaveProperty('pct_capital');
        expect(edge).not.toHaveProperty('pct_votos');
        expect(String(edge.source)).toMatch(/Tribunal|Receita|Quadro de S[oó]cios/);
      }
    });

    it('does not mint a node for Paulo Cesar / PAULO CESAR DO NASCIMENTO', () => {
      const json = loadCommittedGrafo();
      const pauloNodes = json.nodes.filter(
        (n: { label: string }) =>
          n.label === 'PAULO CESAR DO NASCIMENTO' ||
          n.label === 'PAULO CESAR' ||
          n.label === 'Paulo Cesar'
      );
      expect(pauloNodes, 'Paulo Cesar do Nascimento stays a panel name').toHaveLength(0);

      const hdf = json.nodes.find((n: { id: string }) => n.id === '33857830000199');
      expect(
        hdf.partners.some((p: { nome: string }) => p.nome === 'PAULO CESAR DO NASCIMENTO')
      ).toBe(true);
    });

    it('person count is 199 and the only new p- ids vs #119 are p-da3e3836 and p-e1365405', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string; id: string }) => n.kind === 'person');
      const personIds = personNodes.map((n: { id: string }) => n.id);

      expect(personNodes.length).toBe(199);
      expect(new Set(personIds).size).toBe(199);
      expect(personIds).toContain(JOAQUIM_ID);
      expect(personIds).toContain(EDUARDO_ID);

      const extras = personIds.filter((id) => id !== JOAQUIM_ID && id !== EDUARDO_ID);
      expect(extras).toHaveLength(197);
      for (const id of extras) {
        expect(id).toMatch(/^p-[0-9a-f]{8}$/);
      }
      expect(extras).not.toContain(JOAQUIM_ID);
      expect(extras).not.toContain(EDUARDO_ID);
    });

    it('has zero eleven-digit Cadastro, no documento, no ***, and no fortuna', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(jsonText).not.toContain('***');
      expect(jsonText).not.toMatch(/fortuna/i);

      const joaquim = JSON.parse(jsonText).nodes.find((n: { id: string }) => n.id === JOAQUIM_ID);
      const eduardo = JSON.parse(jsonText).nodes.find((n: { id: string }) => n.id === EDUARDO_ID);
      expect(joaquim, 'Joaquim node should exist').toBeDefined();
      expect(eduardo, 'Eduardo node should exist').toBeDefined();
      expect(joaquim).not.toHaveProperty('documento');
      expect(eduardo).not.toHaveProperty('documento');

      const helperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts');
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      expect(withoutFortunaDenial(fs.readFileSync(helperPath, 'utf-8'))).not.toMatch(/fortuna/i);
      expect(withoutFortunaDenial(fs.readFileSync(pagePath, 'utf-8'))).not.toMatch(/fortuna/i);
    });

    it('keeps the three #119 PJ company nodes, LISTED 33, Squadra 11 with Ache, and WEG/Ambev incoming', () => {
      const json = loadCommittedGrafo();

      for (const company of PJ_SOCIAS) {
        const node = json.nodes.find((n: { id: string }) => n.id === company.id);
        expect(node, `PJ ${company.id} from #119 should remain`).toBeDefined();
        expect(node.kind).toBe('company');
        expect(node.label).toBe(company.label);
      }

      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      expect(LISTED_COMPANY_IDS).toContain(WEG_ID);
      expect(LISTED_COMPANY_IDS).toContain(AMBEV_ID);
      expect(incomingCapital(json, WEG_ID)).toBe(100);
      expect(incomingCapital(json, AMBEV_ID)).toBe(99.999);

      const squadra = json.nodes.find((n: { id: string }) => n.id === SQUADRA_ID);
      expect(squadra.partners).toHaveLength(11);
      expect(
        squadra.partners.some((p: { nome: string }) => p.nome === 'GUILHERME MEXIAS ACHE')
      ).toBe(true);
      expect(
        json.nodes.some(
          (n: { kind: string; label: string }) =>
            n.kind === 'person' && /GUILHERME MEXIAS ACHE/i.test(n.label)
        )
      ).toBe(false);

      const view = buildPanelView(json, { nodeId: SQUADRA_ID });
      expect(view, 'Squadra node should open a node panel').not.toBeNull();
      expect(view!.mode).toBe('node');
      if (view!.mode !== 'node') return;
      const html = renderPanelHtml(view);
      expect(html).toContain('GUILHERME MEXIAS ACHE');
    });

    it('page copy names 529 nodes and 670 edges', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('529 nós, 670 arestas');
      expect(page).not.toContain('527 nós, 668 arestas');
    });
  });
});
