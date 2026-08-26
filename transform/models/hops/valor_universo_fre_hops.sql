-- Hop-correct Formulário extract for issue #141 ATIVO hop roots.
-- Latest ID_Documento only. Direct holders point at the listed seed
-- (incoming capital about 100). A related name points at the named
-- parent, not at the listed seed. Prefix-8 company keys. Eleven-digit
-- documents are persons (name key), never a padded /0001 Cadastro.
-- Closed groups have no FRE book. Already-on-graph roots still extract
-- hops but skip_redraw stays true. No public HTML. No /grafo.

with roots as (
    select
        roots.company_name,
        roots.cnpj_basico,
        roots.already_on_graph,
        roots.skip_redraw,
        roots.is_votorantim_seed,
        roots.razao_social
    from {{ ref('valor_universo_hop_roots') }} as roots
    where roots.cnpj_basico is not null
),

fre as (
    select
        {{ prefix8_from_cnpj14('fre.CNPJ_Companhia') }} as fre_cnpj_basico,
        fre.CNPJ_Companhia,
        fre.ID_Documento,
        fre.Data_Referencia,
        fre.ID_Acionista,
        fre.Acionista,
        fre.Tipo_Pessoa_Acionista,
        fre.CPF_CNPJ_Acionista,
        fre.ID_Acionista_Relacionado,
        fre.Acionista_Relacionado,
        fre.Tipo_Pessoa_Acionista_Relacionado,
        fre.CPF_CNPJ_Acionista_Relacionado,
        fre.Quantidade_Acao_Ordinaria_Circulacao,
        fre.Percentual_Acao_Ordinaria_Circulacao,
        fre.Quantidade_Acao_Preferencial_Circulacao,
        fre.Percentual_Acao_Preferencial_Circulacao,
        fre.Quantidade_Total_Acoes_Circulacao,
        fre.Percentual_Total_Acoes_Circulacao
    from {{ ref('stg_cvm_fre_posicao_acionaria_2026') }} as fre
    where {{ prefix8_from_cnpj14('fre.CNPJ_Companhia') }} is not null
),

latest_doc as (
    select
        fre.fre_cnpj_basico,
        max(fre.ID_Documento) as ID_Documento
    from fre as fre
    inner join roots as roots
        on fre.fre_cnpj_basico = roots.cnpj_basico
    group by fre.fre_cnpj_basico
),

latest as (
    select
        roots.company_name as seed_name,
        roots.cnpj_basico as seed_cnpj_basico,
        roots.already_on_graph,
        roots.skip_redraw,
        roots.is_votorantim_seed,
        fre.ID_Documento,
        fre.Data_Referencia,
        fre.ID_Acionista,
        fre.Acionista,
        fre.CPF_CNPJ_Acionista,
        fre.ID_Acionista_Relacionado,
        fre.Acionista_Relacionado,
        fre.CPF_CNPJ_Acionista_Relacionado,
        fre.Quantidade_Acao_Ordinaria_Circulacao,
        fre.Percentual_Acao_Ordinaria_Circulacao,
        fre.Quantidade_Acao_Preferencial_Circulacao,
        fre.Percentual_Acao_Preferencial_Circulacao,
        fre.Quantidade_Total_Acoes_Circulacao,
        fre.Percentual_Total_Acoes_Circulacao
    from fre as fre
    inner join latest_doc as latest_doc
        on fre.fre_cnpj_basico = latest_doc.fre_cnpj_basico
       and fre.ID_Documento = latest_doc.ID_Documento
    inner join roots as roots
        on fre.fre_cnpj_basico = roots.cnpj_basico
),

listed_ranked as (
    select
        latest.*,
        row_number() over (
            partition by latest.seed_cnpj_basico, latest.ID_Acionista
            order by
                case when latest.ID_Acionista_Relacionado is null then 0 else 1 end,
                latest.ID_Acionista_Relacionado
        ) as rn
    from latest as latest
),

listed_hops as (
    select
        listed.seed_name,
        listed.seed_cnpj_basico,
        {{ hop_holder_id('listed.Acionista', 'listed.CPF_CNPJ_Acionista', 'listed.seed_cnpj_basico', 'listed.ID_Acionista') }} as from_id,
        listed.seed_cnpj_basico as to_id,
        {{ hop_holder_kind('listed.Acionista', 'listed.CPF_CNPJ_Acionista') }} as from_kind,
        listed.Acionista as from_name,
        'company' as to_kind,
        listed.seed_name as to_name,
        'participacao' as edge_kind,
        cast(null as string) as edge_role,
        listed.Percentual_Total_Acoes_Circulacao as pct_capital,
        listed.Percentual_Acao_Ordinaria_Circulacao as pct_votos,
        listed.Quantidade_Acao_Ordinaria_Circulacao as qty_ordinarias,
        listed.Quantidade_Acao_Preferencial_Circulacao as qty_preferenciais,
        {% if target.type == 'duckdb' %}
        cast(true as boolean) as is_listed_hop,
        {% else %}
        cast(true as bool) as is_listed_hop,
        {% endif %}
        listed.ID_Documento,
        listed.ID_Acionista,
        listed.ID_Acionista_Relacionado,
        concat('CVM FRE 2026 item 6.1 ID_Documento ', cast(listed.ID_Documento as string)) as source_doc,
        concat('ID_Acionista ', cast(listed.ID_Acionista as string)) as source_locator,
        listed.Data_Referencia as source_retrieved_at,
        listed.already_on_graph,
        listed.skip_redraw,
        listed.is_votorantim_seed
    from listed_ranked as listed
    where listed.rn = 1
),

nested_hops as (
    select
        latest.seed_name,
        latest.seed_cnpj_basico,
        {{ hop_holder_id('latest.Acionista_Relacionado', 'latest.CPF_CNPJ_Acionista_Relacionado', 'latest.seed_cnpj_basico', 'latest.ID_Acionista_Relacionado') }} as from_id,
        {{ hop_holder_id('latest.Acionista', 'latest.CPF_CNPJ_Acionista', 'latest.seed_cnpj_basico', 'latest.ID_Acionista') }} as to_id,
        {{ hop_holder_kind('latest.Acionista_Relacionado', 'latest.CPF_CNPJ_Acionista_Relacionado') }} as from_kind,
        latest.Acionista_Relacionado as from_name,
        {{ hop_holder_kind('latest.Acionista', 'latest.CPF_CNPJ_Acionista') }} as to_kind,
        latest.Acionista as to_name,
        'participacao' as edge_kind,
        cast(null as string) as edge_role,
        latest.Percentual_Total_Acoes_Circulacao as pct_capital,
        latest.Percentual_Acao_Ordinaria_Circulacao as pct_votos,
        cast(null as int64) as qty_ordinarias,
        cast(null as int64) as qty_preferenciais,
        {% if target.type == 'duckdb' %}
        cast(false as boolean) as is_listed_hop,
        {% else %}
        cast(false as bool) as is_listed_hop,
        {% endif %}
        latest.ID_Documento,
        latest.ID_Acionista,
        latest.ID_Acionista_Relacionado,
        concat('CVM FRE 2026 item 6.1 ID_Documento ', cast(latest.ID_Documento as string)) as source_doc,
        concat(
            'ID_Acionista ',
            cast(latest.ID_Acionista as string),
            ' relacionado ',
            cast(latest.ID_Acionista_Relacionado as string)
        ) as source_locator,
        latest.Data_Referencia as source_retrieved_at,
        latest.already_on_graph,
        latest.skip_redraw,
        latest.is_votorantim_seed
    from latest as latest
    where latest.Acionista_Relacionado is not null
      and {{ normalize_company_name('latest.Acionista_Relacionado') }} <> ''
)

select * from listed_hops

union all

select * from nested_hops
where from_id <> to_id
  and to_id <> seed_cnpj_basico
