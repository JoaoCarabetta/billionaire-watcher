import type { Person } from '../types';
import fs from 'fs';
import path from 'path';

export interface PublishedFact {
  fact_id: string;
  person_id: string;
  fact_kind: string;
  value: string;
  source_publisher: string;
  source_locator: string;
  source_retrieved_at: string;
  cpf_masked: string | null;
  cnpj_basico: string | null;
  group_name: string | null;
  supporting_fact_ids: string[] | null;
}

export interface PublishedFactsSource {
  publisher: string;
  locator: string;
  retrieved_at: string;
}

let cachedFacts: PublishedFact[] | null = null;

/**
 * Load published facts from PUBLISHED_FACTS_DIR or git fixture.
 * Only returns facts with source_locator (never unsourced).
 */
export function loadPublishedFacts(): PublishedFact[] {
  if (cachedFacts !== null) {
    return cachedFacts;
  }

  const publishedFactsDir = process.env.PUBLISHED_FACTS_DIR;
  
  let facts: PublishedFact[];
  
  if (publishedFactsDir && fs.existsSync(publishedFactsDir)) {
    // Load from production directory
    facts = loadFromDirectory(publishedFactsDir);
  } else {
    // Fallback to git fixture
    const fixturePath = path.join(process.cwd(), 'test', 'fixtures', 'published-facts.json');
    const fixtureData = fs.readFileSync(fixturePath, 'utf-8');
    facts = JSON.parse(fixtureData);
  }
  
  // Filter to only facts with source_locator
  cachedFacts = facts.filter(fact => fact.source_locator);
  return cachedFacts;
}

/**
 * Load published facts from a directory containing JSON/JSONL files.
 */
function loadFromDirectory(dirPath: string): PublishedFact[] {
  const facts: PublishedFact[] = [];
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(dirPath, file);
      const fileData = fs.readFileSync(filePath, 'utf-8');
      
      // Try parsing as JSON array first
      try {
        const parsed = JSON.parse(fileData);
        if (Array.isArray(parsed)) {
          facts.push(...parsed);
        } else {
          facts.push(parsed);
        }
      } catch {
        // Try parsing as JSONL
        const lines = fileData.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            facts.push(JSON.parse(line));
          }
        }
      }
    } else if (file.endsWith('.jsonl')) {
      const filePath = path.join(dirPath, file);
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const lines = fileData.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          facts.push(JSON.parse(line));
        }
      }
    }
  }
  
  return facts;
}

/**
 * Get all published facts for a person.
 */
export function getPublishedFactsByPersonId(personId: string): PublishedFact[] {
  const facts = loadPublishedFacts();
  return facts.filter(fact => fact.person_id === personId);
}

/**
 * Convert published fact to Source format.
 */
export function publishedFactToSource(fact: PublishedFact): PublishedFactsSource {
  return {
    publisher: fact.source_publisher,
    locator: fact.source_locator,
    retrieved_at: fact.source_retrieved_at
  };
}

/**
 * Get freeze list from published facts.
 * Returns unique persons, using person_id as person_name (they're the same in real data).
 */
export function getPublishedFactsFreeze(): Person[] {
  const facts = loadPublishedFacts();
  const personMap = new Map<string, Person>();
  
  for (const fact of facts) {
    if (!personMap.has(fact.person_id)) {
      personMap.set(fact.person_id, {
        person_id: fact.person_id,
        person_name: fact.person_id, // person_id IS the person name in real data
        group_name: '',
        role: ''
      });
    }
  }
  
  return Array.from(personMap.values());
}

/**
 * Check if we should use published facts loader.
 * Returns true if PUBLISHED_FACTS_DIR is set.
 * Production builds MUST set PUBLISHED_FACTS_DIR or fail.
 * Tests opt-in by setting USE_PUBLISHED_FACTS env var.
 */
export function shouldUsePublishedFacts(): boolean {
  return !!(process.env.PUBLISHED_FACTS_DIR || process.env.USE_PUBLISHED_FACTS);
}
