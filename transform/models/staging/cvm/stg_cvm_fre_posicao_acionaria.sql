{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['id_cnpj'],
    labels={'origin': 'cvm', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'cvm', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('cvm', 'fre_posicao_acionaria_2026') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('CNPJ_Companhia') }} as id_cnpj,
        {{ to_date('Data_Referencia') }} as data_referencia,
        {{ to_int64('Versao') }} as versao,
        {{ clean_string('ID_Documento') }} as id_documento,
        {{ clean_string('Nome_Companhia') }} as nome_companhia,
        {{ clean_string('ID_Acionista') }} as id_acionista,
        {{ clean_string('Acionista') }} as nome_acionista,
        {{ clean_string('Tipo_Pessoa_Acionista') }} as tipo_pessoa_acionista,
        {{ documento_identificador('CPF_CNPJ_Acionista') }} as documento_acionista,
        {{ clean_string('ID_Acionista_Relacionado') }} as id_acionista_relacionado,
        {{ clean_string('Acionista_Relacionado') }} as nome_acionista_relacionado,
        {{ clean_string('Tipo_Pessoa_Acionista_Relacionado') }} as tipo_pessoa_acionista_relacionado,
        {{ documento_identificador('CPF_CNPJ_Acionista_Relacionado') }} as documento_acionista_relacionado,
        {{ to_int64('Quantidade_Acao_Ordinaria_Circulacao') }} as quantidade_acao_ordinaria_circulacao,
        {{ to_float64('Percentual_Acao_Ordinaria_Circulacao') }} as proporcao_acao_ordinaria_circulacao,
        {{ to_int64('Quantidade_Acao_Preferencial_Circulacao') }} as quantidade_acao_preferencial_circulacao,
        {{ to_float64('Percentual_Acao_Preferencial_Circulacao') }} as proporcao_acao_preferencial_circulacao,
        {{ to_int64('Quantidade_Total_Acoes_Circulacao') }} as quantidade_total_acao_circulacao,
        {{ to_float64('Percentual_Total_Acoes_Circulacao') }} as proporcao_total_acao_circulacao,
        {{ clean_string('Nacionalidade') }} as nacionalidade,
        {{ clean_string('Sigla_UF') }} as sigla_uf,
        {{ clean_string('Residente_Exterior') }} as indicador_residente_exterior,
        {{ clean_string('Representante_Legal') }} as nome_representante_legal,
        {{ clean_string('Tipo_Pessoa_Representante_Legal') }} as tipo_pessoa_representante_legal,
        {{ documento_identificador('CPF_CNPJ_Representante_legal') }} as documento_representante_legal,
        {{ clean_string('Data_Composicao_Capital_Social') }} as data_composicao_capital_social,
        {{ to_date('Data_Ultima_Alteracao') }} as data_ultima_alteracao,
        {{ clean_string('Acionista_Controlador') }} as indicador_acionista_controlador,
        {{ clean_string('Participante_Acordo_Acionistas') }} as indicador_participante_acordo_acionistas
    from source
)

select * from cleaned
