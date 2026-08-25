import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

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
          ALLOW_OLD_FIXTURES: undefined,
          NODE_ENV: 'production'
        }
      });
    }).toThrow();
  });
  
  it('should fail when PUBLISHED_FACTS_DIR points to non-existent directory', () => {
    // Production build with non-existent dir must fail
    expect(() => {
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PUBLISHED_FACTS_DIR: '/tmp/nonexistent-facts-dir',
          USE_PUBLISHED_FACTS: undefined,
          ALLOW_OLD_FIXTURES: undefined
        }
      });
    }).toThrow();
  });
  
  it('should fail when PUBLISHED_FACTS_DIR points to empty directory', () => {
    // Create empty temp directory
    const emptyDir = path.join(__dirname, '..', '.tmp-empty-facts');
    if (!fs.existsSync(emptyDir)) {
      fs.mkdirSync(emptyDir, { recursive: true });
    }
    
    try {
      // Production build with empty dir must fail
      expect(() => {
        execSync('npm run build', {
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe',
          encoding: 'utf-8',
          env: {
            ...process.env,
            PUBLISHED_FACTS_DIR: emptyDir,
            USE_PUBLISHED_FACTS: undefined,
            ALLOW_OLD_FIXTURES: undefined
          }
        });
      }).toThrow();
    } finally {
      // Clean up
      if (fs.existsSync(emptyDir)) {
        fs.rmdirSync(emptyDir);
      }
    }
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
          PUBLISHED_FACTS_DIR: fixtureDir,
          USE_PUBLISHED_FACTS: undefined,
          ALLOW_OLD_FIXTURES: undefined
        }
      });
    }).not.toThrow();
  });
  
  it('USE_PUBLISHED_FACTS must not work in production (test-only)', () => {
    // Production build with only USE_PUBLISHED_FACTS should fail
    expect(() => {
      const env = { ...process.env };
      delete env.VITEST;
      delete env.PUBLISHED_FACTS_DIR;
      delete env.ALLOW_OLD_FIXTURES;
      env.USE_PUBLISHED_FACTS = 'true';
      env.NODE_ENV = 'production';
      
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env
      });
    }).toThrow();
  });
});
