# graph-person-tse-match-strong.json

Warehouse export of `billionairewatcher.billionaire_watcher.graph_person_tse_match` for #169 badges.

- Filter: `match_class = 'strong'` and (`is_candidate_strong` or `is_donor_strong`)
- 251 rows. 4 candidate-strong (all also donor-strong). 247 donor-only.
- Columns: `person_id` (p- plus 8 hex only), `is_candidate_strong`, `is_donor_strong`, `candidate_cycles`, `donor_cycles`, `match_class`
- Cycles present: 2016, 2018, 2020, 2022, 2024. 2026 hole stays (Tribunal Dados Abertos not landed).
- Zero eleven-digit Cadastro. Name-only review and collision rows are omitted.
- `p-da3e3836` donor-strong, `donor_cycles` 2024, not candidate-strong.
- `p-e1365405` donor-strong, `donor_cycles` 2016, not candidate-strong.

Not a public page. Coder reads this file for minted-ficha badges.
