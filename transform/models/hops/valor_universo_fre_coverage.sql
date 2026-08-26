-- One row per issue #141 hop root. hops_landed when listed incoming
-- capital is in [99.5, 100.5]. Else an explicit hole. Already-on-graph
-- roots stay in the count and skip_redraw is true. No public HTML.

with roots as (
    select * from {{ ref('valor_universo_hop_roots') }} as roots
),

listed as (
    select
        hops.seed_cnpj_basico,
        hops.seed_name,
        hops.pct_capital,
        hops.skip_redraw,
        hops.already_on_graph
    from {{ ref('valor_universo_fre_hops') }} as hops
    where hops.is_listed_hop
),

incoming as (
    select
        listed.seed_cnpj_basico,
        count(*) as listed_hop_count,
        {% if target.type == 'duckdb' %}
        sum(coalesce(listed.pct_capital, 0)) as incoming_pct_capital
        {% else %}
        sum(coalesce(listed.pct_capital, 0)) as incoming_pct_capital
        {% endif %}
    from listed as listed
    group by listed.seed_cnpj_basico
)

select
    roots.company_name,
    roots.cnpj_basico,
    roots.ranking_family,
    roots.valor_rank,
    roots.root_origin,
    {% if target.type == 'duckdb' %}
    cast(coalesce(roots.already_on_graph, false) as boolean) as already_on_graph,
    cast(coalesce(roots.skip_redraw, false) as boolean) as skip_redraw,
    cast(coalesce(roots.is_votorantim_seed, false) as boolean) as is_votorantim_seed,
    {% else %}
    cast(coalesce(roots.already_on_graph, false) as bool) as already_on_graph,
    cast(coalesce(roots.skip_redraw, false) as bool) as skip_redraw,
    cast(coalesce(roots.is_votorantim_seed, false) as bool) as is_votorantim_seed,
    {% endif %}
    coalesce(incoming.listed_hop_count, 0) as listed_hop_count,
    incoming.incoming_pct_capital,
    case
        when roots.cnpj_basico is null then 'hole'
        when incoming.incoming_pct_capital is null then 'hole'
        when incoming.incoming_pct_capital >= 99.5
         and incoming.incoming_pct_capital <= 100.5 then 'hops'
        else 'hole'
    end as hop_status,
    case
        when roots.cnpj_basico is null then 'no_cadastro_key'
        when incoming.incoming_pct_capital is null then 'no_fre_latest'
        when incoming.incoming_pct_capital >= 99.5
         and incoming.incoming_pct_capital <= 100.5 then cast(null as string)
        else 'incoming_not_about_100'
    end as hole_reason
from roots as roots
left join incoming as incoming
    on roots.cnpj_basico = incoming.seed_cnpj_basico
