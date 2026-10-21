# ICM 22 — Duelos da corrida presidencial

Issue: https://github.com/stefancabral-oss/polimatch/issues/249
Branch: `feat/presidential-chroma-duels`
Base: `dac70018ac1c37c2e1abf004a8bb4d622ed31e7e`

## Entrega
- Nova entrada na home e página `duelos-da-corrida.html`, com identidade própria PoliMatch/Chroma Malaquita: borda facetada, dupla gravação, verniz holográfico reativo, placa de porcelana, número da carta e marcações 1ª/2ª escolha.
- 104 identidades únicas, 107 vínculos em seis categorias: 20 políticos, 11 empresários, 20 influenciadores, 20 artistas/cantores, 15 internacionais e 20 lideranças sem mandato. Soma por categoria contém repetições autorizadas; o baralho de uma categoria nunca duplica uma identidade.
- Mantidas as lacunas das listas anteriores: não inventa oito empresários nem cinco internacionais de apoio a Lula. Erasmo integra os dois apoios como uma única carta. Pablo tem uma identidade em três categorias.
- Michelle, Jair, Eduardo Bolsonaro e Romeu Zema ficam fora desta curadoria; o histórico da edição original permanece íntegro.
- Retratos locais com SHA-256 e origem em `shared/presidential-roster.json`. Fontes originais preservadas byte a byte. Enquadramento/orientação são propriedades do componente, sem gerar pessoas ou fatos.
- Elenco completo, busca sem acentos, filtros por categoria e perfis com fontes. Não promove perfis editoriais pendentes a aprovados.
- Partida pessoal de dez rodadas, quatro cartas por mesa. Dois toques distintos confirmam 1ª +24, 2ª +8, demais −16 cada. Escolhas, ranking e versão são confirmados pela API existente.
- Repetição após perda da resposta usa os mesmos UUID, cartas e ordem. Conta trocada em outra aba invalida respostas antigas. Nenhuma confirmação offline.
- Ranking independente por categoria; inicialização adiciona novos pools para jogadores existentes sem zerar escolhas anteriores.
- Compartilhamento iniciado pelo jogador, cópia e texto manual alternativos; reiniciar a partida não apaga ranking/histórico.

## Verificação
- Suíte completa local: 93 testes compartilhados, 232 backend, 211 frontend, todos aprovados.
- Build e validação de assets/retratos/fingerprint aprovadas; piloto bloqueado #176 continua fora do pacote.
- Chromium: celular e desktop, dez rodadas completas, replay após perda de resposta + reload, offline/reconexão, seis categorias, todos os perfis, busca, fontes, som, ranking, compartilhar e reiniciar.
- Geometria: 320, 375, 768 e 1440 px; quatro cartas na mesma linha no desktop, grade 2×2 no celular, sem overflow horizontal.
- CI inclui smoke PostgreSQL com jogadores antigos e novos, isolamento, replay, pontuação e histórico preservado; inclui E2E Chromium e WebKit.
- Screenshots reais da implementação em `output/screenshots/`.

## Limites e gate
- Não foi alterada a produção nem o branch main nesta entrega.
- Human gate visual continua pendente, conforme AGENTS.md: “Nenhum agente aprova o próprio human gate.” Stefan revisa as telas e o elenco antes da promoção.
- Origem pública registrada não equivale a licença universal; a revisão de publicação deve conferir os créditos/licenças nas fontes, principalmente fotografias novas e recortes de publicações. Não foi fabricada autorização editorial nem de imagem.
- CI PostgreSQL/WebKit precisa estar verde antes do merge. Instalação local desses runtimes foi bloqueada pelos espelhos de download; suas verificações executam nos serviços da CI.
- Esta curadoria registra os apoios da seleção anterior datada de 21/10/2026; não é atualização automática nem mede engajamento Meta.

## Próximo passo
Revisar esta PR e as prévias; com gate visual aprovado e CI verde, mesclar e publicar frontend e API juntos, verificando a versão implantada e uma rodada real em produção.
