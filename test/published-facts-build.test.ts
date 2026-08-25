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
          USE_PUBLISHED_FACTS: 'true',
          VITEST: 'true'
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

  describe('PM Spec: Association facts must be rendered', () => {
    it('should render association fact with citation in João Silva dossier', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must have association section
      expect(html).toMatch(/associações/i);
      
      // Must have the association value from the published fact
      expect(html).toContain('Relação entre João Silva e Maria Santos através de investimentos cruzados');
      
      // Must have citation for the association
      expect(html).toMatch(/\[\d+\]/);
    });
  });

  describe('PM Spec: No CVM hole when control edges exist', () => {
    it('should not show "Informações sobre controle acionário não identificadas" when control_edge exists', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must NOT have the CVM hole text
      expect(html).not.toContain('Informações sobre controle acionário não identificadas');
    });
    
    it('should map control_edge facts to CVM control objects', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must have CVM control section (not just RF edges)
      expect(html).toMatch(/Controle Acionário.*CVM/i);
      
      // Must show control from control_edge fact
      expect(html).toContain('Empresa XYZ Ltda.');
      expect(html).toContain('sócio');
    });
  });

  describe('PM Spec: No invented facts or text', () => {
    it('should not invent "Eleições Municipais" cycle text', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must not invent election cycle text
      expect(html).not.toContain('Eleições Municipais');
    });
    
    it('should not invent CPF identity fact that borrows another source', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // If CPF appears, it must only be from a fact that has cpf_masked
      // Check that CPF isn't listed as a separate identity fact with wrong source
      if (html.includes('***000***')) {
        // The CPF should appear inline with other identity facts, not as standalone
        // It should not have a citation to a source that doesn't mention CPF
        const identitySection = html.match(/<section[^>]*>[\s\S]*?<h2[^>]*>Identidade[\s\S]*?<\/section>/i);
        if (identitySection) {
          // CPF should not be listed as "CPF: ***000*** [citation]" separate from the facts that have it
          expect(identitySection[0]).not.toMatch(/CPF:?\s*\*\*\*\d{3}\*\*\*\s*\[\d+\]/);
        }
      }
    });
    
    it('should only show cpf_masked when the published row itself carries it', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      // Maria Santos has no cpf_masked in published facts - must not show CPF
      const mariaDossierPath = path.join(distPath, 'pessoa', 'Maria Santos', 'index.html');
      const mariaHtml = fs.readFileSync(mariaDossierPath, 'utf-8');
      
      // Must not show any ***NNN*** format
      expect(mariaHtml).not.toMatch(/\*\*\*\d{3}\*\*\*/);
    });
  });

  describe('PM Spec: CPF masking in all formats', () => {
    it('should have ***NNN*** in HTML, never 11 digits', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must have masked CPF
      expect(html).toContain('***000***');
      
      // Must not have 11 consecutive digits in body (excluding URLs)
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        const bodyText = bodyMatch[1].replace(/<a[^>]*href="[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
        expect(bodyText).not.toMatch(/\d{11}/);
      }
    });
    
    it('should have ***NNN*** in markdown mirror', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const mdPath = path.join(distPath, 'pessoa', 'João Silva.md');
      const md = fs.readFileSync(mdPath, 'utf-8');
      
      // Must have masked CPF in markdown
      expect(md).toContain('***000***');
      
      // Must not have 11 consecutive digits
      expect(md).not.toMatch(/\d{11}/);
    });
    
    it('should have ***NNN*** in JSON-LD Person schema', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      expect(jsonLdMatch).toBeTruthy();
      
      if (jsonLdMatch) {
        const jsonLd = jsonLdMatch[1];
        const schema = JSON.parse(jsonLd);
        
        // João Silva has cpf_masked in published facts
        // Must have CPF field with masked value
        expect(schema).toHaveProperty('taxID');
        expect(schema.taxID).toBe('***000***');
        
        // Must not have 11 consecutive digits anywhere in JSON-LD
        expect(jsonLd).not.toMatch(/\d{11}/);
      }
    });
  });

  describe('Is Agentic content-no-js check (500+ characters)', () => {
    it('should have 500+ characters of real cited text in home page static HTML', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      // Extract body content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      expect(bodyMatch).toBeTruthy();
      
      const bodyHtml = bodyMatch![1];
      
      // Remove script tags, style tags, and HTML tags to get text content
      const textContent = bodyHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      expect(textContent.length).toBeGreaterThanOrEqual(500);
      
      // Must contain person names (real content)
      expect(textContent).toContain('João Silva');
      
      // Must have at least one citation marker (Wikipedia-style [n])
      expect(html).toMatch(/\[\d+\]/);
      
      // Must NOT contain unsourced methodology prose (specific phrases from the old paragraph)
      expect(textContent).not.toContain('Congelamento editorial');
      expect(textContent).not.toContain('Sem narrativa especulativa');
      expect(textContent).not.toContain('Metodologia documentada');
      
      // Must not contain 11-digit CPF
      expect(textContent).not.toMatch(/\d{11}/);
    });

    it('should have 500+ characters of real cited text in João Silva dossier static HTML', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract body content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      expect(bodyMatch).toBeTruthy();
      
      const bodyHtml = bodyMatch![1];
      
      // Remove script tags, style tags, and HTML tags to get text content
      const textContent = bodyHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      expect(textContent.length).toBeGreaterThanOrEqual(500);
      
      // Must contain real facts (person name, company, role)
      expect(textContent).toContain('João Silva');
      expect(textContent).toContain('Empresa XYZ Ltda.');
      expect(textContent).toContain('controlador');
      
      // Must contain citations (Wikipedia-style numbered refs)
      expect(textContent).toMatch(/\[\d+\]/);
      expect(textContent).toContain('Referências');
      
      // Must not contain 11-digit CPF (only masked ***NNN***)
      expect(textContent).not.toMatch(/\d{11}/);
      expect(textContent).toMatch(/\*\*\*\d{3}\*\*\*/);
    });

    it('should have citations in static HTML, not behind JavaScript', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check that References section exists in HTML
      expect(html).toContain('<h2');
      expect(html).toContain('Referências');
      expect(html).toContain('<ol');
      expect(html).toContain('<li');
      
      // Check that citation markers exist in HTML
      const citationMarkers = html.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g);
      expect(citationMarkers).toBeTruthy();
      expect(citationMarkers!.length).toBeGreaterThan(0);
      
      // No Astro islands (no client: directives)
      expect(html).not.toContain('client:load');
      expect(html).not.toContain('client:visible');
      expect(html).not.toContain('client:idle');
      expect(html).not.toContain('client:only');
    });

    it('should not have empty shell that fills in later', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check that facts are already in HTML (not fetched client-side)
      expect(html).toContain('João Silva');
      expect(html).toContain('controlador');
      expect(html).toContain('Empresa XYZ Ltda.');
      
      // Check that there's no placeholder content
      expect(html).not.toContain('Loading...');
      expect(html).not.toContain('Carregando...');
      
      // No fetch calls in scripts
      const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          expect(script).not.toContain('fetch(');
          expect(script).not.toContain('axios');
        }
      }
    });
  });
});
