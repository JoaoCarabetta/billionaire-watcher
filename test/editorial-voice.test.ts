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
 * - "Não X, mas Y" rhetorical pattern
 * - Value adjectives (poderoso, polêmico, gigante, tragédia)
 * 
 * DO NOT touch /metodologia (not in scope for this issue).
 */

describe('Tracer: Editorial Voice (REDACAO.md)', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  // In-scope pages for issue #39
  const IN_SCOPE_PAGES = {
    home: 'index.html',
    p1Dossier: 'pessoa/p1/index.html',
    donations: 'doacoes/index.html',
    notFound: '404.html',
    llmsTxt: 'llms.txt'
  };

  beforeAll(() => {
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

  // Helper to get all in-scope HTML pages (excluding llms.txt)
  const getInScopeHtmlPages = () => [
    path.join(distPath, IN_SCOPE_PAGES.home),
    path.join(distPath, IN_SCOPE_PAGES.p1Dossier),
    path.join(distPath, IN_SCOPE_PAGES.donations),
    path.join(distPath, IN_SCOPE_PAGES.notFound)
  ];

  describe('Test: No Wikipedia identity lead', () => {
    it('should not contain "é um empresário" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain Wikipedia identity lead`).not.toMatch(/é um empresário/i);
        expect(html, `${pagePath} should not contain Wikipedia identity lead`).not.toMatch(/é uma empresária/i);
      }
    });

    it('should not contain "é um empresário" in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, IN_SCOPE_PAGES.llmsTxt);
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/é um empresário/i);
      expect(text).not.toMatch(/é uma empresária/i);
    });
  });

  describe('Test: No "bilionário" as identity label', () => {
    it('should not contain "o bilionário" or "bilionário [Name]" pattern in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        
        expect(html, `${pagePath} should not contain "o bilionário"`).not.toMatch(/o bilionário/i);
        expect(html, `${pagePath} should not contain "a bilionária"`).not.toMatch(/a bilionária/i);
        
        // Pattern: "bilionário" followed by a name (João, Maria, etc.)
        expect(html, `${pagePath} should not use bilionário as identity label`).not.toMatch(/bilionári[oa]\s+[A-Z][a-záàâãéêíóôõúüç]+/);
      }
    });

    it('should not contain "o bilionário" in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, IN_SCOPE_PAGES.llmsTxt);
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/o bilionário/i);
      expect(text).not.toMatch(/a bilionária/i);
    });
  });

  describe('Test: RF edges use "sócio", never "dono" or "UBO"', () => {
    it('should have Empresas e Sócios section in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Assert the section exists
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      expect(rfSectionMatch, 'p1 dossier must have Empresas e Sócios section').toBeTruthy();
    });

    it('should not contain "dono" in Empresas e Sócios section', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      expect(rfSectionMatch, 'p1 dossier must have Empresas e Sócios section').toBeTruthy();
      
      const rfSection = rfSectionMatch![1];
      // \bdono\b but not "doador"
      expect(rfSection, 'RF edges must not use "dono"').not.toMatch(/\bdono\b/i);
    });

    it('should not contain "UBO" in Empresas e Sócios section', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      expect(rfSectionMatch, 'p1 dossier must have Empresas e Sócios section').toBeTruthy();
      
      const rfSection = rfSectionMatch![1];
      expect(rfSection, 'RF edges must not use "UBO"').not.toMatch(/\bUBO\b/);
    });

    it('should use "sócio" for all RF edges', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const rfSectionMatch = html.match(/<h2[^>]*>Empresas e Sócios<\/h2>([\s\S]*?)<\/section>/i);
      expect(rfSectionMatch, 'p1 dossier must have Empresas e Sócios section').toBeTruthy();
      
      const rfSection = rfSectionMatch![1];
      expect(rfSection, 'RF edges must use "sócio"').toMatch(/sócio/i);
    });
  });

  describe('Test: No nariz-de-cera phrases', () => {
    it('should not contain "No cenário atual" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain nariz-de-cera`).not.toMatch(/no cenário atual/i);
      }
    });

    it('should not contain "No contexto de" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain nariz-de-cera`).not.toMatch(/no contexto de/i);
      }
    });
  });

  describe('Test: No LLM calques', () => {
    it('should not contain "é fundamental ressaltar" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain LLM calque`).not.toMatch(/é fundamental ressaltar/i);
      }
    });

    it('should not contain "mergulha no" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain LLM calque`).not.toMatch(/mergulha no/i);
      }
    });

    it('should not contain "papel crucial" in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain LLM calque`).not.toMatch(/papel crucial/i);
      }
    });

    it('should not contain "tecido" as metaphor in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        // "tecido" as in "tecido empresarial" or "tecido social" (LLM calque)
        expect(html, `${pagePath} should not contain LLM calque`).not.toMatch(/tecido (empresarial|social|econômico)/i);
      }
    });

    it('should not contain English LLM words (delve, intricate, showcase) in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        expect(html, `${pagePath} should not contain English LLM words`).not.toMatch(/\bdelve\b/i);
        expect(html, `${pagePath} should not contain English LLM words`).not.toMatch(/\bintricate\b/i);
        expect(html, `${pagePath} should not contain English LLM words`).not.toMatch(/\bshowcas(e|ing)\b/i);
      }
    });

    it('should not contain LLM calques in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, IN_SCOPE_PAGES.llmsTxt);
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/é fundamental ressaltar/i);
      expect(text).not.toMatch(/papel crucial/i);
      expect(text).not.toMatch(/\bdelve\b/i);
    });
  });

  describe('Test: No "Não X, mas Y" rhetorical pattern', () => {
    it('should not contain "Não X, mas Y" pattern in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        // Match "Não [up to 60 chars], mas " pattern (REDACAO NEVER #3)
        expect(html, `${pagePath} should not contain "Não X, mas Y" rhetorical pattern`).not.toMatch(/Não [^.]{0,60}, mas /i);
      }
    });

    it('should not contain "Não X, mas Y" pattern in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, IN_SCOPE_PAGES.llmsTxt);
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/Não [^.]{0,60}, mas /i);
    });
  });

  describe('Test: No value adjectives without cifra', () => {
    it('should not contain value adjectives (poderoso, polêmico, gigante, tragédia) in any HTML page', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      for (const pagePath of getInScopeHtmlPages()) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        
        // REDACAO NEVER #6: poderoso, polêmico, gigante, tragédia
        expect(html, `${pagePath} should not contain "poderoso"`).not.toMatch(/\bpoderos[oa]s?\b/i);
        expect(html, `${pagePath} should not contain "polêmico"`).not.toMatch(/\bpolêmic[oa]s?\b/i);
        expect(html, `${pagePath} should not contain "gigante"`).not.toMatch(/\bgigantes?\b/i);
        expect(html, `${pagePath} should not contain "tragédia"`).not.toMatch(/\btragédias?\b/i);
      }
    });

    it('should not contain value adjectives in llms.txt', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, IN_SCOPE_PAGES.llmsTxt);
      const text = fs.readFileSync(llmsPath, 'utf-8');
      
      expect(text).not.toMatch(/\bpoderos[oa]s?\b/i);
      expect(text).not.toMatch(/\bpolêmic[oa]s?\b/i);
      expect(text).not.toMatch(/\bgigantes?\b/i);
      expect(text).not.toMatch(/\btragédias?\b/i);
    });
  });

  describe('Test: Citations remain visible in dossiers', () => {
    it('should have visible citation markers in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check for citation markers (sup with brackets or just brackets)
      const hasCitationMarkers = /<sup[^>]*class="citation-marker"[^>]*>\[[\d]+\]<\/sup>/i.test(html) || /\[[\d]+\]/.test(html);
      expect(hasCitationMarkers).toBe(true);
    });

    it('should have References section in p1 dossier', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toMatch(/Referências/i);
    });

    it('should have visible sources in p1 dossier references', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const dossierPath = path.join(distPath, IN_SCOPE_PAGES.p1Dossier);
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check that references contain publisher names and URLs
      expect(html).toMatch(/Receita Federal do Brasil/);
      expect(html).toMatch(/https:\/\//);
    });
  });
});
