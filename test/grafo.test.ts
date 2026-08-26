import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

    it('should have exactly 89 nodes', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.nodes).toBeDefined();
      expect(json.nodes.length).toBe(89);
    });

    it('should have exactly 44 edges', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(json.edges).toBeDefined();
      expect(json.edges.length).toBe(44);
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

    it('should have person ids matching ***NNN*** pattern', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const personNodes = json.nodes.filter((n: any) => n.kind === 'person');
      
      for (const node of personNodes) {
        expect(
          node.id,
          `Person id "${node.id}" should match ***NNN*** pattern`
        ).toMatch(/^\*\*\*\d{3}\*\*\*$/);
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
    it('should pass all 44 edges with unique IDs to Cytoscape', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      // Build the same element list that the page builds
      const elements: any[] = [];
      
      // Add nodes
      json.nodes.forEach((node: any) => {
        elements.push({
          data: {
            id: node.id,
            label: node.label,
            kind: node.kind
          }
        });
      });
      
      // Add edges with unique IDs (same logic as grafo.astro)
      json.edges.forEach((edge: any, index: number) => {
        const edgeLabel = edge.pct_capital !== null && edge.pct_capital !== undefined
          ? `${edge.pct_capital}%`
          : '';
        
        elements.push({
          data: {
            id: `e${index}`,
            source: edge.from,
            target: edge.to,
            label: edgeLabel,
            kind: edge.kind
          }
        });
      });
      
      // Extract edge elements
      const edges = elements.filter(el => el.data.source !== undefined);
      
      // Assert count equals 44
      expect(
        edges.length,
        `Should have exactly 44 edges, got ${edges.length}`
      ).toBe(44);
      
      // Assert all edge IDs are unique
      const edgeIds = edges.map(e => e.data.id);
      const uniqueEdgeIds = new Set(edgeIds);
      expect(
        uniqueEdgeIds.size,
        `Edge IDs must be unique. Got ${edgeIds.length} edges but only ${uniqueEdgeIds.size} unique IDs`
      ).toBe(44);
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
});
