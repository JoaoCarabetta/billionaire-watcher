-- graph_cycles.sql
-- Detect cycles in the control graph
-- A cycle occurs when a CNPJ básico appears more than once in a path
-- Records the ordered list of cnpj_basico that repeated (the ring)

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

-- Find two-hop rings: A → B → A
two_hop_rings as (
    select
        e1.from_id as cycle_start,
        [n1.cnpj_basico, n2.cnpj_basico] as cycle_path
    from edges e1
    inner join edges e2 on e1.to_id = e2.from_id
    inner join nodes n1 on e1.from_id = n1.node_id
    inner join nodes n2 on e1.to_id = n2.node_id
    where e2.to_id = e1.from_id
      and e1.from_id != e1.to_id
      and n1.cnpj_basico is not null
      and n2.cnpj_basico is not null
)

select
    cycle_start,
    cycle_path
from two_hop_rings
