with
walked_ownership_edges as (
    select * from {{ ref('int_walked_ownership_edges') }}
),

all_ownership_citations as (
    select * from {{ ref('int_ownership_citations') }}
),

fre_edges as (
    select * from all_ownership_citations
    where fonte = 'fre'
),

qsa_all_edges as (
    select * from all_ownership_citations
    where fonte = 'qsa'
),

{{ downward_hop_ctes('walked_ownership_edges') }}

select
    companies.empresa_id,
    companies.cnpj,
    companies.razao_social,
    edges.cited_empresa_id,
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
from downward_hop_person_edges as edges
inner join downward_hop_companies as companies
    on edges.cited_empresa_id = companies.empresa_id
