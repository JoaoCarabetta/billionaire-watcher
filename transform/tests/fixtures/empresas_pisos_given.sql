select
  '02916265000160' as empresa_id,
  '02916265000160' as cnpj,
  cast(1200 as numeric) as valor_do_piso,
  'bolsa_cotahist' as fonte_do_piso,
  true as tem_piso
union all
select
  '01234567000189', '01234567000189', cast(500 as numeric),
  'ifdata_ativo_total', true
union all
select
  '00999999000199', '00999999000199', cast(300 as numeric),
  'susep_premios_emitidos', true
