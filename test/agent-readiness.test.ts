import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: Agent Readiness (is-agentic Essential)', () => {
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

  describe('Test 1: Content in initial HTML (no JS-only body)', () => {
    it('should render home page facts in static HTML', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      // Home should have person names in the initial response
      expect(html).toContain('João Silva');
      expect(html).toContain('/pessoa/p1');
    });

    it('should render dossier facts in static HTML for p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Dossier should have identity facts in the initial response
      expect(html).toContain('João Silva');
      expect(html).toContain('Brasileira');
    });

    it('should render donations table in static HTML', () => {
      const doacoesPath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(doacoesPath, 'utf-8');
      
      // Donations should have table with data in the initial response
      expect(html).toContain('Doações Políticas');
      expect(html).toMatch(/<table/);
    });
  });

  describe('Test 2: sitemap.xml lists all routes', () => {
    it('should have sitemap.xml in dist root', () => {
      const sitemapPath = path.join(distPath, 'sitemap.xml');
      expect(fs.existsSync(sitemapPath), 'sitemap.xml should exist in dist/').toBe(true);
    });

    it('should list home page in sitemap.xml', () => {
      const sitemapPath = path.join(distPath, 'sitemap.xml');
      const xml = fs.readFileSync(sitemapPath, 'utf-8');
      
      expect(xml).toMatch(/<loc>[^<]*\/<\/loc>/);
    });

    it('should list metodologia in sitemap.xml', () => {
      const sitemapPath = path.join(distPath, 'sitemap.xml');
      const xml = fs.readFileSync(sitemapPath, 'utf-8');
      
      expect(xml).toMatch(/<loc>[^<]*\/metodologia\/<\/loc>/);
    });

    it('should list doacoes in sitemap.xml', () => {
      const sitemapPath = path.join(distPath, 'sitemap.xml');
      const xml = fs.readFileSync(sitemapPath, 'utf-8');
      
      expect(xml).toMatch(/<loc>[^<]*\/doacoes\/<\/loc>/);
    });

    it('should list person dossier routes in sitemap.xml', () => {
      const sitemapPath = path.join(distPath, 'sitemap.xml');
      const xml = fs.readFileSync(sitemapPath, 'utf-8');
      
      expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p1\/<\/loc>/);
      expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p2\/<\/loc>/);
      expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p3\/<\/loc>/);
    });
  });

  describe('Test 3: llms.txt exists and points to key routes', () => {
    it('should have llms.txt in dist root', () => {
      const llmsTxtPath = path.join(distPath, 'llms.txt');
      expect(fs.existsSync(llmsTxtPath), 'llms.txt should exist in dist/').toBe(true);
    });

    it('should explain what the archive is', () => {
      const llmsTxtPath = path.join(distPath, 'llms.txt');
      const content = fs.readFileSync(llmsTxtPath, 'utf-8');
      
      // Should mention it's a civic archive and economic power
      expect(content.toLowerCase()).toMatch(/arquivo|archive/);
      expect(content.toLowerCase()).toMatch(/poder econômico|economic power|bilion/);
    });

    it('should link to metodologia', () => {
      const llmsTxtPath = path.join(distPath, 'llms.txt');
      const content = fs.readFileSync(llmsTxtPath, 'utf-8');
      
      expect(content).toMatch(/metodologia/);
    });

    it('should explain how person URLs work', () => {
      const llmsTxtPath = path.join(distPath, 'llms.txt');
      const content = fs.readFileSync(llmsTxtPath, 'utf-8');
      
      expect(content).toMatch(/\/pessoa\//);
    });
  });

  describe('Test 4: Real 404 page (not soft-404 SPA)', () => {
    it('should have 404.html in dist root', () => {
      const notFoundPath = path.join(distPath, '404.html');
      expect(fs.existsSync(notFoundPath), '404.html should exist in dist/').toBe(true);
    });

    it('should have real HTML content in 404 page', () => {
      const notFoundPath = path.join(distPath, '404.html');
      const html = fs.readFileSync(notFoundPath, 'utf-8');
      
      // Should have proper HTML structure
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/<html/);
      expect(html).toMatch(/<body/);
      
      // Should have meaningful content about not found
      expect(html.toLowerCase()).toMatch(/404|não encontrad|not found/);
    });

    it('should link back to home from 404 page', () => {
      const notFoundPath = path.join(distPath, '404.html');
      const html = fs.readFileSync(notFoundPath, 'utf-8');
      
      expect(html).toMatch(/href="\/"/);
    });
  });

  describe('Test 5: Semantic HTML with one h1 and visible citations', () => {
    it('should have exactly one h1 on home page', () => {
      const homePath = path.join(distPath, 'index.html');
      const html = fs.readFileSync(homePath, 'utf-8');
      
      const h1Matches = html.match(/<h1[^>]*>/g);
      expect(h1Matches).toBeTruthy();
      expect(h1Matches!.length).toBe(1);
    });

    it('should have exactly one h1 on dossier page', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const h1Matches = html.match(/<h1[^>]*>/g);
      expect(h1Matches).toBeTruthy();
      expect(h1Matches!.length).toBe(1);
    });

    it('should have exactly one h1 on donations page', () => {
      const doacoesPath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(doacoesPath, 'utf-8');
      
      const h1Matches = html.match(/<h1[^>]*>/g);
      expect(h1Matches).toBeTruthy();
      expect(h1Matches!.length).toBe(1);
    });

    it('should have citations as visible text in HTML for dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Citations should be visible text (superscript with brackets)
      expect(html).toMatch(/<sup[^>]*>\[[\d]+\]<\/sup>/);
      
      // Should not be hidden in canvas/images/display:none
      const citationContext = html.match(/<sup[^>]*>\[[\d]+\]<\/sup>/)?.[0];
      expect(citationContext).toBeDefined();
    });
  });
});
