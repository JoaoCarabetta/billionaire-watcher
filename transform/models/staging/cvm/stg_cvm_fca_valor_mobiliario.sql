{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['id_cnpj'],
    labels={'origin': 'cvm', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'cvm', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('cvm', 'fca_valor_mobiliario_2026') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('CNPJ_Companhia') }} as id_cnpj,
        {{ to_date('Data_Referencia') }} as data_referencia,
        {{ to_int64('Versao') }} as versao,
        {{ clean_string('ID_Documento') }} as id_documento,
        {{ clean_string('Nome_Empresarial') }} as razao_social,
        {{ clean_string('Valor_Mobiliario') }} as tipo_valor_mobiliario,
        {{ clean_string('Sigla_Classe_Acao_Preferencial') }} as sigla_classe_acao_preferencial,
        {{ clean_string('Classe_Acao_Preferencial') }} as classe_acao_preferencial,
        {{ clean_string('Codigo_Negociacao') }} as ticker,
        {{ clean_string('Composicao_BDR_Unit') }} as composicao_bdr_unit,
        {{ clean_string('Mercado') }} as tipo_mercado,
        {{ clean_string('Sigla_Entidade_Administradora') }} as sigla_entidade_administradora,
        {{ clean_string('Entidade_Administradora') }} as nome_entidade_administradora,
        {{ to_date('Data_Inicio_Negociacao') }} as data_inicio_negociacao,
        {{ to_date('Data_Fim_Negociacao') }} as data_fim_negociacao,
        {{ clean_string('Segmento') }} as segmento,
        {{ to_date('Data_Inicio_Listagem') }} as data_inicio_listagem,
        {{ to_date('Data_Fim_Listagem') }} as data_fim_listagem
    from source
)

select * from cleaned
