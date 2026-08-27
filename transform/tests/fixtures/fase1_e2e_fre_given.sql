select
  '10000000000100' as CNPJ_Companhia,
  'LISTADA SEMENTE S.A.' as Nome_Companhia,
  cast('2026-06-30' as date) as Data_Referencia,
  90 as ID_Documento,
  'CONTROLADOR DE DOCUMENTO ANTIGO' as Acionista,
  'PF' as Tipo_Pessoa_Acionista,
  '98765432100' as CPF_CNPJ_Acionista,
  cast(null as integer) as ID_Acionista_Relacionado,
  cast(null as varchar) as Acionista_Relacionado,
  cast(null as varchar) as Tipo_Pessoa_Acionista_Relacionado,
  cast(null as varchar) as CPF_CNPJ_Acionista_Relacionado,
  'S' as Acionista_Controlador,
  'N' as Participante_Acordo_Acionistas,
  90.0 as Percentual_Acao_Ordinaria_Circulacao,
  90.0 as Percentual_Total_Acoes_Circulacao
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'ALICE CONTROLADORA', 'PF', '111.444.777-35',
  null, null, null, null, 'S', 'N', 5.0, 5.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'CARLOS CPF COLISAO', 'PF', '123.555.666-00',
  null, null, null, null, 'S', 'N', 1.0, 1.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'DAVI CPF COLISAO', 'PF', '987.555.666-11',
  null, null, null, null, 'S', 'N', 1.0, 1.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'CAMILA CITADA', 'PF', cast(null as varchar),
  null, null, null, null, 'N', 'S', 4.9, 4.9
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'HOLDING PUBLICA INTERMEDIARIA S.A.', 'PJ', '20000000000100',
  null, null, null, null, 'N', 'N', 60.0, 60.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'HOLDING CONTROLADORA QSA LTDA', 'PJ', '12000000000100',
  null, null, null, null, 'S', 'N', 15.0, 15.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'JOSE CITADO NA ARVORE', 'PF', cast(null as varchar),
  20, 'HOLDING CONTROLADORA QSA LTDA', 'PJ', '12000000000100',
  'S', 'N', 99.0, 99.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'HOLDING SEM PORTA S.A.', 'PJ', '13000000000100',
  null, null, null, null, 'N', 'N', 5.0, 5.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'Outros', cast(null as varchar), cast(null as varchar),
  null, null, null, null, 'N', 'N', 20.0, 20.0
union all
select
  '10000000000100', 'LISTADA SEMENTE S.A.', cast('2026-06-30' as date), 100,
  'Ações em Tesouraria', 'PJ', '10000000000100',
  null, null, null, null, 'N', 'N', 10.1, 10.1
union all
select
  '20000000000100', 'HOLDING PUBLICA INTERMEDIARIA S.A.',
  cast('2026-06-30' as date), 200,
  'DIANA HOLDING', 'PF', cast(null as varchar),
  null, null, null, null, 'S', 'N', 80.0, 80.0
union all
select
  '13000000000100', 'HOLDING SEM PORTA S.A.',
  cast('2026-06-30' as date), 130,
  'INES CONTROLADORA SEM PORTA', 'PF', cast(null as varchar),
  null, null, null, null, 'S', 'N', 80.0, 80.0
union all
select
  '30000000000100', 'HOP FRE S.A.', cast('2026-06-30' as date), 300,
  'ALICE CONTROLADORA', 'PF', '111.444.777-35',
  null, null, null, null, 'S', 'N', 60.0, 60.0
union all
select
  '30000000000100', 'HOP FRE S.A.', cast('2026-06-30' as date), 300,
  'ELENA PARCEIRA DO HOP', 'PF', '222.555.888-00',
  null, null, null, null, 'N', 'N', 20.0, 20.0
union all
select
  '90000000000100', 'SEGUNDA DESCIDA S.A.', cast('2026-06-30' as date), 900,
  'ELENA PARCEIRA DO HOP', 'PF', '222.555.888-00',
  null, null, null, null, 'S', 'N', 70.0, 70.0
union all
select
  '90000000000100', 'SEGUNDA DESCIDA S.A.', cast('2026-06-30' as date), 900,
  'GABRIELA FORA DO PRIMEIRO HOP', 'PF', '333.666.999-11',
  null, null, null, null, 'N', 'N', 30.0, 30.0
union all
select
  '91000000000100', 'HOMONIMO SEM CPF S.A.', cast('2026-06-30' as date), 910,
  'ALICE CONTROLADORA', 'PF', cast(null as varchar),
  null, null, null, null, 'S', 'N', 80.0, 80.0
union all
select
  '91000000000100', 'HOMONIMO SEM CPF S.A.', cast('2026-06-30' as date), 910,
  'HELENA FORA DO HOP', 'PF', '444.777.000-22',
  null, null, null, null, 'N', 'N', 20.0, 20.0
