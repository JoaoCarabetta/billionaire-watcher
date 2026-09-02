{{ config(
    labels={'layer': 'marts'},
    persist_docs={'relation': true, 'columns': true}
) }}

with semente as (
    select
        cnpj,
        razao_social,
        capital_social,
        motivo_entrada_categoria,
        motivo_entrada_descricao,
        motivo_entrada_date
    from {{ ref('int_empresas_semente_a') }}
),

rf_empresa as (
    select
        cnpj_basico,
        razao_social,
        capital_social
    from {{ ref('stg_rf_empresa') }}
    where data = date '{{ var("rf_partition_date") }}'
),

citacao as (
    select
        vinculo.origem_id as cnpj,
        string_agg(
            case
                when vinculo.fonte = 'fre'
                    then 'FRE id_documento ' || coalesce(vinculo.id_documento, '') || ' da companhia ' || vinculo.cnpj
                else 'QSA RF partição {{ var("rf_partition_date") }} da empresa ' || vinculo.cnpj
            end,
            '; '
            order by vinculo.cnpj, vinculo.fonte
        ) as motivo_entrada_descricao,
        min(vinculo.data_referencia) as motivo_entrada_date
    from {{ ref('int_vinculo_propriedade') }} as vinculo
    inner join {{ ref('int_caminhada') }} as caminhada
        on caminhada.cnpj = vinculo.origem_id
        and caminhada.profundidade > 0
    where vinculo.origem_tipo = 'empresa'
    group by vinculo.origem_id
),

via_citacao as (
    select
        vinculo.via_cnpj as cnpj,
        string_agg(
            'FRE Acionista_Relacionado da companhia ' || vinculo.cnpj,
            '; '
            order by vinculo.cnpj
        ) as motivo_entrada_descricao,
        min(vinculo.data_referencia) as motivo_entrada_date
    from {{ ref('int_vinculo_propriedade') }} as vinculo
    inner join {{ ref('int_caminhada') }} as caminhada
        on caminhada.cnpj = vinculo.via_cnpj
        and caminhada.profundidade > 0
    where vinculo.origem_tipo = 'pessoa'
      and vinculo.via_cnpj is not null
      and length(vinculo.via_cnpj) = 14
    group by vinculo.via_cnpj
),

subida as (
    select
        caminhada.cnpj,
        coalesce(rf_empresa.razao_social, vinculo.origem_nome) as razao_social,
        rf_empresa.capital_social,
        'subida' as motivo_entrada_categoria,
        coalesce(
            citacao.motivo_entrada_descricao,
            via_citacao.motivo_entrada_descricao
        ) as motivo_entrada_descricao,
        coalesce(
            citacao.motivo_entrada_date,
            via_citacao.motivo_entrada_date
        ) as motivo_entrada_date
    from {{ ref('int_caminhada') }} as caminhada
    left join semente on semente.cnpj = caminhada.cnpj
    left join rf_empresa on rf_empresa.cnpj_basico = left(caminhada.cnpj, 8)
    left join citacao on citacao.cnpj = caminhada.cnpj
    left join via_citacao on via_citacao.cnpj = caminhada.cnpj
    left join {{ ref('int_vinculo_propriedade') }} as vinculo
        on vinculo.origem_tipo = 'empresa'
        and vinculo.origem_id = caminhada.cnpj
    where caminhada.profundidade > 0
      and semente.cnpj is null
    qualify row_number() over (
        partition by caminhada.cnpj
        order by vinculo.fonte, vinculo.origem_nome
    ) = 1
)

select
    cnpj,
    razao_social,
    capital_social,
    motivo_entrada_categoria,
    motivo_entrada_descricao,
    motivo_entrada_date
from semente

union all

select
    cnpj,
    razao_social,
    capital_social,
    motivo_entrada_categoria,
    motivo_entrada_descricao,
    motivo_entrada_date
from subida
