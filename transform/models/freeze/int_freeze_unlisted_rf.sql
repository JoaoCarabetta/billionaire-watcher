-- int_freeze_unlisted_rf.sql
-- Unlisted controllers from RF QSA
-- CRITICAL: RF QSA is sócios e administradores, NOT shareholder book
-- S.A. QSA is officers, not shareholders
-- Only use if a public act NAMES a PF as Art. 116 controller
-- Otherwise: visible HOLE

with group_flags as (
    select * from {{ ref('stg_group_flags') }}
    where listed_flag = false
      and soe_flag = false
),

rf_socios as (
    select * from {{ ref('stg_rf_socios') }}
),

rf_empresas as (
    select * from {{ ref('stg_rf_empresas') }}
),

-- Join unlisted groups with RF socios
unlisted_socios as (
    select
        gf.rank_2024 as group_rank,
        gf.empresa as group_name,
        gf.cnpj_basico,
        'Valor 1000 FY2024' as ranking_source,
        null as receita_fy2024_brl,
        gf.listed_flag,
        gf.soe_flag,
        gf.controlador_tipo,
        rf.nome as person_name,
        rf.tipo,
        rf.documento as cpf_masked,
        rf.qualificacao,
        emp.natureza_juridica
    from group_flags gf
    inner join rf_socios rf
        on gf.cnpj_basico = rf.cnpj_basico
    left join rf_empresas emp
        on gf.cnpj_basico = emp.cnpj_basico
    where rf.tipo = 'PF' -- Only natural persons
),

-- For unlisted companies, QSA alone is not sufficient to identify Art. 116 controller
-- We can only identify socio relationships from QSA
-- Without a public act naming a PF as controller, we have a HOLE
freeze_rows as (
    select
        group_rank,
        group_name,
        cnpj_basico,
        ranking_source,
        receita_fy2024_brl,
        listed_flag,
        soe_flag,
        controlador_tipo,
        case
            -- For S.A. (natureza 2046, 2054, etc.), QSA is officers not shareholders
            -- Mark as hole unless we have a public act (future enhancement)
            when natureza_juridica in ('2046', '2054', '2038') then null
            -- For other entity types (Ltda, etc.), QSA partners may be meaningful
            -- But still label as socio, never controlador without public act
            else person_name
        end as person_name,
        case
            when natureza_juridica in ('2046', '2054', '2038') then null
            else 'socio_chave'
        end as role,
        case
            when natureza_juridica in ('2046', '2054', '2038') then null
            else 'socio'
        end as edge_label,
        null as acordo_acionistas,
        concat('RF QSA ', cnpj_basico, ' data 2026-01-11') as source_doc,
        null as fre_item,
        case
            -- S.A. QSA is officers, so we have a hole without a public act
            when natureza_juridica in ('2046', '2054', '2038') then true
            -- Non-S.A. we have socio data but still hole for Art. 116 controller
            else true
        end as hole,
        cpf_masked,
        case
            when natureza_juridica in ('2046', '2054', '2038') then 'hole'
            else 'hole'
        end as freeze_status,
        case
            when natureza_juridica in ('2046', '2054', '2038') then 
                'S.A. QSA lists officers, not shareholders. No public act names Art. 116 controller.'
            else 
                'RF QSA partner (sócio) identified. No public act names Art. 116 controller.'
        end as notes
    from unlisted_socios
)

select * from freeze_rows
