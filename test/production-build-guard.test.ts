import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Production Build Guard', () => {
  it('should fail when PUBLISHED_FACTS_DIR is not set', () => {
    // Production build without PUBLISHED_FACTS_DIR must fail
    expect(() => {
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PUBLISHED_FACTS_DIR: undefined,
          USE_PUBLISHED_FACTS: undefined,
          NODE_ENV: 'production'
        }
      });
    }).toThrow();
  });

  it('should succeed when PUBLISHED_FACTS_DIR points to published-facts fixture', () => {
    const fixtureDir = path.join(__dirname, '..', 'test', 'fixtures');
    
    // Build with PUBLISHED_FACTS_DIR set should succeed
    expect(() => {
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PUBLISHED_FACTS_DIR: fixtureDir
        }
      });
    }).not.toThrow();
  });
});
