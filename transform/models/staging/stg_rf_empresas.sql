-- stg_rf_empresas.sql
-- RF CNPJ empresas staging model
-- Source: basedosdados.br_me_cnpj.empresas
-- Restricted to freeze-chain CNPJs and partition date 2026-01-11

with source as (
    select * from {{ source('br_me_cnpj', 'empresas') }}
),

freeze_cnpjs as (
    select cnpj_basico from {{ ref('freeze_cnpj_basicos') }}
),

filtered as (
    select
        source.ano,
        source.mes,
        source.data,
        lpad(cast(source.cnpj_basico as string), 8, '0') as cnpj_basico,
        source.razao_social,
        source.natureza_juridica,
        source.qualificacao_responsavel,
        source.capital_social,
        source.porte,
        source.ente_federativo
    from source
    inner join freeze_cnpjs
        on lpad(cast(source.cnpj_basico as string), 8, '0') = freeze_cnpjs.cnpj_basico
    where source.data = date '{{ var("rf_partition_date") }}'
)

select * from filtered
