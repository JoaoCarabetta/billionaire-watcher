-- donation_facts.sql
-- TSE campaign donation facts for freeze persons
-- One fact per receipt (person×candidate×cycle receipt grain, matching HTML fixture table)
-- Published facts ONLY for freeze_status=in
-- PJ donations banned since 2016; 2026 is PF/campaign/party only

with freeze_persons as (
    select * from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Published facts only
      and person_name is not null
      and cpf_masked is not null -- Must have CPF to match TSE
),

-- 2026 donations from seed (open cycle, not in BD yet)
tse_2026 as (
    select
        ano,
        nome_candidato,
        nome_doador,
        cpf_doador_masked,
        valor_receita,
        tipo_receita,
        fonte_receita,
        numero_recibo_eleitoral
    from {{ ref('tse_donations_2026') }}
    where ano = 2026
      and fonte_receita = 'Pessoa física' -- PF only (PJ banned since 2016)
      and numero_recibo_eleitoral is not null -- Must have receipt number for source_locator
      and nome_candidato is not null -- Must have candidate name for public facts
),

-- Closed cycles from BD br_tse_eleicoes (2014, 2018, 2022)
-- NOTE: In unit tests, use seed/fixture only. No live BD call.
-- FIX #51: Join receitas_candidato → candidatos for nome_candidato (doesn't exist on receitas)
-- VERIFIED 2026-08-24: origem_receita = 'recursos de pessoas fisicas' (NOT fonte_receita)
-- Receipt coverage: 2014 numero_recibo_eleitoral / 2018 numero_recibo_doacao / 2022 numero_documento_doacao
-- LEFT JOIN to emit named hole when candidatos.nome missing (not silent drop)
tse_closed_cycles as (
    {% if target.name in ('test', 'ci') %}
    -- Unit tests: empty CTE (no live BD calls in tests)
    select
        cast(null as int64) as ano,
        cast(null as string) as nome_candidato,
        cast(null as string) as nome_doador,
        cast(null as string) as cpf_doador_masked,
        cast(null as double) as valor_receita,
        cast(null as string) as tipo_receita,
        cast(null as string) as fonte_receita,
        cast(null as string) as numero_recibo_eleitoral
    where false
    {% else %}
    -- Production: query BD for closed cycles with candidatos LEFT JOIN
    select
        r.ano,
        coalesce(
            c.nome,
            c.nome_urna,
            concat('[candidate name unavailable: ano=', cast(r.ano as string), ' seq=', cast(r.sequencial_candidato as string), ']')
        ) as nome_candidato,
        r.nome_doador,
        r.cpf_cnpj_doador as cpf_doador_masked,
        r.valor_receita,
        cast(null as string) as tipo_receita, -- Not available on receitas_candidato
        r.origem_receita as fonte_receita, -- Map origem_receita to fixture's fonte_receita column
        coalesce(
            r.numero_recibo_eleitoral,
            r.numero_recibo_doacao,
            r.numero_documento_doacao,
            cast(r.sequencial_receita as string)
        ) as numero_recibo_eleitoral
    from {{ source('br_tse_eleicoes', 'receitas_candidato') }} r
    left join {{ source('br_tse_eleicoes', 'candidatos') }} c
        on r.ano = c.ano
        and r.sequencial_candidato = c.sequencial
    where r.ano in (2014, 2018, 2022)
      and r.origem_receita = 'recursos de pessoas fisicas' -- PF only (NOT fonte_receita)
      -- Do NOT filter numero_recibo_eleitoral is not null (would drop 2018/2022)
      -- Do NOT filter candidate name is not null (emit named hole instead)
    {% endif %}
),

all_tse_donations as (
    select * from tse_2026
    union all
    select * from tse_closed_cycles
),

-- FIX #57: Normalize CPF to 11 digits on both sides for matching
-- freeze.cpf_masked is full CPF in format NNN.NNN.NNN-NN (misnamed, not masked)
-- TSE cpf_doador_masked is 11 digits (may have punctuation in 2026 seed)
freeze_normalized as (
    select
        person_name,
        cpf_masked,
        cnpj_basico,
        group_name,
        lpad(regexp_replace(cpf_masked, '[^0-9]', ''), 11, '0') as cpf_digits
    from freeze_persons
),

tse_normalized as (
    select
        ano,
        nome_candidato,
        nome_doador,
        cpf_doador_masked,
        valor_receita,
        tipo_receita,
        numero_recibo_eleitoral,
        lpad(regexp_replace(cpf_doador_masked, '[^0-9]', ''), 11, '0') as cpf_digits
    from all_tse_donations
),

-- Match freeze persons to TSE donations on normalized 11-digit CPF
matched_donations as (
    select
        f.person_name,
        f.cpf_masked,
        f.cnpj_basico,
        f.group_name,
        d.ano,
        d.nome_candidato,
        d.nome_doador,
        d.valor_receita,
        d.tipo_receita,
        d.numero_recibo_eleitoral
    from freeze_normalized f
    inner join tse_normalized d
        on f.cpf_digits = d.cpf_digits
),

donation_facts_base as (
    select
        concat(
            'donation_',
            numero_recibo_eleitoral,
            '_',
            person_name
        ) as fact_id,
        person_name,
        'donation' as fact_kind,
        concat(
            person_name,
            ' doou R$ ',
            cast(valor_receita as string),
            ' para ',
            nome_candidato,
            ' em ',
            cast(ano as string),
            ' (recibo ',
            numero_recibo_eleitoral,
            ')'
        ) as value,
        'Tribunal Superior Eleitoral' as source_publisher,
        concat(
            'TSE Receitas Candidato ',
            cast(ano as string),
            ' recibo ',
            numero_recibo_eleitoral
        ) as source_locator,
        null as source_retrieved_at, -- No fake timestamp
        cpf_masked,
        cnpj_basico,
        group_name
    from matched_donations
    where numero_recibo_eleitoral is not null -- Final guard: drop if no source_locator
)

select
    fact_id,
    person_name,
    fact_kind,
    value,
    source_publisher,
    source_locator,
    source_retrieved_at,
    cpf_masked,
    cnpj_basico,
    group_name
from donation_facts_base
