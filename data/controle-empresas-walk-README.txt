Controle do passeio — empresas do recorte Valor
Data: 2026-08-27
Issue: #174

Este arquivo é o controle oficial de cada empresa do recorte combinado:
industrial 1–500 ∪ bancos ∪ seguradoras, mais Itaúsa, Folha e Excelsior
Alimentos. Não inclui o restante do Valor 1000 nem o livro de 757 emissores
do Cadastro.

Arquivo de dados
  data/controle-empresas-walk.csv
  UTF-8 com BOM, separado por ponto e vírgula.

Colunas
  nome;identificador;tipo_societario;no_grafo;porque;situacao_do_passeio;no_formulario;notas

Universo: 653 linhas de dados
  650 linhas de transform/seeds/valor_rankings_2025.csv
  + Itaúsa (lista de lançamento, sem linha de ranking)
  + Folha (grupo fechado, sem linha de ranking)
  + Excelsior Alimentos 95426862000197 (árvore no grafo; não está nas 650)

Contagens
  no_grafo              sim 184 / não 469
  situacao_do_passeio   só inventário 468
                        árvore no grafo 141
                        pulada-já-semente 35
                        grupo sem sócio 4
                        buraco 4
                        inventário-fechada-não-andar 1
  tipo_societario       sociedade anônima aberta 180
                        sociedade anônima fechada 4
                        desconhecido 469

Regras de tipo_societario
  sociedade anônima aberta  — cadastro ATIVO, raiz de hop listada,
                              skip_redraw, buraco do Formulário ou
                              semente listada.
  sociedade anônima fechada — só os quatro grupos fechados
                              (Folha, Globo, Havan, Record).
  desconhecido              — o restante. Não se infere Ltda pelo nome.

identificador
  14 dígitos quando listada / hop / pulada / buraco.
  slug folha / globo / havan / record para os grupos fechados.
  vazio quando desconhecido. Nunca se inventa sufixo /0001.

Notas de recorte
  Natura & Co. (industrial 60) permanece inventário-fechada-não-andar.
  Natura/Seabra não entram no grafo.
  Excelsior Alimentos 95426862000197 não é a seguradora Excelsior
  (insurers 41, Companhia Excelsior de Seguros).
  Dexco é 97837181000147 e não se rotula Votorantim.
  Havan já é industrial 119. As sementes listadas originais já estão
  no ranking. Vibra 34274233000102 é semente original no grafo e não
  consta da lista skip-34 do relatório de hops; mesmo assim fica
  pulada-já-semente.

Fontes (main)
  transform/seeds/valor_rankings_2025.csv
  transform/seeds/valor_group_not_dono.csv
  transform/seeds/valor_known_closed.csv
  transform/seeds/valor_launch_add_list.csv
  data/hops/valor-universo-report.txt
  data/hops/valor-universo.json
  public/grafo-publico.json
  src/lib/grafo-panel.ts LISTED_COMPANY_IDS (174)
  transform/models/hops/valor_universo_hop_roots.sql
  transform/models/inventory/valor_cadastro_inventory.sql
