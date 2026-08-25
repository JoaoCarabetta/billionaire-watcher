import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: Derived associations (cited, freeze-only)', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';

  beforeAll(() => {
    // Always rebuild to ensure fresh state
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
    
    distPath = path.join(__dirname, '..', 'dist');
  });

  describe('Test 1: Politician associations appear only when donation Facts exist', () => {
    it('should show politician association on p1 dossier (has donations)', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p1 donated to Carlos Rodrigues
      expect(html).toContain('Associações');
      expect(html).toContain('Carlos Rodrigues');
    });

    it('should cite donation Facts for politician association on p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Find the association section
      const associationSection = html.match(/Associações[\s\S]{0,2000}/);
      expect(associationSection).toBeTruthy();
      
      // Must have citation markers in association text
      const hasCitations = /Carlos Rodrigues[\s\S]{0,300}\[\d+\]/.test(associationSection![0]);
      expect(hasCitations).toBe(true);
    });

    it('should not show politician section on p3 dossier (no donations)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p3 has no donations, should not have politician associations
      // (but may still have Associações section for freeze-to-freeze)
      const associationSection = html.match(/Associações[\s\S]{0,2000}/);
      if (associationSection) {
        // If section exists, it should not mention any politicians
        expect(associationSection[0]).not.toContain('Carlos Rodrigues');
        expect(associationSection[0]).not.toContain('Fernanda Almeida');
        expect(associationSection[0]).not.toContain('Marina Costa');
      }
    });
  });

  describe('Test 2: Freeze-to-freeze associations appear when control or co-donation Facts exist', () => {
    it('should show freeze person association on p1 dossier (co-donated with p2)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p1 and p2 both donated to Carlos Rodrigues
      expect(html).toContain('Associações');
      expect(html).toContain('Maria Santos');
    });

    it('should cite co-donation Facts for freeze association on p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Find Maria Santos mention in associations
      const mariaMention = html.match(/Maria Santos[\s\S]{0,300}/);
      expect(mariaMention).toBeTruthy();
      
      // Must have citation markers
      const hasCitations = /\[\d+\]/.test(mariaMention![0]);
      expect(hasCitations).toBe(true);
    });

    it('should link freeze person association to their elite dossier URL', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Maria Santos (p2) should link to /pessoa/p2
      expect(html).toContain('/pessoa/p2');
    });

    it('should show reciprocal association on p2 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p2 should show p1 as associated (co-donation)
      expect(html).toContain('Associações');
      expect(html).toContain('João Silva');
      expect(html).toContain('/pessoa/p1');
    });
  });

  describe('Test 3: Association text without parent Facts must not render', () => {
    it('should not render association with missing parent Facts', () => {
      // If we add an association with non-existent parent fact IDs,
      // it should not appear in any dossier
      const p1Path = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const p2Path = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const p3Path = path.join(distPath, 'pessoa', 'p3', 'index.html');
      
      const p1Html = fs.readFileSync(p1Path, 'utf-8');
      const p2Html = fs.readFileSync(p2Path, 'utf-8');
      const p3Html = fs.readFileSync(p3Path, 'utf-8');
      
      // Should not contain the test association with no valid parents
      expect(p1Html).not.toContain('assoc-orphan');
      expect(p2Html).not.toContain('assoc-orphan');
      expect(p3Html).not.toContain('assoc-orphan');
    });

    it('should not render association prose without citations', () => {
      const p1Path = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(p1Path, 'utf-8');
      
      // Find all association texts
      const associationDivs = html.match(/<div class="derived-association"[^>]*>[\s\S]*?<\/div>/g) || [];
      
      for (const div of associationDivs) {
        // Every association div must contain at least one citation marker
        expect(div).toMatch(/\[\d+\]/);
      }
    });
  });

  describe('Test 4: DerivedAssociation uses shared citationMap, not factsStartIndex', () => {
    it('should have association citations matching the page footer', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Extract all citation markers
      const markerMatches = html.match(/\[(\d+)\]/g);
      expect(markerMatches).toBeTruthy();
      
      const markerNumbers = markerMatches!.map(m => parseInt(m.match(/\[(\d+)\]/)![1]));
      
      // Extract all footer citation ids
      const footerMatches = html.match(/id="citation-(\d+)"/g);
      expect(footerMatches).toBeTruthy();
      
      const footerNumbers = footerMatches!.map(m => parseInt(m.match(/id="citation-(\d+)"/)![1]));
      
      // Every marker (including in associations) must have a matching footer item
      for (const markerNum of markerNumbers) {
        expect(footerNumbers, `Marker [${markerNum}] must have footer #citation-${markerNum}`).toContain(markerNum);
      }
    });

    it('should reuse citation numbers for same donation source', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Find donation section citation number
      const donationSection = html.match(/Doações Políticas[\s\S]{0,2000}/);
      expect(donationSection).toBeTruthy();
      
      const donationCitations = donationSection![0].match(/\[(\d+)\]/g);
      expect(donationCitations).toBeTruthy();
      
      // Find association section citation numbers
      const associationSection = html.match(/Associações[\s\S]{0,2000}/);
      expect(associationSection).toBeTruthy();
      
      const associationCitations = associationSection![0].match(/\[(\d+)\]/g);
      expect(associationCitations).toBeTruthy();
      
      // Since associations cite donation Facts, there should be citation number overlap
      const donationNums = donationCitations!.map(c => c.match(/\d+/)![0]);
      const associationNums = associationCitations!.map(c => c.match(/\d+/)![0]);
      
      // At least one number should appear in both sections (same source, same number)
      const overlap = donationNums.filter(n => associationNums.includes(n));
      expect(overlap.length).toBeGreaterThan(0);
    });
  });

  describe('Test 5: Non-freeze candidates still have no dossier URL', () => {
    it('should not create /pessoa page for Carlos Rodrigues (politician, not in freeze)', () => {
      // Carlos Rodrigues appears in associations but is not in freeze
      const carlosPath1 = path.join(distPath, 'pessoa', 'carlos-rodrigues', 'index.html');
      const carlosPath2 = path.join(distPath, 'pessoa', '555666777-88', 'index.html');
      const carlosPath3 = path.join(distPath, 'pessoa', 'c1', 'index.html');
      
      expect(fs.existsSync(carlosPath1)).toBe(false);
      expect(fs.existsSync(carlosPath2)).toBe(false);
      expect(fs.existsSync(carlosPath3)).toBe(false);
    });

    it('should link Carlos Rodrigues to Wikipedia in association, not /pessoa', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Find Carlos in associations section
      const associationSection = html.match(/Associações[\s\S]{0,2000}/);
      expect(associationSection).toBeTruthy();
      
      if (associationSection![0].includes('Carlos Rodrigues')) {
        // Should link to Wikipedia, not /pessoa/
        expect(associationSection![0]).toContain('wikipedia.org');
        expect(associationSection![0]).not.toContain('/pessoa/carlos');
        expect(associationSection![0]).not.toContain('/pessoa/555');
      }
    });

    it('should only create dossier pages for freeze persons', () => {
      const pessoaDir = path.join(distPath, 'pessoa');
      const entries = fs.readdirSync(pessoaDir);
      // Filter to only directories (not .md files)
      const personDirs = entries.filter(entry => {
        const fullPath = path.join(pessoaDir, entry);
        return fs.statSync(fullPath).isDirectory();
      });
      
      // Should only have p1, p2, p3 from freeze.csv
      expect(personDirs).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
      expect(personDirs.length).toBe(3);
    });
  });

  describe('Test 6: Hard rules from spec still in force', () => {
    it('should keep RF sócio table section on p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Empresas e Sócios');
      expect(html).toContain('Empresa XYZ');
      expect(html).toContain('sócio');
    });

    it('should keep CVM FRE section on p2', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Controle Acionário');
      expect(html).toContain('ABC Participações');
    });

    it('should keep donations section on p1', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Doações Políticas');
      expect(html).toContain('Carlos Rodrigues');
    });

    it('should not show full CPF in association section', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      const associationSection = html.match(/Associações[\s\S]{0,2000}/);
      if (associationSection) {
        expect(associationSection[0]).not.toContain('123.456.789-00');
        expect(associationSection[0]).not.toContain('234.567.890-11');
        expect(associationSection[0]).not.toContain('555.666.777-88');
      }
    });
  });
});
