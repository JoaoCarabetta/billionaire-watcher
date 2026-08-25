import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Published Facts Build Integration', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    distPath = path.join(__dirname, '..', 'dist');
    
    // Build with USE_PUBLISHED_FACTS=true
    try {
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          USE_PUBLISHED_FACTS: 'true'
        }
      });
    } catch (error: any) {
      buildFailed = true;
      buildError = error.message || String(error);
    }
  });

  describe('Freeze list from published facts', () => {
    it('should build successfully with USE_PUBLISHED_FACTS=true', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const indexPath = path.join(distPath, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should build dossier for p1 from published facts', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for p1 should exist`).toBe(true);
    });

    it('should build dossier for p4 from published facts (not in freeze CSV)', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p4', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for p4 should exist when using published facts`).toBe(true);
    });

    it('should list p1, p2, p3, p4 on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('João Silva');
      expect(html).toContain('Maria Santos');
      expect(html).toContain('Ana Lima');
      expect(html).toContain('Pedro Costa');
    });
  });

  describe('Facts rendering with citations', () => {
    it('should render identity facts with citations for p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('João Silva');
      expect(html).toContain('Brasileira');
      
      // Must have citation markers
      const hasSuperscriptPattern = /<sup[^>]*>.*?<\/sup>/i.test(html) || /\[[\d]+\]/.test(html);
      expect(hasSuperscriptPattern).toBe(true);
    });

    it('should include References section with sources', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Referências');
      expect(html).toContain('https://www.gov.br/receitafederal');
    });

    it('should render control edge facts with group_name', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Empresa XYZ Ltda.');
    });
  });

  describe('CPF masking from published facts', () => {
    it('should render masked CPF ***NNN*** format in identity section for p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract identity section
      const identityMatch = html.match(/<section[^>]*>[\s\S]*?<h2[^>]*>Dados de Identidade<\/h2>[\s\S]*?<\/section>/);
      expect(identityMatch).toBeTruthy();
      
      const identityHtml = identityMatch![0];
      
      // Should contain masked CPF
      expect(identityHtml).toContain('***000***');
      
      // Should not contain full-format CPF in identity section
      expect(identityHtml).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    });

    it('should render masked CPF ***NNN*** format for p3', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should contain name
      expect(html).toContain('Ana Lima');
      
      // Extract identity section
      const identityMatch = html.match(/<section[^>]*>[\s\S]*?<h2[^>]*>Dados de Identidade<\/h2>[\s\S]*?<\/section>/);
      expect(identityMatch).toBeTruthy();
      
      const identityHtml = identityMatch![0];
      
      // Should contain masked CPF
      expect(identityHtml).toContain('***122***');
      
      // Should not contain original CPF
      expect(html).not.toContain('345.678.901-22');
      expect(html).not.toContain('34567890122');
    });

    it('should not render full-format CPF in body text across all dossiers', () => {
      const pessoaDir = path.join(distPath, 'pessoa');
      const entries = fs.readdirSync(pessoaDir);
      
      // Filter to only directories (not .md files)
      const personIds = entries.filter(entry => {
        const fullPath = path.join(pessoaDir, entry);
        return fs.statSync(fullPath).isDirectory();
      });
      
      for (const personId of personIds) {
        const dossierPath = path.join(pessoaDir, personId, 'index.html');
        const html = fs.readFileSync(dossierPath, 'utf-8');
        
        // Extract body text (not URLs or data attributes)
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
        if (!bodyMatch) continue;
        
        const bodyHtml = bodyMatch[1];
        
        // Remove href and data-* attributes before checking
        const textOnly = bodyHtml
          .replace(/href="[^"]*"/g, '')
          .replace(/data-[^=]*="[^"]*"/g, '');
        
        // Should not contain full-format CPF in text
        expect(textOnly).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });
  });

  describe('Every claim has citation', () => {
    it('should have citation marker for every fact in p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract fact divs
      const factDivMatches = html.match(/<div class="fact"[^>]*>/g);
      if (!factDivMatches) {
        // No explicit fact divs, check that all identity values have citations
        const identitySection = html.match(/<section[^>]*>[\s\S]*?<h2>Dados de Identidade<\/h2>[\s\S]*?<\/section>/);
        if (identitySection) {
          const sectionHtml = identitySection[0];
          const citationMarkers = sectionHtml.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
          expect(citationMarkers).toBeTruthy();
          expect(citationMarkers!.length).toBeGreaterThan(0);
        }
        return;
      }
      
      // Each fact div should have a citation marker
      const citationMarkers = html.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
      expect(citationMarkers).toBeTruthy();
      expect(citationMarkers!.length).toBeGreaterThanOrEqual(factDivMatches.length);
    });
  });
});
