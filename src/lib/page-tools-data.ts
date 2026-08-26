/**
 * Build the in-page tools archive from committed mint + freeze + methods.
 * Node/build only. The client never remints.
 */

import type { GrafoData } from './grafo-elements';
import { lookupPersonMoney, type GrafoMoneyFile } from './grafo-money';
import {
  loadPublicGrafo,
  loadPublicMoney,
  mintCitedPessoas,
  type CitedPessoa,
} from './mint-pessoa';
import { getFreeze, getMethodologyFacts } from '../utils/fixtures';
import type { Fact, Person } from '../types';
import {
  formatArchiveDatePt,
  formatArchiveReais,
  pessoaFichaUrl,
  type ArchiveFicha,
  type ArchiveGraphPerson,
  type ArchiveMethodologyFact,
  type PageToolsArchive,
} from './archive-tools';

export type FreezePersonInput = Pick<Person, 'person_id' | 'person_name' | 'group_name' | 'role'>;

const FORTUNA_NOTE = 'Não é uma fortuna.';

function mintedToFicha(pessoa: CitedPessoa, moneyFile: GrafoMoneyFile | null | undefined): ArchiveFicha {
  const money = lookupPersonMoney(moneyFile, pessoa.id);
  const dateIso = money?.date || pessoa.date;
  const ficha: ArchiveFicha = {
    id: pessoa.id,
    name: pessoa.name,
    role: pessoa.role,
    company_label: pessoa.company_label,
    source: pessoa.source,
    date: dateIso ? formatArchiveDatePt(dateIso) : null,
    url: pessoaFichaUrl(pessoa.id),
  };
  if (money) {
    ficha.money_economic = formatArchiveReais(money.money_economic);
    ficha.money_control = formatArchiveReais(money.money_control);
    ficha.note = FORTUNA_NOTE;
    ficha.date = formatArchiveDatePt(money.date);
  }
  return ficha;
}

function freezeToFicha(person: FreezePersonInput): ArchiveFicha {
  return {
    id: person.person_id,
    name: person.person_name,
    role: person.role,
    company_label: person.group_name,
    source: '',
    date: null,
    url: pessoaFichaUrl(person.person_id),
  };
}

function methodologyFacts(facts: Fact[]): ArchiveMethodologyFact[] {
  const out: ArchiveMethodologyFact[] = [];
  for (const fact of facts) {
    if (!fact.source || typeof fact.value !== 'string' || fact.value === '') {
      continue;
    }
    out.push({
      value: fact.value,
      source: {
        publisher: fact.source.publisher,
        locator: fact.source.locator,
        retrieved_at: fact.source.retrieved_at,
      },
    });
  }
  return out;
}

export function buildPageToolsArchive(input: {
  grafo: GrafoData;
  money: GrafoMoneyFile | null | undefined;
  freeze: FreezePersonInput[];
  methodology: Fact[];
}): PageToolsArchive {
  const minted = mintCitedPessoas(input.grafo);
  const fichas: ArchiveFicha[] = minted.map((pessoa) => mintedToFicha(pessoa, input.money));
  const mintedIds = new Set(minted.map((pessoa) => pessoa.id));
  const freezeIds = new Set<string>();

  for (const person of input.freeze) {
    if (!person.person_id || mintedIds.has(person.person_id) || freezeIds.has(person.person_id)) {
      continue;
    }
    freezeIds.add(person.person_id);
    fichas.push(freezeToFicha(person));
  }

  const graph_people: ArchiveGraphPerson[] = [];
  for (const node of input.grafo.nodes) {
    if (node.kind !== 'person') {
      continue;
    }
    if (mintedIds.has(node.id) || freezeIds.has(node.id)) {
      continue;
    }
    graph_people.push({ id: node.id, name: node.label });
  }

  return {
    fichas,
    graph_people,
    methodology: methodologyFacts(input.methodology),
  };
}

export function loadPageToolsArchive(): PageToolsArchive {
  const freeze = getFreeze().map((person) => ({
    person_id: person.person_id,
    person_name: person.person_name,
    group_name: person.group_name,
    role: person.role,
  }));
  return buildPageToolsArchive({
    grafo: loadPublicGrafo(),
    money: loadPublicMoney(),
    freeze,
    methodology: getMethodologyFacts(),
  });
}

export function pageToolsArchiveJson(): string {
  return JSON.stringify(loadPageToolsArchive());
}
