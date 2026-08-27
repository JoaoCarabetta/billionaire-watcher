select
  '01234567000189' as codigoCNPJ14,
  'BANCO COM ZERO INICIAL' as nomeEntidadeInteresse,
  3 as codigoTipoSituacaoPessoaJuridica,
  8 as codigoTipoEntidadeSupervisionada
union all
select 22345678000190, 'COOPERATIVA TIPO 3', 3, 3
union all
select 32345678000191, 'COOPERATIVA TIPO 9', 3, 9
union all
select 42345678000192, 'COOPERATIVA TIPO 11', 3, 11
union all
select 52345678000193, 'BANCO SEM FUNCIONAMENTO', 8, 2
union all
select 62345678000294, 'FILIAL NAO SEDE', 3, 2
union all
select 123456789, 'CHAVE CURTA NAO E CNPJ', 3, 2
