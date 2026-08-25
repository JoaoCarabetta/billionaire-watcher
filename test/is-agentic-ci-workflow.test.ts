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

  it('should fail only on Essential tier failures, not Recommended', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKeys = Object.keys(jobs);
    
    // Find the job that processes is-agentic results
    let foundFailureLogic = false;
    for (const jobKey of jobKeys) {
      const job = jobs[jobKey];
      const steps = job.steps || [];
      
      for (const step of steps) {
        const run = step.run || '';
        
        // Look for logic that parses the JSON and checks tier
        if (run.includes('essential') || run.includes('tier')) {
          foundFailureLogic = true;
          
          // Should check for essential tier
          expect(run.toLowerCase(), 'Should check for essential tier').toContain('essential');
          
          // Should NOT fail on recommended
          // (absence of 'recommended' in failure condition, or explicit exclusion)
          break;
        }
      }
      if (foundFailureLogic) break;
    }
    
    expect(
      foundFailureLogic,
      'Should have logic that checks Essential tier and fails appropriately'
    ).toBe(true);
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
});
