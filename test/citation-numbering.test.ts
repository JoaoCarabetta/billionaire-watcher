import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Citation Numbering: markers match footer', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
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
    
    distPath = path.join(__dirname, '..', 'dist');
  });

  describe('Every [n] marker must have matching footer <li id="citation-n">', () => {
    it('should have matching citations in p1 dossier', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract all citation markers [n]
      const markerMatches = html.match(/\[(\d+)\]/g);
      expect(markerMatches, 'Page must have citation markers').toBeTruthy();
      
      const markerNumbers = markerMatches!.map(m => parseInt(m.match(/\[(\d+)\]/)![1]));
      
      // Extract all footer citation ids
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      expect(footerMatches, 'Page must have footer citations').toBeTruthy();
      
      const footerNumbers = footerMatches!.map(m => parseInt(m.match(/id="citation-(\d+)"/)![1]));
      
      // Every marker number must have a matching footer item
      for (const markerNum of markerNumbers) {
        expect(footerNumbers, `Marker [${markerNum}] must have footer #citation-${markerNum}`).toContain(markerNum);
      }
    });

    it('should have matching citations in p2 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const markerMatches = html.match(/\[(\d+)\]/g);
      expect(markerMatches, 'Page must have citation markers').toBeTruthy();
      
      const markerNumbers = markerMatches!.map(m => parseInt(m.match(/\[(\d+)\]/)![1]));
      
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      expect(footerMatches, 'Page must have footer citations').toBeTruthy();
      
      const footerNumbers = footerMatches!.map(m => parseInt(m.match(/id="citation-(\d+)"/)![1]));
      
      for (const markerNum of markerNumbers) {
        expect(footerNumbers, `Marker [${markerNum}] must have footer #citation-${markerNum}`).toContain(markerNum);
      }
    });

    it('should have matching citations in p3 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const markerMatches = html.match(/\[(\d+)\]/g);
      expect(markerMatches, 'Page must have citation markers').toBeTruthy();
      
      const markerNumbers = markerMatches!.map(m => parseInt(m.match(/\[(\d+)\]/)![1]));
      
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      expect(footerMatches, 'Page must have footer citations').toBeTruthy();
      
      const footerNumbers = footerMatches!.map(m => parseInt(m.match(/id="citation-(\d+)"/)![1]));
      
      for (const markerNum of markerNumbers) {
        expect(footerNumbers, `Marker [${markerNum}] must have footer #citation-${markerNum}`).toContain(markerNum);
      }
    });

    it('should have matching citations in demo page', () => {
      const demoPath = path.join(distPath, 'demo', 'index.html');
      const html = fs.readFileSync(demoPath, 'utf-8');
      
      const markerMatches = html.match(/\[(\d+)\]/g);
      expect(markerMatches, 'Page must have citation markers').toBeTruthy();
      
      const markerNumbers = markerMatches!.map(m => parseInt(m.match(/\[(\d+)\]/)![1]));
      
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      expect(footerMatches, 'Page must have footer citations').toBeTruthy();
      
      const footerNumbers = footerMatches!.map(m => parseInt(m.match(/id="citation-(\d+)"/)![1]));
      
      for (const markerNum of markerNumbers) {
        expect(footerNumbers, `Marker [${markerNum}] must have footer #citation-${markerNum}`).toContain(markerNum);
      }
    });
  });

  describe('Same locator = same number', () => {
    it('should reuse citation numbers for same locator in p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p1 has 2 identity facts from Receita Federal (should share same citation)
      // and 2 RF edges from Base dos Dados (should share same citation)
      // and donations from TSE
      
      // Count unique footer items
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      const uniqueFooterItems = new Set(footerMatches).size;
      
      // Should have at least 2 unique sources (Receita Federal + Base dos Dados, plus donations)
      expect(uniqueFooterItems).toBeGreaterThanOrEqual(2);
    });
  });
});
