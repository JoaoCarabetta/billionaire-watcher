import type { Fact, DerivedAssociation } from '../types';
import factsData from '../../test/fixtures/facts.json';
import associationsData from '../../test/fixtures/derived-associations.json';

export function getFacts(): Fact[] {
  return factsData.filter(fact => fact.source !== undefined);
}

export function getFactById(id: string): Fact | undefined {
  return factsData.find(fact => fact.id === id && fact.source !== undefined);
}

export function getDerivedAssociations(): DerivedAssociation[] {
  return associationsData.filter(assoc => 
    assoc.parent_facts.length > 0 &&
    assoc.parent_facts.every(factId => getFactById(factId) !== undefined)
  );
}

export function redactCPF(text: string): string {
  return text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF REDACTED]')
             .replace(/\d{11}/g, '[CPF REDACTED]');
}
