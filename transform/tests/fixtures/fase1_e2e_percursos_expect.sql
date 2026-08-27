select
  'p-8c2d3a75' as pessoa_id,
  '10000000000100' as empresa_semente_id,
  'p-8c2d3a75|10000000000100|fre|2026-06-30' as percurso_id,
  cast(1 as int64) as passo,
  'pessoa' as origem_tipo,
  'p-8c2d3a75' as origem_pessoa_id,
  cast(null as varchar) as origem_empresa_id,
  '10000000000100' as destino_empresa_id,
  'acionista_controlador' as papel,
  'fre' as fonte,
  true as acionista_controlador,
  false as participante_acordo_acionistas,
  5.0::double as percentual_on,
  5.0::double as percentual_total,
  cast(null as varchar) as qualificacao,
  cast('2026-06-30' as date) as data_referencia,
  'controlador_fre' as regra_do_passo,
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100' as fonte_documento
union all
select
  'p-f0a39f5c', '10000000000100',
  'p-f0a39f5c|10000000000100|fre|2026-06-30',
  cast(1 as int64),
  'pessoa', 'p-f0a39f5c', null, '10000000000100',
  'acionista_controlador', 'fre', true, false, 1.0, 1.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-20953853', '10000000000100',
  'p-20953853|10000000000100|fre|2026-06-30',
  cast(1 as int64),
  'pessoa', 'p-20953853', null, '10000000000100',
  'acionista_controlador', 'fre', true, false, 1.0, 1.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-provisorio-38456fff6f5e6fd9', '10000000000100',
  'p-provisorio-38456fff6f5e6fd9|20000000000100|fre|2026-06-30>>20000000000100>10000000000100>fre>2026-06-30',
  cast(1 as int64),
  'pessoa', 'p-provisorio-38456fff6f5e6fd9', null, '20000000000100',
  'acionista_controlador', 'fre', true, false, 80.0, 80.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=200'
union all
select
  'p-provisorio-38456fff6f5e6fd9', '10000000000100',
  'p-provisorio-38456fff6f5e6fd9|20000000000100|fre|2026-06-30>>20000000000100>10000000000100>fre>2026-06-30',
  cast(2 as int64),
  'empresa', null, '20000000000100', '10000000000100',
  'acionista', 'fre', false, false, 60.0, 60.0, null,
  cast('2026-06-30' as date),
  'dez_por_cento_on',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-provisorio-ff84fed3d3bd953a', '10000000000100',
  'p-provisorio-ff84fed3d3bd953a|12000000000100|qsa|2026-01-11>>12000000000100>10000000000100>fre>2026-06-30',
  cast(1 as int64),
  'pessoa', 'p-provisorio-ff84fed3d3bd953a', null, '12000000000100',
  'socio', 'qsa', null, null, null, null, '22',
  cast('2026-01-11' as date),
  'socio_qsa',
  'basedosdados.br_me_cnpj.socios?data=2026-01-11&cnpj_basico=12000000'
union all
select
  'p-provisorio-ff84fed3d3bd953a', '10000000000100',
  'p-provisorio-ff84fed3d3bd953a|12000000000100|qsa|2026-01-11>>12000000000100>10000000000100>fre>2026-06-30',
  cast(2 as int64),
  'empresa', null, '12000000000100', '10000000000100',
  'acionista_controlador', 'fre', true, false, 15.0, 15.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-provisorio-46a7c8979f5f35ea', '10000000000100',
  'p-provisorio-46a7c8979f5f35ea|12000000000100|fre|2026-06-30>>12000000000100>10000000000100>fre>2026-06-30',
  cast(1 as int64),
  'pessoa', 'p-provisorio-46a7c8979f5f35ea', null, '12000000000100',
  'acionista_controlador', 'fre', true, false, 99.0, 99.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
union all
select
  'p-provisorio-46a7c8979f5f35ea', '10000000000100',
  'p-provisorio-46a7c8979f5f35ea|12000000000100|fre|2026-06-30>>12000000000100>10000000000100>fre>2026-06-30',
  cast(2 as int64),
  'empresa', null, '12000000000100', '10000000000100',
  'acionista_controlador', 'fre', true, false, 15.0, 15.0, null,
  cast('2026-06-30' as date),
  'controlador_fre',
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=100'
