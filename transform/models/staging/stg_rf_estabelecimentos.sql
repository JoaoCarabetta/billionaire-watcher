-- stg_rf_estabelecimentos.sql
-- RF CNPJ estabelecimentos staging model
-- Source: basedosdados.br_me_cnpj.estabelecimentos
-- Restricted to freeze-chain CNPJs and partition date 2026-01-11

with source as (
    select * from {{ source('br_me_cnpj', 'estabelecimentos') }}
),

freeze_cnpjs as (
    select cnpj_basico from {{ ref('freeze_cnpj_basicos') }}
),

filtered as (
    select
        source.ano,
        source.mes,
        source.data,
        lpad(cast(source.cnpj as string), 14, '0') as cnpj,
        lpad(cast(source.cnpj_basico as string), 8, '0') as cnpj_basico,
        source.cnpj_ordem,
        source.cnpj_dv,
        source.identificador_matriz_filial,
        source.nome_fantasia,
        source.situacao_cadastral,
        source.data_situacao_cadastral,
        source.motivo_situacao_cadastral,
        source.nome_cidade_exterior,
        source.id_pais,
        source.data_inicio_atividade,
        source.cnae_fiscal_principal,
        source.cnae_fiscal_secundaria,
        source.sigla_uf,
        source.id_municipio,
        source.id_municipio_rf,
        source.tipo_logradouro,
        source.logradouro,
        source.numero,
        source.complemento,
        source.bairro,
        source.cep,
        source.ddd_1,
        source.telefone_1,
        source.ddd_2,
        source.telefone_2,
        source.ddd_fax,
        source.fax,
        source.email,
        source.situacao_especial,
        source.data_situacao_especial
    from source
    inner join freeze_cnpjs
        on lpad(cast(source.cnpj_basico as string), 8, '0') = freeze_cnpjs.cnpj_basico
    where source.data = date '{{ var("rf_partition_date") }}'
)

select * from filtered
