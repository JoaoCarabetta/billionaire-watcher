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
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return {
        fichas: Array.isArray(raw.fichas) ? raw.fichas : [],
        graph_people: Array.isArray(raw.graph_people) ? raw.graph_people : [],
        methodology: Array.isArray(raw.methodology) ? raw.methodology : []
      };
    }
    if (typeof raw !== 'string' || raw.trim() === '') {
      return emptyArchive();
    }
    try {
      return parseArchive(JSON.parse(raw));
    } catch (err) {
      return emptyArchive();
    }
  }

  function loadArchive() {
    var el = document.getElementById('page-tools-archive');
    if (el && el.textContent) {
      return Promise.resolve(parseArchive(el.textContent));
    }
    return fetch('/page-tools-archive.json')
      .then(function (response) {
        if (!response.ok) {
          return emptyArchive();
        }
        return response.json().then(parseArchive);
      })
      .catch(function () {
        return emptyArchive();
      });
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
        var out = {
          status: 'ficha',
          id: ficha.id,
          name: ficha.name,
          role: ficha.role,
          company_label: ficha.company_label,
          source: ficha.source,
          date: ficha.date,
          url: ficha.url
        };
        if (ficha.money_economic) {
          out.money_economic = ficha.money_economic;
        }
        if (ficha.money_control) {
          out.money_control = ficha.money_control;
        }
        if (ficha.note) {
          out.note = ficha.note;
        }
        return out;
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

  var archivePromise = loadArchive();
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
      return archivePromise.then(function (archive) {
        return searchArchive(archive, input && typeof input.query === 'string' ? input.query : '');
      });
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
      return archivePromise.then(function (archive) {
        return getPerson(archive, input && typeof input.id === 'string' ? input.id : '');
      });
    }
  });

  register({
    name: 'get_methodology',
    title: 'Ler metodologia',
    description: 'Devolve os fatos públicos já publicados em /metodologia/.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: function () {
      return archivePromise.then(getMethodology);
    }
  });
})();
