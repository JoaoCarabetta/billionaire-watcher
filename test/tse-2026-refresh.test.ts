import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: TSE 2026 Donations with Refresh', () => {
  let distPath: string;
  let buildFailed: boolean = false;
  let buildError: string = '';
  let freezeCsvInitialContent: string = '';

  beforeAll(() => {
    const freezePath = path.join(__dirname, 'fixtures', 'freeze.csv');
    freezeCsvInitialContent = fs.readFileSync(freezePath, 'utf-8');
    
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

  describe('Test 1: 2026 receipts appear on dossiers with TSE citations', () => {
    it('should show 2026 personal donation from João Silva (p1) on his dossier', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('Doações Políticas');
      expect(html).toContain('Marina Costa');
      expect(html).toContain('R$ 75.000');
      expect(html).toContain('2026');
    });

    it('should cite TSE Dados Abertos (not Base dos Dados) for 2026 donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('TSE - Dados Abertos Eleitorais');
      expect(html).toContain('dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026');
    });

    it('should NOT contain Base dos Dados citation for 2026 donations', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // 2026 donation section should not cite BD
      const donation2026Match = html.match(/Marina Costa[\s\S]{0,500}2026/);
      expect(donation2026Match).toBeTruthy();
      expect(donation2026Match![0]).not.toContain('Base dos Dados');
    });

    it('should have citation marker for 2026 donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Need to extend range to include citation marker after cycle text
      const donation2026Section = html.match(/Marina Costa[\s\S]{0,500}Eleições Municipais 2026[\s\S]{0,200}/);
      expect(donation2026Section).toBeTruthy();
      expect(donation2026Section![0]).toMatch(/\[\d+\]/);
    });
  });

  describe('Test 2: 2026 CNPJ palco donations attributed to person', () => {
    it('should attribute Empresa XYZ 2026 donation to João Silva (p1) on his dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // 2026 CNPJ donation should appear attributed to the person
      const xyzDonationMatch = html.match(/Empresa XYZ Ltda\.[\s\S]{0,500}Marina Costa[\s\S]{0,200}2026/);
      expect(xyzDonationMatch).toBeTruthy();
      expect(xyzDonationMatch![0]).toContain('R$ 150.000');
    });

    it('should cite TSE Dados Abertos for 2026 CNPJ donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).toContain('TSE - Dados Abertos Eleitorais');
    });
  });

  describe('Test 3: 2026 rows distinguishable from historical BD cycles', () => {
    it('should show both 2026 (TSE) and historical (BD) donations on p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Historical BD donation
      expect(html).toContain('Carlos Rodrigues');
      expect(html).toContain('2022');
      
      // 2026 TSE donation
      expect(html).toContain('Marina Costa');
      expect(html).toContain('2026');
    });

    it('should display cycle/year info for both BD and TSE donations on dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Historical cycles
      expect(html).toContain('Eleições Gerais 2022');
      expect(html).toContain('Eleições Municipais 2020');
      
      // 2026 cycle
      expect(html).toContain('Eleições Municipais 2026');
    });

    it('should show both BD and TSE donations in site-wide table with visible year/cycle', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // Historical donations
      expect(html).toContain('Carlos Rodrigues');
      expect(html).toContain('2022');
      expect(html).toContain('Eleições Gerais 2022');
      
      // 2026 donations
      expect(html).toContain('Marina Costa');
      expect(html).toContain('2026');
      expect(html).toContain('Eleições Municipais 2026');
    });

    it('should show different publishers in citations: BD vs TSE', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      // BD citation
      expect(html).toContain('Base dos Dados - TSE Eleições');
      expect(html).toContain('basedosdados.org/queries/tse-receitas');
      
      // TSE citation
      expect(html).toContain('TSE - Dados Abertos Eleitorais');
      expect(html).toContain('dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026');
    });
  });

  describe('Test 4: 2026 candidate links to TSE, not dossier', () => {
    it('should link Marina Costa (2026 candidate) to TSE in table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      expect(html).toContain('Marina Costa');
      expect(html).toContain('divulgacandcontas.tse.jus.br');
    });

    it('should NOT create dossier page for Marina Costa (not in freeze)', () => {
      const marinaPath = path.join(distPath, 'pessoa', '888999000-11', 'index.html');
      expect(fs.existsSync(marinaPath)).toBe(false);
      
      const marinaNamePath = path.join(distPath, 'pessoa', 'marina-costa', 'index.html');
      expect(fs.existsSync(marinaNamePath)).toBe(false);
    });

    it('should link Marina Costa to TSE from p1 dossier donation', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Look backwards from "Marina Costa" to find the href
      const marinaDonationMatch = html.match(/href="[^"]*divulgacandcontas\.tse\.jus\.br[^"]*"[^>]*>Marina Costa/);
      expect(marinaDonationMatch).toBeTruthy();
      expect(marinaDonationMatch![0]).toContain('2026/2/BR/888999000-11');
    });
  });

  describe('Test 5: Refresh path - rebuild from updated fixture without touching freeze.csv', () => {
    it('should not modify freeze.csv during build', () => {
      const freezePath = path.join(__dirname, 'fixtures', 'freeze.csv');
      const freezeCsvAfterBuild = fs.readFileSync(freezePath, 'utf-8');
      
      expect(freezeCsvAfterBuild).toBe(freezeCsvInitialContent);
    });

    it('should only create dossiers for persons in freeze.csv', () => {
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

    it('should include 2026 donations in built HTML (simulating refresh)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // After refresh (rebuild with updated fixtures), 2026 donations appear
      expect(html).toContain('Marina Costa');
      expect(html).toContain('2026');
      expect(html).toContain('Eleições Municipais 2026');
    });

    it('should use TSE Dados Abertos locators with 2026-10-04 retrieval (refresh date)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // TSE citation with October 4 retrieval
      expect(html).toContain('TSE - Dados Abertos Eleitorais');
      expect(html).toContain('2026-10-04');
    });
  });

  describe('Test 6: Same matching rules as #5', () => {
    it('should match 2026 personal donation by freeze person CPF', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p1 CPF matches donation-5-2026 donor_cpf
      expect(html).toContain('Marina Costa');
      expect(html).toContain('R$ 75.000');
    });

    it('should match 2026 CNPJ donation by RF partner edge CNPJ', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Empresa XYZ CNPJ matches rf-edge-p1-c1 company_cnpj
      const xyzMatch = html.match(/Empresa XYZ Ltda\.[\s\S]{0,500}Marina Costa/);
      expect(xyzMatch).toBeTruthy();
      expect(xyzMatch![0]).toContain('R$ 150.000');
      expect(xyzMatch![0]).toContain('2026');
    });

    it('should NOT create new freeze person for weak name-only 2026 candidate match', () => {
      const pessoaDir = path.join(distPath, 'pessoa');
      const entries = fs.readdirSync(pessoaDir);
      // Filter to only directories (not .md files)
      const personDirs = entries.filter(entry => {
        const fullPath = path.join(pessoaDir, entry);
        return fs.statSync(fullPath).isDirectory();
      });
      
      // Marina Costa is not in freeze, should not get a dossier
      expect(personDirs).not.toContain('marina-costa');
      expect(personDirs.length).toBe(3);
    });
  });

  describe('Test 7: No full CPF in 2026 donations HTML', () => {
    it('should not display full CPF for 2026 candidate in table', () => {
      const tablePath = path.join(distPath, 'doacoes', 'index.html');
      const html = fs.readFileSync(tablePath, 'utf-8');
      
      expect(html).not.toContain('888.999.000-11');
      expect(html).not.toContain('88899900011');
    });

    it('should not display full CPF in p1 2026 donations section', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      expect(html).not.toContain('888.999.000-11');
    });
  });
});
