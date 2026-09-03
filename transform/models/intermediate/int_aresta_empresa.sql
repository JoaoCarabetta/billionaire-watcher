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
  and {{ is_cnpj14('origem_id') }}
  and origem_id != cnpj
