-- graph_edges.sql
-- Control graph edges: participacao relationships with nullable percents
-- Missing percent is NULL, not zero; hop without percent keeps edge
-- edge_role labels fund relationships (gestora, administrador) and QSA sócio relationships
-- QSA sócio edges use edge_role='socio' (never 'dono' or 'UBO')
-- CVM FRE/IR statement of control wins over QSA for who controls a listed company:
--   Filter out person→listed direct edges from QSA when FRE/IR control exists

with all_edges as (
    select
        from_id,
        to_id,
        edge_kind,
        edge_role,
        pct_capital,
        pct_votos,
        qty_ordinarias,
        qty_preferenciais,
        source_doc,
        source_locator,
        cast(source_retrieved_at as date) as source_retrieved_at
    from {{ ref('energisa_edges_fixture') }}
    
    union all
    
    select
        from_id,
        to_id,
        edge_kind,
        edge_role,
        pct_capital,
        pct_votos,
        qty_ordinarias,
        qty_preferenciais,
        source_doc,
        source_locator,
        cast(source_retrieved_at as date) as source_retrieved_at
    from {{ ref('qsa_edges_fixture') }}
),

nodes as (
    select
        node_id,
        node_kind
    from {{ ref('graph_nodes') }}
),

-- Listed companies that have FRE/IR control statements (table 6.1, IR, or FRE in source_doc)
listed_with_fre_ir as (
    select distinct
        to_id as listed_cnpj
    from all_edges
    where source_doc like '%IR%'
       or source_doc like '%FRE%'
       or source_locator like '%6.1%'
),

-- QSA edges from person directly to listed company (these conflict with FRE/IR)
qsa_person_to_listed as (
    select
        e.from_id,
        e.to_id
    from all_edges e
    inner join nodes n on e.from_id = n.node_id
    inner join listed_with_fre_ir l on e.to_id = l.listed_cnpj
    where n.node_kind = 'person'
      and e.source_doc like '%QSA%'
)

select
    e.from_id,
    e.to_id,
    e.edge_kind,
    e.edge_role,
    e.pct_capital,
    e.pct_votos,
    e.qty_ordinarias,
    e.qty_preferenciais,
    e.source_doc,
    e.source_locator,
    e.source_retrieved_at
from all_edges e
-- Exclude QSA person→listed edges when FRE/IR control exists
where not exists (
    select 1
    from qsa_person_to_listed qsa
    where qsa.from_id = e.from_id
      and qsa.to_id = e.to_id
)
