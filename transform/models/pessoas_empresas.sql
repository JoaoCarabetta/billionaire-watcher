with recursive
{{ ownership_edge_ctes() }},

walk_roots as (
    select root_empresa_id
    from {{ ref('int_walk_roots') }}
),

{{ ownership_walk_ctes('walk_roots') }},

person_edges as (
    select
        case
            when owner_cpf is not null
                then {{ person_id_from_cpf('owner_cpf') }}
            else {{ provisional_person_id('owner_name', 'cited_empresa_id') }}
        end as pessoa_id,
        cited_empresa_id as empresa_id,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        data_referencia,
        fonte_documento
    from walked_ownership_edges
    where owner_kind = 'pessoa'
)

select
    pessoa_id,
    empresa_id,
    case
        when max(case when papel = 'acionista_controlador' then 1 else 0 end) = 1
            then 'acionista_controlador'
        else max(papel)
    end as papel,
    fonte,
    case
        when fonte = 'fre' then
            max(case when acionista_controlador then 1 else 0 end) = 1
    end as acionista_controlador,
    case
        when fonte = 'fre' then
            max(case when participante_acordo_acionistas then 1 else 0 end) = 1
    end as participante_acordo_acionistas,
    max(percentual_on) as percentual_on,
    max(percentual_total) as percentual_total,
    max(qualificacao) as qualificacao,
    data_referencia,
    max(fonte_documento) as fonte_documento
from person_edges
group by
    pessoa_id,
    empresa_id,
    fonte,
    data_referencia
