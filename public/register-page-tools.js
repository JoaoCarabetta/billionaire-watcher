/**
 * In-page read-only tools (issue #157).
 * No-ops when document.modelContext is missing. No banner. No console noise.
 * Logic matches src/lib/archive-tools.ts (searchArchive / getPerson / getMethodology).
 */
(function () {
  if (!document.modelContext) {
    return;
  }

  function emptyArchive() {
    return { fichas: [], graph_people: [], methodology: [] };
  }

  function parseArchive(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return emptyArchive();
    }
    try {
      var parsed = JSON.parse(raw);
      return {
        fichas: Array.isArray(parsed.fichas) ? parsed.fichas : [],
        graph_people: Array.isArray(parsed.graph_people) ? parsed.graph_people : [],
        methodology: Array.isArray(parsed.methodology) ? parsed.methodology : []
      };
    } catch (err) {
      return emptyArchive();
    }
  }

  function fold(value) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  function matches(name, id, needle) {
    return fold(name).indexOf(needle) !== -1 || fold(id).indexOf(needle) !== -1;
  }

  function searchArchive(archive, query) {
    var needle = fold(String(query || '').trim());
    if (!needle) {
      return { status: 'not_in_archive' };
    }
    var fichaHits = archive.fichas.filter(function (ficha) {
      return matches(ficha.name, ficha.id, needle);
    });
    fichaHits.sort(function (a, b) {
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    if (fichaHits[0]) {
      return {
        status: 'ficha',
        id: fichaHits[0].id,
        name: fichaHits[0].name,
        url: fichaHits[0].url
      };
    }
    var graphHits = archive.graph_people.filter(function (person) {
      return matches(person.name, person.id, needle);
    });
    graphHits.sort(function (a, b) {
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    if (graphHits[0]) {
      return {
        status: 'grafo_only',
        id: graphHits[0].id,
        name: graphHits[0].name
      };
    }
    return { status: 'not_in_archive' };
  }

  function getPerson(archive, id) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { status: 'not_in_archive' };
    }
    var wanted = id.trim();
    var i;
    for (i = 0; i < archive.fichas.length; i += 1) {
      if (archive.fichas[i].id === wanted) {
        var ficha = archive.fichas[i];
        return {
          status: 'ficha',
          id: ficha.id,
          name: ficha.name,
          role: ficha.role,
          company_label: ficha.company_label,
          source: ficha.source,
          date: ficha.date,
          url: ficha.url,
          money_economic: ficha.money_economic,
          money_control: ficha.money_control,
          note: ficha.note
        };
      }
    }
    for (i = 0; i < archive.graph_people.length; i += 1) {
      if (archive.graph_people[i].id === wanted) {
        return { status: 'grafo_only' };
      }
    }
    return { status: 'not_in_archive' };
  }

  function getMethodology(archive) {
    return { url: '/metodologia/', facts: archive.methodology };
  }

  var el = document.getElementById('page-tools-archive');
  var archive = parseArchive(el && el.textContent);
  var ctx = document.modelContext;

  function ignore() {}

  function register(tool) {
    try {
      var pending = ctx.registerTool(tool);
      if (pending && typeof pending.then === 'function') {
        pending.then(ignore, ignore);
      }
    } catch (err) {}
  }

  register({
    name: 'search_archive',
    title: 'Buscar no arquivo',
    description:
      'Busca um nome no arquivo. Devolve ficha com URL, presença só no grafo, ou fora do arquivo.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    },
    annotations: { readOnlyHint: true },
    execute: function (input) {
      return searchArchive(archive, input && typeof input.query === 'string' ? input.query : '');
    }
  });

  register({
    name: 'get_person',
    title: 'Ler ficha de pessoa',
    description:
      'Devolve os campos da ficha da pessoa citada, ou o vazio honesto (só no grafo / fora do arquivo).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    },
    annotations: { readOnlyHint: true },
    execute: function (input) {
      return getPerson(archive, input && typeof input.id === 'string' ? input.id : '');
    }
  });

  register({
    name: 'get_methodology',
    title: 'Ler metodologia',
    description: 'Devolve os fatos públicos já publicados em /metodologia/.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: function () {
      return getMethodology(archive);
    }
  });
})();
