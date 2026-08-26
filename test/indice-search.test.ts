import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mintCitedEmpresas } from '../src/lib/mint-empresa';
import { mintCitedPessoas } from '../src/lib/mint-pessoa';
import {
  classifyIndiceQuery,
  searchIndice,
  type MintedFicha,
} from '../src/lib/indice-search';
import type { GrafoData } from '../src/lib/grafo-elements';

const IVAN_ID = 'p-cdbc8c4e';
const JOAQUIM_ID = 'p-da3e3836';
const MUFFATO_ID = 'p-faf6d605';
const ENERGISA_ID = '00864214000106';
const RECORD_ID = 'record';

function loadCommittedGrafo(): GrafoData {
  const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

function mintedFichas(grafo: GrafoData): MintedFicha[] {
  return [
    ...mintCitedPessoas(grafo).map((pessoa) => ({
      id: pessoa.id,
      label: pessoa.name,
      kind: 'person' as const,
    })),
    ...mintCitedEmpresas(grafo).map((empresa) => ({
      id: empresa.id,
      label: empresa.legal_name,
      kind: 'company' as const,
    })),
  ];
}

describe('Índice search classify helper (issue #149)', () => {
  const grafo = loadCommittedGrafo();
  const minted = mintedFichas(grafo);

  it('ivan or p-cdbc8c4e classifies as ficha → /pessoa/p-cdbc8c4e/', () => {
    for (const query of ['ivan', 'IVAN', IVAN_ID, 'Ivan Müller Botelho']) {
      const result = classifyIndiceQuery(query, grafo.nodes, minted);
      expect(result.kind, query).toBe('ficha');
      expect(result.href, query).toBe(`/pessoa/${IVAN_ID}/`);
      expect(result.hits.some((hit) => hit.id === IVAN_ID && hit.href === `/pessoa/${IVAN_ID}/`)).toBe(
        true
      );
    }
  });

  it('Joaquim / p-da3e3836 classifies as ficha → /pessoa/p-da3e3836/', () => {
    const result = classifyIndiceQuery('Joaquim da Silva Ferreira', grafo.nodes, minted);
    expect(result.kind).toBe('ficha');
    expect(result.href).toBe(`/pessoa/${JOAQUIM_ID}/`);
  });

  it('muffato / p-faf6d605 / EVERTON MUFFATO classifies as grafo_only, not a ficha href', () => {
    for (const query of ['muffato', MUFFATO_ID, 'EVERTON MUFFATO']) {
      const result = classifyIndiceQuery(query, grafo.nodes, minted);
      expect(result.kind, query).toBe('grafo_only');
      expect(result.href, query).toBeNull();
      expect(
        result.hits.every((hit) => hit.href === null && hit.classification === 'grafo_only'),
        query
      ).toBe(true);
      expect(result.hits.some((hit) => hit.id === MUFFATO_ID)).toBe(true);
    }
  });

  it('ZZZ NOME INEXISTENTE 999 classifies as not in the archive', () => {
    const result = classifyIndiceQuery('ZZZ NOME INEXISTENTE 999', grafo.nodes, minted);
    expect(result.kind).toBe('not_in_archive');
    expect(result.href).toBeNull();
    expect(result.hits).toEqual([]);
  });

  it('energisa or 00864214000106 classifies as ficha → /empresa/00864214000106/', () => {
    for (const query of ['energisa', ENERGISA_ID]) {
      const result = classifyIndiceQuery(query, grafo.nodes, minted);
      expect(result.kind, query).toBe('ficha');
      expect(result.href, query).toBe(`/empresa/${ENERGISA_ID}/`);
    }
  });

  it('record classifies as ficha → /empresa/record/', () => {
    const result = classifyIndiceQuery('record', grafo.nodes, minted);
    expect(result.kind).toBe('ficha');
    expect(result.href).toBe(`/empresa/${RECORD_ID}/`);
    expect(grafo.nodes.some((node) => node.id === RECORD_ID)).toBe(false);
  });

  it('Ache partner-only / Guilherme Mexias Ache classifies as not in the archive', () => {
    expect(grafo.nodes.some((node) => node.label === 'GUILHERME MEXIAS ACHE')).toBe(false);
    for (const query of ['Guilherme Mexias Ache', 'GUILHERME MEXIAS ACHE']) {
      const result = classifyIndiceQuery(query, grafo.nodes, minted);
      expect(result.kind, query).toBe('not_in_archive');
      expect(result.href, query).toBeNull();
      expect(result.hits, query).toEqual([]);
    }
  });

  it('empty query returns no results list', () => {
    expect(searchIndice('', grafo.nodes, minted)).toEqual([]);
    expect(searchIndice('   ', grafo.nodes, minted)).toEqual([]);
    expect(classifyIndiceQuery('', grafo.nodes, minted).kind).toBe('empty');
  });

  it('helper and grafo-search have no fortuna, UBO, dono, or o bilionário', () => {
    const helper = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'indice-search.ts'),
      'utf-8'
    );
    expect(helper).not.toMatch(/fortuna/i);
    expect(helper).not.toMatch(/\bUBO\b/i);
    expect(helper).not.toMatch(/\bdono\b/i);
    expect(helper).not.toMatch(/o bili?on[aá]rio/i);
  });
});
