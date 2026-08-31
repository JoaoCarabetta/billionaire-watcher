{{ config(labels={'origin': 'bcb', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('bcb', 'entidades_supervisionadas') }}
),

cleaned as (
    select
        {{ to_date('database') }} as data_base,
        {{ cnpj14('codigoCNPJ14') }} as id_cnpj,
        {{ cnpj8('codigoCNPJ8') }} as cnpj_basico,
        {{ clean_string('nomeEntidadeInteresse') }} as nome,
        {{ clean_string('codigoTipoSituacaoPessoaJuridica') }} as tipo_situacao,
        {{ clean_string('codigoTipoEntidadeSupervisionada') }} as tipo_entidade
    from source
)

select * from cleaned
