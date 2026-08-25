import { describe, it, expect } from 'vitest';
import { 
  loadPublishedFacts,
  getPublishedFactsByPersonId,
  getPublishedFactsFreeze
} from '../src/utils/published-facts-loader';

describe('Published Facts Loader', () => {
  describe('loadPublishedFacts()', () => {
    it('should load published facts from fixture', () => {
      const facts = loadPublishedFacts();
      
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0]).toHaveProperty('fact_id');
      expect(facts[0]).toHaveProperty('person_id');
      expect(facts[0]).toHaveProperty('fact_kind');
      expect(facts[0]).toHaveProperty('value');
      expect(facts[0]).toHaveProperty('source_publisher');
      expect(facts[0]).toHaveProperty('source_locator');
      expect(facts[0]).toHaveProperty('source_retrieved_at');
    });

    it('should only return facts with source_locator', () => {
      const facts = loadPublishedFacts();
      
      for (const fact of facts) {
        expect(fact.source_locator).toBeTruthy();
      }
    });
  });

  describe('getPublishedFactsByPersonId()', () => {
    it('should return facts for person p1', () => {
      const facts = getPublishedFactsByPersonId('p1');
      
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.every(f => f.person_id === 'p1')).toBe(true);
    });

    it('should include identity facts', () => {
      const facts = getPublishedFactsByPersonId('p1');
      const nameFact = facts.find(f => f.fact_kind === 'nome');
      
      expect(nameFact).toBeDefined();
      expect(nameFact?.value).toBe('João Silva');
    });

    it('should include control edge facts', () => {
      const facts = getPublishedFactsByPersonId('p1');
      const rfFact = facts.find(f => f.fact_kind === 'rf_socio');
      
      expect(rfFact).toBeDefined();
      expect(rfFact?.group_name).toBe('Empresa XYZ Ltda.');
    });
  });

  describe('getPublishedFactsFreeze()', () => {
    it('should return unique persons from published facts', () => {
      const freeze = getPublishedFactsFreeze();
      
      expect(freeze.length).toBeGreaterThan(0);
      expect(freeze[0]).toHaveProperty('person_id');
      expect(freeze[0]).toHaveProperty('person_name');
    });

    it('should include p1, p2, p3 from published facts', () => {
      const freeze = getPublishedFactsFreeze();
      const personIds = freeze.map(p => p.person_id);
      
      expect(personIds).toContain('p1');
      expect(personIds).toContain('p2');
      expect(personIds).toContain('p3');
    });

    it('should use name fact value as person_name', () => {
      const freeze = getPublishedFactsFreeze();
      const p1 = freeze.find(p => p.person_id === 'p1');
      
      expect(p1?.person_name).toBe('João Silva');
    });

    it('should include p4 even if not in freeze CSV', () => {
      const freeze = getPublishedFactsFreeze();
      const personIds = freeze.map(p => p.person_id);
      
      expect(personIds).toContain('p4');
    });
  });

  describe('CPF masking', () => {
    it('should only render masked CPF format ***NNN***', () => {
      const facts = getPublishedFactsByPersonId('p1');
      const cpfFact = facts.find(f => f.cpf_masked);
      
      expect(cpfFact?.cpf_masked).toMatch(/^\*\*\*\d{3}\*\*\*$/);
    });

    it('should not contain 11-digit CPF in any fact value', () => {
      const facts = loadPublishedFacts();
      
      for (const fact of facts) {
        expect(fact.value).not.toMatch(/\d{11}/);
        expect(fact.value).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });
  });
});
