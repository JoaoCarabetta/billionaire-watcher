{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['cnpj'],
    labels={'layer': 'intermediate'}
) }}
{% else %}
{{ config(labels={'layer': 'intermediate'}) }}
{% endif %}

select
    cnpj,
    origem_id,
    fonte
from {{ ref('int_vinculo_propriedade') }}
where origem_tipo = 'empresa'
  and length(origem_id) = 14
  and origem_id != cnpj
