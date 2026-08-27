select
  'p-8c2d3a75' as pessoa_id,
  '10000000000100' as empresa_id,
  'acionista_controlador' as papel,
  'fre' as fonte,
  true as acionista_controlador,
  false as participante_acordo_acionistas,
  5.0::double as percentual_on,
  5.0::double as percentual_total,
  cast(null as varchar) as qualificacao,
  cast('2026-06-30' as date) as data_referencia,
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100' as fonte_documento
union all
select
  'p-provisorio-5244e17e4d3e00aa', '10000000000100',
  'acionista', 'fre', false, true, 4.9, 4.9, null,
  cast('2026-06-30' as date),
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-provisorio-38456fff6f5e6fd9', '20000000000100',
  'acionista_controlador', 'fre', true, false, 80.0, 80.0, null,
  cast('2026-06-30' as date),
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=200'
union all
select
  'p-provisorio-9c05347c3655101e', '40000000000100',
  'socio', 'qsa', null, null, null, null, '22',
  cast('2026-01-11' as date),
  'basedosdados.br_me_cnpj.socios?data=2026-01-11&cnpj_basico=40000000'
union all
select
  'p-provisorio-bffaca71701a4644', '40000000000100',
  'socio', 'qsa', null, null, null, null, '22',
  cast('2026-01-11' as date),
  'basedosdados.br_me_cnpj.socios?data=2026-01-11&cnpj_basico=40000000'
union all
select
  'p-provisorio-50179797a332df8b', '60000000000100',
  'socio', 'qsa', null, null, null, null, '22',
  cast('2026-01-11' as date),
  'basedosdados.br_me_cnpj.socios?data=2026-01-11&cnpj_basico=60000000'
