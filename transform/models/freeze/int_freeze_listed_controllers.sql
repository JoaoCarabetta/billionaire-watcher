-- int_freeze_listed_controllers.sql
-- Walk FRE 6.1 Acionista_Controlador=S to natural persons
-- Source: stg_cvm_fre_posicao_acionaria_2026 + stg_group_flags
-- IMPORTANT: Every listed non-SOE group must emit at least one row.
-- Missing controller = visible HOLE, not absent row.

with group_flags as (
    select * from {{ ref('stg_group_flags') }}
    where listed_flag = true
      and soe_flag = false
),

fre_positions as (
    select * from {{ ref('stg_cvm_fre_posicao_acionaria_2026') }}
),

-- Find controlling shareholders (Acionista_Controlador=S) for listed groups
controlling_shareholders as (
    select
        gf.rank_2024 as group_rank,
        gf.empresa as group_name,
        gf.cnpj_basico,
        'Valor 1000 FY2024' as ranking_source,
        null as receita_fy2024_brl, -- TODO: add when revenue data available
        gf.listed_flag,
        gf.soe_flag,
        gf.controlador_tipo,
        fre.ID_Acionista,
        fre.Acionista,
        fre.Tipo_Pessoa_Acionista,
        fre.CPF_CNPJ_Acionista,
        fre.ID_Acionista_Relacionado,
        fre.Acionista_Relacionado,
        fre.Tipo_Pessoa_Acionista_Relacionado,
        fre.CPF_CNPJ_Acionista_Relacionado,
        fre.Participante_Acordo_Acionistas,
        fre.CNPJ_Companhia,
        fre.Data_Referencia
    from group_flags gf
    left join fre_positions fre
        on gf.cnpj_full = fre.CNPJ_Companhia
        and fre.Acionista_Controlador = 'S'
),

-- Walk Acionista_Relacionado to find natural persons
-- If Tipo_Pessoa_Acionista_Relacionado = 'PF', we have the natural person
-- Otherwise this is a PJ in the chain (would need recursive walk, marked as hole for now)
-- If no FRE row at all (ID_Acionista is null), mark as hole
natural_person_controllers as (
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
            -- No FRE controlling shareholder found at all
            when ID_Acionista is null then null
            -- If the relacionado is a natural person, use it
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then Acionista_Relacionado
            -- If the direct acionista is a natural person (no relacionado), use it
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then Acionista
            -- Otherwise we have a PJ without a named PF, mark as hole
            else null
        end as person_name,
        case
            when ID_Acionista is null then null
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then 'controlador'
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then 'controlador'
            else null
        end as role,
        case
            when ID_Acionista is null then null
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then 'acionista_controlador'
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then 'acionista_controlador'
            else null
        end as edge_label,
        Participante_Acordo_Acionistas as acordo_acionistas,
        case
            when ID_Acionista is null then concat('CVM FRE 2026 item 6.1 CNPJ ', cnpj_basico, ': empty')
            else concat(
                'CVM FRE 2026 item 6.1 CNPJ ',
                CNPJ_Companhia,
                ' ref ',
                cast(Data_Referencia as string)
            )
        end as source_doc,
        '6.1' as fre_item,
        case
            when ID_Acionista is null then true
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then false
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then false
            else true
        end as hole,
        case
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then CPF_CNPJ_Acionista_Relacionado
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then CPF_CNPJ_Acionista
            else null
        end as cpf_masked,
        case
            when ID_Acionista is null then 'hole'
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then 'in'
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then 'in'
            else 'hole'
        end as freeze_status,
        case
            when ID_Acionista is null then 'FRE 6.1 empty: no Acionista_Controlador=S found'
            when Tipo_Pessoa_Acionista_Relacionado = 'PF' then 'FRE 6.1 walk to PF'
            when Tipo_Pessoa_Acionista = 'PF' and Acionista_Relacionado is null then 'FRE 6.1 direct PF'
            else 'FRE 6.1 chain ends at PJ without named PF controller'
        end as notes
    from controlling_shareholders
),

-- Keep all rows with named PF (freeze_status='in')
named_pf_rows as (
    select * from natural_person_controllers
    where person_name is not null
),

-- For groups with zero named PF, emit exactly one hole row
groups_with_named_pf as (
    select distinct cnpj_basico
    from named_pf_rows
),

hole_rows as (
    select
        npc.group_rank,
        npc.group_name,
        npc.cnpj_basico,
        npc.ranking_source,
        npc.receita_fy2024_brl,
        npc.listed_flag,
        npc.soe_flag,
        npc.controlador_tipo,
        cast(null as string) as person_name,
        cast(null as string) as role,
        cast(null as string) as edge_label,
        cast(null as string) as acordo_acionistas,
        npc.source_doc,
        npc.fre_item,
        true as hole,
        cast(null as string) as cpf_masked,
        'hole' as freeze_status,
        npc.notes
    from (
        select
            group_rank,
            group_name,
            cnpj_basico,
            ranking_source,
            receita_fy2024_brl,
            listed_flag,
            soe_flag,
            controlador_tipo,
            min(source_doc) as source_doc,
            min(fre_item) as fre_item,
            min(notes) as notes
        from natural_person_controllers
        group by 1, 2, 3, 4, 5, 6, 7, 8
    ) npc
    left join groups_with_named_pf gwpf
        on npc.cnpj_basico = gwpf.cnpj_basico
    where gwpf.cnpj_basico is null
),

final_rows as (
    select * from named_pf_rows
    union all
    select * from hole_rows
)

select * from final_rows
