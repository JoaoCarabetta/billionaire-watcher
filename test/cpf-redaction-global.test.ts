import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Global CPF Redaction (Both Old Fixtures and Published Facts)', () => {
  describe('Old Fixture Path (/pessoa/p1, p2, p3)', () => {
    let distPath: string;
    let buildFailed: boolean = false;
    let buildError: string = '';

    beforeAll(() => {
      distPath = path.join(__dirname, '..', 'dist');
      
      // Build with old fixtures
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

    it('should not have 11-digit CPF in p1 HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Must not have 11 consecutive digits
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        // Exclude URLs from check
        const bodyText = bodyMatch[1].replace(/<a[^>]*href="[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
        expect(bodyText).not.toMatch(/\d{11}/);
      }
    });

    it('should not have formatted CPF (NNN.NNN.NNN-NN) in p1 HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Must not have formatted CPF pattern
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        expect(bodyMatch[1]).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });

    it('should have only ***NNN*** format for CPF in p1 HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Should have masked CPF (last 3 digits of 123.456.789-00 are 900)
      expect(html).toMatch(/\*\*\*\d{3}\*\*\*/);
    });

    it('should not have 11-digit CPF in p1 markdown mirror', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const mdPath = path.join(distPath, 'pessoa', 'p1.md');
      const md = fs.readFileSync(mdPath, 'utf-8');
      
      // Must not have 11 consecutive digits
      expect(md).not.toMatch(/\d{11}/);
    });

    it('should not have formatted CPF in p1 markdown mirror', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const mdPath = path.join(distPath, 'pessoa', 'p1.md');
      const md = fs.readFileSync(mdPath, 'utf-8');
      
      // Must not have formatted CPF pattern
      expect(md).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    });

    it('should not have 11-digit CPF in p1 JSON-LD', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Extract JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        const jsonLd = jsonLdMatch[1];
        expect(jsonLd).not.toMatch(/\d{11}/);
      }
    });

    it('should redact CPF in p2 HTML (234.567.890-11)', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Must not have full CPF
      expect(html).not.toContain('234.567.890-11');
      expect(html).not.toMatch(/23456789011/);
    });

    it('should redact CPF in p3 HTML (345.678.901-22)', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Must not have full CPF
      expect(html).not.toContain('345.678.901-22');
      expect(html).not.toMatch(/34567890122/);
    });

    it('should redact candidate CPF in donations section', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Should not show candidate CPF numbers from candidates.json
      expect(html).not.toContain('555.666.777-88');
      expect(html).not.toContain('777.888.999-00');
      expect(html).not.toContain('888.999.000-11');
    });
  });

  describe('Published Facts Path (/pessoa/João Silva, Maria Santos, Ana Lima)', () => {
    let distPath: string;
    let buildFailed: boolean = false;
    let buildError: string = '';

    beforeAll(() => {
      distPath = path.join(__dirname, '..', 'dist');
      
      // Build with published facts
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

    it('should not have 11-digit CPF in João Silva HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Must not have 11 consecutive digits in body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        const bodyText = bodyMatch[1].replace(/<a[^>]*href="[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
        expect(bodyText).not.toMatch(/\d{11}/);
      }
    });

    it('should not have formatted CPF in João Silva HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
      if (bodyMatch) {
        expect(bodyMatch[1]).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });

    it('should have only ***NNN*** format in João Silva HTML', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'João Silva', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Should have ***000*** from published facts
      expect(html).toContain('***000***');
    });

    it('should not have 11-digit CPF in João Silva markdown', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const mdPath = path.join(distPath, 'pessoa', 'João Silva.md');
      const md = fs.readFileSync(mdPath, 'utf-8');
      
      expect(md).not.toMatch(/\d{11}/);
    });

    it('should not have formatted CPF in João Silva markdown', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const mdPath = path.join(distPath, 'pessoa', 'João Silva.md');
      const md = fs.readFileSync(mdPath, 'utf-8');
      
      expect(md).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    });

    it('should not have CPF in Maria Santos (none in published facts)', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const htmlPath = path.join(distPath, 'pessoa', 'Maria Santos', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Maria Santos has no cpf_masked in published facts
      expect(html).not.toMatch(/\*\*\*\d{3}\*\*\*/);
    });
  });
});
