-- One row per Valor 1000 2025 company in industrial ranks 1–500
-- UNION banks UNION insurers (issue #140). Table, not a graph.
-- Company key is prefix-8 of the Cadastro Nacional when known. Never invent a
-- /0001 branch suffix. Never emit an 11-digit Cadastro. percent is always null
-- (this ticket does not extract hops; #141 will). No public HTML. No /grafo.

with rankings as (
    select
        rankings.ranking_family,
        rankings.valor_rank,
        rankings.empresa,
        rankings.razao_social,
        {{ normalize_company_name('rankings.empresa') }} as n_empresa,
        {{ normalize_company_name('rankings.razao_social') }} as n_razao
    from {{ ref('valor_rankings_2025') }} as rankings
),

flags as (
    select
        flags.rank_2024,
        lpad(cast(flags.cnpj_basico as string), 8, '0') as flags_cnpj_basico
    from {{ ref('top50_flags_seed') }} as flags
),

ranked_with_flags as (
    select
        rankings.ranking_family,
        rankings.valor_rank,
        rankings.empresa,
        rankings.razao_social,
        rankings.n_empresa,
        rankings.n_razao,
        case
            when rankings.ranking_family = 'industrial'
            then flags.flags_cnpj_basico
            else cast(null as string)
        end as flags_cnpj_basico
    from rankings as rankings
    left join flags as flags
        on rankings.ranking_family = 'industrial'
       and rankings.valor_rank = flags.rank_2024
),

cadastro_raw as (
    select
        {{ prefix8_from_cnpj14('cadastro.CNPJ_CIA') }} as cad_cnpj_basico,
        cadastro.DENOM_SOCIAL,
        cadastro.DENOM_COMERC,
        cadastro.SIT,
        {{ normalize_company_name('cadastro.DENOM_SOCIAL') }} as n_social,
        {{ normalize_company_name('cadastro.DENOM_COMERC') }} as n_comerc
    from {{ ref('stg_cvm_cad_cia_aberta') }} as cadastro
),

cadastro as (
    select distinct
        cadastro_raw.cad_cnpj_basico,
        cadastro_raw.DENOM_SOCIAL,
        cadastro_raw.DENOM_COMERC,
        cadastro_raw.SIT,
        cadastro_raw.n_social,
        cadastro_raw.n_comerc
    from cadastro_raw as cadastro_raw
    where cadastro_raw.cad_cnpj_basico is not null
),

key_hits as (
    select
        ranked.ranking_family,
        ranked.valor_rank,
        cadastro.cad_cnpj_basico,
        cadastro.SIT,
        count(*) over (
            partition by ranked.ranking_family, ranked.valor_rank
        ) as hit_count
    from ranked_with_flags as ranked
    inner join cadastro as cadastro
        on ranked.flags_cnpj_basico = cadastro.cad_cnpj_basico
),

key_picked as (
    select
        key_hits.ranking_family,
        key_hits.valor_rank,
        key_hits.cad_cnpj_basico,
        key_hits.SIT
    from key_hits as key_hits
    where key_hits.hit_count = 1
),

name_hits as (
    select
        ranked.ranking_family,
        ranked.valor_rank,
        cadastro.cad_cnpj_basico,
        cadastro.SIT,
        case
            when ranked.n_razao <> '' and ranked.n_razao = cadastro.n_social then 1
            when ranked.n_razao <> '' and ranked.n_razao = cadastro.n_comerc then 2
            when ranked.n_empresa <> '' and ranked.n_empresa = cadastro.n_social then 3
            when ranked.n_empresa <> '' and ranked.n_empresa = cadastro.n_comerc then 4
            when cadastro.n_comerc <> ''
             and length(cadastro.n_comerc) >= 8
             and (
                left(ranked.n_razao, length(cadastro.n_comerc)) = cadastro.n_comerc
                or left(ranked.n_empresa, length(cadastro.n_comerc)) = cadastro.n_comerc
             )
            then 5
            else null
        end as match_rank
    from ranked_with_flags as ranked
    inner join cadastro as cadastro
        on (
            ranked.n_razao <> ''
            and ranked.n_razao = cadastro.n_social
        )
        or (
            ranked.n_razao <> ''
            and ranked.n_razao = cadastro.n_comerc
        )
        or (
            ranked.n_empresa <> ''
            and ranked.n_empresa = cadastro.n_social
        )
        or (
            ranked.n_empresa <> ''
            and ranked.n_empresa = cadastro.n_comerc
        )
        or (
            cadastro.n_comerc <> ''
            and length(cadastro.n_comerc) >= 8
            and (
                left(ranked.n_razao, length(cadastro.n_comerc)) = cadastro.n_comerc
                or left(ranked.n_empresa, length(cadastro.n_comerc)) = cadastro.n_comerc
            )
        )
    where ranked.flags_cnpj_basico is null
),

name_ranked as (
    select
        name_hits.ranking_family,
        name_hits.valor_rank,
        name_hits.cad_cnpj_basico,
        name_hits.SIT,
        name_hits.match_rank,
        row_number() over (
            partition by name_hits.ranking_family, name_hits.valor_rank
            order by
                name_hits.match_rank,
                case when name_hits.SIT = 'ATIVO' then 0 else 1 end,
                name_hits.cad_cnpj_basico
        ) as rn,
        count(*) over (
            partition by
                name_hits.ranking_family,
                name_hits.valor_rank,
                name_hits.match_rank,
                case when name_hits.SIT = 'ATIVO' then 0 else 1 end
        ) as tie_count
    from name_hits as name_hits
    where name_hits.match_rank is not null
),

name_picked as (
    select
        name_ranked.ranking_family,
        name_ranked.valor_rank,
        name_ranked.cad_cnpj_basico,
        name_ranked.SIT
    from name_ranked as name_ranked
    where name_ranked.rn = 1
      and name_ranked.tie_count = 1
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

launch_hit as (
    select
        ranked.ranking_family,
        ranked.valor_rank,
        launch.spec_name,
        launch.is_votorantim_seed
    from ranked_with_flags as ranked
    inner join launch as launch
        on ranked.empresa = launch.match_empresa
        or ranked.razao_social = launch.match_razao
),

known_closed as (
    select
        known_closed.ranking_family,
        known_closed.valor_rank
    from {{ ref('valor_known_closed') }} as known_closed
),

graph as (
    select distinct
        lpad(cast(graph.cnpj_basico as string), 8, '0') as cnpj_basico
    from {{ ref('live_graph_company_cnpj_basicos') }} as graph
),

joined as (
    select
        ranked.empresa as company_name,
        coalesce(
            key_picked.cad_cnpj_basico,
            name_picked.cad_cnpj_basico,
            ranked.flags_cnpj_basico
        ) as cnpj_basico,
        ranked.ranking_family,
        ranked.valor_rank,
        case
            when coalesce(key_picked.SIT, name_picked.SIT) = 'ATIVO' then 'ATIVO'
            when coalesce(key_picked.SIT, name_picked.SIT) = 'CANCELADA' then 'closed'
            when known_closed.valor_rank is not null then 'closed'
            else cast(null as string)
        end as cadastro_situation,
        coalesce(key_picked.SIT, name_picked.SIT) = 'ATIVO' as formulario_hop_raw,
        launch_hit.spec_name is not null as on_launch_add_list_raw,
        launch_hit.is_votorantim_seed as is_votorantim_seed_raw,
        ranked.razao_social
    from ranked_with_flags as ranked
    left join key_picked as key_picked
        on ranked.ranking_family = key_picked.ranking_family
       and ranked.valor_rank = key_picked.valor_rank
    left join name_picked as name_picked
        on ranked.ranking_family = name_picked.ranking_family
       and ranked.valor_rank = name_picked.valor_rank
    left join launch_hit as launch_hit
        on ranked.ranking_family = launch_hit.ranking_family
       and ranked.valor_rank = launch_hit.valor_rank
    left join known_closed as known_closed
        on ranked.ranking_family = known_closed.ranking_family
       and ranked.valor_rank = known_closed.valor_rank
)

select
    joined.company_name,
    joined.cnpj_basico,
    joined.ranking_family,
    joined.valor_rank,
    joined.cadastro_situation,
    {% if target.type == 'duckdb' %}
    cast(graph.cnpj_basico is not null as boolean) as already_on_graph,
    cast(coalesce(joined.formulario_hop_raw, false) as boolean) as formulario_hop,
    cast(coalesce(joined.on_launch_add_list_raw, false) as boolean) as on_launch_add_list,
    cast(coalesce(joined.is_votorantim_seed_raw, false) as boolean) as is_votorantim_seed,
    cast(null as double) as percent,
    {% else %}
    cast(graph.cnpj_basico is not null as bool) as already_on_graph,
    cast(coalesce(joined.formulario_hop_raw, false) as bool) as formulario_hop,
    cast(coalesce(joined.on_launch_add_list_raw, false) as bool) as on_launch_add_list,
    cast(coalesce(joined.is_votorantim_seed_raw, false) as bool) as is_votorantim_seed,
    cast(null as float64) as percent,
    {% endif %}
    joined.razao_social
from joined as joined
left join graph as graph
    on joined.cnpj_basico = graph.cnpj_basico
