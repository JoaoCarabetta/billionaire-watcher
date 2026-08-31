{{ config(labels={'origin': 'bcb', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('bcb', 'ifdata_ativo_total_prudencial') }}
),

cleaned as (
    select
        {{ clean_string('AnoMes') }} as ano_mes,
        {{ to_int64('TipoInstituicao') }} as tipo_instituicao,
        {{ clean_string('CodInst') }} as id_instituicao,
        {{ clean_string('NumeroRelatorio') }} as numero_relatorio,
        {{ clean_string('Conta') }} as conta,
        {{ clean_string('NomeColuna') }} as nome_conta,
        {{ to_numeric('Saldo') }} as saldo
    from source
)

select * from cleaned
