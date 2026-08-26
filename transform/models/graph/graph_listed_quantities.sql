-- graph_listed_quantities.sql
-- Formulário share quantity at seed × class grain for priced listed seeds.
-- Issue #129: Coder / public graph sidecar. Not the money 17.1 CSV.
-- Source: graph_edges qty columns only (listed hops from #63). Do not invent.
-- Grain: one row per cnpj_basico × classe (ordinaria / preferencial), not per holder.
-- Identical company totals on more than one holder hop collapse to one row.
-- Seeds whose hops have no quantity are omitted (not zero).
-- Unit classes (ENGI11) are never emitted. Claro has no Bolsa class so it never joins.

{% if target.name in ['test', 'ci'] %}
    {% set listed_prices_relation = ref('listed_prices_fixture') %}
{% else %}
    {% set listed_prices_relation = ref('b3_listed_prices') %}
{% endif %}

with hop_quantities as (
    select
        to_id as cnpj_basico,
        qty_ordinarias,
        qty_preferenciais,
        min(source_doc) as source_doc,
        min(source_locator) as source_locator,
        min(source_retrieved_at) as source_retrieved_at
    from {{ ref('graph_edges') }}
    where qty_ordinarias is not null
       or qty_preferenciais is not null
    group by
        to_id,
        qty_ordinarias,
        qty_preferenciais
),

priced_classes as (
    select distinct
        cnpj_basico,
        ticker,
        classe
    from {{ listed_prices_relation }}
    where classe in ('ordinaria', 'preferencial')
),

ordinarias as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        h.qty_ordinarias as quantidade,
        h.source_doc,
        h.source_locator,
        h.source_retrieved_at
    from hop_quantities h
    inner join priced_classes p
        on h.cnpj_basico = p.cnpj_basico
       and p.classe = 'ordinaria'
    where h.qty_ordinarias is not null
),

preferenciais as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        h.qty_preferenciais as quantidade,
        h.source_doc,
        h.source_locator,
        h.source_retrieved_at
    from hop_quantities h
    inner join priced_classes p
        on h.cnpj_basico = p.cnpj_basico
       and p.classe = 'preferencial'
    where h.qty_preferenciais is not null
),

all_quantities as (
    select * from ordinarias
    union all
    select * from preferenciais
)

select
    cnpj_basico,
    ticker,
    classe,
    quantidade,
    source_doc,
    source_locator,
    source_retrieved_at
from all_quantities
