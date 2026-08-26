import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildCytoscapeElements } from '../src/lib/grafo-elements';
import { buildPanelView, LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';

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

    it('should have exactly 111 nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.nodes).toBeDefined();
      expect(json.nodes.length).toBe(111);
    });

    it('should have exactly 33 person nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      expect(personNodes.length).toBe(33);
    });

    it('should have exactly 130 edges', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.edges).toBeDefined();
      expect(json.edges.length).toBe(130);
    });

    it('should have the eleven listed company ids', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const nodeIds = new Set(json.nodes.map((n: { id: string }) => n.id));

      expect(LISTED_COMPANY_IDS).toHaveLength(11);
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

      expect(json.nodes.length).toBe(111);
      expect(json.edges.length).toBe(130);
      expect(companyNodes.length).toBe(78);

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

    it('keeps the same 33 person nodes, including GUSTAVO KOS BOTELH0', () => {
      const json = loadCommittedGrafo();
      const personNodes = json.nodes.filter((n: { kind: string }) => n.kind === 'person');
      const personIds = personNodes.map((n: { id: string }) => n.id).sort();

      expect(personNodes.length).toBe(33);
      expect(personIds).toEqual([...FROZEN_PERSON_IDS].sort());
      expect(
        personNodes.some((n: { label: string }) => n.label === 'GUSTAVO KOS BOTELH0')
      ).toBe(true);
    });

    it('page copy names 111 nodes and 130 edges', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('111 nós, 130 arestas');
      expect(page).not.toContain('102 nós, 121 arestas');
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

    it('each of the 11 listed companies has incoming capital between 99.5 and 100.5', () => {
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
      ).toMatch(/selector:\s*['"][^'"]*(listed|seed|LISTED)[^'"]*['"]/);

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

    it('buildCytoscapeElements tags exactly the eleven listed ids', () => {
      const json = loadCommittedGrafo();
      const elements = buildCytoscapeElements(json);
      const nodes = elements.filter((el) => el.data.source === undefined);
      const listedNodes = nodes.filter(isTaggedListed);
      const listedIds = listedNodes.map((el) => el.data.id).sort();

      expect(LISTED_COMPANY_IDS).toHaveLength(11);
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
        expect(withoutInterpolation, `${label} must not mention fortuna`).not.toMatch(/fortuna/i);
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
});
