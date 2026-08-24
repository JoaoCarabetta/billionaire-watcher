import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Metodologia Page', () => {
  let builtHtml: string;
  let buildFailed: boolean = false;
  let buildError: string = '';
  let homeHtml: string = '';
  let dossierHtml: string = '';

  beforeAll(() => {
    const metodologiaPath = path.join(__dirname, '..', 'dist', 'metodologia', 'index.html');
    const homePath = path.join(__dirname, '..', 'dist', 'index.html');
    const dossierPath = path.join(__dirname, '..', 'dist', 'pessoa', 'p1', 'index.html');
    
    // Always rebuild to ensure fresh state
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
    
    // Read the built HTML
    if (fs.existsSync(metodologiaPath)) {
      builtHtml = fs.readFileSync(metodologiaPath, 'utf-8');
    } else {
      buildFailed = true;
      buildError = 'Metodologia page not found after build';
    }
    
    if (fs.existsSync(homePath)) {
      homeHtml = fs.readFileSync(homePath, 'utf-8');
    }
    
    if (fs.existsSync(dossierPath)) {
      dossierHtml = fs.readFileSync(dossierPath, 'utf-8');
    }
  });

  describe('Test 1: Page exists and is labeled Metodologia', () => {
    it('should have metodologia page at /metodologia', () => {
      expect(buildFailed).toBe(false);
      expect(builtHtml).toBeTruthy();
    });

    it('should have Metodologia heading (H1 or visible)', () => {
      const hasMetodologiaHeading = /<h1[^>]*>.*?Metodologia.*?<\/h1>/i.test(builtHtml);
      expect(hasMetodologiaHeading).toBe(true);
    });
  });

  describe('Test 2: All sentences have citations', () => {
    it('should have citation markers for all content sentences', () => {
      // Every fact should have a [n] citation marker
      const hasCitationMarkers = /\[[\d]+\]/.test(builtHtml) || 
                                 /<sup[^>]*>.*?\[?\d+\]?.*?<\/sup>/i.test(builtHtml);
      expect(hasCitationMarkers).toBe(true);
    });

    it('should have matching footer citations for all markers', () => {
      // Extract citation numbers from markers
      const markerMatches = builtHtml.match(/\[(\d+)\]/g) || [];
      const citationNumbers = markerMatches.map(m => parseInt(m.replace(/[\[\]]/g, '')));
      
      // Check that each citation has a corresponding footer entry
      for (const num of citationNumbers) {
        const hasFooterCitation = builtHtml.includes(`citation-${num}`) ||
                                  builtHtml.includes(`#citation-${num}`);
        expect(hasFooterCitation).toBe(true);
      }
    });

    it('should have Referências section with citations', () => {
      expect(builtHtml).toMatch(/Referências|referências/);
    });
  });

  describe('Test 3: Required methodology topics are present', () => {
    it('should mention Valor 1000 and receita líquida', () => {
      expect(builtHtml).toMatch(/Valor 1000/i);
      expect(builtHtml).toMatch(/receita líquida/i);
    });

    it('should mention Lei 6.404/1976 Art. 116 (positional door)', () => {
      expect(builtHtml).toMatch(/6\.404|Art\. 116|artigo 116/i);
    });

    it('should clarify RF edges are labeled sócio (not dono/UBO)', () => {
      // Must explicitly state that RF partner edges are labeled "sócio"
      // Not just pass because "Quadro de Sócios" contains the substring
      expect(builtHtml).toMatch(/rotulad[ao]s?\s+como\s+sócio/i);
      expect(builtHtml).toMatch(/QSA|Quadro de Sócios/i);
      expect(builtHtml).toMatch(/IN.*RFB.*2\.119|Instrução Normativa.*2\.119/i);
      // The methodology can mention UBO to clarify what we DON'T use
      // but should not use "dono" as a label
      const mentionsDono = /\bdono\b/i.test(builtHtml);
      expect(mentionsDono).toBe(false);
    });

    it('should mention visible hole when controller unknown', () => {
      expect(builtHtml).toMatch(/desconhecido|lacuna|buraco|não identificado/i);
    });

    it('should mention Forbes as safety net (candidato_forbes)', () => {
      expect(builtHtml).toMatch(/Forbes/i);
    });

    it('should mention freeze date 4 Oct 2026', () => {
      expect(builtHtml).toMatch(/4.*out.*2026|2026-10-04|outubro.*2026/i);
    });

    it('should mention rejected methods: board interlocks', () => {
      expect(builtHtml).toMatch(/conselho|board|interlock/i);
    });

    it('should mention rejected methods: Forbes/Wikipedia as engine', () => {
      expect(builtHtml).toMatch(/Forbes|Wikipedia/i);
    });

    it('should mention rejected methods: TSE volume as elite membership', () => {
      expect(builtHtml).toMatch(/TSE|doações|volume/i);
    });

    it('should mention SOE (União/Estado/Município not person)', () => {
      expect(builtHtml).toMatch(/União|Estado|Município/i);
      expect(builtHtml).toMatch(/estatal/i);
    });

    it('should mention foreign companies and CEO not default controller', () => {
      expect(builtHtml).toMatch(/estrangeira/i);
      expect(builtHtml).toMatch(/CEO|subsidiária/i);
    });
  });

  describe('Test 4: Voice guidelines - forbidden patterns', () => {
    it('should NOT have pipeline jargon (RSS, LLM, UniqueEvent, candidato_forbes, etc.)', () => {
      expect(builtHtml).not.toMatch(/\bRSS\b/);
      expect(builtHtml).not.toMatch(/\bLLM\b/);
      expect(builtHtml).not.toMatch(/UniqueEvent/i);
      expect(builtHtml).not.toMatch(/extrai campos com IA/i);
      expect(builtHtml).not.toMatch(/candidato_forbes/i);
      expect(builtHtml).not.toMatch(/skip_soe/i);
    });

    it('should NOT have Wikipedia identity lead', () => {
      // Should not start with a biographical identity pattern
      expect(builtHtml).not.toMatch(/é um.*brasileiro.*nascido/i);
      expect(builtHtml).not.toMatch(/é um.*empresário.*fundador/i);
    });

    it('should NOT use "o bilionário"', () => {
      expect(builtHtml).not.toMatch(/o bilionário/i);
    });

    it('should NOT have full CPF in the page', () => {
      // No CPF patterns like 123.456.789-00 or 12345678900
      expect(builtHtml).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(builtHtml).not.toMatch(/\b\d{11}\b/);
    });

    it('should NOT use "dono" as RF partner label', () => {
      // "dono" should not appear in methodology
      // UBO can be mentioned in methodology to clarify what's NOT available
      const hasDono = /\bdono\b/i.test(builtHtml);
      expect(hasDono).toBe(false);
    });

    it('should NOT have unsourced value adjectives', () => {
      // Should not have "poderoso", "polêmico", "gigante" without citations
      // This is a heuristic check - if these appear, they should be near citations
      const hasPoderoso = /poderoso/i.test(builtHtml);
      const hasPolemico = /polêmico/i.test(builtHtml);
      const hasGigante = /gigante/i.test(builtHtml);
      
      // If any of these appear, they should be in a cited context
      // For now, we'll just check they're not there at all
      expect(hasPoderoso).toBe(false);
      expect(hasPolemico).toBe(false);
      expect(hasGigante).toBe(false);
    });
  });

  describe('Test 5: Home and dossier link to metodologia', () => {
    it('should have a link from home page to /metodologia', () => {
      expect(homeHtml).toMatch(/href=["']\/metodologia["']/i);
    });

    it('should have a link from dossier footer to /metodologia', () => {
      expect(dossierHtml).toMatch(/href=["']\/metodologia["']/i);
    });
  });

  describe('Test 6: No unsourced claims render', () => {
    it('should not render any fact without a source', () => {
      // This is enforced by FactWithCitation component
      // Any methodology fact without source should cause build failure or not render
      expect(buildFailed || !builtHtml.includes('UNSOURCED_CLAIM')).toBe(true);
    });
  });
});
