import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  loadPublishedFacts,
  getPublishedFactsByPersonId,
  getPublishedFactsFreeze
} from '../src/utils/published-facts-loader';

describe('Published Facts Loader', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeAll(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Set USE_PUBLISHED_FACTS for these tests
    process.env.USE_PUBLISHED_FACTS = 'true';
  });
  
  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });
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
    it('should return facts for person João Silva', () => {
      const facts = getPublishedFactsByPersonId('João Silva');
      
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.every(f => f.person_id === 'João Silva')).toBe(true);
    });

    it('should include identity facts', () => {
      const facts = getPublishedFactsByPersonId('João Silva');
      const identityFacts = facts.filter(f => f.fact_kind === 'identity');
      
      expect(identityFacts.length).toBeGreaterThan(0);
      const nameFact = identityFacts.find(f => f.value === 'João Silva');
      expect(nameFact).toBeDefined();
    });

    it('should include control edge facts', () => {
      const facts = getPublishedFactsByPersonId('João Silva');
      const controlFacts = facts.filter(f => f.fact_kind === 'control_edge');
      
      expect(controlFacts.length).toBeGreaterThan(0);
      expect(controlFacts[0].value).toContain('é sócio de');
      expect(controlFacts[0].group_name).toBe('Empresa XYZ Ltda.');
    });

    it('should include donation facts', () => {
      const facts = getPublishedFactsByPersonId('João Silva');
      const donationFacts = facts.filter(f => f.fact_kind === 'donation');
      
      expect(donationFacts.length).toBeGreaterThan(0);
      expect(donationFacts[0].value).toContain('doou');
    });
  });

  describe('getPublishedFactsFreeze()', () => {
    it('should return unique persons from published facts', () => {
      const freeze = getPublishedFactsFreeze();
      
      expect(freeze.length).toBeGreaterThan(0);
      expect(freeze[0]).toHaveProperty('person_id');
      expect(freeze[0]).toHaveProperty('person_name');
    });

    it('should include João Silva, Maria Santos, Ana Lima from published facts', () => {
      const freeze = getPublishedFactsFreeze();
      const personIds = freeze.map(p => p.person_id);
      
      expect(personIds).toContain('João Silva');
      expect(personIds).toContain('Maria Santos');
      expect(personIds).toContain('Ana Lima');
    });

    it('should use person_id as person_name', () => {
      const freeze = getPublishedFactsFreeze();
      const joao = freeze.find(p => p.person_id === 'João Silva');
      
      expect(joao?.person_name).toBe('João Silva');
    });

    it('should only include persons with facts', () => {
      const freeze = getPublishedFactsFreeze();
      
      expect(freeze.length).toBe(3); // Only João Silva, Maria Santos, Ana Lima
    });
  });

  describe('CPF masking', () => {
    it('should only render masked CPF format ***NNN***', () => {
      const facts = getPublishedFactsByPersonId('João Silva');
      const cpfFacts = facts.filter(f => f.cpf_masked);
      
      expect(cpfFacts.length).toBeGreaterThan(0);
      for (const fact of cpfFacts) {
        expect(fact.cpf_masked).toMatch(/^\*\*\*\d{3}\*\*\*$/);
      }
    });

    it('should not contain 11-digit CPF in any fact value', () => {
      const facts = loadPublishedFacts();
      
      for (const fact of facts) {
        expect(fact.value).not.toMatch(/\d{11}/);
        expect(fact.value).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      }
    });

    it('should not contain 11 consecutive digits in cpf_masked', () => {
      const facts = loadPublishedFacts();
      
      for (const fact of facts) {
        if (fact.cpf_masked) {
          expect(fact.cpf_masked).not.toMatch(/\d{11}/);
        }
      }
    });
  });
});
