{{ config(materialized='view') }}

select
    origem_pessoa_id as pessoa_id,
    destino_empresa_id as empresa_id,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    data_referencia,
    fonte_documento
from {{ ref('vinculos') }}
where origem_tipo = 'pessoa'
