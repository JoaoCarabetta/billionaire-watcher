# Test Fix Reference: Complete Column Lists

## freeze_persons_with_forbes (18 columns)
All `given` inputs that use `ref('freeze_persons_with_forbes')` must include:

```sql
select
  cast(null as integer) as group_rank,
  '<value>' as group_name,
  '<value>' as cnpj_basico,
  cast(null as varchar) as ranking_source,
  cast(null as varchar) as receita_fy2024_brl,
  cast(null as boolean) as listed_flag,
  cast(null as boolean) as soe_flag,
  cast(null as varchar) as controlador_tipo,
  '<value>' as person_name,
  '<value>' as role,
  cast(null as varchar) as edge_label,
  cast(null as varchar) as acordo_acionistas,
  '<value>' as source_doc,
  cast(null as varchar) as fre_item,
  cast(null as boolean) as hole,
  '<value>' as cpf_masked,
  '<value>' as freeze_status,
  cast(null as varchar) as notes
```

## donation_facts outputs (10 columns)
All `expect` sections for `donation_facts` model must include:

```sql
select
  '<value>' as fact_id,
  '<value>' as person_name,
  'donation' as fact_kind,
  '<value>' as value,
  'Tribunal Superior Eleitoral' as source_publisher,
  '<value>' as source_locator,
  cast(null as varchar) as source_retrieved_at,
  '<value>' as cpf_masked,
  '<value>' as cnpj_basico,
  '<value>' as group_name
```

## Pattern for ALL Tests
1. List columns model READS → those go in `given`
2. List columns model EMITS → those go in `expect`  
3. Use cast(null as TYPE) for untested columns
4. Arrays: `NULL::VARCHAR[]` (DuckDB syntax)
5. Booleans: `cast(null as boolean)`
6. Integers: `cast(null as integer)`
7. Doubles: `cast(null as double)`

## Remaining Test Fixes Needed (32 tests)

### unit_test_facts.yml (15 tests)
All need complete column lists in given/expect following patterns above.

### unit_test_freeze.yml (11 tests)  
Same - add all columns for each int_freeze_* model input.

### unit_test_forbes.yml (6 tests)
Same - add all columns for forbes_billionaires_brazil_nexus and freeze_persons inputs.
