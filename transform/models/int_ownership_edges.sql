{{
    config(
        cluster_by=['company_key'] if target.type == 'bigquery' else none
    )
}}

with citations as (
    select * from {{ ref('int_ownership_citations') }}
),

fre_cnpj8 as (
    select distinct left(CNPJ_Companhia, 8) as cnpj8
    from {{ ref('stg_cvm_fre_posicao_acionaria_2026') }}
    where length(CNPJ_Companhia) = 14
),

rf_natureza as (
    select
        lpad({{ digits_only('cnpj_basico') }}, 8, '0') as cnpj_basico,
        lpad({{ digits_only('natureza_juridica') }}, 4, '0') as natureza_juridica
    from {{ source('br_me_cnpj', 'empresas') }}
    where cast(data as date) = cast('{{ var("rf_partition_date") }}' as date)
)

select citations.*
from citations
left join fre_cnpj8
    on citations.fonte = 'qsa'
    and citations.company_key = fre_cnpj8.cnpj8
left join rf_natureza
    on citations.fonte = 'qsa'
    and citations.company_key = rf_natureza.cnpj_basico
where
    citations.fonte = 'fre'
    or (
        citations.fonte = 'qsa'
        and fre_cnpj8.cnpj8 is null
        and coalesce(rf_natureza.natureza_juridica, '') != '2054'
    )
