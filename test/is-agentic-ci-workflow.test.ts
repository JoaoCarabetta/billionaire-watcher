import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

describe('Is Agentic CI Workflow (issue #30)', () => {
  const workflowsDir = path.join(__dirname, '..', '.github', 'workflows');
  let workflowFile: string | null = null;
  let workflowContent: any = null;

  it('should have a workflow file in .github/workflows/', () => {
    expect(fs.existsSync(workflowsDir), '.github/workflows/ should exist').toBe(true);
    
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    expect(files.length, 'At least one workflow file should exist').toBeGreaterThan(0);
    
    // Find a workflow that contains is-agentic command
    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
      if (content.includes('is-agentic') || content.includes('npx is-agentic')) {
        workflowFile = file;
        workflowContent = yaml.parse(content);
        break;
      }
    }
    
    expect(workflowFile, 'A workflow file with is-agentic command should exist').not.toBeNull();
  });

  it('should trigger on push to main with site file paths OR after Pages deploy', () => {
    expect(workflowContent).not.toBeNull();
    
    const on = workflowContent.on || workflowContent['on'] || workflowContent.true;
    expect(on, 'Workflow should have triggers').toBeDefined();
    
    // Should have either:
    // 1. push to main with paths (site files), OR
    // 2. workflow_run after Pages deploy
    const hasPushToMain = on.push?.branches?.includes('main');
    const hasWorkflowRun = on.workflow_run !== undefined;
    
    expect(
      hasPushToMain || hasWorkflowRun,
      'Should trigger on push to main OR workflow_run'
    ).toBe(true);
    
    // If using push, should have path filters for site files
    if (hasPushToMain) {
      const pushPaths = on.push?.paths;
      expect(pushPaths, 'push should have paths filter for site files').toBeDefined();
      expect(pushPaths.length, 'push should filter relevant site paths').toBeGreaterThan(0);
    }
  });

  it('should trigger on weekday schedule', () => {
    expect(workflowContent).not.toBeNull();
    
    const on = workflowContent.on || workflowContent['on'] || workflowContent.true;
    const schedule = on.schedule;
    
    expect(schedule, 'Should have schedule trigger').toBeDefined();
    expect(Array.isArray(schedule), 'Schedule should be an array').toBe(true);
    expect(schedule.length, 'Schedule should have at least one cron').toBeGreaterThan(0);
    
    // Should have a cron expression (we don't validate if it's weekdays-only, just that schedule exists)
    const firstCron = schedule[0].cron;
    expect(firstCron, 'Should have cron expression').toBeDefined();
    expect(typeof firstCron, 'Cron should be a string').toBe('string');
  });

  it('should run npx is-agentic against the public URL with --json', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    expect(jobs, 'Workflow should have jobs').toBeDefined();
    
    // Get the is-agentic job
    const jobKeys = Object.keys(jobs);
    expect(jobKeys.length, 'Should have at least one job').toBeGreaterThan(0);
    
    // Find the job that runs is-agentic
    let foundCommand = false;
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        if (run.includes('npx is-agentic')) {
          foundCommand = true;
          
          // Should use the exact public URL
          expect(run, 'Should target https://billionaire-watcher.pages.dev/').toContain(
            'https://billionaire-watcher.pages.dev/'
          );
          
          // Should use --json flag
          expect(run, 'Should use --json flag').toContain('--json');
          
          break;
        }
      }
      if (foundCommand) break;
    }
    
    expect(foundCommand, 'Should have a step that runs npx is-agentic').toBe(true);
  });

  it('should not reference secrets or API keys', () => {
    expect(workflowContent).not.toBeNull();
    
    const workflowString = JSON.stringify(workflowContent).toLowerCase();
    
    // Check for common secret patterns
    expect(workflowString, 'Should not reference secrets.').not.toMatch(/secrets\./);
    expect(workflowString, 'Should not reference env with API keys').not.toMatch(/api.{0,5}key/);
  });

  it('should use a whitelist of Essential IDs we apply', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    // Find the job that processes is-agentic results
    let foundWhitelist = false;
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        
        // Look for whitelist logic
        if (run.includes('ESSENTIAL_WHITELIST') || (run.includes('content-no-js') && run.includes('agent-friendly-404'))) {
          foundWhitelist = true;
          
          // Should have content-no-js in whitelist (SSR check from agent-readiness Test 1)
          expect(run, 'Should whitelist content-no-js').toContain('content-no-js');
          
          // Should have agent-friendly-404 in whitelist (404 check from agent-readiness Test 4)
          expect(run, 'Should whitelist agent-friendly-404').toContain('agent-friendly-404');
          
          // Should NOT have markdown-negotiation-vary in whitelist (not in agent-readiness tests)
          expect(run, 'Should NOT whitelist markdown-negotiation-vary').not.toContain('markdown-negotiation-vary');
          
          break;
        }
      }
      if (foundWhitelist) break;
    }
    
    expect(
      foundWhitelist,
      'Should have whitelist of Essential IDs we apply'
    ).toBe(true);
  });

  it('should fail on whitelisted Essential failures (content-no-js)', () => {
    // Simulate a report with content-no-js failure
    const mockReport = {
      issues: [
        {
          id: 'content-no-js',
          tier: 'essential',
          result: 'failed',
          name: 'Content without JavaScript',
          details: 'Test failure'
        }
      ]
    };
    
    // Extract the whitelist logic from the workflow
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    let hasWhitelistCheck = false;
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        
        // Verify the jq filter would catch content-no-js
        if (run.includes('ESSENTIAL_WHITELIST') && run.includes('content-no-js')) {
          hasWhitelistCheck = true;
          
          // The whitelist should include content-no-js
          expect(run).toContain('content-no-js');
          
          // The jq filter checks: tier == "essential" and result == "failed" and id in whitelist
          expect(run).toContain('tier == "essential"');
          expect(run).toContain('result == "failed"');
          
          break;
        }
      }
      if (hasWhitelistCheck) break;
    }
    
    expect(hasWhitelistCheck, 'Whitelist logic should catch content-no-js failures').toBe(true);
  });

  it('should NOT fail on non-whitelisted Essential failures (markdown-negotiation-vary)', () => {
    // Simulate a report with ONLY markdown-negotiation-vary failure
    const mockReport = {
      issues: [
        {
          id: 'markdown-negotiation-vary',
          tier: 'essential',
          result: 'failed',
          name: 'Markdown content negotiation',
          details: 'Test failure'
        }
      ]
    };
    
    // Extract the whitelist from the workflow
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    let whitelist: string[] = [];
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        
        if (run.includes('ESSENTIAL_WHITELIST')) {
          // Extract whitelist array
          const match = run.match(/ESSENTIAL_WHITELIST='?\[([^\]]+)\]'?/);
          if (match) {
            whitelist = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
          }
          break;
        }
      }
      if (whitelist.length > 0) break;
    }
    
    // Verify markdown-negotiation-vary is NOT in the whitelist
    expect(
      whitelist,
      'Whitelist should not include markdown-negotiation-vary'
    ).not.toContain('markdown-negotiation-vary');
    
    // Verify content-no-js IS in the whitelist (sanity check)
    expect(
      whitelist,
      'Whitelist should include content-no-js'
    ).toContain('content-no-js');
  });

  it('should document the public URL in comments', () => {
    expect(workflowContent).not.toBeNull();
    
    // Read the raw workflow file to check for comments
    const workflowPath = path.join(workflowsDir, workflowFile!);
    const rawContent = fs.readFileSync(workflowPath, 'utf-8');
    
    // Should mention the public URL somewhere (in comments or the workflow)
    expect(
      rawContent,
      'Should document https://billionaire-watcher.pages.dev/'
    ).toContain('https://billionaire-watcher.pages.dev/');
  });

  it('should allow is-agentic CLI to fail without stopping the job', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    // Find the is-agentic step
    let foundIsAgenticStep = false;
    let hasContinueOnError = false;
    
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        const name = step.name || '';
        
        if (run.includes('npx is-agentic') || name.toLowerCase().includes('is-agentic')) {
          foundIsAgenticStep = true;
          
          // Should have continue-on-error: true
          hasContinueOnError = step['continue-on-error'] === true;
          
          break;
        }
      }
      if (foundIsAgenticStep) break;
    }
    
    expect(foundIsAgenticStep, 'Should have is-agentic step').toBe(true);
    expect(
      hasContinueOnError,
      'is-agentic step should have continue-on-error: true so whitelist check can run'
    ).toBe(true);
  });

  it('should NOT have continue-on-error on the whitelist check step', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    // Find the whitelist check step
    let foundWhitelistStep = false;
    let hasContinueOnError = false;
    
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        const name = step.name || '';
        
        if (run.includes('ESSENTIAL_WHITELIST') && (name.toLowerCase().includes('essential') || name.toLowerCase().includes('check'))) {
          foundWhitelistStep = true;
          
          // Should NOT have continue-on-error: true (or should be false)
          hasContinueOnError = step['continue-on-error'] === true;
          
          break;
        }
      }
      if (foundWhitelistStep) break;
    }
    
    expect(foundWhitelistStep, 'Should have whitelist check step').toBe(true);
    expect(
      hasContinueOnError,
      'Whitelist check step should NOT have continue-on-error (must fail job when needed)'
    ).toBe(false);
  });
});
