/**
 * Builds the /grafo side-panel view-model from committed JSON.
 *
 * Reads only label, kind, partners, pct_capital, pct_votos, source (plus id / from / to).
 * Cited participation is the product of hop percents on complete paths.
 * No invented percents. Person money is looked up from the money JSON; never baked in.
 */

import type { GrafoData, GrafoEdge, GrafoNode, GrafoPartner } from './grafo-elements';
import { lookupPersonMoney, type GrafoMoneyFile, type PersonMoney } from './grafo-money';

export type PanelHop = {
  other_id: string;
  other_label: string;
  direction: 'in' | 'out';
  kind: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type CitedHop = {
  from_id: string;
  from_label: string;
  to_id: string;
  to_label: string;
  kind: string;
  pct_capital?: number;
  pct_votos?: number;
  source?: string;
};

export type CitedPath = {
  hops: CitedHop[];
  pct_capital?: number;
  pct_votos?: number;
};

export type CitedParticipation = {
  company_id: string;
  company_label: string;
  pct_capital?: number;
  pct_votos?: number;
  paths: CitedPath[];
};

export type NodePanelView = {
  mode: 'node';
  label: string;
  kind: string;
  id: string;
  hops: PanelHop[];
  participations: CitedParticipation[];
  partners?: GrafoPartner[];
  money?: PersonMoney;
};

export type EdgePanelView = {
  mode: 'edge';
  from_label: string;
  to_label: string;
  kind: string;
  pct_capital?: number | null;
  pct_votos?: number | null;
  source?: string;
};

export type PanelView = NodePanelView | EdgePanelView | null;

export type PanelSelection =
  | { nodeId: string }
  | { from: string; to: string }
  | null;

function nodeById(data: GrafoData, id: string): GrafoNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

function labelOf(data: GrafoData, id: string): string {
  return nodeById(data, id)?.label ?? id;
}

function presentNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

function hopFromEdge(
  data: GrafoData,
  edge: GrafoEdge,
  direction: 'in' | 'out'
): PanelHop {
  const otherId = direction === 'out' ? edge.to : edge.from;
  const hop: PanelHop = {
    other_id: otherId,
    other_label: labelOf(data, otherId),
    direction,
    kind: edge.kind,
  };

  if (presentNumber(edge.pct_capital)) {
    hop.pct_capital = edge.pct_capital;
  }
  if (presentNumber(edge.pct_votos)) {
    hop.pct_votos = edge.pct_votos;
  }
  if (edge.source) {
    hop.source = edge.source;
  }

  return hop;
}

function buildNodePanel(
  data: GrafoData,
  nodeId: string,
  moneyFile?: GrafoMoneyFile | null
): NodePanelView | null {
  const node = nodeById(data, nodeId);
  if (!node) {
    return null;
  }

  const hops: PanelHop[] = [];
  for (const edge of data.edges) {
    if (edge.from === nodeId) {
      hops.push(hopFromEdge(data, edge, 'out'));
    }
    if (edge.to === nodeId) {
      hops.push(hopFromEdge(data, edge, 'in'));
    }
  }

  const view: NodePanelView = {
    mode: 'node',
    label: node.label,
    kind: node.kind,
    id: node.id,
    hops,
    participations: buildCitedParticipations(data, nodeId),
  };
  if (node.partners) {
    view.partners = node.partners;
  }
  if (node.kind === 'person') {
    const money = lookupPersonMoney(moneyFile, nodeId);
    if (money) {
      view.money = money;
    }
  }
  return view;
}

function buildEdgePanel(
  data: GrafoData,
  from: string,
  to: string
): EdgePanelView | null {
  const edge = data.edges.find((item) => item.from === from && item.to === to);
  if (!edge) {
    return null;
  }

  const view: EdgePanelView = {
    mode: 'edge',
    from_label: labelOf(data, from),
    to_label: labelOf(data, to),
    kind: edge.kind,
  };

  if (presentNumber(edge.pct_capital)) {
    view.pct_capital = edge.pct_capital;
  }
  if (presentNumber(edge.pct_votos)) {
    view.pct_votos = edge.pct_votos;
  }
  if (edge.source) {
    view.source = edge.source;
  }

  return view;
}

export const LISTED_COMPANY_IDS = [
  '00864214000106',
  '07689002000189',
  '33592510000154',
  '03220438000173',
  '34274233000102',
  '07415333000120',
  '01838723000127',
  '17155730000164',
  '01083200000118',
  '43776517000180',
  '06057223000171',
  '02916265000160',
  '33453598000123',
  '07043628000113',
  '33611500000119',
  '50746577000115',
  '06047087000139',
  '02558157000162',
  '61585865000151',
  '42150391000170',
  '47960950000121',
  '33042730000104',
  '33256439000139',
  '67620377000114',
  '16404287000155',
  '02429144000193',
  '00001180000126',
  '16670085000155',
  '33000167000101',
  '03853896000140',
  '24990777000109',
  '84429695000111',
  '07526557000100',
  '94813102000170',
  '28195667000106',
  '08827501000158',
  '71208516000174',
  '20247322000147',
  '61079117000105',
  '08364948000138',
  '00776574000156',
  '28594234000123',
  '37663076000107',
  '09305994000129',
  '09346601000125',
  '61186680000174',
  '24396489000120',
  '04902979000144',
  '00000000000191',
  '13009717000146',
  '28127603000178',
  '04913711000108',
  '92702067000196',
  '60746948000112',
  '12091809000155',
  '45242914000105',
  '61409892000173',
  '33938119000169',
  '19014221000147',
  '07040108000157',
  '64904295000103',
  '41096674000119',
  '00080671000100',
  '33352394000104',
  '83878892000155',
  '02800026000140',
  '71476527000135',
  '17281106000103',
  '76483817000120',
  '62984091000102',
  '08797760000183',
  '73178600000118',
  '62232889000190',
  '97837181000147',
  '92665611000177',
  '16614075000100',
  '03983431000103',
  '04149454000180',
  '07401436000131',
  '04423567000121',
  '02474103000119',
  '56643018000166',
  '61190096000192',
  '95426862000197',
  '06626253000151',
  '15141799000103',
  '89850341000160',
  '05878397000132',
  '08262121000113',
  '12648266000124',
  '02919555000167',
  '33041260065290',
  '61486650000183',
  '09053134000145',
  '60840055000131',
  '09229201000130',
  '03378521000175',
  '79430682000122',
  '13217485000111',
  '33958695000178',
  '08402943000152',
  '22266175000188',
  '02932074000191',
  '17314329000120',
  '08159965000133',
  '82901000000127',
  '03758318000124',
  '61156113000175',
  '02998611000104',
  '60872504000123',
  '61532644000115',
  '14998371000119',
  '02635522000195',
  '43283811000150',
  '89637490000145',
  '13270520000166',
  '00389481000179',
  '42278291000124',
  '96418264021802',
  '92754738000162',
  '07206816000115',
  '01417222000177',
  '08343492000120',
  '60476884000187',
  '88611835000129',
  '17184037000110',
  '07816890000153',
  '04992714000184',
  '04972092000122',
  '12104241000402',
  '14388334000199',
  '03342704000130',
  '62144175000120',
  '24230275000180',
  '02149205000169',
  '51430503000138',
  '83475913000191',
  '81243735000148',
  '10629105000168',
  '45453214000151',
  '62307848000115',
  '89086144000116',
  '16676520000159',
  '59981829000165',
  '02387241000160',
  '01616929000102',
  '76484013000145',
  '90400888000142',
  '02762121000104',
  '42500384000151',
  '04626426000106',
  '07594978000178',
  '41052420000107',
  '51466860000156',
  '02421421000111',
  '07859971000130',
  '17359233000188',
  '84684455000163',
  '53113791000122',
  '84683374000149',
  '75609123000123',
  '60665981000118',
  '60894730000105',
  '02041460000193',
  '87870952000144',
  '33839910000111',
  '12420164000157',
  '01637895000132',
  '50926955000142',
  '33228024000151',
  '59105999000186',
  '08807432000110',
  '13574594000196',
  '09288252000132',
] as const;

function isListedCompany(id: string): boolean {
  return (LISTED_COMPANY_IDS as readonly string[]).includes(id);
}

function productOfPercents(values: Array<number | null | undefined>): number | undefined {
  if (values.some((value) => !presentNumber(value))) {
    return undefined;
  }
  let acc = 1;
  for (const value of values as number[]) {
    acc = acc * (value / 100);
  }
  return acc * 100;
}

function citedHopFromEdge(data: GrafoData, edge: GrafoEdge): CitedHop {
  const hop: CitedHop = {
    from_id: edge.from,
    from_label: labelOf(data, edge.from),
    to_id: edge.to,
    to_label: labelOf(data, edge.to),
    kind: edge.kind,
  };
  if (presentNumber(edge.pct_capital)) {
    hop.pct_capital = edge.pct_capital;
  }
  if (presentNumber(edge.pct_votos)) {
    hop.pct_votos = edge.pct_votos;
  }
  if (edge.source) {
    hop.source = edge.source;
  }
  return hop;
}

function findPathsTo(
  data: GrafoData,
  fromId: string,
  targetId: string,
  visited: Set<string>
): GrafoEdge[][] {
  const results: GrafoEdge[][] = [];
  for (const edge of data.edges) {
    if (edge.from !== fromId) {
      continue;
    }
    if (visited.has(edge.to)) {
      continue;
    }
    if (edge.to === targetId) {
      results.push([edge]);
      continue;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(edge.to);
    for (const rest of findPathsTo(data, edge.to, targetId, nextVisited)) {
      results.push([edge, ...rest]);
    }
  }
  return results;
}

function pathView(data: GrafoData, edges: GrafoEdge[]): CitedPath {
  const hops = edges.map((edge) => citedHopFromEdge(data, edge));
  const path: CitedPath = { hops };
  const capital = productOfPercents(edges.map((edge) => edge.pct_capital));
  const votes = productOfPercents(edges.map((edge) => edge.pct_votos));
  if (capital !== undefined) {
    path.pct_capital = capital;
  }
  if (votes !== undefined) {
    path.pct_votos = votes;
  }
  return path;
}

function sumPresent(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  return present.reduce((acc, value) => acc + value, 0);
}

function buildCitedParticipations(data: GrafoData, startId: string): CitedParticipation[] {
  const listedIds = data.nodes
    .filter((node) => isListedCompany(node.id) && node.id !== startId)
    .map((node) => node.id);

  const participations: CitedParticipation[] = [];
  for (const companyId of listedIds) {
    const rawPaths = findPathsTo(data, startId, companyId, new Set([startId]));
    if (rawPaths.length === 0) {
      continue;
    }
    const paths = rawPaths.map((edges) => pathView(data, edges));
    const participation: CitedParticipation = {
      company_id: companyId,
      company_label: labelOf(data, companyId),
      paths,
    };
    const capital = sumPresent(paths.map((path) => path.pct_capital));
    const votes = sumPresent(paths.map((path) => path.pct_votos));
    if (capital !== undefined) {
      participation.pct_capital = capital;
    }
    if (votes !== undefined) {
      participation.pct_votos = votes;
    }
    participations.push(participation);
  }
  return participations;
}

export function buildPanelView(
  data: GrafoData,
  selection: PanelSelection,
  moneyFile?: GrafoMoneyFile | null
): PanelView {
  if (!selection) {
    return null;
  }
  if ('nodeId' in selection) {
    return buildNodePanel(data, selection.nodeId, moneyFile);
  }
  return buildEdgePanel(data, selection.from, selection.to);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function factLine(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return '<p><span class="grafo-panel-field">' + escapeHtml(name) + '</span> ' +
    escapeHtml(String(value)) + '</p>';
}

function renderHop(hop: PanelHop): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(hop.other_label) + '</strong>' +
      factLine('kind', hop.kind) +
      factLine('pct_capital', hop.pct_capital) +
      factLine('pct_votos', hop.pct_votos) +
      factLine('source', hop.source) +
    '</li>'
  );
}

function renderHopGroup(title: string, hops: PanelHop[]): string {
  if (hops.length === 0) {
    return '';
  }
  return (
    '<section>' +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<ul>' + hops.map(renderHop).join('') + '</ul>' +
    '</section>'
  );
}

function renderCitedHop(hop: CitedHop): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(hop.from_label) + ' - ' + escapeHtml(hop.to_label) + '</strong>' +
      factLine('kind', hop.kind) +
      factLine('pct_capital', hop.pct_capital) +
      factLine('pct_votos', hop.pct_votos) +
      factLine('source', hop.source) +
    '</li>'
  );
}

function renderCitedPath(path: CitedPath): string {
  return (
    '<li>' +
      factLine('pct_capital', path.pct_capital) +
      factLine('pct_votos', path.pct_votos) +
      '<ul>' + path.hops.map(renderCitedHop).join('') + '</ul>' +
    '</li>'
  );
}

function renderParticipation(item: CitedParticipation): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(item.company_label) + '</strong>' +
      factLine('pct_capital', item.pct_capital) +
      factLine('pct_votos', item.pct_votos) +
      '<ul>' + item.paths.map(renderCitedPath).join('') + '</ul>' +
    '</li>'
  );
}

function renderParticipations(items: CitedParticipation[]): string {
  if (items.length === 0) {
    return '';
  }
  return (
    '<section>' +
      '<h3>participacao citada</h3>' +
      '<ul>' + items.map(renderParticipation).join('') + '</ul>' +
    '</section>'
  );
}

function renderPartner(partner: GrafoPartner): string {
  return (
    '<li>' +
      '<strong>' + escapeHtml(partner.nome) + '</strong>' +
      factLine('qualificacao_label', partner.qualificacao_label) +
    '</li>'
  );
}

function renderPartners(partners: GrafoPartner[] | undefined): string {
  if (!partners) {
    return '';
  }
  return (
    '<section>' +
      '<h3>sócios</h3>' +
      '<ul>' + partners.map(renderPartner).join('') + '</ul>' +
    '</section>'
  );
}

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

function formatReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoneyDate(iso: string): string {
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

function renderMoney(kind: string, money: PersonMoney | undefined): string {
  if (kind !== 'person' || !money) {
    return '';
  }
  const sources = money.sources.join('; ');
  return (
    '<section>' +
      factLine('Dinheiro econômico (fatia de capital)', formatReais(money.money_economic)) +
      factLine('Dinheiro sob controle (fatia de votos)', formatReais(money.money_control)) +
      factLine('date', formatMoneyDate(money.date)) +
      factLine('sources', sources) +
      '<p>Não é uma fortuna.</p>' +
    '</section>'
  );
}

export function renderPanelHtml(view: PanelView): string {
  if (!view) {
    return '';
  }

  if (view.mode === 'node') {
    const outgoing = view.hops.filter((hop) => hop.direction === 'out');
    const incoming = view.hops.filter((hop) => hop.direction === 'in');
    return (
      '<div class="grafo-panel-body">' +
        '<h2>' + escapeHtml(view.label) + '</h2>' +
        factLine('kind', view.kind) +
        factLine('id', view.id) +
        renderMoney(view.kind, view.money) +
        renderPartners(view.partners) +
        renderHopGroup('saida', outgoing) +
        renderHopGroup('entrada', incoming) +
        renderParticipations(view.participations) +
      '</div>'
    );
  }

  return (
    '<div class="grafo-panel-body">' +
      '<h2>' + escapeHtml(view.from_label) + ' - ' + escapeHtml(view.to_label) + '</h2>' +
      factLine('kind', view.kind) +
      factLine('pct_capital', view.pct_capital) +
      factLine('pct_votos', view.pct_votos) +
      factLine('source', view.source) +
    '</div>'
  );
}
