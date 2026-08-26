/**
 * Mint thin /empresa/{id}/ fichas from committed public graph JSON.
 *
 * A company becomes a page only if it is:
 *   A) a listed seed already in LISTED_COMPANY_IDS and on grafo-publico.json
 *   B) one closed sociedade anônima group (agreed key `record`)
 *
 * Ordinary holdings, tesouraria, outros, União, limitadas and gestoras stay
 * graph nodes. Record and Globo are not in the JSON; this ticket mints Record
 * only. Do not invent a fourteen-digit Cadastro for Record.
 */

import type { GrafoData, GrafoEdge, GrafoNode } from './grafo-elements';
import { LISTED_COMPANY_IDS } from './grafo-panel';
import { mintCitedPessoas } from './mint-pessoa';

export type EmpresaType = 'listed_seed' | 'closed_sa_group';

export type EmpresaEntrada = {
  counterparty_label: string;
  pct_capital?: number;
  pct_votos?: number;
  source: string;
};

export type CitedEmpresa = {
  id: string;
  legal_name: string;
  type: EmpresaType;
  company_id: string | null;
  controlador_label: string | null;
  entradas: EmpresaEntrada[];
  quadro_does_not_name_shareholders: boolean;
};

const RECORD_GROUP_KEY = 'record';
const RECORD_LEGAL_NAME = 'Record';

function presentNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

function nodeById(data: GrafoData, id: string): GrafoNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

function incomingEdges(data: GrafoData, toId: string): GrafoEdge[] {
  return data.edges.filter((edge) => edge.to === toId);
}

function controladorByCompanyLabel(data: GrafoData): Map<string, string> {
  const map = new Map<string, string>();
  for (const pessoa of mintCitedPessoas(data)) {
    if (pessoa.role === 'acionista controlador') {
      map.set(pessoa.company_label, pessoa.name);
    }
  }
  return map;
}

function entradasFor(data: GrafoData, companyId: string): EmpresaEntrada[] {
  const entradas: EmpresaEntrada[] = [];
  for (const edge of incomingEdges(data, companyId)) {
    const counterparty = nodeById(data, edge.from);
    const entrada: EmpresaEntrada = {
      counterparty_label: counterparty?.label ?? edge.from,
      source: edge.source,
    };
    if (presentNumber(edge.pct_capital)) {
      entrada.pct_capital = edge.pct_capital;
    }
    if (presentNumber(edge.pct_votos)) {
      entrada.pct_votos = edge.pct_votos;
    }
    entradas.push(entrada);
  }
  return entradas;
}

function mintListedSeeds(data: GrafoData): CitedEmpresa[] {
  const controladores = controladorByCompanyLabel(data);
  const minted: CitedEmpresa[] = [];
  for (const id of LISTED_COMPANY_IDS) {
    const node = nodeById(data, id);
    if (!node || node.kind !== 'company') {
      continue;
    }
    minted.push({
      id: node.id,
      legal_name: node.label,
      type: 'listed_seed',
      company_id: node.id,
      controlador_label: controladores.get(node.label) ?? null,
      entradas: entradasFor(data, node.id),
      quadro_does_not_name_shareholders: false,
    });
  }
  return minted;
}

function mintClosedSaGroups(): CitedEmpresa[] {
  return [
    {
      id: RECORD_GROUP_KEY,
      legal_name: RECORD_LEGAL_NAME,
      type: 'closed_sa_group',
      company_id: null,
      controlador_label: null,
      entradas: [],
      quadro_does_not_name_shareholders: true,
    },
  ];
}

export function mintCitedEmpresas(grafo: GrafoData): CitedEmpresa[] {
  const minted = [...mintListedSeeds(grafo), ...mintClosedSaGroups()];
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

function formatPercent(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(rounded) + '%'
  );
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

function typeLabel(type: EmpresaType): string {
  if (type === 'listed_seed') {
    return 'companhia aberta (semente listada)';
  }
  return 'sociedade anônima fechada';
}

function renderControlador(empresa: CitedEmpresa): string {
  if (empresa.controlador_label) {
    return fieldLine('Controlador', empresa.controlador_label);
  }
  return (
    '<div class="missing-control">' +
      (empresa.quadro_does_not_name_shareholders
        ? 'Lacuna visível. O Quadro de Sócios não nomeia acionistas.'
        : 'Controlador não identificado nos registros públicos. Lacuna visível.') +
    '</div>'
  );
}

function renderEntrada(entrada: EmpresaEntrada): string {
  const parts = ['<li><strong>' + escapeHtml(entrada.counterparty_label) + '</strong>'];
  if (presentNumber(entrada.pct_capital)) {
    parts.push(fieldLine('capital', formatPercent(entrada.pct_capital)));
  }
  if (presentNumber(entrada.pct_votos)) {
    parts.push(fieldLine('votos', formatPercent(entrada.pct_votos)));
  }
  if (entrada.source) {
    parts.push(fieldLine('fonte', entrada.source));
  }
  parts.push('</li>');
  return parts.join('');
}

function renderEntradaList(entradas: EmpresaEntrada[]): string {
  if (entradas.length === 0) {
    return '';
  }
  return (
    '<section>' +
      '<h2>Entrada</h2>' +
      '<ul>' +
        entradas.map(renderEntrada).join('') +
      '</ul>' +
    '</section>'
  );
}

function renderResumoSection(sentences: string[]): string {
  if (sentences.length === 0) {
    return '';
  }
  return (
    '<section class="resumo">' +
      sentences.map((sentence) => '<p>' + escapeHtml(sentence) + '</p>').join('') +
    '</section>'
  );
}

/**
 * Template nexo only. Listed: type + controlador or a visible hole.
 * Closed S.A. group: the Quadro hole. No Wikipedia, no model prose.
 */
export function empresaResumoSentences(empresa: CitedEmpresa): string[] {
  if (empresa.type === 'closed_sa_group') {
    if (!empresa.quadro_does_not_name_shareholders) {
      return [];
    }
    return [
      empresa.legal_name + ' é sociedade anônima fechada.',
      'O Quadro de Sócios não nomeia acionistas.',
    ];
  }

  const sentences = [empresa.legal_name + ' é companhia aberta.'];
  if (empresa.controlador_label) {
    sentences.push(empresa.controlador_label + ' figura como acionista controlador no Formulário.');
  } else {
    sentences.push('Lacuna visível.');
  }
  return sentences;
}

export function renderEmpresaFichaHtml(empresa: CitedEmpresa): string {
  const idLine =
    empresa.company_id && /^\d{14}$/.test(empresa.company_id)
      ? fieldLine('Id', empresa.company_id)
      : '';

  return (
    '<!DOCTYPE html>' +
    '<html lang="pt-BR">' +
      '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(empresa.legal_name) + ' - Billionaire Watcher</title>' +
        '<style>' +
          '*{margin:0;padding:0;box-sizing:border-box}' +
          'body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#333;max-width:900px;margin:0 auto;padding:2rem}' +
          'h1{font-size:2rem;margin-bottom:2rem;color:#1a1a1a}' +
          'h2{font-size:1.5rem;margin-bottom:1rem;color:#1a1a1a}' +
          'a{color:#0066cc;text-decoration:none}' +
          'a:hover{text-decoration:underline}' +
          '.back-link{display:inline-block;margin-bottom:1rem;font-size:.9rem}' +
          '.ficha-field{color:#666;font-size:.85rem}' +
          'section{margin:2rem 0}' +
          '.resumo p{margin:0 0 .75rem}' +
          'ul{list-style:none;padding:0}' +
          'li{margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid #eee}' +
          '.missing-control{padding:1rem;background:#fff3cd;border-left:3px solid #ffc107;color:#856404;margin-top:.5rem}' +
          'footer{margin-top:3rem;padding-top:2rem;border-top:1px solid #ddd}' +
        '</style>' +
      '</head>' +
      '<body>' +
        '<a href="/" class="back-link">← Voltar para o índice</a>' +
        '<header><h1>' + escapeHtml(empresa.legal_name) + '</h1></header>' +
        '<main>' +
          renderResumoSection(empresaResumoSentences(empresa)) +
          fieldLine('Tipo', typeLabel(empresa.type)) +
          idLine +
          renderControlador(empresa) +
          renderEntradaList(empresa.entradas) +
          '<footer><p><a href="/metodologia">Metodologia →</a></p></footer>' +
        '</main>' +
      '</body>' +
    '</html>'
  );
}
