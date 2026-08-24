-- stg_rf_socios.sql
-- RF CNPJ sócios staging model
-- Source: basedosdados.br_me_cnpj.socios
-- Restricted to freeze-chain CNPJs and partition date 2026-01-11

with source as (
    select * from {{ source('br_me_cnpj', 'socios') }}
),

freeze_cnpjs as (
    select cnpj_basico from {{ ref('nonexistent_model_that_does_not_exist') }}
),

filtered as (
    select
        source.ano,
        source.mes,
        source.data,
        lpad(cast(source.cnpj_basico as string), 8, '0') as cnpj_basico,
        source.tipo,
        source.nome,
        source.documento,
        source.qualificacao,
        source.data_entrada_sociedade,
        source.id_pais,
        source.cpf_representante_legal,
        source.nome_representante_legal,
        source.qualificacao_representante_legal,
        source.faixa_etaria
    from source
    inner join freeze_cnpjs
        on lpad(cast(source.cnpj_basico as string), 8, '0') = freeze_cnpjs.cnpj_basico
    where source.data = date '{{ var("rf_partition_date") }}'
)

select * from filtered
