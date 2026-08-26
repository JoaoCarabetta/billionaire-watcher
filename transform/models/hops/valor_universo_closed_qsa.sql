-- Quadro de Sócios slice for closed Valor rows (issue #141).
-- Sócio only, never dono / UBO. Percent always null. Globo, Record,
-- Havan, and Folha stay groups even when QSA names officers. Closed
-- rows have no Formulário book. Prefix-8 when a key exists. Never
-- invent /0001. No public HTML. No /grafo.

with groups as (
    select groups.empresa
    from {{ ref('valor_group_not_dono') }} as groups
),

inventory as (
    select
        inventory.company_name,
        inventory.cnpj_basico,
        inventory.ranking_family,
        inventory.valor_rank,
        inventory.cadastro_situation,
        inventory.razao_social
    from {{ ref('valor_cadastro_inventory') }} as inventory
),

closed_inventory as (
    select
        inventory.company_name,
        inventory.cnpj_basico,
        inventory.ranking_family,
        inventory.valor_rank,
        inventory.razao_social,
        {% if target.type == 'duckdb' %}
        cast(groups.empresa is not null as boolean) as stay_group
        {% else %}
        cast(groups.empresa is not null as bool) as stay_group
        {% endif %}
    from inventory as inventory
    left join groups as groups
        on inventory.company_name = groups.empresa
    where inventory.cadastro_situation = 'closed'
       or groups.empresa is not null
),

seed_only as (
    select
        groups.empresa as company_name,
        cast(null as string) as cnpj_basico,
        cast(null as string) as ranking_family,
        cast(null as int64) as valor_rank,
        groups.empresa as razao_social,
        {% if target.type == 'duckdb' %}
        cast(true as boolean) as stay_group
        {% else %}
        cast(true as bool) as stay_group
        {% endif %}
    from groups as groups
    left join inventory as inventory
        on inventory.company_name = groups.empresa
    where inventory.company_name is null
),

closed_roots as (
    select * from closed_inventory
    union all
    select * from seed_only
),

roots_with_query as (
    select
        closed_roots.company_name,
        closed_roots.cnpj_basico,
        closed_roots.ranking_family,
        closed_roots.valor_rank,
        closed_roots.razao_social,
        closed_roots.stay_group,
        case
            when closed_roots.cnpj_basico is null then concat(
                'closed group ',
                closed_roots.company_name,
                ': no Cadastro key; Quadro de Socios is socio only, never dono'
            )
            else concat(
                'SELECT tipo, nome, documento, qualificacao, data_entrada_sociedade ',
                'FROM basedosdados.br_me_cnpj.socios WHERE data = DATE ',
                chr(39),
                cast(date '{{ var("rf_partition_date") }}' as string),
                chr(39),
                ' AND LPAD(CAST(cnpj_basico AS STRING), 8, ',
                chr(39),
                '0',
                chr(39),
                ') = ',
                chr(39),
                closed_roots.cnpj_basico,
                chr(39)
            )
        end as source_query
    from closed_roots as closed_roots
),

keyed as (
    select * from roots_with_query as roots
    where roots.cnpj_basico is not null
),

filtered_socios as (
    select
        keyed.company_name,
        keyed.cnpj_basico,
        keyed.ranking_family,
        keyed.valor_rank,
        keyed.razao_social,
        keyed.stay_group,
        keyed.source_query,
        cast(socios.tipo as string) as tipo,
        socios.nome,
        socios.documento,
        socios.qualificacao,
        socios.data_entrada_sociedade
    from {{ source('br_me_cnpj', 'socios') }} as socios
    inner join keyed as keyed
        on lpad(cast(socios.cnpj_basico as string), 8, '0') = keyed.cnpj_basico
    where socios.data = date '{{ var("rf_partition_date") }}'
),

partner_rows as (
    select
        socios.company_name,
        socios.cnpj_basico,
        socios.ranking_family,
        socios.valor_rank,
        socios.razao_social,
        socios.stay_group,
        socios.tipo,
        socios.nome,
        socios.documento,
        socios.qualificacao,
        socios.data_entrada_sociedade,
        'socio' as edge_role,
        {% if target.type == 'duckdb' %}
        cast(null as double) as percent,
        {% else %}
        cast(null as float64) as percent,
        {% endif %}
        count(*) over (partition by socios.company_name, socios.cnpj_basico) as partner_count,
        socios.source_query
    from filtered_socios as socios
),

empty_keyed as (
    select
        keyed.company_name,
        keyed.cnpj_basico,
        keyed.ranking_family,
        keyed.valor_rank,
        keyed.razao_social,
        keyed.stay_group,
        cast(null as string) as tipo,
        cast(null as string) as nome,
        cast(null as string) as documento,
        cast(null as string) as qualificacao,
        cast(null as date) as data_entrada_sociedade,
        'socio' as edge_role,
        {% if target.type == 'duckdb' %}
        cast(null as double) as percent,
        {% else %}
        cast(null as float64) as percent,
        {% endif %}
        0 as partner_count,
        keyed.source_query
    from keyed as keyed
    where not exists (
        select 1
        from filtered_socios as socios
        where socios.company_name = keyed.company_name
          and socios.cnpj_basico = keyed.cnpj_basico
    )
),

empty_unkeyed as (
    select
        roots.company_name,
        roots.cnpj_basico,
        roots.ranking_family,
        roots.valor_rank,
        roots.razao_social,
        roots.stay_group,
        cast(null as string) as tipo,
        cast(null as string) as nome,
        cast(null as string) as documento,
        cast(null as string) as qualificacao,
        cast(null as date) as data_entrada_sociedade,
        'socio' as edge_role,
        {% if target.type == 'duckdb' %}
        cast(null as double) as percent,
        {% else %}
        cast(null as float64) as percent,
        {% endif %}
        0 as partner_count,
        roots.source_query
    from roots_with_query as roots
    where roots.cnpj_basico is null
)

select * from partner_rows
union all
select * from empty_keyed
union all
select * from empty_unkeyed
