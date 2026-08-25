-- graph_edges.sql
-- Control graph edges: participacao relationships with nullable percents
-- Missing percent is NULL, not zero; hop without percent keeps edge
-- edge_role labels fund relationships (gestora, administrador)

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
