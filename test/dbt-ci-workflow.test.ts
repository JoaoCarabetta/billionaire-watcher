import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

describe('dbt CI Workflow (issue #43)', () => {
  const workflowsDir = path.join(__dirname, '..', '.github', 'workflows');
  let workflowFile: string | null = null;
  let workflowContent: any = null;

  it('should have a workflow file in .github/workflows/', () => {
    expect(fs.existsSync(workflowsDir), '.github/workflows/ should exist').toBe(true);
    
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    expect(files.length, 'At least one workflow file should exist').toBeGreaterThan(0);
    
    // Find a workflow that contains dbt commands
    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
      if (content.includes('dbt parse') || content.includes('dbt test')) {
        workflowFile = file;
        workflowContent = yaml.parse(content);
        break;
      }
    }
    
    expect(workflowFile, 'A workflow file with dbt commands should exist').not.toBeNull();
  });

  it('should trigger on pull_request and push events', () => {
    expect(workflowContent).not.toBeNull();
    
    const on = workflowContent.on || workflowContent['on'] || workflowContent.true;
    expect(on, 'Workflow should have triggers').toBeDefined();
    
    // Check for pull_request trigger
    expect(on.pull_request || on['pull_request'], 'Should trigger on pull_request').toBeDefined();
    
    // Check for push trigger
    expect(on.push, 'Should trigger on push').toBeDefined();
  });

  it('should filter paths to include transform/**', () => {
    expect(workflowContent).not.toBeNull();
    
    const on = workflowContent.on || workflowContent['on'] || workflowContent.true;
    
    // Check pull_request paths
    const prPaths = on.pull_request?.paths || on['pull_request']?.paths;
    expect(prPaths, 'pull_request should have paths filter').toBeDefined();
    expect(prPaths, 'pull_request paths should include transform/**').toContain('transform/**');
    
    // Check push paths
    const pushPaths = on.push?.paths;
    expect(pushPaths, 'push should have paths filter').toBeDefined();
    expect(pushPaths, 'push paths should include transform/**').toContain('transform/**');
  });

  it('should trigger on main branch', () => {
    expect(workflowContent).not.toBeNull();
    
    const on = workflowContent.on || workflowContent['on'] || workflowContent.true;
    const pushBranches = on.push?.branches;
    
    expect(pushBranches, 'push should have branches filter').toBeDefined();
    expect(pushBranches, 'push branches should include main').toContain('main');
  });

  it('should run dbt deps to install packages', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    expect(jobs, 'Workflow should have jobs').toBeDefined();
    
    // Get first job (there should be at least one)
    const jobKey = Object.keys(jobs)[0];
    const job = jobs[jobKey];
    const steps = job.steps;
    
    expect(steps, 'Job should have steps').toBeDefined();
    
    // Check that dbt deps is run
    const dbtDepsStep = steps.find((step: any) => 
      step.run?.includes('dbt deps') || step.name?.toLowerCase().includes('deps')
    );
    
    expect(dbtDepsStep, 'Should have a step that runs dbt deps').toBeDefined();
  });

  it('should run dbt parse', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKey = Object.keys(jobs)[0];
    const job = jobs[jobKey];
    const steps = job.steps;
    
    // Check that dbt parse is run
    const dbtParseStep = steps.find((step: any) => 
      step.run?.includes('dbt parse')
    );
    
    expect(dbtParseStep, 'Should have a step that runs dbt parse').toBeDefined();
  });

  it('should run dbt test --select test_type:unit', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKey = Object.keys(jobs)[0];
    const job = jobs[jobKey];
    const steps = job.steps;
    
    // Check that unit tests are run
    const unitTestStep = steps.find((step: any) => 
      step.run?.includes('dbt test') && step.run?.includes('test_type:unit')
    );
    
    expect(unitTestStep, 'Should have a step that runs dbt test --select test_type:unit').toBeDefined();
  });

  it('should not reference GCP/BigQuery credentials or secrets', () => {
    expect(workflowContent).not.toBeNull();
    
    const workflowString = JSON.stringify(workflowContent).toLowerCase();
    
    // Check for common secret/credential patterns
    expect(workflowString, 'Should not reference secrets.').not.toMatch(/secrets\./);
    expect(workflowString, 'Should not reference service account').not.toMatch(/service.{0,5}account/);
    expect(workflowString, 'Should not reference GCP key').not.toMatch(/gcp.{0,5}key/);
    expect(workflowString, 'Should not reference GOOGLE_CREDENTIALS').not.toMatch(/google.{0,5}credentials/);
  });

  it('should not commit dbt_packages', () => {
    expect(workflowContent).not.toBeNull();
    
    const jobs = workflowContent.jobs;
    const jobKey = Object.keys(jobs)[0];
    const job = jobs[jobKey];
    const steps = job.steps;
    
    // Check that there's no step that commits or adds dbt_packages
    const commitStep = steps.find((step: any) => {
      const run = step.run || '';
      return run.includes('git add') && run.includes('dbt_packages');
    });
    
    expect(commitStep, 'Should not commit dbt_packages').toBeUndefined();
  });
});
