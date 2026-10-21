# [ICM 22] Duelos da corrida presidencial e cartas Chroma — #249

## Objetivo e autorização
Pedido de Stefan em 21/10/2026: criar duelos com todas as listas consolidadas,
com acabamento mínimo de Chroma da capa e riqueza gráfica de um jogo TCG.
O usuário confirmou expressamente **todas as categorias**, não apenas as 40
lideranças. Issue #249; branch `feat/presidential-chroma-duels`.

## Entradas
- Conversa: listas finais de políticos e lideranças sem mandato; listas anteriores
  de empresários, influenciadores, artistas e internacionais; exclusões expressas.
- Referência enviada: `references/home-reference.png`.
- `app/src/main.js`, `photos.js`, `chroma-motion.js`, `styles.css`.
- Contratos existentes de round-vote, sessão anônima e ranking pessoal.

## Escopo
- Curadoria nova versionada com todas as pessoas confirmadas, fontes e retratos.
- Categorias independentes, busca de elenco e rodada de quatro com duas escolhas
  ordenadas; a primeira vale +24, a segunda +8, as duas demais −16 cada.
- Uma identidade por pessoa e vários vínculos de categoria/apoio quando pertinente.
- Camada Chroma uniforme: fotografia dominante, moldura facetada dourada,
  malaquita, foil e luz reativa, tipografia legível; nomes sem duplicação.
- Novo modo integrado à home, escolhas confirmadas pelo servidor e ranking por
  categoria. Compartilhamento explícito; sem resultado público fictício.
- Manter íntegros o catálogo histórico, votos, quiz e contratos existentes.

## Direção visual antes da implementação
- Retrato em 5:7; nome na placa inferior em porcelana; moldura dupla gravada em
  ouro e malaquita; halo sutil, verniz direcional e filigrana geométrica.
- A mesma Chroma inicial para todas as pessoas. Acabamentos não dependem do apoio.
- Mesa 2×2 no celular, quatro cartas no desktop, seleção sinalizada por 1º/2º.
- Home com quatro cartas do elenco atual, sem as quatro exclusões desta curadoria.
- Referência TCG diz respeito a materialidade e acabamento; marca própria PoliMatch.

## Exclusões e limites
- Michelle Bolsonaro, Jair Bolsonaro, Eduardo Bolsonaro e Romeu Zema não entram
  nesta curadoria. Não completar artificialmente listas com menos de dez apoios.
- Não fabricar biografias, aprovação editorial, números de engajamento ou retratos.
- Não alterar a pontuação por lado, pessoa, categoria ou aparência.
- Esta etapa não concede retrospectivamente aprovação a gates editoriais antigos.

## Critérios de aceite
- Elenco e exclusões verificáveis por teste; fontes e integridade dos retratos.
- Nenhuma rodada oferece pessoa fora da categoria; não duplica a mesma identidade.
- Dois toques distintos confirmam uma rodada; repetição e erro de rede preservam
  roundId e ordem; respostas antigas não trocam categoria/sessão.
- Trocar categoria, voltar, abrir perfil, ranking, compartilhar, reiniciar sessão de
  jogo e conexão interrompida têm comportamento verificável.
- Fotografias reconhecíveis, nome legível, foco e toque acessíveis em 320–1440px.
- Testes proporcionais, build e CI; HANDOFF e verification.json com limitações reais.

## Gate humano
Stefan revisa a entrega concreta de arte e produto antes da promoção final.
Nenhum agente aprova esse gate nem encerra a issue #249 por conta própria.
