/**
 * Mint thin /pessoa/{p-id}/ fichas from committed public graph JSON.
 *
 * A person node becomes a page only when a cited hop names the role:
 *   A) Formulário acionista controlador (issue #147 cites Ivan / FRE Energisa 160981)
 *   B) Sócio-Administrador on a limitada, with a Receita / Quadro hop
 *
 * Everyone else stays a graph node. No invented ids. No name slugs.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GrafoData, GrafoEdge, GrafoNode } from './grafo-elements';
import { lookupPersonMoney, type GrafoMoneyFile, type PersonMoney } from './grafo-money';

export type CitedPessoaRole = 'acionista controlador' | 'sócio-administrador';

export type CitedPessoa = {
  id: string;
  name: string;
  role: CitedPessoaRole;
  company_label: string;
  source: string;
  date: string | null;
};

const PERSON_ID_RE = /^p-[0-9a-f]{8}$/;

/**
 * The public graph does not label hops as acionista controlador.
 * Issue #147 requires this hop: Ivan Müller Botelho, FRE Energisa 160981 / Formulário 6.1.
 * Do not mint every FRE shareholder.
 */
const FORMULARIO_CONTROLADOR_PERSON_ID = 'p-cdbc8c4e';
const FORMULARIO_CONTROLADOR_SOURCE = 'FRE Energisa 160981';
const FORMULARIO_CONTROLADOR_SOURCE_LABEL = 'Formulário 6.1 (FRE Energisa 160981)';

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function loadPublicGrafo(): GrafoData {
  const filePath = path.join(process.cwd(), 'public', 'grafo-publico.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GrafoData;
}

export function loadPublicMoney(): GrafoMoneyFile {
  const filePath = path.join(process.cwd(), 'public', 'grafo-dinheiro.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GrafoMoneyFile;
}

function foldUpper(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

function isPersonId(id: string): boolean {
  return PERSON_ID_RE.test(id);
}

function isBlockedNode(node: GrafoNode): boolean {
  if (node.id.startsWith('tesouraria-') || node.id.startsWith('outros-')) {
    return true;
  }
  const folded = foldUpper(node.label);
  if (folded.includes('UNIAO FEDERAL')) {
    return true;
  }
  if (folded.startsWith('ESTADO ') || folded.startsWith('MUNICIPIO ')) {
    return true;
  }
  return false;
}

function isLtdaLabel(label: string): boolean {
  const folded = foldUpper(label);
  return folded.includes('LTDA') || folded.includes('LIMITADA');
}

function isoDateFromSource(source: string): string | null {
  const match = source.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function isReceitaQuadroSource(source: string): boolean {
  return /Receita|Quadro de S[oó]cios/.test(source);
}

function nodeById(data: GrafoData, id: string): GrafoNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

function outgoingHops(data: GrafoData, fromId: string): GrafoEdge[] {
  return data.edges.filter((edge) => edge.from === fromId);
}

function mintFormularioControlador(data: GrafoData): CitedPessoa | null {
  const person = nodeById(data, FORMULARIO_CONTROLADOR_PERSON_ID);
  if (!person || person.kind !== 'person' || !isPersonId(person.id) || isBlockedNode(person)) {
    return null;
  }

  const hop = outgoingHops(data, person.id).find((edge) => {
    if (edge.kind !== 'person_owns') {
      return false;
    }
    if (edge.source !== FORMULARIO_CONTROLADOR_SOURCE) {
      return false;
    }
    const company = nodeById(data, edge.to);
    return Boolean(company && /ENERGISA/i.test(company.label));
  });
  if (!hop) {
    return null;
  }

  const company = nodeById(data, hop.to);
  if (!company) {
    return null;
  }

  return {
    id: person.id,
    name: person.label,
    role: 'acionista controlador',
    company_label: company.label,
    source: FORMULARIO_CONTROLADOR_SOURCE_LABEL,
    date: isoDateFromSource(hop.source),
  };
}

function mintSocioAdministradores(data: GrafoData): CitedPessoa[] {
  const peopleByLabel = new Map<string, GrafoNode[]>();
  for (const node of data.nodes) {
    if (node.kind !== 'person') {
      continue;
    }
    const list = peopleByLabel.get(node.label) ?? [];
    list.push(node);
    peopleByLabel.set(node.label, list);
  }

  const minted: CitedPessoa[] = [];
  const seen = new Set<string>();

  for (const company of data.nodes) {
    if (company.kind !== 'company' || !isLtdaLabel(company.label) || !company.partners) {
      continue;
    }
    for (const partner of company.partners) {
      if (partner.qualificacao_label !== 'Sócio-Administrador') {
        continue;
      }
      const matches = peopleByLabel.get(partner.nome) ?? [];
      for (const person of matches) {
        if (!isPersonId(person.id) || isBlockedNode(person) || seen.has(person.id)) {
          continue;
        }
        const hop = outgoingHops(data, person.id).find(
          (edge) =>
            edge.to === company.id &&
            edge.kind === 'person_owns' &&
            isReceitaQuadroSource(edge.source)
        );
        if (!hop) {
          continue;
        }
        seen.add(person.id);
        minted.push({
          id: person.id,
          name: person.label,
          role: 'sócio-administrador',
          company_label: company.label,
          source: 'Receita / Quadro de Sócios',
          date: isoDateFromSource(hop.source),
        });
      }
    }
  }

  return minted;
}

export function mintCitedPessoas(grafo: GrafoData): CitedPessoa[] {
  const minted: CitedPessoa[] = [];
  const formulario = mintFormularioControlador(grafo);
  if (formulario) {
    minted.push(formulario);
  }
  minted.push(...mintSocioAdministradores(grafo));
  minted.sort((a, b) => a.id.localeCompare(b.id));
  return minted;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDatePt(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) {
    return iso;
  }
  const year = parts[0];
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (year.length !== 4 || !Number.isFinite(month) || !Number.isFinite(day)) {
    return iso;
  }
  const monthName = MONTHS_PT[month - 1];
  if (!monthName) {
    return iso;
  }
  return String(day) + ' de ' + monthName + ' de ' + year + ' (' + iso + ')';
}

function fieldLine(name: string, value: string): string {
  return (
    '<p><span class="ficha-field">' +
    escapeHtml(name) +
    '</span> ' +
    escapeHtml(value) +
    '</p>'
  );
}

function renderMoneyBlock(money: PersonMoney | null): string {
  if (!money) {
    return '';
  }
  return (
    '<section>' +
      fieldLine('Dinheiro econômico (fatia de capital)', formatReais(money.money_economic)) +
      fieldLine('Dinheiro sob controle (fatia de votos)', formatReais(money.money_control)) +
      '<p>Não é uma fortuna.</p>' +
    '</section>'
  );
}

export function renderFichaHtml(
  pessoa: CitedPessoa,
  money: PersonMoney | null,
  extraBodyHtml = ''
): string {
  const dateIso = money?.date || pessoa.date;
  const dateLine = dateIso ? fieldLine('Data', formatDatePt(dateIso)) : '';

  return (
    '<!DOCTYPE html>' +
    '<html lang="pt-BR">' +
      '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(pessoa.name) + ' - Billionaire Watcher</title>' +
        '<style>' +
          '*{margin:0;padding:0;box-sizing:border-box}' +
          'body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#333;max-width:900px;margin:0 auto;padding:2rem}' +
          'h1{font-size:2rem;margin-bottom:2rem;color:#1a1a1a}' +
          'a{color:#0066cc;text-decoration:none}' +
          'a:hover{text-decoration:underline}' +
          '.back-link{display:inline-block;margin-bottom:1rem;font-size:.9rem}' +
          '.ficha-field{color:#666;font-size:.85rem}' +
          'section{margin:2rem 0}' +
          'footer{margin-top:3rem;padding-top:2rem;border-top:1px solid #ddd}' +
        '</style>' +
      '</head>' +
      '<body>' +
        '<a href="/" class="back-link">← Voltar para o índice</a>' +
        '<header><h1>' + escapeHtml(pessoa.name) + '</h1></header>' +
        '<main>' +
          fieldLine('Papel', pessoa.role) +
          fieldLine('Empresa', pessoa.company_label) +
          fieldLine('Fonte', pessoa.source) +
          dateLine +
          renderMoneyBlock(money) +
          '<footer><p><a href="/metodologia">Metodologia →</a></p></footer>' +
        '</main>' +
        extraBodyHtml +
      '</body>' +
    '</html>'
  );
}

export function fichaMoneyFor(pessoa: CitedPessoa, moneyFile: GrafoMoneyFile | null | undefined): PersonMoney | null {
  return lookupPersonMoney(moneyFile, pessoa.id);
}
