{{ config(
    labels={'layer': 'intermediate'},
    persist_docs={'relation': true, 'columns': true}
) }}

with listas as (
    select
        {{ normalize_company_name("coalesce(razao_social, nome)") }} as chave_nome,
        nome,
        coalesce(razao_social, nome) as razao_social,
        posicao,
        1 as lista_ordem,
        'Valor 1000 2025, ranking industrial, posição ' || cast(posicao as string) as citacao
    from {{ ref('stg_valor_ranking') }}

    union all

    select
        {{ normalize_company_name("coalesce(razao_social, nome)") }} as chave_nome,
        nome,
        coalesce(razao_social, nome) as razao_social,
        posicao,
        2 as lista_ordem,
        'Valor 1000 2025, bancos, posição ' || cast(posicao as string) as citacao
    from {{ ref('stg_valor_banco') }}

    union all

    select
        {{ normalize_company_name("coalesce(razao_social, nome)") }} as chave_nome,
        nome,
        coalesce(razao_social, nome) as razao_social,
        posicao,
        3 as lista_ordem,
        'Valor 1000 2025, seguradoras, posição ' || cast(posicao as string) as citacao
    from {{ ref('stg_valor_seguradora') }}
),

escolhida as (
    select
        chave_nome,
        nome,
        razao_social
    from listas
    qualify row_number() over (
        partition by chave_nome
        order by lista_ordem, posicao
    ) = 1
),

motivos as (
    select
        chave_nome,
        motivo_semente_a
    from (
        select
            chave_nome,
            string_agg(citacao, '; ' order by lista_ordem, posicao) as motivo_semente_a
        from listas
        group by chave_nome
    ) as _motivos
),

semente_chaves as (
    select
        chave_nome,
        nome,
        razao_social,
        chave_nome as chave,
        1 as prioridade
    from escolhida

    union all

    select
        chave_nome,
        nome,
        razao_social,
        {{ normalize_company_name(text_before_dash('razao_social')) }} as chave,
        2 as prioridade
    from escolhida
    where razao_social like '% - %'

    union all

    select
        chave_nome,
        nome,
        razao_social,
        {{ normalize_company_name(first_parenthetical('razao_social')) }} as chave,
        3 as prioridade
    from escolhida
    where razao_social like '%(%'
),

rf_empresa as (
    select
        {{ normalize_company_name('razao_social') }} as chave,
        cnpj_basico,
        razao_social,
        capital_social
    from {{ ref('stg_rf_empresa') }}
    where data = date '{{ var("rf_partition_date") }}'
      and razao_social is not null
),

rf_exact as (
    select
        semente_chaves.chave_nome,
        rf_empresa.cnpj_basico,
        rf_empresa.razao_social,
        rf_empresa.capital_social,
        semente_chaves.prioridade
    from semente_chaves
    inner join rf_empresa on rf_empresa.chave = semente_chaves.chave
    where semente_chaves.chave != ''
),

rf_escolhido as (
    select
        chave_nome,
        cnpj_basico,
        razao_social,
        capital_social
    from rf_exact
    qualify row_number() over (
        partition by chave_nome
        order by prioridade, capital_social desc, cnpj_basico
    ) = 1
),

semente_sem_exact as (
    select
        escolhida.chave_nome
    from escolhida
    left join rf_escolhido on escolhida.chave_nome = rf_escolhido.chave_nome
    where rf_escolhido.cnpj_basico is null
),

semente_prefix_keys as (
    select
        semente_chaves.chave_nome,
        semente_chaves.chave,
        semente_chaves.prioridade
    from semente_chaves
    inner join semente_sem_exact
        on semente_chaves.chave_nome = semente_sem_exact.chave_nome
    where length(semente_chaves.chave) >= 8

    union all

    select
        semente_chaves.chave_nome,
        {{ strip_legal_suffix('semente_chaves.chave') }} as chave,
        4 as prioridade
    from semente_chaves
    inner join semente_sem_exact
        on semente_chaves.chave_nome = semente_sem_exact.chave_nome
    where length({{ strip_legal_suffix('semente_chaves.chave') }}) >= 5
),

rf_prefix as (
    select
        semente_prefix_keys.chave_nome,
        rf_empresa.cnpj_basico,
        rf_empresa.razao_social,
        rf_empresa.capital_social,
        semente_prefix_keys.prioridade
    from semente_prefix_keys
    inner join rf_empresa
        on starts_with(rf_empresa.chave, semente_prefix_keys.chave)
        or starts_with(semente_prefix_keys.chave, rf_empresa.chave)
),

rf_escolhido_prefix as (
    select
        chave_nome,
        cnpj_basico,
        razao_social,
        capital_social
    from rf_prefix
    qualify row_number() over (
        partition by chave_nome
        order by prioridade, capital_social desc, cnpj_basico
    ) = 1
),

rf_unico as (
    select chave_nome, cnpj_basico, razao_social, capital_social from rf_escolhido
    union all
    select chave_nome, cnpj_basico, razao_social, capital_social from rf_escolhido_prefix
),

matriz as (
    select
        estabelecimento.cnpj_basico,
        estabelecimento.cnpj
    from {{ ref('stg_rf_estabelecimento') }} as estabelecimento
    inner join rf_unico on estabelecimento.cnpj_basico = rf_unico.cnpj_basico
    where estabelecimento.data = date '{{ var("rf_partition_date") }}'
    qualify row_number() over (
        partition by estabelecimento.cnpj_basico
        order by
            case when estabelecimento.identificador_matriz_filial = '1' then 0 else 1 end,
            case when estabelecimento.situacao_cadastral = '02' then 0 else 1 end,
            case when estabelecimento.cnpj_ordem = '0001' then 0 else 1 end,
            estabelecimento.cnpj
    ) = 1
),

cadastro as (
    select
        {{ normalize_company_name('razao_social') }} as chave,
        id_cnpj as cnpj,
        1 as origem,
        case when situacao = 'ATIVO' then 0 else 1 end as situacao_ordem
    from {{ ref('stg_cvm_cia_aberta') }}
    where id_cnpj is not null

    union all

    select
        {{ normalize_company_name('nome_comercial') }} as chave,
        id_cnpj as cnpj,
        2 as origem,
        case when situacao = 'ATIVO' then 0 else 1 end as situacao_ordem
    from {{ ref('stg_cvm_cia_aberta') }}
    where id_cnpj is not null
      and nome_comercial is not null

    union all

    select
        {{ normalize_company_name('razao_social') }} as chave,
        id_cnpj as cnpj,
        3 as origem,
        0 as situacao_ordem
    from {{ ref('stg_b3_empresa_listada') }}
    where id_cnpj is not null

    union all

    select
        {{ normalize_company_name('nome_comercial') }} as chave,
        id_cnpj as cnpj,
        4 as origem,
        0 as situacao_ordem
    from {{ ref('stg_b3_empresa_listada') }}
    where id_cnpj is not null
      and nome_comercial is not null

    union all

    select
        {{ normalize_company_name('nome') }} as chave,
        id_cnpj as cnpj,
        5 as origem,
        0 as situacao_ordem
    from {{ ref('stg_bcb_entidade_supervisionada') }}
    where id_cnpj is not null

    union all

    select
        {{ normalize_company_name('nome') }} as chave,
        id_cnpj as cnpj,
        6 as origem,
        0 as situacao_ordem
    from {{ ref('stg_susep_dado_cadastral') }}
    where id_cnpj is not null
),

cadastro_escolhido as (
    select
        semente_chaves.chave_nome,
        cadastro.cnpj
    from semente_chaves
    inner join cadastro on cadastro.chave = semente_chaves.chave
    where semente_chaves.chave != ''
    qualify row_number() over (
        partition by semente_chaves.chave_nome
        order by semente_chaves.prioridade, cadastro.situacao_ordem, cadastro.origem, cadastro.cnpj
    ) = 1
),

excecao as (
    select
        razao_social,
        cnpj
    from (
        select 'CCR S.A.' as razao_social, '02846056000197' as cnpj
    ) as _excecao
),

resolvida as (
    select
        coalesce(matriz.cnpj, cadastro_escolhido.cnpj, excecao.cnpj) as cnpj,
        coalesce(rf_unico.razao_social, escolhida.razao_social) as razao_social,
        rf_unico.capital_social,
        rf_unico.cnpj_basico,
        motivos.motivo_semente_a as motivo_entrada_descricao
    from escolhida
    inner join motivos on escolhida.chave_nome = motivos.chave_nome
    left join rf_unico on escolhida.chave_nome = rf_unico.chave_nome
    left join matriz on rf_unico.cnpj_basico = matriz.cnpj_basico
    left join cadastro_escolhido on escolhida.chave_nome = cadastro_escolhido.chave_nome
    left join excecao on escolhida.razao_social = excecao.razao_social
),

com_capital as (
    select
        resolvida.cnpj,
        coalesce(resolvida.razao_social, rf_basico.razao_social) as razao_social,
        coalesce(resolvida.capital_social, rf_basico.capital_social) as capital_social,
        resolvida.motivo_entrada_descricao
    from resolvida
    left join rf_empresa as rf_basico
        on rf_basico.cnpj_basico = left(resolvida.cnpj, 8)
        and resolvida.cnpj_basico is null
)

select
    cnpj,
    razao_social,
    capital_social,
    'semente' as motivo_entrada_categoria,
    motivo_entrada_descricao,
    date '{{ var("valor_1000_2025_publication_date") }}' as motivo_entrada_date
from (
    select
        cnpj,
        any_value(razao_social) as razao_social,
        any_value(capital_social) as capital_social,
        string_agg(motivo_entrada_descricao, '; ' order by motivo_entrada_descricao) as motivo_entrada_descricao
    from com_capital
    where cnpj is not null
    group by cnpj
) as _por_cnpj
