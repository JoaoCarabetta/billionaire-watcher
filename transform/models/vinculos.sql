with
{{ ownership_edges_from_int() }},

{{ company_walk_from_int() }},

{{ walked_ownership_edges_cte() }},

{{ downward_hop_ctes('walked_ownership_edges') }},

all_person_edges as (
    select
        cited_empresa_id,
        owner_name,
        owner_cpf,
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

    union all

    select
        cited_empresa_id,
        owner_name,
        owner_cpf,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        data_referencia,
        fonte_documento
    from downward_hop_person_edges
),

raw_vinculos as (
    select
        'pessoa' as origem_tipo,
        case
            when owner_cpf is not null
                then {{ person_id_from_cpf('owner_cpf') }}
            else {{ provisional_person_id('owner_name', 'cited_empresa_id') }}
        end as origem_pessoa_id,
        cast(null as string) as origem_empresa_id,
        cited_empresa_id as destino_empresa_id,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        data_referencia,
        fonte_documento
    from all_person_edges

    union all

    select
        'empresa' as origem_tipo,
        cast(null as string) as origem_pessoa_id,
        owner_company_id as origem_empresa_id,
        cited_empresa_id as destino_empresa_id,
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
    where owner_kind = 'empresa' and owner_company_id is not null
)

select
    origem_tipo,
    origem_pessoa_id,
    origem_empresa_id,
    destino_empresa_id,
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
from raw_vinculos
group by
    origem_tipo,
    origem_pessoa_id,
    origem_empresa_id,
    destino_empresa_id,
    fonte,
    data_referencia
