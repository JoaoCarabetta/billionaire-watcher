/**
 * Tribunal badges on already-minted person fichas (issue #169).
 *
 * Reads the Data Engineer sidecar of warehouse graph_person_tse_match strong
 * rows. Badges only when match_class is strong and a candidate/donor flag is
 * set. name_review / collision / no_hit never produce a badge. 2026 is a hole.
 * Do not mint pages here. Do not print eleven-digit Cadastro.
 */

import fs from 'node:fs';
import path from 'node:path';

export const COMMITTED_TSE_MATCH_RELATIVE = path.join(
  'data',
  'tse',
  'graph-person-tse-match-strong.json'
);

export const TSE_CLOSED_CYCLE_PUBLISHER = 'Base dos Dados - TSE Eleições';
export const TSE_CLOSED_CYCLE_LOCATOR = 'https://basedosdados.org/queries/tse-receitas';

const PERSON_ID_RE = /^p-[0-9a-f]{8}$/;
const CLOSED_CYCLES = new Set([2016, 2018, 2020, 2022, 2024]);
const MATCH_CLASSES = new Set(['strong', 'name_review', 'collision', 'no_hit']);
const ELEVEN_DIGIT = /(?<!\d)\d{11}(?!\d)/;

export type TseMatchClass = 'strong' | 'name_review' | 'collision' | 'no_hit';
export type TseBadge = 'político' | 'doador';

export type GraphPersonTseMatchRow = {
  person_id: string;
  is_candidate_strong: boolean;
  is_donor_strong: boolean;
  candidate_cycles: string | string[] | number[] | null;
  donor_cycles: string | string[] | number[] | null;
  match_class: TseMatchClass;
};

export type MintedTseBadges = {
  badges: TseBadge[];
  candidate_cycles: number[];
  donor_cycles: number[];
};

const EMPTY_BADGES: MintedTseBadges = {
  badges: [],
  candidate_cycles: [],
  donor_cycles: [],
};

function parseCycles(value: unknown): number[] {
  if (value == null || value === '') {
    return [];
  }
  const parts = Array.isArray(value) ? value.map(String) : String(value).split(',');
  const years: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const year = Number(String(part).trim());
    if (!Number.isInteger(year) || !CLOSED_CYCLES.has(year) || seen.has(year)) {
      continue;
    }
    seen.add(year);
    years.push(year);
  }
  years.sort((a, b) => a - b);
  return years;
}

function asMatchRow(value: unknown): GraphPersonTseMatchRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.person_id !== 'string' || !PERSON_ID_RE.test(raw.person_id)) {
    return null;
  }
  if (typeof raw.match_class !== 'string' || !MATCH_CLASSES.has(raw.match_class)) {
    return null;
  }
  const row: GraphPersonTseMatchRow = {
    person_id: raw.person_id,
    is_candidate_strong: raw.is_candidate_strong === true,
    is_donor_strong: raw.is_donor_strong === true,
    candidate_cycles: raw.candidate_cycles as GraphPersonTseMatchRow['candidate_cycles'],
    donor_cycles: raw.donor_cycles as GraphPersonTseMatchRow['donor_cycles'],
    match_class: raw.match_class as TseMatchClass,
  };
  if (ELEVEN_DIGIT.test(JSON.stringify(row))) {
    return null;
  }
  return row;
}

export function badgesForMintedPessoa(
  pessoa: { id: string },
  rows: GraphPersonTseMatchRow[]
): MintedTseBadges {
  if (!pessoa || typeof pessoa.id !== 'string' || !Array.isArray(rows)) {
    return EMPTY_BADGES;
  }
  const row = rows.find((entry) => entry.person_id === pessoa.id);
  if (!row || row.match_class !== 'strong') {
    return EMPTY_BADGES;
  }
  const isCandidate = row.is_candidate_strong === true;
  const isDonor = row.is_donor_strong === true;
  if (!isCandidate && !isDonor) {
    return EMPTY_BADGES;
  }
  const badges: TseBadge[] = [];
  if (isCandidate) {
    badges.push('político');
  }
  if (isDonor) {
    badges.push('doador');
  }
  return {
    badges,
    candidate_cycles: isCandidate ? parseCycles(row.candidate_cycles) : [],
    donor_cycles: isDonor ? parseCycles(row.donor_cycles) : [],
  };
}

export function loadCommittedTseMatch(): GraphPersonTseMatchRow[] {
  const filePath = path.join(process.cwd(), COMMITTED_TSE_MATCH_RELATIVE);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const rawRows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : [];
  const rows: GraphPersonTseMatchRow[] = [];
  for (const entry of rawRows) {
    const row = asMatchRow(entry);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}
