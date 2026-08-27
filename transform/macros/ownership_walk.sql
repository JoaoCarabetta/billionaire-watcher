{% macro provisional_person_id(name_expression, company_expression) -%}
    {%- if target.type == 'bigquery' -%}
        concat(
            'p-provisorio-',
            substr(
                to_hex(
                    sha256(
                        cast(
                            concat(
                                {{ normalize_person_name(name_expression) }},
                                '|',
                                cast({{ company_expression }} as string)
                            ) as bytes
                        )
                    )
                ),
                1,
                16
            )
        )
    {%- else -%}
        concat(
            'p-provisorio-',
            substr(
                sha256(
                    concat(
                        {{ normalize_person_name(name_expression) }},
                        '|',
                        cast({{ company_expression }} as varchar)
                    )
                ),
                1,
                16
            )
        )
    {%- endif -%}
{%- endmacro %}


{% macro ownership_edge_ctes() -%}
fre_latest_documents as (
    select
        CNPJ_Companhia,
        max(ID_Documento) as ID_Documento
    from {{ ref('stg_cvm_fre_posicao_acionaria_2026') }}
    group by CNPJ_Companhia
),

fre_rows as (
    select
        fre.CNPJ_Companhia as company_key,
        trim(cast(fre.Nome_Companhia as string)) as company_name,
        trim(cast(fre.Acionista as string)) as owner_name,
        {{ normalize_company_name('fre.Acionista') }} as owner_name_normalized,
        upper(trim(cast(fre.Tipo_Pessoa_Acionista as string))) as owner_type,
        {{ digits_only('fre.CPF_CNPJ_Acionista') }} as owner_document,
        fre.Data_Referencia as data_referencia,
        fre.ID_Documento,
        upper(trim(cast(fre.Acionista_Controlador as string))) as controller_flag,
        upper(trim(cast(fre.Participante_Acordo_Acionistas as string))) as agreement_flag,
        cast(fre.Percentual_Acao_Ordinaria_Circulacao as double) as percentual_on,
        cast(fre.Percentual_Total_Acoes_Circulacao as double) as percentual_total
    from {{ ref('stg_cvm_fre_posicao_acionaria_2026') }} as fre
    inner join fre_latest_documents as latest
        on fre.CNPJ_Companhia = latest.CNPJ_Companhia
        and fre.ID_Documento = latest.ID_Documento
),

fre_edges as (
    select
        company_key,
        company_name,
        'fre' as fonte,
        case
            when
                owner_type in ('PF', 'PESSOA FISICA', 'PESSOA FÍSICA')
                or length(owner_document) = 11
                then 'pessoa'
            when
                owner_type in ('PJ', 'PESSOA JURIDICA', 'PESSOA JURÍDICA')
                or length(owner_document) = 14
                then 'empresa'
            else 'parada'
        end as owner_kind,
        case
            when
                owner_type in ('PJ', 'PESSOA JURIDICA', 'PESSOA JURÍDICA')
                or length(owner_document) = 14
                then case
                    when length(owner_document) = 14
                        then lpad(owner_document, 14, '0')
                    else concat('nome:', owner_name_normalized)
                end
        end as owner_company_id,
        owner_name,
        owner_document,
        case
            when length(owner_document) = 11
                then lpad(owner_document, 11, '0')
        end as owner_cpf,
        case
            when controller_flag = 'S' then 'acionista_controlador'
            else 'acionista'
        end as papel,
        controller_flag = 'S' as acionista_controlador,
        agreement_flag = 'S' as participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        cast(null as string) as qualificacao,
        data_referencia,
        concat(
            'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/',
            'fre_cia_aberta_2026.zip#',
            'fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=',
            cast(ID_Documento as string)
        ) as fonte_documento
    from fre_rows
    where
        owner_name_normalized != ''
        and owner_name_normalized != 'OUTROS'
        and owner_name_normalized not like '%TESOURARIA%'
),

rf_companies as (
    select
        lpad({{ digits_only('cnpj_basico') }}, 8, '0') as cnpj_basico,
        trim(cast(razao_social as string)) as razao_social,
        lpad({{ digits_only('natureza_juridica') }}, 4, '0') as natureza_juridica
    from {{ source('br_me_cnpj', 'empresas') }}
    where cast(data as date) = cast('{{ var("rf_partition_date") }}' as date)
),

qsa_rows as (
    select
        lpad({{ digits_only('socios.cnpj_basico') }}, 8, '0') as company_key,
        companies.razao_social as company_name,
        trim(cast(socios.nome as string)) as owner_name,
        {{ normalize_company_name('socios.nome') }} as owner_name_normalized,
        trim(cast(socios.tipo as string)) as owner_type,
        {{ digits_only('socios.documento') }} as owner_document,
        lpad({{ digits_only('socios.qualificacao') }}, 2, '0') as qualificacao,
        cast(socios.data as date) as data_referencia
    from {{ source('br_me_cnpj', 'socios') }} as socios
    inner join rf_companies as companies
        on lpad({{ digits_only('socios.cnpj_basico') }}, 8, '0') = companies.cnpj_basico
    where
        cast(socios.data as date) = cast('{{ var("rf_partition_date") }}' as date)
        -- Keep ownership qualifications, including socio-administrador, but never
        -- turn administrators, directors, presidents, or councillors into owners.
        and lpad({{ digits_only('socios.qualificacao') }}, 2, '0') in (
            '20', '21', '22', '23', '24', '25', '26', '28', '29', '30',
            '31', '34', '37', '38', '47', '48', '49', '50', '52', '53',
            '54', '55', '56', '57', '58', '59', '65', '66', '67', '68',
            '74', '75', '78', '79'
        )
),

qsa_classified_rows as (
    select
        *,
        case
            when owner_type = '1' then 'empresa'
            when owner_type = '2' then 'pessoa'
            when owner_type = '3' and length(owner_document) = 14 then 'empresa'
            when owner_type = '3' and length(owner_document) = 11 then 'pessoa'
            -- Receita qualification labels explicitly identify these as legal
            -- persons; generic/unknown foreign partners stay provisional people.
            when owner_type = '3' and qualificacao in (
                '20', '21', '37', '48', '57', '78', '79'
            ) then 'empresa'
            when owner_type = '3' then 'pessoa'
            else 'parada'
        end as owner_kind
    from qsa_rows
),

qsa_all_edges as (
    select
        company_key,
        company_name,
        'qsa' as fonte,
        owner_kind,
        case
            when owner_kind = 'empresa' then case
                when length(owner_document) = 14
                    then lpad(owner_document, 14, '0')
                else concat('nome:', owner_name_normalized)
            end
        end as owner_company_id,
        owner_name,
        owner_document,
        case
            when
                owner_kind = 'pessoa'
                and length(owner_document) = 11
                then lpad(owner_document, 11, '0')
        end as owner_cpf,
        'socio' as papel,
        cast(null as boolean) as acionista_controlador,
        cast(null as boolean) as participante_acordo_acionistas,
        cast(null as double) as percentual_on,
        cast(null as double) as percentual_total,
        qualificacao,
        data_referencia,
        concat(
            'basedosdados.br_me_cnpj.socios?data=',
            cast(data_referencia as string),
            '&cnpj_basico=',
            company_key
        ) as fonte_documento
    from qsa_classified_rows
    where
        owner_name_normalized != ''
        and owner_name_normalized != 'OUTROS'
        and owner_name_normalized not like '%TESOURARIA%'
),

qsa_edges as (
    select edges.*
    from qsa_all_edges as edges
    inner join rf_companies as companies
        on edges.company_key = companies.cnpj_basico
    where
        -- 2054 is Sociedade Anônima Fechada: QSA is not a public shareholder book.
        companies.natureza_juridica != '2054'
        and not exists (
            select 1
            from fre_latest_documents
            where left(CNPJ_Companhia, 8) = edges.company_key
        )
),

ownership_edges as (
    select * from fre_edges
    union all
    select * from qsa_edges
),

all_ownership_citations as (
    select * from fre_edges
    union all
    select * from qsa_all_edges
)
{%- endmacro %}


{% macro ownership_walk_ctes(roots_cte) -%}
company_walk as (
    select
        root_empresa_id,
        root_empresa_id as current_empresa_id,
        0 as depth,
        concat('|', root_empresa_id, '|') as visited_path
    from {{ roots_cte }}

    union all

    select
        walk.root_empresa_id,
        edges.owner_company_id as current_empresa_id,
        walk.depth + 1 as depth,
        concat(walk.visited_path, edges.owner_company_id, '|') as visited_path
    from company_walk as walk
    inner join ownership_edges as edges
        on (
            edges.fonte = 'fre'
            and edges.company_key = walk.current_empresa_id
        ) or (
            edges.fonte = 'qsa'
            and edges.company_key = left(walk.current_empresa_id, 8)
        )
    where
        edges.owner_kind = 'empresa'
        and edges.owner_company_id is not null
        and strpos(
            walk.visited_path,
            concat('|', edges.owner_company_id, '|')
        ) = 0
        and walk.depth < 50
),

walked_ownership_edges as (
    select distinct
        walk.root_empresa_id,
        walk.current_empresa_id as cited_empresa_id,
        edges.fonte,
        edges.owner_kind,
        edges.owner_company_id,
        edges.owner_name,
        edges.owner_document,
        edges.owner_cpf,
        edges.papel,
        edges.acionista_controlador,
        edges.participante_acordo_acionistas,
        edges.percentual_on,
        edges.percentual_total,
        edges.qualificacao,
        edges.data_referencia,
        edges.fonte_documento
    from company_walk as walk
    inner join ownership_edges as edges
        on (
            edges.fonte = 'fre'
            and edges.company_key = walk.current_empresa_id
        ) or (
            edges.fonte = 'qsa'
            and edges.company_key = left(walk.current_empresa_id, 8)
        )
)
{%- endmacro %}


{% macro downward_hop_ctes(upward_edges_cte) -%}
eligible_oligarch_cpfs as (
    select distinct owner_cpf as cpf
    from {{ upward_edges_cte }}
    where
        owner_kind = 'pessoa'
        and fonte = 'fre'
        and length(owner_cpf) = 11
        and cited_empresa_id = root_empresa_id
        and (
            acionista_controlador
            or percentual_on >= 10
        )
),

eligible_oligarch_masks as (
    select distinct
        substr(cpf, 4, 6) as cpf_mask,
        cpf
    from eligible_oligarch_cpfs
),

fre_hop_company_keys as (
    select distinct
        edges.fonte,
        edges.company_key,
        edges.company_key as empresa_id,
        edges.company_key as cnpj,
        edges.company_name as razao_social
    from fre_edges as edges
    inner join eligible_oligarch_cpfs as oligarchs
        on edges.owner_cpf = oligarchs.cpf
    where
        edges.owner_kind = 'pessoa'
        and (
            edges.acionista_controlador
            or edges.percentual_on >= 10
        )
),

qsa_hop_company_keys as (
    select distinct
        edges.fonte,
        edges.company_key,
        edges.company_name as razao_social
    from qsa_all_edges as edges
    inner join eligible_oligarch_masks as oligarchs
        on edges.owner_document = oligarchs.cpf_mask
    where
        edges.owner_kind = 'pessoa'
        and length(edges.owner_document) = 6
),

rf_hop_establishments_ranked as (
    select
        lpad({{ digits_only('cnpj_basico') }}, 8, '0') as cnpj_basico,
        lpad({{ digits_only('cnpj') }}, 14, '0') as cnpj,
        row_number() over (
            partition by lpad({{ digits_only('cnpj_basico') }}, 8, '0')
            order by
                case
                    when substr(lpad({{ digits_only('cnpj') }}, 14, '0'), 9, 4) = '0001'
                        then 0
                    else 1
                end,
                lpad({{ digits_only('cnpj') }}, 14, '0')
        ) as establishment_row
    from {{ source('br_me_cnpj', 'estabelecimentos') }}
    where
        cast(data as date) = cast('{{ var("rf_partition_date") }}' as date)
        and length({{ digits_only('cnpj_basico') }}) = 8
        and length({{ digits_only('cnpj') }}) = 14
),

rf_hop_headquarters as (
    select cnpj_basico, cnpj
    from rf_hop_establishments_ranked
    where establishment_row = 1
),

qsa_hop_companies_resolved as (
    select
        companies.fonte,
        companies.company_key,
        coalesce(
            headquarters.cnpj,
            concat(
                'nome:',
                {{ normalize_company_name('companies.razao_social') }}
            )
        ) as empresa_id,
        headquarters.cnpj,
        companies.razao_social
    from qsa_hop_company_keys as companies
    left join rf_hop_headquarters as headquarters
        on companies.company_key = headquarters.cnpj_basico
),

downward_hop_company_keys_raw as (
    select * from fre_hop_company_keys
    union all
    select * from qsa_hop_companies_resolved
),

upward_company_ids as (
    select root_empresa_id as empresa_id
    from {{ upward_edges_cte }}

    union

    select cited_empresa_id
    from {{ upward_edges_cte }}

    union

    select owner_company_id
    from {{ upward_edges_cte }}
    where owner_kind = 'empresa' and owner_company_id is not null
),

downward_hop_company_keys as (
    select candidates.*
    from downward_hop_company_keys_raw as candidates
    left join upward_company_ids as upward using (empresa_id)
    where upward.empresa_id is null
),

downward_hop_companies as (
    select
        empresa_id,
        max(cnpj) as cnpj,
        max(razao_social) as razao_social
    from downward_hop_company_keys
    group by empresa_id
),

downward_hop_match_keys as (
    select distinct empresa_id, fonte, company_key
    from downward_hop_company_keys

    union

    select distinct
        companies.empresa_id,
        citations.fonte,
        citations.company_key
    from downward_hop_companies as companies
    inner join all_ownership_citations as citations
        on (
            citations.fonte = 'fre'
            and citations.company_key = companies.cnpj
        ) or (
            citations.fonte = 'qsa'
            and citations.company_key = left(companies.cnpj, 8)
        )
    where companies.cnpj is not null
),

downward_hop_person_edges as (
    select
        keys.empresa_id as cited_empresa_id,
        edges.fonte,
        edges.owner_kind,
        edges.owner_company_id,
        edges.owner_name,
        edges.owner_document,
        coalesce(
            edges.owner_cpf,
            case
                when edges.fonte = 'qsa' then oligarchs.cpf
            end
        ) as owner_cpf,
        edges.papel,
        edges.acionista_controlador,
        edges.participante_acordo_acionistas,
        edges.percentual_on,
        edges.percentual_total,
        edges.qualificacao,
        edges.data_referencia,
        edges.fonte_documento
    from downward_hop_match_keys as keys
    inner join all_ownership_citations as edges
        on keys.fonte = edges.fonte
        and keys.company_key = edges.company_key
    left join eligible_oligarch_masks as oligarchs
        on edges.fonte = 'qsa'
        and edges.owner_document = oligarchs.cpf_mask
    where edges.owner_kind = 'pessoa'
)
{%- endmacro %}
