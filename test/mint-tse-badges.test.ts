import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mintCitedPessoas, renderFichaHtml, type CitedPessoa } from '../src/lib/mint-pessoa';
import { lookupPersonMoney } from '../src/lib/grafo-money';
import type { GrafoData } from '../src/lib/grafo-elements';
import { firstMainBlockText } from './ficha-html';
import {
  COMMITTED_TSE_MATCH_RELATIVE,
  badgesForMintedPessoa,
  loadCommittedTseMatch,
  type GraphPersonTseMatchRow,
} from '../src/lib/mint-tse-badges';

const IVAN_ID = 'p-cdbc8c4e';
const JOAQUIM_ID = 'p-da3e3836';
const EDUARDO_ID = 'p-e1365405';
const MUFFATO_ID = 'p-faf6d605';
const CANDIDATE_EXAMPLE_IDS = ['p-33bb4f86', 'p-55b17a37', 'p-77cb38bd', 'p-e72fa01a'] as const;
const ELEVEN_DIGIT = /(?<!\d)\d{11}(?!\d)/;
const ROOT = path.join(__dirname, '..');
const SIDECAR_PATH = path.join(ROOT, COMMITTED_TSE_MATCH_RELATIVE);

function loadCommittedGrafo(): GrafoData {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'grafo-publico.json'), 'utf-8'));
}

function loadCommittedMoney() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'grafo-dinheiro.json'), 'utf-8'));
}

function fixturePessoa(id: string, name = 'PESSOA FORTE'): CitedPessoa {
  return {
    id,
    name,
    role: 'sócio-administrador',
    company_label: 'EMPRESA FICTICIA LTDA',
    source: 'Receita / Quadro de Sócios',
    date: null,
  };
}

function matchRow(partial: Partial<GraphPersonTseMatchRow> & Pick<GraphPersonTseMatchRow, 'person_id'>): GraphPersonTseMatchRow {
  return {
    is_candidate_strong: false,
    is_donor_strong: false,
    candidate_cycles: null,
    donor_cycles: null,
    match_class: 'no_hit',
    ...partial,
  };
}

function sidecarPresent(): boolean {
  return fs.existsSync(SIDECAR_PATH);
}

describe('Minted ficha TSE badges (issue #169)', () => {
  describe('helper from fixture match rows', () => {
    it('strong candidate + donor yields both badges and closed cycles, dropping 2026', () => {
      const pessoa = fixturePessoa('p-aaa11111');
      const rows = [
        matchRow({
          person_id: 'p-aaa11111',
          is_candidate_strong: true,
          is_donor_strong: true,
          candidate_cycles: '2016,2022,2026',
          donor_cycles: ['2018', '2020', '2024'],
          match_class: 'strong',
        }),
      ];
      const result = badgesForMintedPessoa(pessoa, rows);
      expect(result.badges).toEqual(['político', 'doador']);
      expect(result.candidate_cycles).toEqual([2016, 2022]);
      expect(result.donor_cycles).toEqual([2018, 2020, 2024]);
      expect(result.candidate_cycles).not.toContain(2026);
      expect(result.donor_cycles).not.toContain(2026);
    });

    it('name_review never yields político or doador, even if flags are later set', () => {
      const pessoa = fixturePessoa('p-bbb22222', 'NOME UNICO');
      const rows = [
        matchRow({
          person_id: 'p-bbb22222',
          is_candidate_strong: true,
          is_donor_strong: true,
          candidate_cycles: '2022',
          donor_cycles: '2024',
          match_class: 'name_review',
        }),
      ];
      const result = badgesForMintedPessoa(pessoa, rows);
      expect(result.badges).toEqual([]);
      expect(result.candidate_cycles).toEqual([]);
      expect(result.donor_cycles).toEqual([]);
    });

    it('collision never yields a badge', () => {
      const pessoa = fixturePessoa('p-ccc33333', 'NOME COLISAO');
      const rows = [
        matchRow({
          person_id: 'p-ccc33333',
          is_candidate_strong: true,
          is_donor_strong: true,
          candidate_cycles: '2018',
          donor_cycles: '2016',
          match_class: 'collision',
        }),
      ];
      expect(badgesForMintedPessoa(pessoa, rows).badges).toEqual([]);
    });

    it('no_hit and missing rows yield no badge', () => {
      const pessoa = fixturePessoa('p-ddd44444', 'SEM EVENTO');
      expect(
        badgesForMintedPessoa(pessoa, [matchRow({ person_id: 'p-ddd44444', match_class: 'no_hit' })]).badges
      ).toEqual([]);
      expect(badgesForMintedPessoa(pessoa, []).badges).toEqual([]);
    });

    it('strong donor without cycles still yields doador and omits the cycle list', () => {
      const pessoa = fixturePessoa('p-eee55555');
      const result = badgesForMintedPessoa(pessoa, [
        matchRow({
          person_id: 'p-eee55555',
          is_donor_strong: true,
          match_class: 'strong',
        }),
      ]);
      expect(result.badges).toEqual(['doador']);
      expect(result.candidate_cycles).toEqual([]);
      expect(result.donor_cycles).toEqual([]);
    });
  });

  describe('rendered minted HTML from fixture rows', () => {
    it('strong candidate + donor HTML has both badges, [n], and Base dos Dados - TSE Eleições', () => {
      const pessoa = fixturePessoa('p-aaa11111');
      const tse = badgesForMintedPessoa(pessoa, [
        matchRow({
          person_id: 'p-aaa11111',
          is_candidate_strong: true,
          is_donor_strong: true,
          candidate_cycles: '2016,2022',
          donor_cycles: '2018,2024',
          match_class: 'strong',
        }),
      ]);
      const html = renderFichaHtml(pessoa, null, '', tse);
      expect(html).toMatch(/<span class="ficha-badge">político<\/span>/);
      expect(html).toMatch(/<span class="ficha-badge">doador<\/span>/);
      expect(html).toMatch(/<sup class="citation-marker">\[1\]<\/sup>/);
      expect(html).toContain('Base dos Dados - TSE Eleições');
      expect(html).toContain('basedosdados.org/queries/tse-receitas');
      expect(html).toContain('2016');
      expect(html).toContain('2022');
      expect(html).toContain('2018');
      expect(html).toContain('2024');
      expect(html).not.toContain('2026');
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/figura como s[oó]cio-administrador/);
      expect(lead).not.toMatch(/o doador/i);
      expect(lead).not.toMatch(/o pol[ií]tico/i);
      expect(html).not.toMatch(ELEVEN_DIGIT);
      expect(html).not.toMatch(/fortuna/i);
    });

    it('name_review HTML has no político, no doador, and no invented cycles', () => {
      const pessoa = fixturePessoa('p-bbb22222');
      const tse = badgesForMintedPessoa(pessoa, [
        matchRow({
          person_id: 'p-bbb22222',
          is_candidate_strong: true,
          is_donor_strong: true,
          candidate_cycles: '2022',
          donor_cycles: '2024',
          match_class: 'name_review',
        }),
      ]);
      const html = renderFichaHtml(pessoa, null, '', tse);
      expect(html).not.toMatch(/<span class="ficha-badge">/);
      expect(html).not.toContain('político');
      expect(html).not.toContain('doador');
      expect(html).not.toContain('2022');
      expect(html).not.toContain('2024');
      expect(html).not.toContain('Base dos Dados - TSE Eleições');
    });

    it('collision HTML has no badge', () => {
      const pessoa = fixturePessoa('p-ccc33333');
      const html = renderFichaHtml(
        pessoa,
        null,
        '',
        badgesForMintedPessoa(pessoa, [
          matchRow({
            person_id: 'p-ccc33333',
            is_candidate_strong: true,
            is_donor_strong: true,
            match_class: 'collision',
          }),
        ])
      );
      expect(html).not.toMatch(/<span class="ficha-badge">/);
      expect(html).not.toContain('político');
      expect(html).not.toContain('doador');
    });
  });

  describe('mint set and live committed graph', () => {
    const grafo = loadCommittedGrafo();
    const money = loadCommittedMoney();
    const minted = mintCitedPessoas(grafo);
    const mintedIds = new Set(minted.map((pessoa) => pessoa.id));
    const ivan = minted.find((pessoa) => pessoa.id === IVAN_ID)!;
    const joaquim = minted.find((pessoa) => pessoa.id === JOAQUIM_ID)!;
    const rows = loadCommittedTseMatch();

    it('mintCitedPessoas still includes Ivan + Joaquim and excludes Eduardo/Muffato', () => {
      expect(mintedIds.has(IVAN_ID)).toBe(true);
      expect(mintedIds.has(JOAQUIM_ID)).toBe(true);
      expect(mintedIds.has(EDUARDO_ID)).toBe(false);
      expect(mintedIds.has(MUFFATO_ID)).toBe(false);
      expect(minted.map((pessoa) => pessoa.id).sort()).toEqual([IVAN_ID, JOAQUIM_ID].sort());
    });

    it('does not mint a /pessoa/ from the candidate examples or Eduardo', () => {
      for (const id of [...CANDIDATE_EXAMPLE_IDS, EDUARDO_ID, MUFFATO_ID]) {
        expect(mintedIds.has(id), `${id} must not be minted from a donation or candidacy`).toBe(false);
      }
    });

    it('Eduardo p-e1365405 still has no minted ficha, so no page and no badge', () => {
      expect(minted.some((pessoa) => pessoa.id === EDUARDO_ID)).toBe(false);
      const eduardoRow = rows.find((row) => row.person_id === EDUARDO_ID);
      if (eduardoRow) {
        expect(eduardoRow.match_class === 'strong' && eduardoRow.is_donor_strong).toBe(true);
      }
    });

    it('live badges are the intersection of mintCitedPessoas and committed strong rows, not a hardcoded five-person list', () => {
      const liveBadgeIds = minted
        .filter((pessoa) => badgesForMintedPessoa(pessoa, rows).badges.length > 0)
        .map((pessoa) => pessoa.id)
        .sort();
      const hardcodedFive = [JOAQUIM_ID, EDUARDO_ID, ...CANDIDATE_EXAMPLE_IDS].sort();
      expect(liveBadgeIds).not.toContain(EDUARDO_ID);
      if (!sidecarPresent()) {
        expect(liveBadgeIds).toEqual([]);
        expect(rows).toEqual([]);
      } else {
        const expected = rows
          .filter(
            (row) =>
              mintedIds.has(row.person_id) &&
              row.match_class === 'strong' &&
              (row.is_candidate_strong || row.is_donor_strong)
          )
          .map((row) => row.person_id)
          .sort();
        expect(liveBadgeIds).toEqual(expected);
        expect(liveBadgeIds).not.toEqual(hardcodedFive);
      }
    });

    it('Joaquim live ficha: doador only if sidecar says donor-strong; no político; no invented cycles', () => {
      expect(joaquim).toBeDefined();
      const tse = badgesForMintedPessoa(joaquim, rows);
      const html = renderFichaHtml(joaquim, lookupPersonMoney(money, JOAQUIM_ID), '', tse);
      const lead = firstMainBlockText(html);
      expect(lead).toMatch(/figura como s[oó]cio-administrador/);
      expect(lead).not.toMatch(/o doador/i);
      expect(html).not.toMatch(ELEVEN_DIGIT);
      if (!sidecarPresent()) {
        expect(tse.badges).toEqual([]);
        expect(html).not.toMatch(/<span class="ficha-badge">/);
        expect(html).not.toContain('político');
        expect(html).not.toContain('doador');
        expect(html).not.toContain('2016');
        expect(html).not.toContain('2018');
        expect(html).not.toContain('2020');
        expect(html).not.toContain('2022');
        expect(html).not.toContain('2024');
      } else {
        expect(tse.badges).toEqual(['doador']);
        expect(tse.candidate_cycles).toEqual([]);
        expect(tse.donor_cycles).toEqual([2024]);
        expect(html).toMatch(/<span class="ficha-badge">doador<\/span>/);
        expect(html).not.toMatch(/<span class="ficha-badge">político<\/span>/);
        expect(html).toContain('2024');
        expect(html).toContain('Base dos Dados - TSE Eleições');
        expect(html).toContain('basedosdados.org/queries/tse-receitas');
        expect(html).toMatch(/<sup class="citation-marker">\[1\]<\/sup>/);
      }
    });

    it('Ivan HTML has no badge unless a committed strong match row says so', () => {
      expect(ivan).toBeDefined();
      const tse = badgesForMintedPessoa(ivan, rows);
      const html = renderFichaHtml(ivan, lookupPersonMoney(money, IVAN_ID), '', tse);
      const ivanRow = rows.find((row) => row.person_id === IVAN_ID);
      const strong =
        ivanRow?.match_class === 'strong' &&
        (ivanRow.is_candidate_strong || ivanRow.is_donor_strong);
      if (!strong) {
        expect(tse.badges).toEqual([]);
        expect(html).not.toMatch(/<span class="ficha-badge">/);
        expect(html).not.toContain('político');
        expect(html).not.toContain('doador');
      }
      expect(html).not.toMatch(ELEVEN_DIGIT);
    });
  });

  describe('public HTML / sidecar privacy', () => {
    it('committed sidecar text, if present, has no eleven-digit Cadastro and no fortuna', () => {
      if (!sidecarPresent()) {
        expect(fs.existsSync(path.join(ROOT, 'public', 'grafo-tse-match.json'))).toBe(false);
        return;
      }
      const text = fs.readFileSync(SIDECAR_PATH, 'utf-8');
      expect(text).not.toMatch(ELEVEN_DIGIT);
      expect(text).not.toMatch(/fortuna/i);
    });

    it('does not ship a handmade public list of the four candidates or 251 donors', () => {
      expect(fs.existsSync(path.join(ROOT, 'public', 'grafo-tse-match.json'))).toBe(false);
      const helper = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'mint-tse-badges.ts'), 'utf-8');
      expect(helper).not.toContain('p-33bb4f86');
      expect(helper).not.toContain('p-55b17a37');
      expect(helper).not.toContain('p-77cb38bd');
      expect(helper).not.toContain('p-e72fa01a');
      expect(helper).not.toMatch(/AMAR[IÍ]LIO/i);
    });
  });
});
