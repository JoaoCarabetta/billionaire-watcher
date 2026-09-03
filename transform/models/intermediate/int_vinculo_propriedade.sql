{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['cnpj'],
    labels={'layer': 'intermediate'}
) }}
{% else %}
{{ config(labels={'layer': 'intermediate'}) }}
{% endif %}

with fre as (
    select
        'fre' as fonte,
        cnpj,
        {{ prefix8_from_cnpj14('cnpj') }} as cnpj_basico,
        id_documento,
        nome_acionista as origem_nome,
        documento_acionista as origem_documento,
        tipo_pessoa_acionista,
        cast(null as string) as qualificacao,
        cast(null as string) as qsa_tipo,
        indicador_acionista_controlador,
        indicador_participante_acordo_acionistas,
        proporcao_acao_ordinaria_circulacao as percentual_on,
        proporcao_total_acao_circulacao as percentual_total,
        data_referencia,
        'fre_cia_aberta_posicao_acionaria_2026 id_documento=' || id_documento as fonte_documento,
        true as tem_informacao_de_controle,
        nome_acionista_relacionado as via,
        documento_acionista_relacionado as via_documento
    from {{ ref('int_fre_posicao_recente') }}
),

qsa_raw as (
    select *
    from {{ ref('stg_rf_socio') }}
    where data = date '{{ var("rf_partition_date") }}'
      and qualificacao in {{ qsa_ownership_qualificacao() }}
      and nome is not null
),

matriz as (
    select
        estabelecimento.cnpj_basico,
        estabelecimento.cnpj
    from {{ ref('stg_rf_estabelecimento') }} as estabelecimento
    inner join (select distinct cnpj_basico from qsa_raw) as socio_basico
        on estabelecimento.cnpj_basico = socio_basico.cnpj_basico
    where estabelecimento.data = date '{{ var("rf_partition_date") }}'
    qualify row_number() over (
        partition by estabelecimento.cnpj_basico
        order by {{ matriz_order() }}
    ) = 1
),

qsa as (
    select
        'qsa' as fonte,
        matriz.cnpj,
        qsa_raw.cnpj_basico,
        cast(null as string) as id_documento,
        qsa_raw.nome as origem_nome,
        qsa_raw.documento as origem_documento,
        cast(null as string) as tipo_pessoa_acionista,
        qsa_raw.qualificacao,
        qsa_raw.tipo as qsa_tipo,
        cast(null as string) as indicador_acionista_controlador,
        cast(null as string) as indicador_participante_acordo_acionistas,
        {{ null_float() }} as percentual_on,
        {{ null_float() }} as percentual_total,
        qsa_raw.data as data_referencia,
        'rf.socios partição ' || cast(qsa_raw.data as string) || ' cnpj_basico=' || qsa_raw.cnpj_basico as fonte_documento,
        false as tem_informacao_de_controle,
        cast(null as string) as via,
        cast(null as string) as via_documento
    from qsa_raw
    inner join matriz on qsa_raw.cnpj_basico = matriz.cnpj_basico
),

uniao as (
    select
        fonte,
        cnpj,
        cnpj_basico,
        id_documento,
        origem_nome,
        origem_documento,
        tipo_pessoa_acionista,
        qualificacao,
        qsa_tipo,
        indicador_acionista_controlador,
        indicador_participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        data_referencia,
        fonte_documento,
        tem_informacao_de_controle,
        via,
        via_documento
    from fre
    union all
    select
        fonte,
        cnpj,
        cnpj_basico,
        id_documento,
        origem_nome,
        origem_documento,
        tipo_pessoa_acionista,
        qualificacao,
        qsa_tipo,
        indicador_acionista_controlador,
        indicador_participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        data_referencia,
        fonte_documento,
        tem_informacao_de_controle,
        via,
        via_documento
    from qsa
),

rf_empresa as (
    select
        {{ normalize_company_name('razao_social') }} as chave,
        cnpj_basico,
        natureza_juridica,
        ente_federativo
    from {{ ref('stg_rf_empresa') }}
    where data = date '{{ var("rf_partition_date") }}'
      and razao_social is not null
),

rf_nome_unico as (
    select
        chave,
        any_value(cnpj_basico) as cnpj_basico
    from rf_empresa
    group by chave
    having count(*) = 1
),

nomes_sem_cnpj as (
    select distinct chave
    from (
        select {{ normalize_company_name('origem_nome') }} as chave
        from uniao
        where length(coalesce(origem_documento, '')) != 14

        union all

        select {{ normalize_company_name('via') }} as chave
        from uniao
        where via is not null
          and length(coalesce(via_documento, '')) != 14
    ) as _nomes
),

matriz_nome as (
    select
        estabelecimento.cnpj_basico,
        estabelecimento.cnpj
    from {{ ref('stg_rf_estabelecimento') }} as estabelecimento
    inner join rf_nome_unico
        on estabelecimento.cnpj_basico = rf_nome_unico.cnpj_basico
    inner join nomes_sem_cnpj
        on nomes_sem_cnpj.chave = rf_nome_unico.chave
    where estabelecimento.data = date '{{ var("rf_partition_date") }}'
    qualify row_number() over (
        partition by estabelecimento.cnpj_basico
        order by {{ matriz_order() }}
    ) = 1
),

com_cnpj as (
    select
        uniao.*,
        case
            when {{ is_cnpj14('uniao.origem_documento') }} then uniao.origem_documento
            else matriz_nome.cnpj
        end as owner_cnpj
    from uniao
    left join rf_nome_unico
        on rf_nome_unico.chave = {{ normalize_company_name('uniao.origem_nome') }}
        and length(coalesce(uniao.origem_documento, '')) != 14
    left join matriz_nome
        on matriz_nome.cnpj_basico = rf_nome_unico.cnpj_basico
),

com_natureza as (
    select
        com_cnpj.*,
        rf_por_basico.natureza_juridica,
        rf_por_basico.ente_federativo
    from com_cnpj
    left join {{ ref('stg_rf_empresa') }} as rf_por_basico
        on {{ is_cnpj14('com_cnpj.owner_cnpj') }}
        and rf_por_basico.cnpj_basico = left(com_cnpj.owner_cnpj, 8)
        and rf_por_basico.data = date '{{ var("rf_partition_date") }}'
),

classificado as (
    select
        *,
        {{ fold_upper('origem_nome') }} as nome_dobrado,
        {{ normalize_company_name('origem_nome') }} as chave_nome,
        {{ fold_upper('tipo_pessoa_acionista') }} as tipo_dobrado
    from com_natureza
),

tipado as (
    select
        classificado.*,
        case
            when classificado.nome_dobrado = 'OUTROS' then 'outros'
            when classificado.nome_dobrado like '%TESOURARIA%' then 'tesouraria'
            when classificado.natureza_juridica in ('2011', '2038') then 'empresa'
            when classificado.natureza_juridica like '1%'
                or classificado.ente_federativo is not null
                or classificado.chave_nome in (
                    'UNIAO', 'UNIAOFEDERAL', 'TESOURONACIONAL', 'FAZENDANACIONAL'
                )
                then 'estado'
            when classificado.tipo_dobrado like '%FISICA%'
                or classificado.tipo_dobrado = 'PF'
                or classificado.qsa_tipo = '2'
                or length(classificado.origem_documento) = 11
                then 'pessoa'
            when {{ is_placeholder_cnpj('classificado.origem_documento') }}
                then 'estrangeiro'
            when classificado.qsa_tipo = '3'
                and classificado.owner_cnpj is null
                then 'estrangeiro'
            when {{ is_cnpj14('classificado.owner_cnpj') }} then 'empresa'
            when classificado.tipo_dobrado like '%JURIDICA%'
                or classificado.tipo_dobrado = 'PJ'
                or classificado.qsa_tipo = '1'
                then 'nao_resolvido'
            when classificado.qsa_tipo = '3' then 'estrangeiro'
            else 'nao_resolvido'
        end as origem_tipo
    from classificado
),

com_via as (
    select
        tipado.*,
        case
            when {{ is_cnpj14('tipado.via_documento') }} then tipado.via_documento
            else matriz_via.cnpj
        end as via_cnpj
    from tipado
    left join rf_nome_unico as rf_via
        on rf_via.chave = {{ normalize_company_name('tipado.via') }}
        and tipado.via is not null
        and length(coalesce(tipado.via_documento, '')) != 14
    left join matriz_nome as matriz_via
        on matriz_via.cnpj_basico = rf_via.cnpj_basico
),

base as (
    select
        origem_tipo,
        case origem_tipo
            when 'pessoa' then {{ pessoa_id_origem('origem_documento', 'origem_nome', 'cnpj') }}
            when 'empresa' then owner_cnpj
            when 'estado' then coalesce(owner_cnpj, 'estado:' || chave_nome)
            when 'outros' then origem_tipo || ':' || chave_nome || '@' || cnpj
            when 'tesouraria' then origem_tipo || ':' || chave_nome || '@' || cnpj
            else origem_tipo || ':' || chave_nome
        end as origem_id,
        origem_nome,
        origem_documento,
        cnpj,
        case
            when fonte = 'qsa' then 'socio'
            when indicador_acionista_controlador = 'S' then 'acionista_controlador'
            else 'acionista'
        end as papel,
        fonte,
        case
            when fonte = 'qsa' then {{ null_bool() }}
            when indicador_acionista_controlador = 'S' then true
            when indicador_acionista_controlador = 'N' then false
            else {{ null_bool() }}
        end as acionista_controlador,
        case
            when fonte = 'qsa' then {{ null_bool() }}
            when indicador_participante_acordo_acionistas = 'S' then true
            when indicador_participante_acordo_acionistas = 'N' then false
            else {{ null_bool() }}
        end as participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        tem_informacao_de_controle,
        data_referencia,
        fonte_documento,
        cnpj_basico,
        id_documento,
        via,
        via_cnpj
    from com_via
),

pessoa as (
    select
        base.*,
        {{ normalize_person_name('origem_nome') }} as chave_pessoa,
        {{ cpf_mask6('origem_documento') }} as mask6,
        case
            when {{ is_cpf11('origem_documento') }} then origem_documento
        end as cpf11
    from base
    where origem_tipo = 'pessoa'
),

pessoa_tok as (
    select
        pessoa.*,
        {{ person_n_tok('chave_pessoa') }} as n_tok,
        {{ person_first_tok('chave_pessoa') }} as primeiro,
        {{ person_last_tok('chave_pessoa') }} as ultimo,
        case
            when cpf11 is not null then {{ person_id_from_cpf('cpf11') }}
        end as pessoa_id_cpf,
        count(cpf11) over (partition by chave_pessoa) as n_cpf_chave,
        count(distinct mask6) over (partition by chave_pessoa) as n_mask_chave
    from pessoa
),

cpf_citado as (
    select
        chave_pessoa,
        primeiro,
        ultimo,
        n_tok,
        mask6,
        cpf11 as cpf,
        pessoa_id_cpf as pessoa_id,
        count(distinct cpf11) over (partition by chave_pessoa) as n_cpf_distintos,
        count(distinct cpf11) over (partition by chave_pessoa, mask6) as n_cpf_chave_mask,
        count(distinct cpf11) over (partition by primeiro, ultimo, mask6) as n_cpf_bloco_mask
    from pessoa_tok
    where cpf11 is not null
),

chave_1cpf as (
    select distinct
        chave_pessoa,
        pessoa_id
    from cpf_citado
    where n_cpf_distintos = 1
),

mascara_chave as (
    select distinct
        chave_pessoa,
        mask6,
        pessoa_id
    from cpf_citado
    where n_cpf_chave_mask = 1
),

mascara_bloco as (
    select distinct
        primeiro,
        ultimo,
        mask6,
        pessoa_id
    from cpf_citado
    where n_cpf_bloco_mask = 1
),

cpf_ancora as (
    select distinct
        chave_pessoa,
        primeiro,
        ultimo,
        n_tok,
        pessoa_id
    from cpf_citado
),

proximo as (
    select
        a.chave_pessoa,
        b.pessoa_id as id_ancora
    from pessoa_tok as a
    inner join cpf_ancora as b
        on a.primeiro = b.primeiro
        and a.ultimo = b.ultimo
        and a.chave_pessoa != b.chave_pessoa
    where a.n_cpf_chave = 0
      and (
        (
            {{ name_edit_distance('a.chave_pessoa', 'b.chave_pessoa') }} <= 2
            and a.n_tok = b.n_tok
        )
        or (
            least(a.n_tok, b.n_tok) >= 3
            and (
                {{ tokens_contained('a.chave_pessoa', 'b.chave_pessoa') }}
                or {{ tokens_contained('b.chave_pessoa', 'a.chave_pessoa') }}
            )
        )
      )
),

proximo_ok as (
    select distinct
        chave_pessoa,
        id_ancora as pessoa_id
    from (
        select
            chave_pessoa,
            id_ancora,
            count(distinct id_ancora) over (partition by chave_pessoa) as n_ancoras
        from proximo
    ) as _proximo
    where n_ancoras = 1
),

pessoa_resolvida as (
    select
        p.origem_tipo,
        case
            when p.pessoa_id_cpf is not null then p.pessoa_id_cpf
            when mascara_chave.pessoa_id is not null then mascara_chave.pessoa_id
            when chave_1cpf.pessoa_id is not null then chave_1cpf.pessoa_id
            when mascara_bloco.pessoa_id is not null then mascara_bloco.pessoa_id
            when proximo_ok.pessoa_id is not null then proximo_ok.pessoa_id
            when p.n_mask_chave = 1 then concat('nome:', p.chave_pessoa)
            when p.n_tok >= 3 then concat('nome:', p.chave_pessoa)
            else p.origem_id
        end as origem_id,
        p.origem_nome,
        p.origem_documento,
        p.cnpj,
        p.papel,
        p.fonte,
        p.acionista_controlador,
        p.participante_acordo_acionistas,
        p.percentual_on,
        p.percentual_total,
        p.qualificacao,
        p.tem_informacao_de_controle,
        p.data_referencia,
        p.fonte_documento,
        p.cnpj_basico,
        p.id_documento,
        p.via,
        p.via_cnpj
    from pessoa_tok as p
    left join mascara_chave
        on mascara_chave.chave_pessoa = p.chave_pessoa
        and mascara_chave.mask6 = p.mask6
    left join chave_1cpf
        on chave_1cpf.chave_pessoa = p.chave_pessoa
    left join mascara_bloco
        on mascara_bloco.primeiro = p.primeiro
        and mascara_bloco.ultimo = p.ultimo
        and mascara_bloco.mask6 = p.mask6
    left join proximo_ok
        on proximo_ok.chave_pessoa = p.chave_pessoa
)

select
    origem_tipo,
    origem_id,
    origem_nome,
    origem_documento,
    cnpj,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    tem_informacao_de_controle,
    data_referencia,
    fonte_documento,
    cnpj_basico,
    id_documento,
    via,
    via_cnpj
from pessoa_resolvida

union all

select
    origem_tipo,
    origem_id,
    origem_nome,
    origem_documento,
    cnpj,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    tem_informacao_de_controle,
    data_referencia,
    fonte_documento,
    cnpj_basico,
    id_documento,
    via,
    via_cnpj
from base
where origem_tipo != 'pessoa'
