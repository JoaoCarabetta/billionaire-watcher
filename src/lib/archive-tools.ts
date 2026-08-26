/**
 * Read-only page-tool functions (issue #157).
 *
 * Pure seam: search_archive, get_person, get_methodology.
 * The registrar calls these. It does not mint; minted fichas arrive
 * already decided by src/lib/mint-pessoa.ts.
 */

export const PAGE_TOOLS_ARCHIVE_ELEMENT_ID = 'page-tools-archive';

export const PAGE_TOOL_NAMES = ['search_archive', 'get_person', 'get_methodology'] as const;

export type PageToolName = (typeof PAGE_TOOL_NAMES)[number];

export type ArchiveSearchStatus = 'ficha' | 'grafo_only' | 'not_in_archive';

export type ArchiveFicha = {
  id: string;
  name: string;
  role: string;
  company_label: string;
  source: string;
  date: string | null;
  url: string;
  money_economic?: string;
  money_control?: string;
  note?: string;
};

export type ArchiveGraphPerson = {
  id: string;
  name: string;
};

export type ArchiveMethodologyFact = {
  value: string;
  source: {
    publisher: string;
    locator: string;
    retrieved_at: string;
  };
};

export type PageToolsArchive = {
  fichas: ArchiveFicha[];
  graph_people: ArchiveGraphPerson[];
  methodology: ArchiveMethodologyFact[];
};

export type SearchArchiveResult = {
  status: ArchiveSearchStatus;
  id?: string;
  name?: string;
  url?: string;
};

export type GetPersonResult =
  | ({ status: 'ficha' } & ArchiveFicha)
  | { status: 'grafo_only' }
  | { status: 'not_in_archive' };

export type GetMethodologyResult = {
  url: string;
  facts: ArchiveMethodologyFact[];
};

export type PageToolExecuteInput = {
  query?: unknown;
  id?: unknown;
};

export type PageToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: true };
  execute: (input: PageToolExecuteInput) => unknown;
};

export type PageToolsModelContext = {
  registerTool: (tool: PageToolRegistration) => unknown;
};

export type PageToolsHost = {
  modelContext?: PageToolsModelContext;
  getElementById?: (id: string) => { textContent?: string | null } | null;
};

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

const TOOL_NAME_RE = /^[a-z0-9_.-]{1,128}$/;

export function emptyPageToolsArchive(): PageToolsArchive {
  return { fichas: [], graph_people: [], methodology: [] };
}

export function foldSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function formatArchiveReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatArchiveDatePt(iso: string): string {
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

export function pessoaFichaUrl(id: string): string {
  return '/pessoa/' + id + '/';
}

function nameOrIdMatches(name: string, id: string, needle: string): boolean {
  return foldSearchText(name).includes(needle) || foldSearchText(id).includes(needle);
}

export function searchArchive(archive: PageToolsArchive, query: string): SearchArchiveResult {
  const needle = foldSearchText(query.trim());
  if (!needle) {
    return { status: 'not_in_archive' };
  }

  const fichaHits = archive.fichas.filter((ficha) => nameOrIdMatches(ficha.name, ficha.id, needle));
  fichaHits.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const ficha = fichaHits[0];
  if (ficha) {
    return {
      status: 'ficha',
      id: ficha.id,
      name: ficha.name,
      url: ficha.url,
    };
  }

  const graphHits = archive.graph_people.filter((person) =>
    nameOrIdMatches(person.name, person.id, needle)
  );
  graphHits.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const graphPerson = graphHits[0];
  if (graphPerson) {
    return {
      status: 'grafo_only',
      id: graphPerson.id,
      name: graphPerson.name,
    };
  }

  return { status: 'not_in_archive' };
}

export function getPerson(archive: PageToolsArchive, id: string): GetPersonResult {
  if (typeof id !== 'string' || id.trim() === '') {
    return { status: 'not_in_archive' };
  }
  const wanted = id.trim();
  const ficha = archive.fichas.find((row) => row.id === wanted);
  if (ficha) {
    return { status: 'ficha', ...ficha };
  }
  if (archive.graph_people.some((person) => person.id === wanted)) {
    return { status: 'grafo_only' };
  }
  return { status: 'not_in_archive' };
}

export function getMethodology(archive: PageToolsArchive): GetMethodologyResult {
  return {
    url: '/metodologia/',
    facts: archive.methodology,
  };
}

export function parsePageToolsArchiveJson(raw: string | null | undefined): PageToolsArchive {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return emptyPageToolsArchive();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PageToolsArchive>;
    return {
      fichas: Array.isArray(parsed.fichas) ? parsed.fichas : [],
      graph_people: Array.isArray(parsed.graph_people) ? parsed.graph_people : [],
      methodology: Array.isArray(parsed.methodology) ? parsed.methodology : [],
    };
  } catch {
    return emptyPageToolsArchive();
  }
}

export function readArchiveFromDocument(doc: PageToolsHost): PageToolsArchive {
  const el = doc.getElementById?.(PAGE_TOOLS_ARCHIVE_ELEMENT_ID);
  return parsePageToolsArchiveJson(el?.textContent);
}

export function pageToolDefinitions(archive: PageToolsArchive): PageToolRegistration[] {
  return [
    {
      name: 'search_archive',
      title: 'Buscar no arquivo',
      description:
        'Busca um nome no arquivo. Devolve ficha com URL, presença só no grafo, ou fora do arquivo.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      annotations: { readOnlyHint: true },
      execute: (input) => searchArchive(archive, typeof input?.query === 'string' ? input.query : ''),
    },
    {
      name: 'get_person',
      title: 'Ler ficha de pessoa',
      description:
        'Devolve os campos da ficha da pessoa citada, ou o vazio honesto (só no grafo / fora do arquivo).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      annotations: { readOnlyHint: true },
      execute: (input) => getPerson(archive, typeof input?.id === 'string' ? input.id : ''),
    },
    {
      name: 'get_methodology',
      title: 'Ler metodologia',
      description: 'Devolve os fatos públicos já publicados em /metodologia/.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      annotations: { readOnlyHint: true },
      execute: () => getMethodology(archive),
    },
  ];
}

export function assertPageToolNames(tools: readonly PageToolRegistration[]): void {
  for (const tool of tools) {
    if (!TOOL_NAME_RE.test(tool.name)) {
      throw new Error('invalid page tool name: ' + tool.name);
    }
  }
}

/**
 * Feature-detect document.modelContext. If missing, do nothing.
 * No banner. No console noise.
 */
export function bootPageTools(doc: PageToolsHost): void {
  const ctx = doc.modelContext;
  if (ctx == null) {
    return;
  }
  const archive = readArchiveFromDocument(doc);
  const tools = pageToolDefinitions(archive);
  assertPageToolNames(tools);
  for (const tool of tools) {
    try {
      const pending = ctx.registerTool(tool);
      if (pending && typeof (pending as Promise<unknown>).then === 'function') {
        void (pending as Promise<unknown>).catch(() => {});
      }
    } catch {
      // Missing interface or duplicate name: stay silent.
    }
  }
}

export function pageToolsMarkup(_archiveJson: string, scriptSrc: string): string {
  return '<script src="' + scriptSrc + '"></script>';
}
