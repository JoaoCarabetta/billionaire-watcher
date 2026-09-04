{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['cnpj'],
    labels={'layer': 'intermediate'}
) }}
{% else %}
{{ config(labels={'layer': 'intermediate'}) }}
{% endif %}

with {% if target.type == 'bigquery' %}recursive {% endif %}
passo as (
    select
        cnpj,
        origem_id,
        fonte
    from {{ ref('int_aresta_empresa') }}

    union all

    select
        cnpj,
        via_cnpj as origem_id,
        'via' as fonte
    from {{ ref('int_vinculo_propriedade') }}
    where origem_tipo = 'pessoa'
      and {{ is_cnpj14('via_cnpj') }}
      and via_cnpj != cnpj
),

seed as (
    select
        cnpj,
        0 as profundidade,
        cast(null as string) as cnpj_origem,
        'semente' as fonte_chegada
    from {{ ref('int_empresas_semente_a') }}
    where cnpj is not null
),

{% if target.type == 'bigquery' %}
walk as (
    select
        cnpj,
        profundidade,
        cnpj_origem,
        fonte_chegada
    from seed

    union all

    select
        passo.origem_id as cnpj,
        walk.profundidade + 1 as profundidade,
        walk.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from walk
    inner join passo
        on passo.cnpj = walk.cnpj
    where walk.profundidade < 8
      and passo.origem_id != walk.cnpj
)
{% else %}
h0 as (
    select * from seed
),

h1 as (
    select
        passo.origem_id as cnpj,
        1 as profundidade,
        h0.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h0
    inner join passo
        on passo.cnpj = h0.cnpj
    left join h0 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h0.cnpj
      and ja.cnpj is null
),

vistas_1 as (
    select cnpj from h0
    union all
    select cnpj from h1
),

h2 as (
    select
        passo.origem_id as cnpj,
        2 as profundidade,
        h1.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h1
    inner join passo
        on passo.cnpj = h1.cnpj
    left join vistas_1 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h1.cnpj
      and ja.cnpj is null
),

vistas_2 as (
    select cnpj from vistas_1
    union all
    select cnpj from h2
),

h3 as (
    select
        passo.origem_id as cnpj,
        3 as profundidade,
        h2.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h2
    inner join passo
        on passo.cnpj = h2.cnpj
    left join vistas_2 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h2.cnpj
      and ja.cnpj is null
),

vistas_3 as (
    select cnpj from vistas_2
    union all
    select cnpj from h3
),

h4 as (
    select
        passo.origem_id as cnpj,
        4 as profundidade,
        h3.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h3
    inner join passo
        on passo.cnpj = h3.cnpj
    left join vistas_3 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h3.cnpj
      and ja.cnpj is null
),

vistas_4 as (
    select cnpj from vistas_3
    union all
    select cnpj from h4
),

h5 as (
    select
        passo.origem_id as cnpj,
        5 as profundidade,
        h4.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h4
    inner join passo
        on passo.cnpj = h4.cnpj
    left join vistas_4 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h4.cnpj
      and ja.cnpj is null
),

vistas_5 as (
    select cnpj from vistas_4
    union all
    select cnpj from h5
),

h6 as (
    select
        passo.origem_id as cnpj,
        6 as profundidade,
        h5.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h5
    inner join passo
        on passo.cnpj = h5.cnpj
    left join vistas_5 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h5.cnpj
      and ja.cnpj is null
),

vistas_6 as (
    select cnpj from vistas_5
    union all
    select cnpj from h6
),

h7 as (
    select
        passo.origem_id as cnpj,
        7 as profundidade,
        h6.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h6
    inner join passo
        on passo.cnpj = h6.cnpj
    left join vistas_6 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h6.cnpj
      and ja.cnpj is null
),

vistas_7 as (
    select cnpj from vistas_6
    union all
    select cnpj from h7
),

h8 as (
    select
        passo.origem_id as cnpj,
        8 as profundidade,
        h7.cnpj as cnpj_origem,
        passo.fonte as fonte_chegada
    from h7
    inner join passo
        on passo.cnpj = h7.cnpj
    left join vistas_7 as ja
        on ja.cnpj = passo.origem_id
    where passo.origem_id != h7.cnpj
      and ja.cnpj is null
),

walk as (
    select * from h0
    union all
    select * from h1
    union all
    select * from h2
    union all
    select * from h3
    union all
    select * from h4
    union all
    select * from h5
    union all
    select * from h6
    union all
    select * from h7
    union all
    select * from h8
)
{% endif %}

select
    cnpj,
    profundidade,
    cnpj_origem,
    fonte_chegada
from walk
qualify row_number() over (
    partition by cnpj
    order by profundidade, cnpj_origem, fonte_chegada
) = 1
