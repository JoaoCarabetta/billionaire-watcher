-- int_match_freeze_to_control_edges.sql
-- Match freeze persons to control-chain CNPJs from RF socios
-- Maps freeze_persons_with_forbes → RF edges (cnpj_basico already on freeze rows)
-- DO NOT name-only add people. DO NOT scan full Brazil RF.

with freeze_persons as (
    select * from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Only match published freeze persons
),

rf_socios as (
    select * from {{ ref('stg_rf_socios') }}
    where tipo = 'PF' -- Natural persons only
),

rf_empresas as (
    select * from {{ ref('stg_rf_empresas') }}
),

-- Attach RF socios for CNPJs already in freeze rows
freeze_person_control_edges as (
    select
        fp.person_name,
        fp.cnpj_basico,
        fp.group_name,
        fp.role,
        fp.edge_label as freeze_edge_label,
        fp.source_doc as freeze_source_doc,
        fp.cpf_masked,
        -- RF edge details (if person is in RF socios for this CNPJ)
        rf.nome as rf_nome,
        rf.qualificacao,
        rf.data_entrada_sociedade,
        -- Company details
        emp.razao_social,
        -- Generate control edge metadata
        concat('rf_control_', fp.cnpj_basico, '_', fp.person_name) as control_edge_id
    from freeze_persons fp
    left join rf_socios rf
        on fp.cnpj_basico = rf.cnpj_basico
        and upper(fp.person_name) = upper(rf.nome)
    left join rf_empresas emp
        on fp.cnpj_basico = emp.cnpj_basico
    where fp.freeze_status = 'in'
      and fp.person_name is not null
)

select * from freeze_person_control_edges
