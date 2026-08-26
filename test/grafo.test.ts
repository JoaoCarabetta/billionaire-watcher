import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildCytoscapeElements } from '../src/lib/grafo-elements';
import { buildPanelView } from '../src/lib/grafo-panel';

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

    it('should have exactly 97 nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.nodes).toBeDefined();
      expect(json.nodes.length).toBe(97);
    });

    it('should have exactly 25 person nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      expect(personNodes.length).toBe(25);
    });

    it('should have exactly 60 edges', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.edges).toBeDefined();
      expect(json.edges.length).toBe(60);
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

  describe('Test 2 (issue #80): Energisa incoming sums and hop correctness', () => {
    it('should have capital sum to Energisa between 99.999 and 100.001', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const energisaId = '00864214000106';
      const incomingEdges = json.edges.filter((e: any) => e.to === energisaId);
      
      const capitalSum = incomingEdges.reduce((sum: number, edge: any) => {
        return sum + (edge.pct_capital || 0);
      }, 0);
      
      expect(
        capitalSum,
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
      
      expect(
        votosSum,
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
      
      const outrosId = 'outros-energisa';
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
  });
});
