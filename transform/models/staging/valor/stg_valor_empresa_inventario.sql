{{ config(labels={'origin': 'valor', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('valor', 'controle_empresas_walk') }}
),

cleaned as (
    select
        2025 as ano,
        {{ clean_string('identificador') }} as identificador,
        case
            when length({{ digits_only('identificador') }}) = 14
                then lpad({{ digits_only('identificador') }}, 14, '0')
            else cast(null as string)
        end as id_cnpj,
        {{ clean_string('nome') }} as nome,
        {{ clean_string('tipo_societario') }} as tipo_societario,
        {{ clean_string('no_grafo') }} as indicador_grafo,
        {{ clean_string('porque') }} as motivo,
        {{ clean_string('situacao_do_passeio') }} as situacao_passeio,
        {{ clean_string('no_formulario') }} as indicador_formulario,
        {{ clean_string('notas') }} as notas
    from source
)

select * from cleaned
