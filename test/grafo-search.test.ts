import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { searchGrafoNodes } from '../src/lib/grafo-search';
import { buildPanelView } from '../src/lib/grafo-panel';
import type { GrafoData } from '../src/lib/grafo-elements';

function loadCommittedGrafo(): GrafoData {
  const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

describe('Grafo search (issue #128)', () => {
  const json = loadCommittedGrafo();

  describe('pure helper: (nodes, query) → ordered matches', () => {
    it('ivan includes IVAN MÜLLER BOTELHO', () => {
      const hits = searchGrafoNodes(json.nodes, 'ivan');
      expect(hits).toContainEqual({
        id: 'p-cdbc8c4e',
        label: 'IVAN MÜLLER BOTELHO',
        kind: 'person',
      });
    });

    it('weg includes WEG S.A. / 84429695000111', () => {
      const hits = searchGrafoNodes(json.nodes, 'weg');
      expect(hits).toContainEqual({
        id: '84429695000111',
        label: 'WEG S.A.',
        kind: 'company',
      });
    });

    it('10630748000121 includes Opportunity Partners Participações Ltda.', () => {
      const hits = searchGrafoNodes(json.nodes, '10630748000121');
      expect(hits).toContainEqual({
        id: '10630748000121',
        label: 'Opportunity Partners Participações Ltda.',
        kind: 'company',
      });
    });

    it('jose salim includes a node whose live label has José after accent fold', () => {
      const hits = searchGrafoNodes(json.nodes, 'jose salim');
      expect(hits).toContainEqual({
        id: 'p-d584d2cc',
        label: 'JOSÉ SALIM MATTAR JÚNIOR',
        kind: 'person',
      });
    });

    it('empty query returns []', () => {
      expect(searchGrafoNodes(json.nodes, '')).toEqual([]);
      expect(searchGrafoNodes(json.nodes, '   ')).toEqual([]);
      expect(searchGrafoNodes(json.nodes, '\t\n')).toEqual([]);
    });

    it('GUILHERME MEXIAS ACHE does not appear (panel-only partner, not a node label)', () => {
      expect(
        json.nodes.some((node) => node.label === 'GUILHERME MEXIAS ACHE')
      ).toBe(false);
      expect(searchGrafoNodes(json.nodes, 'GUILHERME MEXIAS ACHE')).toEqual([]);
    });

    it('people appear before companies when both match', () => {
      const fixture = [
        { id: 'c-beta', kind: 'company' as const, label: 'Beta Co' },
        { id: 'p-zeta', kind: 'person' as const, label: 'Zeta Person' },
      ];
      expect(searchGrafoNodes(fixture, 'eta')).toEqual([
        { id: 'p-zeta', label: 'Zeta Person', kind: 'person' },
        { id: 'c-beta', label: 'Beta Co', kind: 'company' },
      ]);
    });

    it('results length is at most 20', () => {
      const fixture = [
        { id: 'p-00000000', kind: 'person' as const, label: 'Nome 00' },
        { id: 'p-00000001', kind: 'person' as const, label: 'Nome 01' },
        { id: 'p-00000002', kind: 'person' as const, label: 'Nome 02' },
        { id: 'p-00000003', kind: 'person' as const, label: 'Nome 03' },
        { id: 'p-00000004', kind: 'person' as const, label: 'Nome 04' },
        { id: 'p-00000005', kind: 'person' as const, label: 'Nome 05' },
        { id: 'p-00000006', kind: 'person' as const, label: 'Nome 06' },
        { id: 'p-00000007', kind: 'person' as const, label: 'Nome 07' },
        { id: 'p-00000008', kind: 'person' as const, label: 'Nome 08' },
        { id: 'p-00000009', kind: 'person' as const, label: 'Nome 09' },
        { id: 'p-00000010', kind: 'person' as const, label: 'Nome 10' },
        { id: 'p-00000011', kind: 'person' as const, label: 'Nome 11' },
        { id: 'p-00000012', kind: 'person' as const, label: 'Nome 12' },
        { id: 'p-00000013', kind: 'person' as const, label: 'Nome 13' },
        { id: 'p-00000014', kind: 'person' as const, label: 'Nome 14' },
        { id: 'p-00000015', kind: 'person' as const, label: 'Nome 15' },
        { id: 'p-00000016', kind: 'person' as const, label: 'Nome 16' },
        { id: 'p-00000017', kind: 'person' as const, label: 'Nome 17' },
        { id: 'p-00000018', kind: 'person' as const, label: 'Nome 18' },
        { id: 'p-00000019', kind: 'person' as const, label: 'Nome 19' },
        { id: 'p-00000020', kind: 'person' as const, label: 'Nome 20' },
        { id: 'c-zzzzzzzz', kind: 'company' as const, label: 'Nome Company' },
      ];
      const hits = searchGrafoNodes(fixture, 'nome');
      expect(hits).toHaveLength(20);
      expect(hits.map((hit) => hit.label)).toEqual([
        'Nome 00',
        'Nome 01',
        'Nome 02',
        'Nome 03',
        'Nome 04',
        'Nome 05',
        'Nome 06',
        'Nome 07',
        'Nome 08',
        'Nome 09',
        'Nome 10',
        'Nome 11',
        'Nome 12',
        'Nome 13',
        'Nome 14',
        'Nome 15',
        'Nome 16',
        'Nome 17',
        'Nome 18',
        'Nome 19',
      ]);
    });

    it('does not search partners arrays', () => {
      const helperPath = path.join(__dirname, '..', 'src', 'lib', 'grafo-search.ts');
      const helper = fs.readFileSync(helperPath, 'utf-8');
      expect(helper).not.toMatch(/partners/);
    });
  });

  describe('same panel as a canvas tap', () => {
    it('buildPanelView for a chosen search id equals buildPanelView for a tap on that nodeId', () => {
      const hits = searchGrafoNodes(json.nodes, 'ivan');
      const chosen = hits.find((hit) => hit.id === 'p-cdbc8c4e');
      expect(chosen).toBeDefined();

      const fromSearch = buildPanelView(json, { nodeId: chosen!.id });
      const fromTap = buildPanelView(json, { nodeId: 'p-cdbc8c4e' });
      expect(fromSearch).toEqual(fromTap);
      expect(fromSearch).not.toBeNull();
      expect(fromSearch!.mode).toBe('node');
    });
  });

  describe('page', () => {
    const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
    const page = fs.readFileSync(pagePath, 'utf-8');

    it('grafo.astro contains Buscar pessoa ou empresa', () => {
      expect(page).toContain('Buscar pessoa ou empresa');
    });

    it('search box label is associated with the input', () => {
      expect(page).toMatch(/<label[^>]*for="grafo-search"[^>]*>Buscar pessoa ou empresa<\/label>/);
      expect(page).toMatch(/<input[^>]*id="grafo-search"/);
    });

    it('empty query hides the list', () => {
      expect(page).toMatch(
        /id="grafo-search-results"[^>]*\bhidden\b|\bhidden\b[^>]*id="grafo-search-results"/
      );
      expect(page).toMatch(/searchGrafoNodes\s*\(/);
      expect(page).toMatch(/from ['"]\.\.\/lib\/grafo-search['"]/);
    });

    it('typed query with zero matches shows a Portuguese no-match state without fortuna', () => {
      expect(page).toContain('Nenhuma pessoa ou empresa neste grafo.');
      expect(page).toMatch(/id="grafo-search-empty"/);
      expect(page).not.toMatch(/fortuna/i);
    });

    it('Enter selects the first match', () => {
      expect(page).toMatch(/Enter/);
      expect(page).toMatch(/matches\[0\]|hits\[0\]/);
    });

    it('choosing a result calls the same buildPanelView path as a tap', () => {
      expect(page).toMatch(/from ['"]\.\.\/lib\/grafo-panel['"]/);
      expect(page).toMatch(/buildPanelView\s*\(\s*data\s*,\s*\{\s*nodeId/);
      expect(page).toMatch(/cy\.on\(\s*['"]tap['"]\s*,\s*['"]node['"]/);
      expect(page).toMatch(/cy\.(fit|center)\s*\(/);
    });

    it('does not filter or fade unmatched canvas nodes', () => {
      expect(page).not.toMatch(/addClass\(['"](?:hidden|dim|fade|unmatched)/);
      expect(page).not.toMatch(/\.style\(\s*['"]display['"]/);
      expect(page).not.toMatch(/\.style\(\s*['"]opacity['"]/);
    });

    it('page copy states the live node and edge counts from the committed JSON', () => {
      expect(page).toContain(`${json.nodes.length} nós, ${json.edges.length} arestas`);
    });
  });

  describe('hard rules stay green', () => {
    it('has no fortuna and zero eleven-digit Cadastro in the public JSON', () => {
      const jsonPath = path.join(__dirname, '..', 'public', 'grafo-publico.json');
      const jsonText = fs.readFileSync(jsonPath, 'utf-8');
      expect(jsonText).not.toMatch(/fortuna/i);
      expect(jsonText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
    });

    it('search helper and /grafo page have no fortuna', () => {
      const helper = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'lib', 'grafo-search.ts'),
        'utf-8'
      );
      const page = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'pages', 'grafo.astro'),
        'utf-8'
      );
      expect(helper).not.toMatch(/fortuna/i);
      expect(page).not.toMatch(/fortuna/i);
    });

    it('other pages stay without extra JS', () => {
      const pagesDir = path.join(__dirname, '..', 'src', 'pages');
      const otherPages = [
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
