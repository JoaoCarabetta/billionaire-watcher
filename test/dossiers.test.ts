import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: Freeze CSV + Identity Dossiers', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
    
    // Always rebuild to ensure fresh state
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
    
    distPath = path.join(__dirname, '..', 'dist');
  });

  describe('Test 1: Dossier routes for freeze persons with citations', () => {
    it('should build dossier HTML for person p1 in freeze CSV', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for p1 should exist at ${dossierPath}`).toBe(true);
    });

    it('should render identity fields with citations for p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('João Silva');
      expect(html).toContain('Brasileira');
      expect(html).toContain('Receita Federal do Brasil');
    });

    it('should have visible citation markers (superscript/brackets) for p1 identity fields', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const hasSuperscriptPattern = /<sup[^>]*>.*?<\/sup>/i.test(html) || /\[[\d]+\]/.test(html);
      expect(hasSuperscriptPattern).toBe(true);
    });

    it('should include References section with publisher and locator for p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Referências');
      expect(html).toContain('https://www.gov.br/receitafederal');
    });

    it('should build dossier HTML for person p2 in freeze CSV', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for p2 should exist`).toBe(true);
    });

    it('should build dossier HTML for person p3 in freeze CSV', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for p3 should exist`).toBe(true);
    });
  });

  describe('Test 2: Person not in freeze has no dossier URL', () => {
    it('should not build dossier page for person p4 (not in freeze)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p4', 'index.html');
      expect(fs.existsSync(dossierPath), 'Person p4 not in freeze should not have a dossier page').toBe(false);
    });

    it('should not link to p4 from home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).not.toContain('/pessoa/p4');
      expect(html).not.toContain('Pedro Costa (não no freeze)');
    });
  });

  describe('Test 3: No biography paragraph or unsourced prose', () => {
    it('should not contain biography paragraph in p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toContain('biografia');
      expect(html).not.toContain('nasceu em');
      expect(html).not.toContain('é conhecido por');
    });

    it('should not contain unsourced LLM prose in p2 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toContain('texto inventado por IA');
      expect(html).not.toContain('narrativa especulativa');
    });

    it('should only render Facts with Sources in dossiers', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check that we have fact elements with citation markers for identity facts
      const factDivMatches = html.match(/<div class="fact"[^>]*data-fact-id="[^"]*"[^>]*>/g);
      const identityCitationMatches = html.match(/<div class="fact"[^>]*>[\s\S]*?<sup class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
      
      // Must have facts and citations - no guard, fail if missing
      expect(factDivMatches).toBeTruthy();
      expect(identityCitationMatches).toBeTruthy();
      expect(factDivMatches!.length).toBeGreaterThan(0);
      expect(identityCitationMatches!.length).toBeGreaterThan(0);
      expect(factDivMatches!.length).toBe(identityCitationMatches!.length);
    });

    it('should not render unsourced freeze CSV cells (group, role) unless they exist as cited Facts', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // These are freeze CSV cells for p1: group="Empresa XYZ Ltda.", role="controlador"
      // They should NOT appear on the page unless they exist as cited identity Facts
      
      // "Empresa XYZ Ltda." can appear in RF partner edges (which have citations), but not as unsourced text
      const empresaXYZMatches = html.match(/Empresa XYZ Ltda\./g) || [];
      
      // "controlador" should NOT appear - RF edges use "sócio" instead
      // The freeze CSV has role="controlador" but this should NOT be rendered anywhere
      expect(html).not.toMatch(/controlador(?!a)/i); // allow "controladora" as company name in the future
      
      // Verify that Empresa XYZ Ltda. appears with citation
      expect(empresaXYZMatches.length).toBeGreaterThan(0);
      for (const match of empresaXYZMatches) {
        const matchIndex = html.indexOf(match);
        const surroundingContext = html.slice(Math.max(0, matchIndex - 200), matchIndex + 200);
        
        // Must be part of an RF edge (in a table) or a cited fact, not raw text
        const hasRFEdgeCitation = surroundingContext.includes('rf-edge') && surroundingContext.includes('[');
        const hasFactCitation = /<span class="fact-value"[^>]*>.*Empresa XYZ Ltda\..*<\/span>\s*<sup class="citation-marker"/.test(surroundingContext);
        
        expect(hasRFEdgeCitation || hasFactCitation).toBe(true);
      }
    });
  });

  describe('Test 4: Home lists freeze persons with links', () => {
    it('should list person p1 on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('João Silva');
    });

    it('should link to p1 dossier from home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('/pessoa/p1');
    });

    it('should not attach unsourced role/group claims to home links', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      // The freeze CSV has role="controlador" and group="Empresa XYZ Ltda." for p1
      // These should NOT appear on the home page as unsourced claims
      expect(html).not.toMatch(/controlador\s+na\s+Empresa XYZ/i);
      expect(html).not.toMatch(/sócia\s+na\s+ABC Participações/i);
      
      // If role/group appear, they must be in cited Facts, not raw CSV text
    });

    it('should list person p2 on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('Maria Santos');
    });

    it('should link to p2 dossier from home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('/pessoa/p2');
    });

    it('should list person p3 on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('Ana Lima');
    });

    it('should link to p3 dossier from home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('/pessoa/p3');
    });
  });

  describe('Test 5: CPF still redacted', () => {
    it('should not emit CPF field in p3 dossier HTML', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toContain('123.456.789-00');
      expect(html).not.toContain('12345678900');
    });

    it('should redact CPF from identity fact values in p3 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Ana Lima');
      expect(html).not.toContain('123.456.789-00');
    });
  });
});
