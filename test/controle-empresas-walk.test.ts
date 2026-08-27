import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';

const CSV_PATH = path.join(__dirname, '..', 'data', 'controle-empresas-walk.csv');
const README_PATH = path.join(__dirname, '..', 'data', 'controle-empresas-walk-README.txt');

const HEADERS = [
  'nome',
  'identificador',
  'tipo_societario',
  'no_grafo',
  'porque',
  'situacao_do_passeio',
  'no_formulario',
  'notas',
] as const;

const SITUACAO = [
  'árvore no grafo',
  'pulada-já-semente',
  'grupo sem sócio',
  'buraco',
  'inventário-fechada-não-andar',
  'só inventário',
] as const;

function parseSemicolonCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ';') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      if (!(row.length === 1 && row[0] === '' && i === src.length - 1)) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

describe('walk-control table (issue #174)', () => {
  const raw = fs.readFileSync(CSV_PATH);
  const text = raw.toString('utf8');
  const table = parseSemicolonCsv(text);
  const header = table[0];
  const records = table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    HEADERS.forEach((name, index) => {
      row[name] = cells[index] ?? '';
    });
    return row;
  });

  it('is UTF-8 with BOM and semicolon headers', () => {
    expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    expect(header).toEqual([...HEADERS]);
    expect(records).toHaveLength(653);
  });

  it('holds the agreed counts and enumerations', () => {
    const count = (field: string) => {
      const tallies = new Map<string, number>();
      for (const row of records) {
        tallies.set(row[field], (tallies.get(row[field]) ?? 0) + 1);
      }
      return tallies;
    };

    expect(count('no_grafo')).toEqual(new Map([['sim', 184], ['não', 469]]));
    expect(count('situacao_do_passeio')).toEqual(
      new Map([
        ['só inventário', 468],
        ['árvore no grafo', 141],
        ['pulada-já-semente', 35],
        ['grupo sem sócio', 4],
        ['buraco', 4],
        ['inventário-fechada-não-andar', 1],
      ])
    );
    expect(count('tipo_societario')).toEqual(
      new Map([
        ['sociedade anônima aberta', 180],
        ['sociedade anônima fechada', 4],
        ['desconhecido', 469],
      ])
    );

    for (const row of records) {
      expect(SITUACAO, row.nome).toContain(row.situacao_do_passeio);
      expect(['sim', 'não'], row.nome).toContain(row.no_grafo);
      expect(['sim', 'não', 'buraco'], row.nome).toContain(row.no_formulario);
    }
  });

  it('covers every LISTED_COMPANY_IDS id once as identificador, with no duplicate 14-digit ids', () => {
    const identifiers = records.map((row) => row.identificador);
    for (const id of LISTED_COMPANY_IDS) {
      expect(identifiers, `listed ${id}`).toContain(id);
    }
    expect(LISTED_COMPANY_IDS).toHaveLength(174);

    const fourteen = identifiers.filter((id) => /^\d{14}$/.test(id));
    expect(new Set(fourteen).size).toBe(fourteen.length);
  });

  it('keeps Dexco, Natura, Vibra, closed groups and the Excelsior collision apart', () => {
    const byNome = (nome: string) => records.filter((row) => row.nome === nome);

    const dexco = byNome('Dexco');
    expect(dexco).toHaveLength(1);
    expect(dexco[0].identificador).toBe('97837181000147');
    expect(dexco[0].notas).toMatch(/Votorantim/i);

    const natura = byNome('Natura & Co.');
    expect(natura).toHaveLength(1);
    expect(natura[0].identificador).toBe('vazio');
    expect(natura[0].situacao_do_passeio).toBe('inventário-fechada-não-andar');

    const vibra = byNome('Vibra');
    expect(vibra).toHaveLength(1);
    expect(vibra[0].identificador).toBe('34274233000102');
    expect(vibra[0].situacao_do_passeio).toBe('pulada-já-semente');

    expect(byNome('Globo')[0].identificador).toBe('globo');
    expect(byNome('Havan')[0].identificador).toBe('havan');
    expect(byNome('Record')[0].identificador).toBe('record');
    expect(byNome('Folha')[0].identificador).toBe('folha');

    const insurer = records.find((row) => row.nome === 'Excelsior' && row.porque.includes('insurers 41'));
    expect(insurer?.identificador).toBe('vazio');
    const alimentos = byNome('Excelsior Alimentos');
    expect(alimentos).toHaveLength(1);
    expect(alimentos[0].identificador).toBe('95426862000197');
    expect(alimentos[0].situacao_do_passeio).toBe('árvore no grafo');
  });

  it('ships a Portuguese README dated 2026-08-27 with the same counts', () => {
    const readme = fs.readFileSync(README_PATH, 'utf8');
    expect(readme).toContain('2026-08-27');
    expect(readme).toContain('653');
    expect(readme).toContain('sim 184');
    expect(readme).toContain('não 469');
    expect(readme).toContain('Excelsior Alimentos');
    expect(readme).toContain('Natura');
  });
});
