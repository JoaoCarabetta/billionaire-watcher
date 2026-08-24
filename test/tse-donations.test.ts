import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: Historical TSE Donations', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    distPath = path.join(__dirname, '..', 'dist');
    
    // Check if dist exists, if not, build is required
    if (!fs.existsSync(distPath)) {
      buildFailed = true;
      buildError = 'dist/ folder not found. Run `npm run build` first.';
    }
  });

  describe('Test 1: Historical donations for freeze person appear on dossier with citations', () => {
    it('should show personal donation from João Silva (p1) on his dossier', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Doações Políticas');
      expect(html).toContain('Carlos Rodrigues');
      expect(html).toContain('R$ 50.000');
      expect(html).toContain('2022');
    });

    it('should cite Base dos Dados TSE for p1 donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Base dos Dados - TSE Eleições');
      expect(html).toContain('basedosdados.org/queries/tse-receitas');
    });

    it('should have citation marker for p1 donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check for citation marker near donation info
      const donationSection = html.match(/Doações Políticas[\s\S]{0,1000}Carlos Rodrigues[\s\S]{0,200}/);
      expect(donationSection).toBeTruthy();
      expect(donationSection![0]).toMatch(/\[\d+\]/);
    });
  });

  describe('Test 2: Donations from CNPJs in control chain appear as person donations (palco)', () => {
    it('should attribute Empresa XYZ donation to João Silva (p1) on his dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // CNPJ donation should appear attributed to the person
      expect(html).toContain('Empresa XYZ Ltda.');
      expect(html).toContain('Fernanda Almeida');
      expect(html).toContain('R$ 100.000');
      expect(html).toContain('2020');
    });

    it('should cite BD TSE for CNPJ donation attributed to p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should have citation for the donation
      expect(html).toContain('Base dos Dados - TSE Eleições');
    });

    it('should label CNPJ donation with company name (palco)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Company name should appear as the donor vehicle
      const donationText = html.match(/Empresa XYZ Ltda\.[\s\S]{0,500}Fernanda Almeida/);
      expect(donationText).toBeTruthy();
    });
  });

  describe('Test 3: Site-wide donations table exists', () => {
    it('should build a donations table page at /doacoes', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      expect(fs.existsSync(tablePath), 'Donations table page should exist at /doacoes').toBe(true);
    });

    it('should list all donations in the table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // Should contain all donors
      expect(html).toContain('João Silva');
      expect(html).toContain('Maria Santos');
      expect(html).toContain('Empresa XYZ Ltda.');
      
      // Should contain all candidates
      expect(html).toContain('Carlos Rodrigues');
      expect(html).toContain('Fernanda Almeida');
    });

    it('should show donation amounts and years in table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      expect(html).toContain('R$ 50.000');
      expect(html).toContain('R$ 100.000');
      expect(html).toContain('2022');
      expect(html).toContain('2020');
    });
  });

  describe('Test 4: Non-freeze candidates have Wikipedia/TSE links, not dossier URLs', () => {
    it('should link Carlos Rodrigues to Wikipedia, not /pessoa', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // Carlos is not in freeze, should link to Wikipedia
      expect(html).toContain('https://pt.wikipedia.org/wiki/Carlos_Rodrigues');
      
      // Should NOT create a /pessoa page for Carlos
      const carlosPath = path.join(distPath, 'pessoa', '555666777-88', 'index.html');
      expect(fs.existsSync(carlosPath)).toBe(false);
    });

    it('should link Fernanda Almeida to TSE, not /pessoa', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // Fernanda is not in freeze, should link to TSE
      expect(html).toContain('divulgacandcontas.tse.jus.br');
      
      // Should NOT create a /pessoa page for Fernanda
      const fernandaPath = path.join(distPath, 'pessoa', '777888999-00', 'index.html');
      expect(fs.existsSync(fernandaPath)).toBe(false);
    });

    it('should link freeze person João Silva to his dossier in table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // João is in freeze, should link to his dossier
      expect(html).toContain('/pessoa/p1');
    });
  });

  describe('Test 5: Weak name-only match does not create new freeze person', () => {
    it('should only create dossier pages for persons in freeze.csv', () => {
      const pessoaDir = path.join(distPath, 'pessoa');
      const personDirs = fs.readdirSync(pessoaDir);
      
      // Should only have p1, p2, p3 from freeze.csv
      expect(personDirs).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
      expect(personDirs.length).toBe(3);
    });

    it('should not create dossier for Roberto Oliveira (weak name match)', () => {
      const robertoPath = path.join(distPath, 'pessoa', '999888777-66', 'index.html');
      expect(fs.existsSync(robertoPath)).toBe(false);
      
      const robertoNamePath = path.join(distPath, 'pessoa', 'roberto-oliveira', 'index.html');
      expect(fs.existsSync(robertoNamePath)).toBe(false);
    });
  });

  describe('Test 6: No unsourced donation prose', () => {
    it('should not render donation without source in p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Any donation text should be accompanied by a citation
      const donationMatches = html.match(/doou|doação|contribuiu/gi) || [];
      
      if (donationMatches.length > 0) {
        // Check that there are corresponding citations
        const citationMatches = html.match(/<sup[^>]*class="citation-marker"[^>]*>\[\d+\]<\/sup>/g) || [];
        expect(citationMatches.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Test 7: No full CPF in donations HTML', () => {
    it('should not display full CPF from donation records in table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // No full CPF patterns should appear
      expect(html).not.toContain('123.456.789-00');
      expect(html).not.toContain('555.666.777-88');
      expect(html).not.toContain('777.888.999-00');
      expect(html).not.toContain('12345678900');
    });

    it('should not display full CPF in p1 donations section', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should show donations but not CPFs
      expect(html).not.toContain('555.666.777-88');
      expect(html).not.toContain('777.888.999-00');
    });
  });

  describe('Test 8: RF relation still labeled sócio, not controlador', () => {
    it('should keep RF control chain labeled as sócio in donation context', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // When showing CNPJ donation attribution, RF relation should be sócio
      if (html.includes('Empresa XYZ')) {
        const xyzSection = html.match(/Empresa XYZ[\s\S]{0,500}/);
        if (xyzSection && xyzSection[0].match(/sócio|controlador|dono|UBO/i)) {
          expect(xyzSection[0]).toContain('sócio');
          expect(xyzSection[0]).not.toMatch(/\bcontrolador\b/i);
          expect(xyzSection[0]).not.toMatch(/\bUBO\b/i);
          expect(xyzSection[0]).not.toMatch(/\bdono\b/i);
        }
      }
    });
  });

  describe('Test 9: Citation numbering consistency', () => {
    it('should have matching citation markers and reference list in p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract all citation markers
      const markerMatches = html.match(/\[(\d+)\]/g);
      if (markerMatches) {
        const markerNumbers = markerMatches.map(m => parseInt(m.match(/\d+/)![0]));
        
        // Extract all citation list items
        const citationMatches = html.match(/<li id="citation-(\d+)">/g);
        if (citationMatches) {
          const citationNumbers = citationMatches.map(m => parseInt(m.match(/\d+/)![0]));
          
          // Every marker should have a corresponding citation
          markerNumbers.forEach(num => {
            expect(citationNumbers).toContain(num);
          });
        }
      }
    });

    it('should have matching citation markers and reference list in donations table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // Extract all citation markers
      const markerMatches = html.match(/\[(\d+)\]/g);
      if (markerMatches) {
        const markerNumbers = markerMatches.map(m => parseInt(m.match(/\d+/)![0]));
        
        // Extract all citation list items
        const citationMatches = html.match(/<li id="citation-(\d+)">/g);
        if (citationMatches) {
          const citationNumbers = citationMatches.map(m => parseInt(m.match(/\d+/)![0]));
          
          // Every marker should have a corresponding citation
          markerNumbers.forEach(num => {
            expect(citationNumbers).toContain(num);
          });
        }
      }
    });
  });
});
