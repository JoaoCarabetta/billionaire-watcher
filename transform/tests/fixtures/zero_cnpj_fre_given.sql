select
  '14000000000100' as CNPJ_Companhia,
  'SEMENTE ALFA S.A.' as Nome_Companhia,
  cast('2026-06-30' as date) as Data_Referencia,
  140 as ID_Documento,
  'HOLDING FANTASMA ALFA' as Acionista,
  'PJ' as Tipo_Pessoa_Acionista,
  '00.000.000/0000-00' as CPF_CNPJ_Acionista,
  cast(null as integer) as ID_Acionista_Relacionado,
  cast(null as varchar) as Acionista_Relacionado,
  cast(null as varchar) as Tipo_Pessoa_Acionista_Relacionado,
  cast(null as varchar) as CPF_CNPJ_Acionista_Relacionado,
  'S' as Acionista_Controlador,
  'N' as Participante_Acordo_Acionistas,
  50.0 as Percentual_Acao_Ordinaria_Circulacao,
  50.0 as Percentual_Total_Acoes_Circulacao
union all
select
  '14000000000100', 'SEMENTE ALFA S.A.', cast('2025-12-31' as date), 140,
  'HOLDING FANTASMA ALFA', 'PJ', '00.000.000/0000-00',
  null, null, null, null, 'S', 'N', 99.0, 99.0
union all
select
  '14000000000100', 'SEMENTE ALFA S.A.', cast('2026-06-30' as date), 140,
  'JOAO ZERO HUB', 'PF', '555.666.777-88',
  1, 'HOLDING FANTASMA ALFA', 'PJ', '00.000.000/0000-00',
  'S', 'N', 50.0, 50.0
union all
select
  '15000000000100', 'SEMENTE BETA S.A.', cast('2026-06-30' as date), 150,
  'HOLDING FANTASMA BETA', 'PJ', '00.000.000/0000-00',
  null, null, null, null, 'S', 'N', 50.0, 50.0
union all
select
  '15000000000100', 'SEMENTE BETA S.A.', cast('2026-06-30' as date), 150,
  'MARIA ZERO HUB', 'PF', '666.777.888-99',
  1, 'HOLDING FANTASMA BETA', 'PJ', '00.000.000/0000-00',
  'S', 'N', 50.0, 50.0
