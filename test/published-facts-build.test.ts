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
    
    // Build from published facts (uses git fixture when USE_PUBLISHED_FACTS is set)
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
    it('should build successfully from published facts', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const indexPath = path.join(distPath, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should build dossier for João Silva from published facts', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for João Silva should exist`).toBe(true);
    });

    it('should build dossier for Maria Santos from published facts', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'Maria Santos', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for Maria Santos should exist`).toBe(true);
    });

    it('should build dossier for Ana Lima from published facts', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'Ana Lima', 'index.html');
      expect(fs.existsSync(dossierPath), `Dossier page for Ana Lima should exist`).toBe(true);
    });

    it('should list João Silva, Maria Santos, Ana Lima on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      expect(html).toContain('João Silva');
      expect(html).toContain('Maria Santos');
      expect(html).toContain('Ana Lima');
    });
  });

  describe('Facts rendering with citations', () => {
    it('should render identity facts with citations for João Silva', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('João Silva');
      expect(html).toContain('controlador');
      
      // Must have citation markers
      const hasSuperscriptPattern = /<sup[^>]*>.*?<\/sup>/i.test(html) || /\[[\d]+\]/.test(html);
      expect(hasSuperscriptPattern).toBe(true);
    });

    it('should include References section with sources', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Referências');
      expect(html).toContain('Receita Federal');
    });

    it('should render control edge facts with company name', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Empresa XYZ Ltda.');
      expect(html).toContain('sócio');
    });

    it('should render donation facts', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Fernanda Almeida');
      expect(html).toContain('Marina Costa');
    });
  });

  describe('CPF masking from published facts', () => {
    it('should render masked CPF ***NNN*** format for João Silva', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
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

    it('should render masked CPF ***NNN*** format for Ana Lima', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'Ana Lima', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should contain name
      expect(html).toContain('Ana Lima');
      
      // Extract identity section
      const identityMatch = html.match(/<section[^>]*>[\s\S]*?<h2[^>]*>Dados de Identidade<\/h2>[\s\S]*?<\/section>/);
      expect(identityMatch).toBeTruthy();
      
      const identityHtml = identityMatch![0];
      
      // Should contain masked CPF
      expect(identityHtml).toContain('***122***');
      
      // Should not contain 11-digit CPF
      expect(html).not.toMatch(/\d{11}/);
    });

    it('should not render 11 consecutive digits in body text across all dossiers', () => {
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
        
        // Should not contain 11 consecutive digits (CPF)
        expect(textOnly).not.toMatch(/\d{11}/);
        // Should not contain full-format CPF
        expect(textOnly).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });
  });

  describe('Every claim has citation', () => {
    it('should have citation marker for every fact in João Silva dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract fact divs
      const factDivMatches = html.match(/<div class="fact"[^>]*>/g);
      if (!factDivMatches) {
        // No explicit fact divs, check that all sections have citations
        const citationMarkers = html.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
        expect(citationMarkers).toBeTruthy();
        expect(citationMarkers!.length).toBeGreaterThan(0);
        return;
      }
      
      // Each fact div should have a citation marker
      const citationMarkers = html.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
      expect(citationMarkers).toBeTruthy();
      expect(citationMarkers!.length).toBeGreaterThanOrEqual(factDivMatches.length);
    });
  });
});
