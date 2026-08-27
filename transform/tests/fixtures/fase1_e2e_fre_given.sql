select
  '10000000000100' as CNPJ_Companhia,
  'LISTADA SEMENTE S.A.' as Nome_Companhia,
  cast('2026-06-30' as date) as Data_Referencia,
  90 as ID_Documento,
  'CONTROLADOR DE DOCUMENTO ANTIGO' as Acionista,
  'PF' as Tipo_Pessoa_Acionista,
  '98765432100' as CPF_CNPJ_Acionista,
  'S' as Acionista_Controlador,
  'N' as Participante_Acordo_Acionistas,
  90.0 as Percentual_Acao_Ordinaria_Circulacao,
  90.0 as Percentual_Total_Acoes_Circulacao
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'ALICE CONTROLADORA', 'PF', '111.444.777-35', 'S', 'N', 5.0, 5.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'CAMILA CITADA', 'PF', cast(null as varchar), 'N', 'S', 4.9, 4.9
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'HOLDING PUBLICA INTERMEDIARIA S.A.', 'PJ', '20000000000100',
  'N', 'N', 60.0, 60.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'Outros', cast(null as varchar), cast(null as varchar),
  'N', 'N', 20.0, 20.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'Ações em Tesouraria', 'PJ', '10000000000100',
  'N', 'N', 10.1, 10.1
union all
select
  '20000000000100', 'HOLDING PUBLICA INTERMEDIARIA S.A.',
  cast('2026-06-30' as date), 200,
  'DIANA HOLDING', 'PF', cast(null as varchar), 'S', 'N', 80.0, 80.0
union all
select
  '30000000000100', 'HOP FRE S.A.', cast('2026-06-30' as date), 300,
  'ALICE CONTROLADORA', 'PF', '111.444.777-35', 'S', 'N', 60.0, 60.0
union all
select
  '30000000000100', 'HOP FRE S.A.', cast('2026-06-30' as date), 300,
  'ELENA PARCEIRA DO HOP', 'PF', '222.555.888-00', 'N', 'N', 20.0, 20.0
union all
select
  '90000000000100', 'SEGUNDA DESCIDA S.A.', cast('2026-06-30' as date), 900,
  'ELENA PARCEIRA DO HOP', 'PF', '222.555.888-00', 'S', 'N', 70.0, 70.0
union all
select
  '90000000000100', 'SEGUNDA DESCIDA S.A.', cast('2026-06-30' as date), 900,
  'GABRIELA FORA DO PRIMEIRO HOP', 'PF', '333.666.999-11', 'N', 'N', 30.0, 30.0
union all
select
  '91000000000100', 'HOMONIMO SEM CPF S.A.', cast('2026-06-30' as date), 910,
  'ALICE CONTROLADORA', 'PF', cast(null as varchar), 'S', 'N', 80.0, 80.0
union all
select
  '91000000000100', 'HOMONIMO SEM CPF S.A.', cast('2026-06-30' as date), 910,
  'HELENA FORA DO HOP', 'PF', '444.777.000-22', 'N', 'N', 20.0, 20.0
