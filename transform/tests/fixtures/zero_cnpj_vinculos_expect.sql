select
  'empresa' as origem_tipo,
  cast(null as varchar) as origem_pessoa_id,
  'nome:HOLDINGFANTASMAALFA' as origem_empresa_id,
  '14000000000100' as destino_empresa_id,
  'acionista_controlador' as papel,
  'fre' as fonte,
  true as acionista_controlador,
  false as participante_acordo_acionistas,
  50.0::double as percentual_on,
  50.0::double as percentual_total,
  cast(null as varchar) as qualificacao,
  cast('2026-06-30' as date) as data_referencia,
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=140' as fonte_documento
union all
select
  'pessoa', 'p-b7148766', cast(null as varchar), 'nome:HOLDINGFANTASMAALFA',
  'acionista_controlador', 'fre', true, false, 50.0, 50.0, null,
  cast('2026-06-30' as date),
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=140'
union all
select
  'empresa', cast(null as varchar), 'nome:HOLDINGFANTASMABETA',
  '15000000000100', 'acionista_controlador', 'fre', true, false, 50.0, 50.0, null,
  cast('2026-06-30' as date),
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=150'
union all
select
  'pessoa', 'p-cfb6dd27', cast(null as varchar), 'nome:HOLDINGFANTASMABETA',
  'acionista_controlador', 'fre', true, false, 50.0, 50.0, null,
  cast('2026-06-30' as date),
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_2026.zip#fre_cia_aberta_posicao_acionaria_2026.csv;ID_Documento=150'
