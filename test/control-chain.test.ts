import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Tracer: Control Chain (RF sócios + CVM FRE)', () => {
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

  describe('Test 1: RF partner edges labeled "sócio" with visible citation', () => {
    it('should show RF partner edges in p1 dossier', () => {
      if (buildFailed) {
        throw new Error(`Build failed: ${buildError}`);
      }
      
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should have a section for empresas e sócios
      expect(html).toMatch(/empresas\s+e\s+sócios/i);
    });

    it('should label RF edges as "sócio" not "dono" or "UBO"', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Must contain "sócio" label
      expect(html).toContain('sócio');
      
      // Company names should appear in RF partner section
      expect(html).toContain('Empresa XYZ Ltda.');
    });

    it('should have visible citation to BD RF or Receita Federal for partner edges', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should have citation markers in partner section
      const hasCitationMarkers = /<sup[^>]*>\[\d+\]<\/sup>/.test(html);
      expect(hasCitationMarkers).toBe(true);
      
      // Should cite Base dos Dados or Receita Federal
      expect(html).toMatch(/Base dos Dados|Receita Federal/i);
    });

    it('should use public locator (not Pro-only URL) for RF citations', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should not have Pro subscription URLs
      expect(html).not.toContain('basedosdados.org/dataset');
      expect(html).not.toMatch(/pro\.basedosdados\.org/i);
      
      // Should use public query or docs URLs
      if (html.includes('basedosdados')) {
        expect(html).toMatch(/basedosdados\.org\/.*(?:queries|docs)/i);
      }
    });
  });

  describe('Test 2: Listed groups show CVM FRE controller facts', () => {
    it('should show CVM FRE controller facts for p2 (listed group)', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should mention FRE or controller section
      expect(html).toMatch(/controle|formulário de referência|FRE/i);
    });

    it('should cite CVM FRE locator for controller facts', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p2', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should have CVM citation
      expect(html).toMatch(/CVM|Comissão de Valores Mobiliários/i);
      
      // Should have FRE locator in references
      expect(html).toContain('Referências');
    });
  });

  describe('Test 3: HTML never labels RF socio as controlador/UBO', () => {
    it('should not label RF partner edges as "controlador" in p1 dossier', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Find the RF partner section - must exist
      const rfSectionMatch = html.match(/<section[^>]*>[\s\S]*?empresas\s+e\s+sócios[\s\S]*?<\/section>/i);
      expect(rfSectionMatch, 'RF section must exist in dossier').toBeTruthy();
      
      const rfSection = rfSectionMatch![0];
      
      // Within RF section, must have "sócio" labels
      expect(rfSection).toContain('sócio');
      
      // Within RF section, must NOT have "controlador", "UBO", or "dono" labels
      expect(rfSection).not.toMatch(/\bcontrolador\b/i);
      expect(rfSection).not.toMatch(/\bUBO\b/);
      expect(rfSection).not.toMatch(/\bdono\b/i);
    });

    it('should not use "dono" for RF edges', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Check RF partner section specifically - must exist
      const rfSectionMatch = html.match(/<section[^>]*>[\s\S]*?empresas\s+e\s+sócios[\s\S]*?<\/section>/i);
      expect(rfSectionMatch, 'RF section must exist in dossier').toBeTruthy();
      
      const rfSection = rfSectionMatch![0];
      expect(rfSection).not.toMatch(/\bdono\b/i);
    });

    it('should always display literal "sócio" even if fixture has UBO/controlador', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p1 has an RF edge with relationship="UBO" in fixtures
      // Must still display "sócio" in the HTML
      const rfSectionMatch = html.match(/<section[^>]*>[\s\S]*?empresas\s+e\s+sócios[\s\S]*?<\/section>/i);
      expect(rfSectionMatch, 'RF section must exist in dossier').toBeTruthy();
      
      const rfSection = rfSectionMatch![0];
      
      // Should have "Tech Investimentos S.A." (the company with UBO in fixture)
      expect(rfSection).toContain('Tech Investimentos S.A.');
      
      // But must display "sócio", not "UBO"
      const techInvestimentosContext = html.slice(
        html.indexOf('Tech Investimentos S.A.'),
        html.indexOf('Tech Investimentos S.A.') + 200
      );
      expect(techInvestimentosContext).toContain('sócio');
      expect(techInvestimentosContext).not.toContain('UBO');
    });
  });

  describe('Test 4: Visible hole when control is unknown', () => {
    it('should show explicit missing-control message when FRE controller data absent', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // p3 is in a group but has no FRE controller data in fixtures
      // Should show a visible hole, not invent a controller
      expect(html).toMatch(/não identificadas|não identificado|desconhecido|não disponível/i);
      expect(html).toMatch(/Controle Acionário/i);
    });

    it('should not invent controller facts when FRE data is missing', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p3', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Should not show made-up controller info
      // Only cited facts should appear
      const controllerMatches = html.match(/controlador\s*:\s*([^<]+)</gi);
      
      if (controllerMatches) {
        // Any controller claim must have a citation
        for (const match of controllerMatches) {
          const matchIndex = html.indexOf(match);
          const surroundingContext = html.slice(matchIndex, matchIndex + 100);
          expect(surroundingContext).toMatch(/<sup[^>]*>\[\d+\]<\/sup>/);
        }
      }
    });
  });

  describe('Test 5: No company/fund dossier URLs generated', () => {
    it('should not generate /pessoa/c1 page for companies', () => {
      const companyDossierPath = path.join(distPath, 'pessoa', 'c1', 'index.html');
      expect(fs.existsSync(companyDossierPath), 'Companies should not have dossier URLs').toBe(false);
    });

    it('should not generate /pessoa/f1 page for funds', () => {
      const fundDossierPath = path.join(distPath, 'pessoa', 'f1', 'index.html');
      expect(fs.existsSync(fundDossierPath), 'Funds should not have dossier URLs').toBe(false);
    });

    it('should not link to company URLs from any dossier page', () => {
      const dossierPath = path.join(distPath, 'pessoa', 'p1', 'index.html');
      const html = fs.readFileSync(dossierPath, 'utf-8');
      
      // Company names can appear but should not be linked to /pessoa/{company-id}
      expect(html).not.toContain('/pessoa/c1');
      expect(html).not.toContain('/pessoa/c2');
    });
  });
});
