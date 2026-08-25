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
  const usePublishedFacts = process.env.USE_PUBLISHED_FACTS;
  const nodeEnv = process.env.NODE_ENV;
  
  let facts: PublishedFact[];
  
  if (publishedFactsDir) {
    // Load from production directory or test directory
    if (!fs.existsSync(publishedFactsDir)) {
      throw new Error(`PUBLISHED_FACTS_DIR is set but directory does not exist: ${publishedFactsDir}`);
    }
    
    // Check if it's pointing to a directory with published-facts.json
    const fixtureFile = path.join(publishedFactsDir, 'published-facts.json');
    if (fs.existsSync(fixtureFile)) {
      const fixtureData = fs.readFileSync(fixtureFile, 'utf-8');
      facts = JSON.parse(fixtureData);
      
      if (!facts || facts.length === 0) {
        throw new Error(`PUBLISHED_FACTS_DIR points to empty fixture file: ${fixtureFile}`);
      }
    } else {
      facts = loadFromDirectory(publishedFactsDir);
      
      if (!facts || facts.length === 0) {
        throw new Error(`PUBLISHED_FACTS_DIR is empty (no fact files found): ${publishedFactsDir}`);
      }
    }
  } else if (usePublishedFacts) {
    // Test mode: use git fixture
    // USE_PUBLISHED_FACTS is test-only
    // It should fail in production unless we're in a test runner context
    if (nodeEnv === 'production' && !process.env.VITEST) {
      throw new Error(
        'USE_PUBLISHED_FACTS is test-only and cannot be used in production. ' +
        'Set PUBLISHED_FACTS_DIR to a non-empty directory containing published facts.'
      );
    }
    
    const fixturePath = path.join(process.cwd(), 'test', 'fixtures', 'published-facts.json');
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Published facts fixture not found: ${fixturePath}`);
    }
    const fixtureData = fs.readFileSync(fixturePath, 'utf-8');
    facts = JSON.parse(fixtureData);
  } else {
    // Fallback to empty (old fixtures will be used instead)
    cachedFacts = [];
    return cachedFacts;
  }
  
  // Filter to only facts with source_locator
  cachedFacts = facts.filter(fact => fact.source_locator);
  
  if (cachedFacts.length === 0 && publishedFactsDir) {
    throw new Error(`No published facts with source_locator found in: ${publishedFactsDir}`);
  }
  
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
