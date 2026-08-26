-- ATIVO hop roots for issue #141.
-- Universe is inventory cadastro ATIVO (Valor 1–500 ∪ banks ∪ insurers),
-- plus launch-list names that are cadastro ATIVO but not a Valor ranking
-- row (Itaúsa). Globo / Record / Havan / Folha stay groups and are never
-- hop roots. No invented /0001. Prefix-8 only. No public HTML. No /grafo.

with groups as (
    select groups.empresa
    from {{ ref('valor_group_not_dono') }} as groups
),

inventory_ativo as (
    select
        inventory.company_name,
        inventory.cnpj_basico,
        inventory.ranking_family,
        inventory.valor_rank,
        inventory.already_on_graph,
        inventory.is_votorantim_seed,
        inventory.razao_social,
        'inventory_ativo' as root_origin
    from {{ ref('valor_cadastro_inventory') }} as inventory
    left join groups as groups
        on inventory.company_name = groups.empresa
    where inventory.cadastro_situation = 'ATIVO'
      and inventory.cnpj_basico is not null
      and groups.empresa is null
),

launch as (
    select
        launch.spec_name,
        launch.match_empresa,
        launch.match_razao,
        {% if target.type == 'duckdb' %}
        cast(launch.is_votorantim_seed as boolean) as is_votorantim_seed
        {% else %}
        cast(launch.is_votorantim_seed as bool) as is_votorantim_seed
        {% endif %}
    from {{ ref('valor_launch_add_list') }} as launch
),

inventory_launch_hit as (
    select distinct launch.spec_name
    from launch as launch
    inner join {{ ref('valor_cadastro_inventory') }} as inventory
        on inventory.company_name = launch.match_empresa
        or inventory.razao_social = launch.match_razao
),

launch_extra as (
    select
        launch.spec_name,
        launch.match_empresa,
        launch.match_razao,
        launch.is_votorantim_seed,
        {{ normalize_company_name('launch.spec_name') }} as n_spec,
        {{ normalize_company_name('launch.match_razao') }} as n_razao
    from launch as launch
    left join inventory_launch_hit as hit
        on launch.spec_name = hit.spec_name
    where hit.spec_name is null
),

cadastro as (
    select distinct
        {{ prefix8_from_cnpj14('cadastro.CNPJ_CIA') }} as cad_cnpj_basico,
        cadastro.SIT,
        {{ normalize_company_name('cadastro.DENOM_SOCIAL') }} as n_social,
        {{ normalize_company_name('cadastro.DENOM_COMERC') }} as n_comerc
    from {{ ref('stg_cvm_cad_cia_aberta') }} as cadastro
    where {{ prefix8_from_cnpj14('cadastro.CNPJ_CIA') }} is not null
      and cadastro.SIT = 'ATIVO'
),

extra_hits as (
    select
        extra.spec_name,
        extra.match_empresa,
        extra.match_razao,
        extra.is_votorantim_seed,
        cadastro.cad_cnpj_basico,
        count(distinct cadastro.cad_cnpj_basico) over (
            partition by extra.spec_name
        ) as hit_count
    from launch_extra as extra
    inner join cadastro as cadastro
        on extra.n_spec = cadastro.n_social
        or extra.n_spec = cadastro.n_comerc
        or extra.n_razao = cadastro.n_social
        or extra.n_razao = cadastro.n_comerc
),

extra_picked as (
    select distinct
        extra_hits.spec_name as company_name,
        extra_hits.cad_cnpj_basico as cnpj_basico,
        cast(null as string) as ranking_family,
        cast(null as int64) as valor_rank,
        extra_hits.is_votorantim_seed,
        extra_hits.match_razao as razao_social,
        'launch_extra' as root_origin
    from extra_hits as extra_hits
    where extra_hits.hit_count = 1
),

extra_holes as (
    select
        extra.spec_name as company_name,
        cast(null as string) as cnpj_basico,
        cast(null as string) as ranking_family,
        cast(null as int64) as valor_rank,
        extra.is_votorantim_seed,
        extra.match_razao as razao_social,
        'launch_hole' as root_origin
    from launch_extra as extra
    left join extra_picked as picked
        on extra.spec_name = picked.company_name
    where picked.company_name is null
),

graph as (
    select distinct
        lpad(cast(graph.cnpj_basico as string), 8, '0') as cnpj_basico
    from {{ ref('live_graph_company_cnpj_basicos') }} as graph
),

extras as (
    select * from extra_picked
    union all
    select * from extra_holes
),

rooted as (
    select
        inventory_ativo.company_name,
        inventory_ativo.cnpj_basico,
        inventory_ativo.ranking_family,
        inventory_ativo.valor_rank,
        inventory_ativo.already_on_graph,
        inventory_ativo.is_votorantim_seed,
        inventory_ativo.razao_social,
        inventory_ativo.root_origin
    from inventory_ativo as inventory_ativo

    union all

    select
        extras.company_name,
        extras.cnpj_basico,
        extras.ranking_family,
        extras.valor_rank,
        {% if target.type == 'duckdb' %}
        cast(graph.cnpj_basico is not null as boolean) as already_on_graph,
        {% else %}
        cast(graph.cnpj_basico is not null as bool) as already_on_graph,
        {% endif %}
        extras.is_votorantim_seed,
        extras.razao_social,
        extras.root_origin
    from extras as extras
    left join graph as graph
        on extras.cnpj_basico = graph.cnpj_basico
)

select
    rooted.company_name,
    rooted.cnpj_basico,
    rooted.ranking_family,
    rooted.valor_rank,
    {% if target.type == 'duckdb' %}
    cast(coalesce(rooted.already_on_graph, false) as boolean) as already_on_graph,
    cast(coalesce(rooted.already_on_graph, false) as boolean) as skip_redraw,
    cast(coalesce(rooted.is_votorantim_seed, false) as boolean) as is_votorantim_seed,
    {% else %}
    cast(coalesce(rooted.already_on_graph, false) as bool) as already_on_graph,
    cast(coalesce(rooted.already_on_graph, false) as bool) as skip_redraw,
    cast(coalesce(rooted.is_votorantim_seed, false) as bool) as is_votorantim_seed,
    {% endif %}
    rooted.razao_social,
    rooted.root_origin
from rooted as rooted
