import type { Fact, DerivedAssociation, Person, IdentityFact, RFPartnerEdge, CVMFREControl } from '../types';
import factsData from '../../test/fixtures/facts.json';
import associationsData from '../../test/fixtures/derived-associations.json';
import identityFactsData from '../../test/fixtures/identity-facts.json';
import rfPartnerEdgesData from '../../test/fixtures/rf-partner-edges.json';
import cvmFreControlData from '../../test/fixtures/cvm-fre-control.json';
import fs from 'fs';
import path from 'path';

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

export function getFreeze(): Person[] {
  try {
    const freezePath = path.join(process.cwd(), 'test', 'fixtures', 'freeze.csv');
    const freezeContent = fs.readFileSync(freezePath, 'utf-8');
    const lines = freezeContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const person: Person = {
        person_id: values[0],
        person_name: values[1],
        group_name: values[2],
        role: values[3],
      };
      if (values[4]) {
        person.cpf = values[4];
      }
      return person;
    });
  } catch (error) {
    console.error('Error loading freeze CSV:', error);
    return [];
  }
}

export function getIdentityFacts(): IdentityFact[] {
  return identityFactsData.filter(fact => fact.source !== undefined) as IdentityFact[];
}

export function getIdentityFactsByPersonId(personId: string): IdentityFact[] {
  return getIdentityFacts().filter(fact => fact.person_id === personId);
}

export function getRFPartnerEdges(): RFPartnerEdge[] {
  return rfPartnerEdgesData.filter(edge => edge.source !== undefined) as RFPartnerEdge[];
}

export function getRFPartnerEdgesByPersonId(personId: string): RFPartnerEdge[] {
  return getRFPartnerEdges().filter(edge => edge.person_id === personId);
}

export function getCVMFREControls(): CVMFREControl[] {
  return cvmFreControlData.filter(control => control.source !== undefined) as CVMFREControl[];
}

export function getCVMFREControlsByPersonId(personId: string): CVMFREControl[] {
  return getCVMFREControls().filter(control => control.person_id === personId);
}
