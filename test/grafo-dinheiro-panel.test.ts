import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { lookupPersonMoney } from '../src/lib/grafo-money';
import { buildPanelView, renderPanelHtml } from '../src/lib/grafo-panel';
import { searchGrafoNodes } from '../src/lib/grafo-search';
import type { GrafoData } from '../src/lib/grafo-elements';

const IVAN_ID = 'p-cdbc8c4e';
const JOAQUIM_ID = 'p-da3e3836';
const EDUARDO_ID = 'p-e1365405';
const WEG_ID = '84429695000111';
const GIPAR_ID = '02260956000158';
const ENERGISA_ID = '00864214000106';

const LAST_HOP_MONEY = 31734156.59;
const LAST_HOP_SLICE = 0.387;

function loadCommittedGrafo(): GrafoData {
  const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

function loadCommittedMoney() {
  const jsonPath = path.join(__dirname, '..', 'public', 'grafo-dinheiro.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

function containsLiteralOrPtBr(html: string, raw: number): boolean {
  const [whole, cents] = raw.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return html.includes(String(raw)) || html.includes(`${grouped},${cents}`);
}

function moneySection(html: string): string {
  const start = html.indexOf('Dinheiro econômico (fatia de capital)');
  if (start < 0) {
    return '';
  }
  const end = html.indexOf('</section>', start);
  return end < 0 ? html.slice(start) : html.slice(start, end);
}

function panelHtmlFor(nodeId: string): string {
  const grafo = loadCommittedGrafo();
  const money = loadCommittedMoney();
  const view = buildPanelView(grafo, { nodeId }, money);
  return renderPanelHtml(view);
}

describe('Grafo person money panel (issue #130)', () => {
  describe('lookup: money JSON + person id', () => {
    it('lookup p-cdbc8c4e returns money_economic 1300458655.36, money_control 2896272224.98, date 2025-05-16', () => {
      const money = loadCommittedMoney();
      const row = lookupPersonMoney(money, IVAN_ID);
      expect(row).not.toBeNull();
      expect(row!.money_economic).toBe(1300458655.36);
      expect(row!.money_control).toBe(2896272224.98);
      expect(row!.date).toBe('2025-05-16');
    });

    it('lookup p-da3e3836 and p-e1365405 returns null / no row', () => {
      const money = loadCommittedMoney();
      expect(lookupPersonMoney(money, JOAQUIM_ID)).toBeNull();
      expect(lookupPersonMoney(money, EDUARDO_ID)).toBeNull();
      expect(money.people.some((person: { id: string }) => person.id === JOAQUIM_ID)).toBe(false);
      expect(money.people.some((person: { id: string }) => person.id === EDUARDO_ID)).toBe(false);
    });
  });

  describe('renderPanelHtml / buildPanelView', () => {
    it('Ivan panel HTML includes both person totals and the date; not the 0.387 last-hop money as the total', () => {
      const html = panelHtmlFor(IVAN_ID);
      expect(containsLiteralOrPtBr(html, 1300458655.36)).toBe(true);
      expect(containsLiteralOrPtBr(html, 2896272224.98)).toBe(true);
      expect(html).toContain('2025-05-16');
      expect(html).toContain('Dinheiro econômico (fatia de capital)');
      expect(html).toContain('Dinheiro sob controle (fatia de votos)');
      expect(html).toContain('Não é uma fortuna.');

      const section = moneySection(html);
      expect(section.length).toBeGreaterThan(0);
      expect(containsLiteralOrPtBr(section, 1300458655.36)).toBe(true);
      expect(containsLiteralOrPtBr(section, 2896272224.98)).toBe(true);
      expect(containsLiteralOrPtBr(section, LAST_HOP_MONEY)).toBe(false);
      expect(section).not.toContain(String(LAST_HOP_SLICE));
      expect(section).not.toMatch(/(?:^|[^\d.])31734156(?:\.59)?/);
    });

    it('Ivan sources include Brasil Bolsa Balcão and Formulário / FRE', () => {
      const html = panelHtmlFor(IVAN_ID);
      expect(html).toMatch(/Brasil Bolsa Balc[aã]o/);
      expect(html).toMatch(/FRE|Formul[aá]rio/);
    });

    it('Joaquim and Eduardo panel HTML have no money numbers', () => {
      for (const id of [JOAQUIM_ID, EDUARDO_ID]) {
        const html = panelHtmlFor(id);
        expect(html).not.toContain('Dinheiro econômico (fatia de capital)');
        expect(html).not.toContain('Dinheiro sob controle (fatia de votos)');
        expect(html).not.toContain('money_economic');
        expect(html).not.toContain('money_control');
        expect(html).not.toMatch(/R\$/);
        expect(containsLiteralOrPtBr(html, 1300458655.36)).toBe(false);
        expect(containsLiteralOrPtBr(html, 2896272224.98)).toBe(false);
      }
    });

    it('wealth_rank is not shown in panel HTML', () => {
      const html = panelHtmlFor(IVAN_ID);
      expect(html).not.toMatch(/wealth_rank/i);
      expect(html).not.toMatch(/wealth rank/i);
    });

    it('company panel (WEG) has no money block', () => {
      const html = panelHtmlFor(WEG_ID);
      expect(html).toMatch(/WEG/i);
      expect(html).not.toContain('Dinheiro econômico (fatia de capital)');
      expect(html).not.toContain('Dinheiro sob controle (fatia de votos)');
      expect(html).not.toContain('Não é uma fortuna.');
      expect(html).not.toMatch(/R\$/);
    });

    it('edge panel has no money block', () => {
      const grafo = loadCommittedGrafo();
      const money = loadCommittedMoney();
      const view = buildPanelView(grafo, { from: GIPAR_ID, to: ENERGISA_ID }, money);
      const html = renderPanelHtml(view);
      expect(html).toMatch(/Gipar/i);
      expect(html).not.toContain('Dinheiro econômico (fatia de capital)');
      expect(html).not.toContain('Dinheiro sob controle (fatia de votos)');
      expect(html).not.toMatch(/R\$/);
    });
  });

  describe('search still works; wiring; public files', () => {
    it('search box is still present and Ivan search still opens the same panel as a tap', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toContain('Buscar pessoa ou empresa');
      expect(page).toMatch(/<input[^>]*id="grafo-search"/);
      expect(page).toMatch(/from ['"]\.\.\/lib\/grafo-search['"]/);
      expect(page).toMatch(/searchGrafoNodes\s*\(/);

      const grafo = loadCommittedGrafo();
      const money = loadCommittedMoney();
      const hits = searchGrafoNodes(grafo.nodes, 'ivan');
      const chosen = hits.find((hit) => hit.id === IVAN_ID);
      expect(chosen).toBeDefined();
      const fromSearch = buildPanelView(grafo, { nodeId: chosen!.id }, money);
      const fromTap = buildPanelView(grafo, { nodeId: IVAN_ID }, money);
      expect(fromSearch).toEqual(fromTap);
      expect(fromSearch?.mode).toBe('node');
      if (fromSearch?.mode === 'node') {
        expect(fromSearch.money?.money_economic).toBe(1300458655.36);
      }
    });

    it('grafo.astro loads grafo-dinheiro.json as a static file like grafo-publico.json', () => {
      const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'grafo.astro'), 'utf-8');
      expect(page).toContain('/grafo-publico.json');
      expect(page).toContain('/grafo-dinheiro.json');
      expect(page).toMatch(/buildPanelView\s*\(/);
    });

    it('grafo-panel.ts does not bake Ivan money literals', () => {
      const helper = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts'), 'utf-8');
      expect(helper).not.toContain('1300458655.36');
      expect(helper).not.toContain('2896272224.98');
      expect(helper).not.toContain('31734156.59');
    });

    it('no eleven-digit Cadastro in public files', () => {
      const publico = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'grafo-publico.json'),
        'utf-8'
      );
      expect(publico).not.toMatch(/(?<!\d)\d{11}(?!\d)/);

      // Money amounts may have an 11-digit integer part; Cadastro is 11 digits
      // standing alone, not a decimal reais figure or a 14-digit company id.
      const dinheiro = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'grafo-dinheiro.json'),
        'utf-8'
      );
      expect(dinheiro).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(dinheiro).not.toMatch(/(?<![\d.])\d{11}(?![\d.])/);
    });

    it('other pages stay without extra JS', () => {
      const pagesDir = path.join(__dirname, '..', 'src', 'pages');
      const otherPages = [
        'index.astro',
        'doacoes.astro',
        'metodologia.astro',
        '404.astro',
        'demo.astro',
      ];
      for (const file of otherPages) {
        const source = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
        expect(source, `${file} must not gain a script tag`).not.toMatch(/<script/);
      }
    });
  });
});
