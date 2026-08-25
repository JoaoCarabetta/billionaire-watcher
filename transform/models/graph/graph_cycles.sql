-- graph_cycles.sql
-- Detect cycles in the control graph
-- A cycle occurs when a CNPJ básico appears more than once in a path

with edges as (
    select
        from_id,
        to_id
    from {{ ref('graph_edges') }}
),

nodes as (
    select
        node_id,
        node_kind,
        cnpj_basico
    from {{ ref('graph_nodes') }}
),

-- Find self-loops (direct cycles)
self_loops as (
    select
        e.from_id as cycle_start,
        [e.from_id] as cycle_path
    from edges e
    inner join nodes n1 on e.from_id = n1.node_id
    inner join nodes n2 on e.to_id = n2.node_id
    where e.from_id = e.to_id
      and n1.cnpj_basico is not null
      and n2.cnpj_basico is not null
)

select
    cycle_start,
    cycle_path
from self_loops
