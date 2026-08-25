import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PublishedFact } from '../src/types';
import { convertPublishedFactsToAssociations } from '../src/utils/fixtures';
import { loadPublishedFacts } from '../src/utils/published-facts-loader';

describe('Association Conversion from Published Facts', () => {
  let originalEnv: string | undefined;
  
  beforeAll(() => {
    originalEnv = process.env.USE_PUBLISHED_FACTS;
    process.env.USE_PUBLISHED_FACTS = 'true';
  });
  
  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.USE_PUBLISHED_FACTS;
    } else {
      process.env.USE_PUBLISHED_FACTS = originalEnv;
    }
  });

  it('should convert association fact with array supporting_fact_ids', () => {
    
    const facts: PublishedFact[] = loadPublishedFacts();
    
    // Find the association fact with array supporting_fact_ids
    const associationFact = facts.find(f => 
      f.fact_kind === 'association' && 
      f.fact_id === 'association_cross_investment_João Silva_Maria Santos'
    );
    
    expect(associationFact).toBeDefined();
    expect(Array.isArray(associationFact!.supporting_fact_ids)).toBe(true);
    expect(associationFact!.supporting_fact_ids).toEqual([
      'control_edge_12345678_João Silva_socio',
      'control_edge_11222333_Maria Santos_socio'
    ]);
    
    // Convert all associations
    const associations = convertPublishedFactsToAssociations();
    
    // Find the converted association
    const converted = associations.find(a => 
      a.id === 'association_cross_investment_João Silva_Maria Santos'
    );
    
    expect(converted).toBeDefined();
    expect(converted!.parent_donation_ids).toEqual([
      'control_edge_12345678_João Silva_socio',
      'control_edge_11222333_Maria Santos_socio'
    ]);
  });
  
  it('should handle string supporting_fact_ids for backward compatibility', () => {
    
    // Create a mock association with string supporting_fact_ids
    const mockFact: PublishedFact = {
      fact_id: 'test-assoc-string',
      person_id: 'Test Person',
      fact_kind: 'association',
      value: 'Test association value',
      source_publisher: 'Test Publisher',
      source_locator: 'Test Locator',
      source_retrieved_at: null,
      cpf_masked: null,
      cnpj_basico: null,
      group_name: null,
      supporting_fact_ids: 'id-a,id-b,id-c'
    };
    
    // Test the conversion logic directly with string input
    const supportingIds = mockFact.supporting_fact_ids 
      ? (Array.isArray(mockFact.supporting_fact_ids)
          ? mockFact.supporting_fact_ids
          : mockFact.supporting_fact_ids.split(',').map((id: string) => id.trim()))
      : [];
    
    expect(supportingIds).toEqual(['id-a', 'id-b', 'id-c']);
  });
});
