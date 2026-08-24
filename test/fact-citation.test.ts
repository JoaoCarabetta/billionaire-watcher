import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Fact + Citation Seam', () => {
  let builtHtml: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    try {
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8'
      });
      
      const distPath = path.join(__dirname, '..', 'dist', 'index.html');
      if (fs.existsSync(distPath)) {
        builtHtml = fs.readFileSync(distPath, 'utf-8');
      }
    } catch (error: any) {
      buildFailed = true;
      buildError = error.message || String(error);
    }
  });

  describe('Test 1: Fact with Source renders with visible citation', () => {
    it('should render fact-1 claim in HTML', () => {
      expect(builtHtml).toContain('João Silva é controlador da Empresa XYZ Ltda.');
    });

    it('should render visible citation with publisher for fact-1', () => {
      expect(builtHtml).toContain('Receita Federal do Brasil');
    });

    it('should render visible citation with locator for fact-1', () => {
      expect(builtHtml).toContain('https://www.gov.br/receitafederal');
    });

    it('should have Wikipedia-style superscript citation format', () => {
      const hasSuperscriptPattern = /<sup[^>]*>.*?<\/sup>/i.test(builtHtml) ||
                                    /\[[\d]+\]/.test(builtHtml);
      expect(hasSuperscriptPattern).toBe(true);
    });
  });

  describe('Test 2: Fact without Source is not in HTML or build fails', () => {
    it('should either not contain unsourced fact-3 or build should fail', () => {
      if (buildFailed) {
        expect(buildError).toBeTruthy();
      } else {
        expect(builtHtml).not.toContain('Pedro Costa é um bilionário famoso.');
      }
    });
  });

  describe('Test 3: Derived association cites parent Facts only', () => {
    it('should render assoc-1 description in HTML', () => {
      expect(builtHtml).toContain('João Silva e Maria Santos têm conexão através de doação política');
    });

    it('should cite parent fact-1 publisher in references', () => {
      const assocText = 'João Silva e Maria Santos têm conexão através de doação política';
      const assocIndex = builtHtml.indexOf(assocText);
      expect(assocIndex).toBeGreaterThan(-1);
      
      const citationMatch = builtHtml.slice(assocIndex, assocIndex + 200).match(/\[(\d+)\]/g);
      expect(citationMatch).toBeTruthy();
      
      const citationNumbers = citationMatch!.map(m => parseInt(m.match(/\d+/)![0]));
      expect(citationNumbers).toContain(1);
    });

    it('should cite parent fact-2 publisher in references', () => {
      const assocText = 'João Silva e Maria Santos têm conexão através de doação política';
      const assocIndex = builtHtml.indexOf(assocText);
      
      const citationMatch = builtHtml.slice(assocIndex, assocIndex + 200).match(/\[(\d+)\]/g);
      const citationNumbers = citationMatch!.map(m => parseInt(m.match(/\d+/)![0]));
      expect(citationNumbers).toContain(2);
    });

    it('should not render association without parent facts', () => {
      expect(builtHtml).not.toContain('Pedro Costa está associado com pessoas poderosas');
    });
  });

  describe('Test 4: CPF is redacted from HTML', () => {
    it('should render fact-4 claim', () => {
      expect(builtHtml).toContain('Ana Lima é controladora da DEF Holdings');
    });

    it('should not contain fact-4 CPF field in HTML', () => {
      expect(builtHtml).not.toContain('123.456.789-00');
      expect(builtHtml).not.toContain('12345678900');
    });

    it('should redact CPF from fact-5 value string', () => {
      expect(builtHtml).toContain('Carlos Mendes');
      expect(builtHtml).toContain('GHI Investimentos');
      expect(builtHtml).not.toContain('987.654.321-00');
      expect(builtHtml).not.toContain('98765432100');
    });
  });

  describe('Test 5: Unsourced prose is not in HTML', () => {
    it('should not contain unsourced LLM/prose text from fixture', () => {
      expect(builtHtml).not.toContain('texto inventado por IA');
      expect(builtHtml).not.toContain('narrativa especulativa');
    });

    it('should not contain hardcoded editorial prose without citations', () => {
      expect(builtHtml).not.toContain('dossiês HTML gerados de dados públicos');
      expect(builtHtml).not.toContain('Arquivo cívico');
    });
  });
});
