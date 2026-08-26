import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mintCitedPessoas, renderFichaHtml } from '../src/lib/mint-pessoa';
import { lookupPersonMoney } from '../src/lib/grafo-money';
import type { GrafoData } from '../src/lib/grafo-elements';
import { firstMainBlockText, h1Text } from './ficha-html';

const IVAN_ID = 'p-cdbc8c4e';
const JOAQUIM_ID = 'p-da3e3836';
const EDUARDO_ID = 'p-e1365405';
const MUFFATO_ID = 'p-faf6d605';
const ADRIANA_ID = 'p-dbf7401a';
const UNIAO_ID = '00394460000141';
const TESOURARIA_ENERGISA_ID = 'tesouraria-00864214';
const OUTROS_ENERGISA_ID = 'outros-00864214';
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

describe('Mint cited /pessoa/ fichas (issue #147)', () => {
  describe('mint helper from committed public/grafo-publico.json', () => {
    const grafo = loadCommittedGrafo();
    const minted = mintCitedPessoas(grafo);
    const byId = new Map(minted.map((pessoa) => [pessoa.id, pessoa]));

    it('mints Ivan Müller Botelho p-cdbc8c4e as Formulário controlador of Energisa', () => {
      const ivan = byId.get(IVAN_ID);
      expect(ivan, 'Ivan p-cdbc8c4e must be minted').toBeDefined();
      expect(ivan!.name).toMatch(/IVAN MÜLLER BOTELHO/);
      expect(ivan!.role).toMatch(/acionista controlador/i);
      expect(ivan!.company_label).toMatch(/ENERGISA/i);
      expect(ivan!.source).toMatch(/Formul[aá]rio|FRE/);
      expect(ivan!.source).toMatch(/160981/);
      expect(ivan!.id).toBe(IVAN_ID);
    });

    it('mints Joaquim da Silva Ferreira p-da3e3836 as sócio-administrador of Nova Futura Ltda', () => {
      const joaquim = byId.get(JOAQUIM_ID);
      expect(joaquim, 'Joaquim p-da3e3836 must be minted').toBeDefined();
      expect(joaquim!.name).toMatch(/JOAQUIM DA SILVA FERREIRA/);
      expect(joaquim!.role).toMatch(/s[oó]cio-administrador/i);
      expect(joaquim!.company_label).toMatch(/NOVA FUTURA/i);
      expect(joaquim!.source).toMatch(/Receita|Quadro de S[oó]cios/);
      expect(joaquim!.id).toBe(JOAQUIM_ID);
    });

    it('does not mint Eduardo p-e1365405 (Dynamo sócio, not Sócio-Administrador)', () => {
      expect(byId.has(EDUARDO_ID)).toBe(false);
    });

    it('does not mint Everton Muffato p-faf6d605 or a name slug', () => {
      expect(byId.has(MUFFATO_ID)).toBe(false);
      expect(minted.some((pessoa) => /MUFFATO/i.test(pessoa.name))).toBe(false);
      expect(minted.some((pessoa) => pessoa.id === 'EVERTON MUFFATO')).toBe(false);
    });

    it('does not mint every FRE shareholder (Adriana stays a graph node)', () => {
      expect(byId.has(ADRIANA_ID)).toBe(false);
    });

    it('does not mint tesouraria, outros, or União ids', () => {
      expect(byId.has(TESOURARIA_ENERGISA_ID)).toBe(false);
      expect(byId.has(OUTROS_ENERGISA_ID)).toBe(false);
      expect(byId.has(UNIAO_ID)).toBe(false);
      expect(minted.some((pessoa) => pessoa.id.startsWith('tesouraria-'))).toBe(false);
      expect(minted.some((pessoa) => pessoa.id.startsWith('outros-'))).toBe(false);
      expect(minted.some((pessoa) => /uni[aã]o federal/i.test(pessoa.name))).toBe(false);
    });

    it('does not mint partner-only names without a p- node', () => {
      expect(minted.some((pessoa) => /GUILHERME MEXIAS ACHE/i.test(pessoa.name))).toBe(false);
      expect(minted.some((pessoa) => /ACACIO ROBOREDO/i.test(pessoa.name))).toBe(false);
    });

    it('emits only existing p- plus eight hex ids (no invented ids, no name slugs)', () => {
      const personIds = new Set(
        grafo.nodes.filter((node) => node.kind === 'person').map((node) => node.id)
      );
      for (const pessoa of minted) {
        expect(pessoa.id).toMatch(/^p-[0-9a-f]{8}$/);
        expect(personIds.has(pessoa.id), `minted ${pessoa.id} must already be a person node`).toBe(true);
      }
    });
  });

  describe('ficha HTML render', () => {
    const grafo = loadCommittedGrafo();
    const money = loadCommittedMoney();
    const minted = mintCitedPessoas(grafo);
    const ivan = minted.find((pessoa) => pessoa.id === IVAN_ID)!;
    const joaquim = minted.find((pessoa) => pessoa.id === JOAQUIM_ID)!;

    it('Ivan HTML has name, Formulário / FRE, date, both money totals, and the denial line', () => {
      expect(ivan).toBeDefined();
      const html = renderFichaHtml(ivan, lookupPersonMoney(money, IVAN_ID));
      expect(html).toMatch(/IVAN MÜLLER BOTELHO/);
      expect(html).toMatch(/Formul[aá]rio|FRE/);
      expect(html).toMatch(/2025-05-16|16 de maio de 2025/);
      expect(containsLiteralOrPtBr(html, 1300458655.36)).toBe(true);
      expect(containsLiteralOrPtBr(html, 2896272224.98)).toBe(true);
      expect(html).toContain('Dinheiro econômico (fatia de capital)');
      expect(html).toContain('Dinheiro sob controle (fatia de votos)');
      expect(html).toContain('Não é uma fortuna.');
    });

    it('Ivan lead is the nexo template in view-source, with money sentence, not a biography (issue #161)', () => {
      const html = renderFichaHtml(ivan, lookupPersonMoney(money, IVAN_ID));
      expect(h1Text(html)).toMatch(/IVAN MÜLLER BOTELHO/);
      expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('<main>'));
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/figura como acionista controlador/);
      expect(lead).toMatch(/ENERGISA/);
      expect(lead).toMatch(/Formul[aá]rio 6\.1|FRE/);
      expect(lead).toMatch(/Fatia citada de capital/);
      expect(containsLiteralOrPtBr(lead, 1300458655.36)).toBe(true);
      expect(containsLiteralOrPtBr(lead, 2896272224.98)).toBe(true);
      expect(lead).toMatch(/16 de maio de 2025/);
      expect(lead).toContain('Não é uma fortuna.');
      expect(lead).not.toMatch(/é um empresário/i);
      expect(lead).not.toMatch(/o bili?on[aá]rio/i);
      expect(html).not.toMatch(/<script(?![^>]*type="application\/ld\+json")/i);
    });

    it('Ivan cite is in the HTML (not JS-only) and does not print the 0.387 hop slice', () => {
      const html = renderFichaHtml(ivan, lookupPersonMoney(money, IVAN_ID));
      expect(html).not.toMatch(/<script(?![^>]*type="application\/ld\+json")/i);
      expect(html).not.toContain(String(LAST_HOP_SLICE));
      expect(containsLiteralOrPtBr(html, LAST_HOP_MONEY)).toBe(false);
    });

    it('Joaquim HTML has the cited role and no money block', () => {
      expect(joaquim).toBeDefined();
      const html = renderFichaHtml(joaquim, lookupPersonMoney(money, JOAQUIM_ID));
      expect(html).toMatch(/JOAQUIM DA SILVA FERREIRA/);
      expect(html).toMatch(/s[oó]cio-administrador/i);
      expect(html).toMatch(/NOVA FUTURA/i);
      expect(html).toMatch(/Receita|Quadro/);
      expect(html).not.toContain('Dinheiro econômico (fatia de capital)');
      expect(html).not.toContain('Dinheiro sob controle (fatia de votos)');
      expect(html).not.toMatch(/R\$/);
      expect(html).not.toContain('money_economic');
      expect(html).not.toMatch(/>\s*0\s*</);
      expect(html).not.toMatch(/R\$\s*[—–-]/);
    });

    it('Joaquim lead is sócio-administrador of Nova Futura and has no money sentence (issue #161)', () => {
      const html = renderFichaHtml(joaquim, lookupPersonMoney(money, JOAQUIM_ID));
      expect(h1Text(html)).toMatch(/JOAQUIM DA SILVA FERREIRA/);
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/figura como s[oó]cio-administrador/);
      expect(lead).toMatch(/NOVA FUTURA/);
      expect(lead).not.toMatch(/Fatia citada/);
      expect(lead).not.toMatch(/R\$/);
      expect(lead).not.toContain('Não é uma fortuna.');
    });

    it('public ficha HTML has no eleven-digit Cadastro, no UBO, no biography voice', () => {
      for (const pessoa of minted) {
        const html = renderFichaHtml(pessoa, lookupPersonMoney(money, pessoa.id));
        expect(html, `${pessoa.id} must not contain eleven-digit Cadastro`).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
        expect(html, `${pessoa.id} must not contain UBO`).not.toMatch(/\bUBO\b/i);
        expect(html, `${pessoa.id} must not say dono`).not.toMatch(/\bdono\b/i);
        expect(html, `${pessoa.id} must not use Wikipedia lead`).not.toMatch(/é um empresário/i);
        expect(html, `${pessoa.id} must not say o bilionário`).not.toMatch(/o bili?on[aá]rio/i);
        expect(html).not.toMatch(/ver no grafo/i);
        expect(html).not.toMatch(/ver dossi[eê]/i);
      }
    });
  });
});
