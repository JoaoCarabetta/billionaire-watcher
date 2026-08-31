# Profile: stg_bcb_ifdata_cadastro

Source: `bcb.ifdata_cadastro`. Downloader subset. Quarter default `202603`.

## Overview

- **Grain**: one reporter (`CodInst`) per quarter
- **Primary key**: `id_instituicao`

## Column analysis

Join to valores: `coalesce(id_conglomerado_prudencial, id_instituicao) = valores.id_instituicao`. `CnpjInstituicaoLider` is CNPJ8. `Situacao` A/I.

## Recommended seed filter (not applied)

`situacao = 'A'` when building the bank floor.
