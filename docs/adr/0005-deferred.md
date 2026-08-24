# ADR-0005: Deferred

## Status

Accepted

## Date

2026-08-24

## Context

Some features are valuable but not essential for the initial release (v1) of billionaire-watcher. Deferring them allows v1 to ship sooner while documenting the intent to revisit them.

This ADR records two deferred efforts:
1. Automated refresh of 2026 TSE donation data via GitHub Actions cron
2. Contribution of CVM FRE data to Base dos Dados pipelines

Both are desirable for maintainability and ecosystem contribution, but neither is a v1 blocker.

## Decision

### GitHub Actions cron for TSE 2026 refresh: DEFERRED

**Context**: TSE publishes updated prestação (accountability) ZIPs throughout the 2026 electoral cycle, culminating in final data after the October 4, 2026 election.

**Desired state**: A GitHub Actions workflow runs on a cron schedule (e.g., weekly) to:
- Download the latest TSE prestação ZIPs
- Upload to GCS
- Trigger the dbt pipeline to regenerate Facts
- Export updated JSONL to R2
- Trigger an Astro rebuild to publish updated HTML

**Deferred rationale**:
- v1 can launch with donations through 2024 (from BD `br_tse_eleicoes.receitas_candidato`) plus a manual 2026 snapshot
- Automated refresh adds operational complexity (GCS credentials in GitHub Actions, error handling, notification on failure)
- The 2026 cycle ends October 4, 2026; manual refreshes are feasible for the ~6-week window

**Design constraint for later**: The architecture must support pulling new TSE data and rebuilding Facts **without mutating the dated freeze object**. The freeze is versioned (`freeze/{date}.csv`); a new TSE pull should reference the same freeze date or create a new one. Facts JSONL is versioned by export date (`facts/{date}/`), not by source data freshness.

**Revisit after**: v1 launch. If the project gains traction, automate TSE refresh before the 2028 cycle.

### CVM FRE contribution to Base dos Dados: DEFERRED (parallel track)

**Context**: CVM FRE (Formulário de Referência) data is not yet in Base dos Dados. ADR-0002 documents that v1 extracts FRE directly from CVM ZIPs.

**Desired state**: FRE tables (structured: §6 organograma, §12 directors, etc.) are contributed to Base dos Dados, maintained by BD pipelines, and available in `basedosdados.br_cvm_fre.*`.

**Deferred rationale**:
- Contributing to BD requires following BD's contribution guidelines (schema design, data freshness SLA, tests)
- BD contribution is a separate project from billionaire-watcher v1
- v1 can ship with custom CVM extraction; BD integration improves maintainability but is not a blocker

**Parallel track**: A maintainer or contributor can work on the BD contribution independently while v1 development proceeds. When FRE is available in BD, billionaire-watcher's dbt models can switch from custom extraction to `source('basedosdados', 'br_cvm_fre')`.

**Revisit**: After v1 launch, prioritize the BD contribution to reduce custom extraction code in billionaire-watcher.

## Consequences

### Positive

- v1 can ship without solving automated TSE refresh or waiting for BD FRE contribution
- Both deferred efforts are documented, not forgotten
- Design constraint (non-mutating freeze snapshots) is recorded for future implementation

### Negative

- Manual TSE refreshes through October 4, 2026 increase maintainer workload
- Custom CVM extraction code will persist until BD FRE is available

### Neutral

- Deferred efforts do not imply "never implement"; they are candidates for post-v1 work
- The architecture (ADR-0001, ADR-0002, ADR-0003) already supports both features; only the automation/integration is deferred

## Rejected Alternatives

### Block v1 on automated TSE refresh

**Rejected**: Adds ~2-3 weeks of work (GitHub Actions workflow, credential management, error handling) for a 6-week window (now through October 4). Manual refreshes are feasible for v1.

### Block v1 on CVM FRE in Base dos Dados

**Rejected**: BD contribution is a separate project with uncertain timeline. Custom CVM extraction is tractable; waiting for BD would delay v1 indefinitely.

### Never automate TSE refresh

**Rejected**: For the 2028 and 2030 cycles, automation will be essential. Deferral is temporary, not permanent.

### Never contribute FRE to Base dos Dados

**Rejected**: BD contribution benefits the entire Brazilian data ecosystem, not just billionaire-watcher. The parallel track documents the intent to contribute.
