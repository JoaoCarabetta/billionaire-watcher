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
