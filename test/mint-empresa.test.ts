import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';
import { mintCitedEmpresas, renderEmpresaFichaHtml } from '../src/lib/mint-empresa';
import type { GrafoData } from '../src/lib/grafo-elements';
import { firstMainBlockText, h1Text } from './ficha-html';

const ENERGISA_ID = '00864214000106';
const GIPAR_ID = '02260956000158';
const RECORD_ID = 'record';
const ALASKA_ID = '11752203000150';
const DYNAMO_ID = '72116353000162';
const NOVA_FUTURA_ID = '41020034000125';
const UNIAO_ID = '00394460000141';
const TESOURARIA_ENERGISA_ID = 'tesouraria-00864214';
const OUTROS_ENERGISA_ID = 'outros-00864214';
const OPPORTUNITY_HDF_ID = '33857830000199';
const OPPORTUNITY_HOLDERS_ID = '00806334000157';
const LAST_HOP_SLICE = 0.387;

function loadCommittedGrafo(): GrafoData {
  const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

describe('Mint cited /empresa/ fichas (issue #148)', () => {
  describe('mint helper from committed public/grafo-publico.json + LISTED_COMPANY_IDS', () => {
    const grafo = loadCommittedGrafo();
    const minted = mintCitedEmpresas(grafo);
    const byId = new Map(minted.map((empresa) => [empresa.id, empresa]));

    it('mints each LISTED_COMPANY_IDS seed that already has a company node, including Energisa', () => {
      expect(LISTED_COMPANY_IDS).toHaveLength(33);
      expect(LISTED_COMPANY_IDS).toContain(ENERGISA_ID);
      for (const id of LISTED_COMPANY_IDS) {
        const empresa = byId.get(id);
        expect(empresa, `listed seed ${id} must be minted`).toBeDefined();
        expect(empresa!.type).toBe('listed_seed');
        expect(empresa!.company_id).toBe(id);
        expect(empresa!.id).toBe(id);
      }
    });

    it('mints Energisa 00864214000106 with legal name, type, controlador or hole, and JSON entrada list', () => {
      const energisa = byId.get(ENERGISA_ID);
      expect(energisa, 'Energisa must be minted').toBeDefined();
      expect(energisa!.legal_name).toMatch(/ENERGISA/i);
      expect(energisa!.type).toBe('listed_seed');
      expect(energisa!.company_id).toBe(ENERGISA_ID);
      expect(energisa!.controlador_label === null || /IVAN MÜLLER BOTELHO/i.test(energisa!.controlador_label)).toBe(
        true
      );
      expect(energisa!.entradas.length).toBeGreaterThan(0);
      const gipar = energisa!.entradas.find((entrada) => /Gipar/i.test(entrada.counterparty_label));
      expect(gipar, 'Energisa entrada list must include Gipar from committed JSON').toBeDefined();
      expect(gipar!.source).toMatch(/FRE Energisa 160981/);
      expect(gipar!.pct_capital).toBe(26.646);
      const ivan = energisa!.entradas.find((entrada) => /IVAN MÜLLER BOTELHO/i.test(entrada.counterparty_label));
      expect(ivan, 'Energisa entrada list must include Ivan from committed JSON').toBeDefined();
    });

    it('mints exactly one closed S.A. group: record, and does not mint globo', () => {
      const record = byId.get(RECORD_ID);
      expect(record, 'Record group key must be minted').toBeDefined();
      expect(record!.id).toBe('record');
      expect(record!.legal_name).toMatch(/Record/i);
      expect(record!.type).toBe('closed_sa_group');
      expect(record!.company_id).toBeNull();
      expect(record!.controlador_label).toBeNull();
      expect(record!.quadro_does_not_name_shareholders).toBe(true);
      expect(byId.has('globo')).toBe(false);
      expect(minted.filter((empresa) => empresa.type === 'closed_sa_group')).toHaveLength(1);
    });

    it('does not mint ordinary holdings, tesouraria, outros, União, limitadas, or gestoras', () => {
      expect(byId.has(GIPAR_ID)).toBe(false);
      expect(byId.has(TESOURARIA_ENERGISA_ID)).toBe(false);
      expect(byId.has(OUTROS_ENERGISA_ID)).toBe(false);
      expect(byId.has(UNIAO_ID)).toBe(false);
      expect(byId.has(NOVA_FUTURA_ID)).toBe(false);
      expect(byId.has(ALASKA_ID)).toBe(false);
      expect(byId.has(DYNAMO_ID)).toBe(false);
      expect(byId.has(OPPORTUNITY_HDF_ID)).toBe(false);
      expect(byId.has(OPPORTUNITY_HOLDERS_ID)).toBe(false);
      expect(minted.some((empresa) => empresa.id.startsWith('tesouraria-'))).toBe(false);
      expect(minted.some((empresa) => empresa.id.startsWith('outros-'))).toBe(false);
    });

    it('does not mint Dexco, Votorantim, or Globo, and does not mint every 14-digit Cadastro', () => {
      expect(minted.some((empresa) => /dexco/i.test(empresa.id) || /dexco/i.test(empresa.legal_name))).toBe(false);
      expect(minted.some((empresa) => /votorantim/i.test(empresa.id) || /votorantim/i.test(empresa.legal_name))).toBe(
        false
      );
      expect(minted.some((empresa) => /globo/i.test(empresa.id) || /globo/i.test(empresa.legal_name))).toBe(false);
      const fourteenDigitNodes = grafo.nodes.filter(
        (node) => node.kind === 'company' && /^\d{14}$/.test(node.id)
      );
      expect(fourteenDigitNodes.length).toBeGreaterThan(LISTED_COMPANY_IDS.length);
      expect(minted.filter((empresa) => /^\d{14}$/.test(empresa.id))).toHaveLength(LISTED_COMPANY_IDS.length);
    });

    it('listed mint ids are the existing graph company ids from LISTED_COMPANY_IDS, not invented Cadastros', () => {
      const companyIds = new Set(
        grafo.nodes.filter((node) => node.kind === 'company').map((node) => node.id)
      );
      for (const empresa of minted) {
        if (empresa.type === 'listed_seed') {
          expect(empresa.id).toMatch(/^\d{14}$/);
          expect(LISTED_COMPANY_IDS as readonly string[]).toContain(empresa.id);
          expect(companyIds.has(empresa.id), `listed ${empresa.id} must already be a company node`).toBe(true);
        }
      }
    });
  });

  describe('ficha HTML render', () => {
    const grafo = loadCommittedGrafo();
    const minted = mintCitedEmpresas(grafo);
    const energisa = minted.find((empresa) => empresa.id === ENERGISA_ID)!;
    const record = minted.find((empresa) => empresa.id === RECORD_ID)!;

    it('Energisa HTML has ENERGISA, the fourteen-digit id, type, and view-source cite (no JS-only body)', () => {
      expect(energisa).toBeDefined();
      const html = renderEmpresaFichaHtml(energisa);
      expect(html).toMatch(/ENERGISA/);
      expect(html).toContain(ENERGISA_ID);
      expect(html).toMatch(/companhia aberta|semente listada|listada/i);
      expect(html).not.toMatch(/<script(?![^>]*type="application\/ld\+json")/i);
    });

    it('Energisa lead names companhia aberta and Ivan or a visible hole; entrada list stays below (issue #161)', () => {
      const html = renderEmpresaFichaHtml(energisa);
      expect(h1Text(html)).toMatch(/ENERGISA/);
      expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('<main>'));
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/é companhia aberta/);
      expect(lead).toMatch(/IVAN MÜLLER BOTELHO|lacuna vis[ií]vel/i);
      const entradaIdx = html.indexOf('<h2>Entrada</h2>');
      const resumoIdx = html.indexOf('class="resumo"');
      expect(entradaIdx).toBeGreaterThan(-1);
      expect(resumoIdx).toBeGreaterThan(-1);
      expect(resumoIdx).toBeLessThan(entradaIdx);
      expect(html).toMatch(/Gipar/i);
      expect(html).toMatch(/26,646/);
      expect(html).toMatch(/FRE Energisa 160981/);
    });

    it('Energisa HTML shows Gipar and Ivan as entrada labels with formatted percent, without /pessoa/ or /grafo/ links', () => {
      const html = renderEmpresaFichaHtml(energisa);
      expect(html).toMatch(/Gipar/i);
      expect(html).toMatch(/IVAN MÜLLER BOTELHO/);
      expect(html).toMatch(/26,646/);
      expect(html).toMatch(/FRE Energisa 160981/);
      expect(html).not.toContain(String(LAST_HOP_SLICE));
      expect(html).not.toMatch(/\/pessoa\//);
      expect(html).not.toMatch(/\/grafo\//);
      expect(html).not.toMatch(/href="\/empresa\/02260956000158/);
    });

    it('Record HTML has a visible shareholder hole and states the Quadro de Sócios does not name shareholders', () => {
      expect(record).toBeDefined();
      const html = renderEmpresaFichaHtml(record);
      expect(html).toMatch(/Record/i);
      expect(html).toMatch(/sociedade an[oô]nima fechada/i);
      expect(html).not.toContain(ENERGISA_ID);
      expect(html).not.toMatch(/(?<!\d)\d{14}(?!\d)/);
      expect(html).toMatch(/Quadro de S[oó]cios/);
      expect(html).toMatch(/n[aã]o nomeia acionistas/i);
      expect(html).toMatch(/lacuna vis[ií]vel/i);
      expect(html).not.toMatch(/Edir Macedo/i);
      expect(html).not.toMatch(/\/pessoa\//);
    });

    it('Record lead is the closed S.A. Quadro hole and does not name Edir Macedo (issue #161)', () => {
      const html = renderEmpresaFichaHtml(record);
      expect(h1Text(html)).toMatch(/Record/i);
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/é sociedade an[oô]nima fechada/);
      expect(lead).toMatch(/Quadro de S[oó]cios/);
      expect(lead).toMatch(/n[aã]o nomeia acionistas/i);
      expect(lead).not.toMatch(/Edir Macedo/i);
    });

    it('listed seed without a minted controlador leads with companhia aberta and a visible hole', () => {
      const embraer = minted.find((empresa) => empresa.id === '07689002000189');
      expect(embraer).toBeDefined();
      expect(embraer!.controlador_label).toBeNull();
      const html = renderEmpresaFichaHtml(embraer!);
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/é companhia aberta/);
      expect(lead).toMatch(/lacuna vis[ií]vel/i);
      expect(lead).not.toMatch(/IVAN MÜLLER BOTELHO/);
    });

    it('company HTML has no money block, no UBO, no biography voice, no eleven-digit Cadastro', () => {
      for (const empresa of minted) {
        const html = renderEmpresaFichaHtml(empresa);
        expect(html, `${empresa.id} must not contain money_economic`).not.toContain('money_economic');
        expect(html, `${empresa.id} must not contain R$`).not.toMatch(/R\$/);
        expect(html, `${empresa.id} must not link /grafo/`).not.toMatch(/\/grafo\//);
        expect(html, `${empresa.id} must not link /pessoa/`).not.toMatch(/\/pessoa\//);
        expect(html, `${empresa.id} must not contain UBO`).not.toMatch(/\bUBO\b/i);
        expect(html, `${empresa.id} must not contain eleven-digit Cadastro`).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
        expect(html, `${empresa.id} must not say dono`).not.toMatch(/\bdono\b/i);
        expect(html, `${empresa.id} must not say o bilionário`).not.toMatch(/o bili?on[aá]rio/i);
        expect(html).not.toMatch(/ver no grafo/i);
        expect(html).not.toMatch(/ver dossi[eê]/i);
        expect(html).not.toContain(String(LAST_HOP_SLICE));
      }
    });
  });
});
