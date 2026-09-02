{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['cnpj'],
    labels={'layer': 'intermediate'}
) }}
{% else %}
{{ config(labels={'layer': 'intermediate'}) }}
{% endif %}

with fre as (
    select * from {{ ref('stg_cvm_fre_posicao_acionaria') }}
),

recente as (
    select
        id_cnpj as cnpj,
        max(id_documento) as id_documento
    from fre
    where id_cnpj is not null
      and id_documento is not null
    group by id_cnpj
)

select
    fre.id_cnpj as cnpj,
    fre.id_documento,
    fre.data_referencia,
    fre.id_acionista,
    fre.nome_acionista,
    fre.tipo_pessoa_acionista,
    fre.documento_acionista,
    fre.proporcao_acao_ordinaria_circulacao,
    fre.proporcao_total_acao_circulacao,
    fre.indicador_acionista_controlador,
    fre.indicador_participante_acordo_acionistas,
    fre.nome_acionista_relacionado,
    fre.documento_acionista_relacionado
from fre
inner join recente
    on fre.id_cnpj = recente.cnpj
    and fre.id_documento = recente.id_documento
where fre.nome_acionista is not null
