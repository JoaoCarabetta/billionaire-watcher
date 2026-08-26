-- Four leftover-planning counts for issue #140. Grain: one summary row.
-- launch_add_list_size is the named first-wave seed (14), including Itaúsa
-- even when Itaúsa is not a Valor ranking row. leftover_after_launch is ATIVO
-- in the Valor universe that is not already on the live graph and not on the
-- named add-list.

select
    {% if target.type == 'duckdb' %}
    count(*) filter (where inventory.cadastro_situation = 'ATIVO') as ativo_in_universe,
    count(*) filter (where inventory.already_on_graph) as already_on_graph,
    (
        select count(*)
        from {{ ref('valor_launch_add_list') }} as launch
    ) as launch_add_list_size,
    count(*) filter (
        where inventory.cadastro_situation = 'ATIVO'
          and inventory.already_on_graph = false
          and inventory.on_launch_add_list = false
    ) as leftover_after_launch
    {% else %}
    countif(inventory.cadastro_situation = 'ATIVO') as ativo_in_universe,
    countif(inventory.already_on_graph) as already_on_graph,
    (
        select count(*)
        from {{ ref('valor_launch_add_list') }} as launch
    ) as launch_add_list_size,
    countif(
        inventory.cadastro_situation = 'ATIVO'
        and inventory.already_on_graph = false
        and inventory.on_launch_add_list = false
    ) as leftover_after_launch
    {% endif %}
from {{ ref('valor_cadastro_inventory') }} as inventory
