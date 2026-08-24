-- int_freeze_unlisted_rf.sql
-- Unlisted controllers from RF QSA
-- CRITICAL: RF QSA is sócios e administradores, NOT shareholder book
-- S.A. QSA is officers, not shareholders
-- QSA names stay OFF the freeze until a public act NAMES a PF as Art. 116 controller
-- Otherwise: visible HOLE (one row per group)

with group_flags as (
    select * from {{ ref('stg_group_flags') }}
    where listed_flag = false
      and soe_flag = false
      and controlador_tipo != 'foreign' -- Foreign unlisted → int_freeze_foreign_hq
),

rf_empresas as (
    select * from {{ ref('stg_rf_empresas') }}
),

-- For unlisted companies, QSA alone is not sufficient to identify Art. 116 controller
-- QSA names stay OFF the freeze until a public act names an Art. 116 controller
-- Emit one hole row per unlisted group, no PF from QSA
freeze_rows as (
    select
        gf.rank_2024 as group_rank,
        gf.empresa as group_name,
        gf.cnpj_basico,
        'Valor 1000 FY2024' as ranking_source,
        null as receita_fy2024_brl,
        gf.listed_flag,
        gf.soe_flag,
        gf.controlador_tipo,
        null as person_name, -- QSA names stay OFF until public act
        null as role,
        null as edge_label,
        null as acordo_acionistas,
        concat('RF QSA ', gf.cnpj_basico, ' data 2026-01-11') as source_doc,
        null as fre_item,
        true as hole, -- Always hole without public act
        null as cpf_masked,
        'hole' as freeze_status,
        case
            when emp.natureza_juridica in ('2046', '2054', '2038') then 
                'S.A. QSA lists officers, not shareholders. No public act names Art. 116 controller.'
            when emp.natureza_juridica = '2062' then
                'Ltda QSA lists partners. No public act names Art. 116 controller.'
            else 
                'RF QSA available. No public act names Art. 116 controller.'
        end as notes
    from group_flags gf
    left join rf_empresas emp
        on gf.cnpj_basico = emp.cnpj_basico
)

select * from freeze_rows
