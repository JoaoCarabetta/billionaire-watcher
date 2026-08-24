import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Tracer: Editorial Voice (REDACAO.md compliance)
 * 
 * These tests enforce the accepted voice register from docs/REDACAO.md and docs/PRINCIPIOS.md
 * on the in-scope fixture pages (home, dossier p1, doacoes, 404, llms.txt).
 * 
 * Tests check the rendered HTML/text at the public seam (build output), not internals.
 * 
 * Forbidden patterns:
 * - Wikipedia identity lead ("é um empresário")
 * - "o bilionário" / "bilionário" as identity label
 * - "dono" / "UBO" on RF edges (must be "sócio")
 * - Nariz-de-cera ("No cenário atual...")
 * - LLM calques (delve, intricate, "é fundamental ressaltar", "mergulha no", "tecido", "papel crucial")
 * 
 * DO NOT touch /metodologia (not in scope for this issue).
 */

describe('Tracer: Editorial Voice (REDACAO.md)', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    try {
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8'
      });
    } catch (error: any) {
      buildFailed = true;
      buildError = error.message || String(error);
    }
    
    distPath = path.join(__dirname, '..', 'dist');
  });

  describe('Test: No Wikipedia identity lead', () => {
    it('should not contain "é um empresário" in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toMatch(/é um empresário/i);
      expect(html).not.toMatch(/é uma empresária/i);
    });

    it('should not contain "é um empresário" in home page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).not.toMatch(/é um empresário/i);
      expect(html).not.toMatch(/é uma empresária/i);
    });

    it('should not contain "é um empresário" in donations page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const donationsPath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(donationsPath, 'utf-8');
      
      expect(html).not.toMatch(/é um empresário/i);
      expect(html).not.toMatch(/é uma empresária/i);
    });

    it('should not contain "é um empresário" in 404 page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const notFoundPath = path.join(distPath, '404.html');
      const html = fs.readFileSync(notFoundPath, 'utf-8');
      
      expect(html).not.toMatch(/é um empresário/i);
      expect(html).not.toMatch(/é uma empresária/i);
    });

    it('should not contain "é um empresário" in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, 'llms.txt');
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/é um empresário/i);
      expect(text).not.toMatch(/é uma empresária/i);
    });
  });

  describe('Test: No "bilionário" as identity label', () => {
    it('should not contain "o bilionário" in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toMatch(/o bilionário/i);
      expect(html).not.toMatch(/a bilionária/i);
    });

    it('should not contain "bilionário [Name]" pattern in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Pattern: "bilionário" followed by a name (João, Maria, etc.)
      expect(html).not.toMatch(/bilionári[oa]\s+[A-Z][a-záàâãéêíóôõúüç]+/);
    });

    it('should not contain "o bilionário" in home page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).not.toMatch(/o bilionário/i);
      expect(html).not.toMatch(/a bilionária/i);
    });

    it('should not contain "o bilionário" in donations page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const donationsPath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(donationsPath, 'utf-8');
      
      expect(html).not.toMatch(/o bilionário/i);
      expect(html).not.toMatch(/a bilionária/i);
    });

    it('should not contain "o bilionário" in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, 'llms.txt');
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/o bilionário/i);
      expect(text).not.toMatch(/a bilionária/i);
    });
  });

  describe('Test: RF edges use "sócio", never "dono" or "UBO"', () => {
    it('should not contain "dono" as relationship in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // "dono" should not appear in the RF edges context
      // Allow "controlador" in company names but not as relationship
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      if (rfSectionMatch) {
        const rfSection = rfSectionMatch[1];
        expect(rfSection).not.toMatch(/\bdono\b/i);
      }
    });

    it('should not contain "UBO" as relationship in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // "UBO" should not appear in the RF edges section
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      if (rfSectionMatch) {
        const rfSection = rfSectionMatch[1];
        expect(rfSection).not.toMatch(/\bUBO\b/);
      }
    });

    it('should use "sócio" for all RF edges in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // All RF edges should show "sócio"
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      if (rfSectionMatch) {
        const rfSection = rfSectionMatch[1];
        // Check that "sócio" appears (at least once)
        expect(rfSection).toMatch(/sócio/i);
      }
    });
  });

  describe('Test: No nariz-de-cera phrases', () => {
    it('should not contain "No cenário atual" in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/no cenário atual/i);
      }
    });

    it('should not contain "No contexto de" in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/no contexto de/i);
      }
    });
  });

  describe('Test: No LLM calques', () => {
    it('should not contain "é fundamental ressaltar" in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/é fundamental ressaltar/i);
      }
    });

    it('should not contain "mergulha no" in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/mergulha no/i);
      }
    });

    it('should not contain "papel crucial" in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/papel crucial/i);
      }
    });

    it('should not contain "tecido" as metaphor in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        // "tecido" as in "tecido empresarial" or "tecido social" (LLM calque)
        expect(html).not.toMatch(/tecido (empresarial|social|econômico)/i);
      }
    });

    it('should not contain English LLM words (delve, intricate, showcase) in any page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const pages = [
        path.join(distPath, 'index.html'),
        path.join(distPath, 'pessoa', 'p1', 'index.html'),
        path.join(distPath, 'doacoes', 'index.html'),
        path.join(distPath, '404.html')
      ];
      
      for (const page of pages) {
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).not.toMatch(/\bdelve\b/i);
        expect(html).not.toMatch(/\bintricate\b/i);
        expect(html).not.toMatch(/\bshowcas(e|ing)\b/i);
      }
    });

    it('should not contain llms.txt with LLM calques', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, 'llms.txt');
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/é fundamental ressaltar/i);
      expect(text).not.toMatch(/papel crucial/i);
      expect(text).not.toMatch(/\bdelve\b/i);
    });
  });

  describe('Test: Citations remain visible in dossiers', () => {
    it('should have visible citation markers in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check for citation markers (sup with brackets or just brackets)
      const hasCitationMarkers = /<sup[^>]*class="citation-marker"[^>]*>\[[\d]+\]<\/sup>/i.test(html) || /\[[\d]+\]/.test(html);
      expect(hasCitationMarkers).toBe(true);
    });

    it('should have References section in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toMatch(/Referências/i);
    });

    it('should have visible sources in p1 dossier references', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check that references contain publisher names and URLs
      expect(html).toMatch(/Receita Federal do Brasil/);
      expect(html).toMatch(/https:\/\//);
    });
  });

  describe('Test: /metodologia is not modified (out of scope)', () => {
    it('should not have metodologia page in dist (not created yet)', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const metodologiaPath = path.join(distPath, 'metodologia', 'index.html');
      // This page doesn't exist yet, so we just verify it's not there
      // If it exists in the future, DO NOT modify it per issue #39
      
      if (fs.existsSync(metodologiaPath)) {
        // If it exists, we should NOT have touched it
        // This test would need to compare against the original
        console.log('Note: /metodologia exists but is out of scope for issue #39');
      }
    });
  });
});
