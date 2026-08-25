import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Facts Index Citation', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    distPath = path.join(__dirname, '..', 'dist');
    
    // Build with old fixtures (methodology doesn't depend on published facts)
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

  describe('/llms.txt', () => {
    it('should contain the Facts index URL', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, 'llms.txt');
      const content = fs.readFileSync(llmsPath, 'utf-8');
      
      // Must contain the Facts index URL
      expect(content).toContain('https://billionaire-watcher.pages.dev/api/facts/latest/index.json');
    });

    it('should reference person fact files pattern', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const llmsPath = path.join(distPath, 'llms.txt');
      const content = fs.readFileSync(llmsPath, 'utf-8');
      
      // Should mention the pattern for person files
      expect(content).toMatch(/\/api\/facts\/latest\/.*\.json/);
    });
  });

  describe('/metodologia', () => {
    it('should contain the Facts index URL with citation', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const metodologiaPath = path.join(distPath, 'metodologia', 'index.html');
      const html = fs.readFileSync(metodologiaPath, 'utf-8');
      
      // Must contain the Facts index URL
      expect(html).toContain('https://billionaire-watcher.pages.dev/api/facts/latest/index.json');
    });

    it('should have Facts index with Wikipedia-style citation marker', () => {
      if (buildFailed) throw new Error(`Build failed: ${buildError}`);
      
      const metodologiaPath = path.join(distPath, 'metodologia', 'index.html');
      const html = fs.readFileSync(metodologiaPath, 'utf-8');
      
      // Should have citation marker [n] near the Facts index mention
      const hasFactsIndex = html.includes('api/facts/latest/index.json');
      const hasCitationMarkers = html.match(/\[\d+\]/);
      
      expect(hasFactsIndex).toBe(true);
      expect(hasCitationMarkers).toBeTruthy();
    });
  });
});
