# PoliMatch — Contexto global ICM

## Entrega consolidada autorizada em 17/09/2026

Stefan solicitou uma única PR sem conflitos com as issues abertas prontas.
O estágio 16 registra o escopo e as decisões desta entrega, incluindo coleção
gratuita, aquecimento/desempate e fechamento pessoal. A autorização permite
consolidar unidades na mesma PR, sem fabricar gates humanos ou mesclar sem revisão.
## Recuperação autorizada em 17/09/2026 — issue #202

Stefan solicitou construir as issues e recolocar o jogo em operação, escolhendo
expressamente restaurar fotografias existentes nas cartas e adiar ilustrações.
O estágio ativo é `stages/15_operation_recovery/CONTEXT.md`. A recuperação pode
publicar um catálogo mínimo de nome/fotografia previamente selecionada, com estado
`restored`; não equivale à aprovação dos textos editoriais, da taxonomia pendente
ou de agregados. Esses conteúdos continuam retidos até suas próprias evidências.

## Integração autorizada em 17/09/2026

O responsável solicitou mesclar as PRs pendentes #191, #194, #195, #199, #200 e
#201. A combinação é documentada em `stages/14_aggregate_publication/CONTEXT.md`.
O código inclui DOM persistente, perfil acessível, taxonomia, gate editorial,
piloto de arte bloqueado e controle de publicação agregada. A mescla não encerra
as validações humanas das issues #166, #167, #171, #173, #176 e #177.
Conteúdo sem aprovação externa e agregados sem autoridade continuam retidos.

## Norte do produto

Desde 12/11/2026, por decisão do Stefan, a direção do PoliMatch é ser uma pesquisa de preferência por foto: a pessoa se diverte escolhendo fotos e disso sai a preferência do público. O registro completo está em `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`.

Essa direção ainda não está no ar. O que está em produção continua sendo o jogo casual de comparação descrito nesta página, e as decisões abaixo seguem valendo para ele até que cada etapa da direção nova passe pelo gate humano.

Norte anterior, mantido como histórico: "PoliMatch é um jogo casual de comparação entre personalidades públicas. Não é pesquisa eleitoral. O produto deve ser simples de jogar, visualmente próprio, colecionável e agradável no celular." A frase "Não é pesquisa eleitoral" continua valendo, e exibida, no que está no ar. Ela deixa de valer para a direção nova: o texto que a substitui ali depende da revisão jurídica (Q5 da #277), e até lá o repositório não afirma nenhum enquadramento para a pesquisa por foto.

## Direção nova: pesquisa de preferência por foto — issue #318

Em 12/11/2026 Stefan respondeu à Q1 da #277 com um caminho fora das três opções. Estágio `stages/67_photo_survey_direction/CONTEXT.md`. Resumo da decisão:

- Cada pesquisa é um conjunto de fotos e uma pergunta curta, com começo e fim. Só foto e nome, sem texto para ler.
- Qualquer pessoa joga. A escolha só entra na pesquisa com cadastro por CPF.
- Quem jogou vê os cinco primeiros. Só a resposta somada sai do PoliMatch, nunca o dado de uma pessoa.
- Abre com Política, Famosos e influenciadores, e Futebol.
- Os jogos de leitura e a parte cívica e de notícias ficam no ar sem trabalho novo.
- Telas novas minimalistas: fundo neutro, um único verde, foto sem moldura na hora do voto.

Nada disso está liberado para produção por este registro. A ordem do trabalho é maturidade primeiro (#309), e as respostas às Q2, Q3 e Q4, com a proposta para a Q6, estão na #277; nenhuma delas libera produção. Continuam sem resposta a Q5 (controlador de dados e revisão jurídica), a visibilidade do repositório e a convivência entre o login Google e o CPF. O gate de publicação agregada (#177) e a política de integridade do voto continuam em vigor.

Antes de propor ou alterar tela, regra de voto ou cadastro, ler o registro de decisão: ele lista o que continua valendo e o que deixa de valer para as telas novas.

## Decisões atuais aprovadas

As decisões desta lista descrevem o que está no ar. A referência para o que não se aplica à direção nova é a tabela do registro de decisão. A marca "Substituída para as telas da pesquisa por foto" aparece só nas principais, como atalho.

- O frontend anterior foi rejeitado e será substituído, não remendado.
- A direção de arte `Malaquita 2026 / Digital First` enviada em 13/09/2026 está aprovada e é a referência visual oficial. Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue valendo para o que está no ar.
- O shell usa malaquita escura; porcelana aparece em placas de nome e superfícies editoriais; ouro indica progresso e raridade.
- Cards têm moldura facetada, fotografia dominante, marca pequena, raridade no canto e placa inferior clara.
- Chromas ampliam luz, cor e materialidade progressivamente; o efeito prismático máximo é reservado à Chroma comemorativa.
- O catálogo mestre tem 125 pessoas reconhecíveis: 100 nomes políticos e 25 influenciadores. Por decisão do usuário em 15/09/2026, os influenciadores com fotografia aprovada também participam da edição principal enquanto a edição independente ainda não existe.
- O núcleo é uma rodada rápida de quatro pessoas: todas aparecem com a mesma exposição, um toque confirma uma única preferida e a rodada seguinte traz quatro novas opções.
- Cada escolha gera três comparações auditáveis para o ranking — a escolhida vence as outras três — mas conta como uma única rodada para o jogador e para os indicadores de uso.
- O menu de assuntos nasce pronto para expansão, mas somente `Eleições 2026` estará ativo na primeira edição; ela reúne todos os perfis com fotografia aprovada.
- `Influenciadores` poderá ser uma edição independente futura, sem retirar essas personalidades da edição principal atual.
- Escândalos e acontecimentos serão curadorias independentes, começando posteriormente por casos como Banco Master, Mensalão, INSS e 8 de Janeiro.
- Cada pessoa terá perfil educativo, fontes e contexto suficientes para uma escolha informada. Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue valendo para o que está no ar.
- Existirão ranking da edição e ranking pessoal. Ranking geral entre assuntos só será exibido quando houver mais de um assunto ativo. Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue valendo para o que está no ar.
- Cards e Chromas são colecionáveis; Chromas são obtidas por sorte e não determinam o ranking.
- Duelos usam carta padrão por default. Apenas o próprio jogador pode aplicar uma Chroma possuída àquela pessoa.
- Novos debates e discussões podem lançar novas Chromas versionadas sem alterar votos ou rankings anteriores.
- A suspensão temporária da Coleção em 15/09/2026 é substituída pela entrega da #183 autorizada em 17/09/2026: a navegação mostra `Início`, `Duelo`, `Coleção` e `Ranking` quando a coleção está habilitada. A entrada abre inventário real adquirido gratuitamente; a antiga galeria de demonstração sai do fluxo.
- As fotografias serão curadas e tratadas com padrão profissional, sem alterar a identidade da pessoa.
- A aprovação visual dos retratos começa por um lote de dez pessoas antes da escala fotográfica completa.
- O app continua online-only: nenhuma escolha é confirmada antes do servidor.
- A identidade sonora usa impactos graves, atrito curto e brilho metálico discreto, sintetizados localmente após interação do usuário; nunca varia por pessoa e oferece controle persistente para desligar.
- O resultado da rodada permanece por um instante nas quatro cartas: a escolhida sobe e acende, as outras três descem e perdem saturação, sempre com os deltas reais de Elo e sem cobrir os rostos. Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue valendo para o que está no ar.
- Faixas de Elo e eventos de ultrapassagem, subida, queda e baixa pontuação recebem respostas visuais, sonoras e hápticas próprias. O texto pode provocar com humor leve, mas nunca julga ideologia ou dignidade da pessoa.
- Por decisão do usuário em 15/09/2026, o acesso com Google entra como opção simples para salvar e recuperar progresso; jogar anonimamente continua permitido. Publicação automática permanece fora do primeiro corte e compartilhamento será iniciado pelo usuário.

## Referências visuais aprovadas

- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/01_duelo_mobile.jpeg`
- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/02_sistema_raridades.jpeg`
- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/03_chroma_comemorativa.jpeg`

Essas peças definem direção de arte, não dimensões literais da interface. A implementação deve preservar leitura, toque e as quatro cartas completas na mesma tela: grade 2 × 2 no celular e uma fileira de quatro no desktop.

As explorações posteriores estão documentadas em `stages/10_rebuild_eleicoes_2026/references/ART_DIRECTION.md`. Elas podem fornecer textura editorial e inspiração para a revelação, mas não substituem a fonte de verdade.

## Estado técnico atual

- Frontend: Vite/JavaScript.
- PWA e frontend consolidados em `app/`; o diretório duplicado `front/` foi removido nesta reconstrução.
- Backend/API e ranking agregado já existem.
- Produção usa Dokploy e o autodeploy não tem se mostrado confiável; publicação precisa ser confirmada manualmente.
- Houve regressão anterior em que o PWA redirecionava para Ranking quando player-sync falhava; hotfix já foi aplicado.
- O redesign anterior foi parcial e sofreu com cascata CSS; esta rodada deve evitar overlays intermináveis e consolidar componentes novos.

## Objetivo deste programa ICM

Construir do zero um frontend coerente e testável para `Eleições 2026`, preservando somente contratos sólidos do backend e removendo as camadas visuais anteriores.

## Fora de escopo desta rodada

- Outros provedores de identidade além do acesso opcional com Google aprovado na etapa 11.
- Migração de banco motivada apenas por autenticação.
- Construção das edições independentes `Influenciadores` e `Escândalos`.
- Manipulação de ranking para favorecer qualquer pessoa.
- Reescrita desnecessária do backend que não seja exigida pelo frontend.

## Gate final

O programa só é considerado concluído quando:

1. O usuário escolhe `Eleições 2026` e chega à primeira rodada de quatro sem ambiguidade.
2. As quatro cartas aparecem juntas, com a mesma exposição, sem exigir rolagem para decidir em iPhone e desktop.
3. A pessoa pode entender quem é cada participante sem perder a rodada atual.
4. O voto só produz resultado depois de confirmado pelo servidor.
5. Ranking da edição, ranking pessoal e coleção têm papéis claramente separados.
6. Cards básicos e revelação de Chroma passam por gate visual humano.
7. O catálogo mestre contém exatamente 125 pessoas e cada assunto público expõe apenas perfis e fotografias aprovados para aquela curadoria.
8. Testes críticos, build, deploy e QA pós-deploy são confirmados.

## Duas escolhas ordenadas — issue #239
A decisão posterior de Stefan substitui a escolha única no núcleo de quatro cartas: primeira preferência recebe mais pontos que segunda; as duas restantes recebem a mesma penalização. O estágio ativo é stages/19_ordered_two_choices/CONTEXT.md. Histórico e modos binários permanecem compatíveis. Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue valendo para o que está no ar.

## Quem disse isso? — issue #244
Novo modo de conhecimento aprovado por Stefan, independente do ranking político. Estágio stages/20_quote_quiz/CONTEXT.md. Layout: duas cartas clicáveis, nome uma vez, frase real e revelação com fonte.

## Edição presidencial — issue #246
Stefan aprovou o resultado do estágio 20 e definiu novo recorte editorial, com vozes misturadas e propostas oficiais. Estágio ativo: stages/21_presidential_quiz/CONTEXT.md. Preservar autoria real e distinguir resumo de plano de citação literal.

## Duelos da corrida e Chroma — issue #249
Em 21/10/2026 Stefan solicitou duelos com todas as categorias de apoiadores
consolidadas na conversa e uma nova camada visual de cartas TCG. Estágio ativo:
`stages/22_presidential_chroma_duels/CONTEXT.md`. Esta curadoria tem temas próprios,
não substitui snapshots históricos e exclui Michelle, Jair, Eduardo Bolsonaro e
Romeu Zema. As regras de duas escolhas e confirmação online permanecem vigentes.

## Correção do menu da corrida — issue #255
Em 23/10/2026 Stefan apontou a navegação sobreposta às cartas no celular.
Estágio 25: faixa inferior em linha própria, conteúdo rolável separado, sem
mudar jogo ou pontuação. As Chromas especiais Lula 13 e Flávio 22 são artes
do estágio 26, apresentadas para avaliação e ainda fora do runtime.

## Completar menu principal — issue #259
Em 23/10/2026 Stefan mostrou que a página principal ainda conserva outro menu
flutuante. Estágio 27 aplica a mesma faixa separada também ao shell de Início,
Duelo, Coleção e Ranking, preservando navegação cívica e controles existentes.

## Capa presidencial — issue #261
Em 23/10/2026 Stefan pediu Flávio, Lula, Nikolas e Janja na capa principal.
Estágio 28 usa as artes especiais existentes Flávio azul/22 e Lula vermelha/13
somente na capa, preservando jogos, inventário e as Malaquitas de Nikolas/Janja.
Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue
valendo para o que está no ar.

## Vinte Chromas Políticos — issue #263
Em 23/10/2026 Stefan solicitou refinar todas as Chromas da seção política.
Estágio 29 renova as vinte artes da categoria politicos na corrida, com masters,
fontes, prompts e derivados rastreáveis. Preserva capa, demais categorias e regras.

## Rodada diária com Chromas e encaixe no iPhone — issue #265
Em 24/10/2026 Stefan reportou que a raiz ainda não ativava as novas artes e
pediu reduzir a escala no iPhone 17 Pro Max. Estágio 30 aplica as edições
existentes aos slots persistentes diários/livres/pares, mantendo a foto documental
como reserva. A grade móvel usa o espaço restante real do shell. Sem mudar
sessão diária, escolhas, ranking ou propriedade de itens da Coleção.
Substituída para as telas da pesquisa por foto pela decisão 0001 (#318); segue
valendo para o que está no ar.

## Fato ou fake — issue #267
Em 24/10/2026 Stefan solicitou jogo com falas pragmáticas do debate da Globo
de 23/10/2026. Estágio 31 inclui autoria, revelação explicada e documentos
consultáveis. Selecionar apenas verdadeiro/falso claros; não converter
qualificações editoriais ou promessas em falsidade. Jogos e ranking preservados.

## Capa dos duelos — issue #269
Stefan pediu Flávio e Lula no lugar de Marçal e Erika na vitrine da arena
independente. Estágio 32 reutiliza as artes especiais e preserva Nikolas/Janja.

## Quiz combinado e Chromas — issue #271
Stefan pediu juntar autoria e checagem no Quem disse isso, com selo grande e
resposta livre, e usar as artes novas nas cartas. Estágio 33 preserva edições
anteriores, fontes e separação entre erro de autoria e falsidade do conteúdo.

## Checagem documental — issue #273
Stefan autorizou validar a pauta do Mentiras do Lula contra documentos e dados
originais e incorporar as conclusões sustentadas. Estágio 34 registra 13 itens
do debate e oito anteriores; edição 4 preserva versões/progresso e restringe
o selo aos recortes verificáveis. Sem transformar ausência de prova em falso.

## Proteger o banco — issue #279
A auditoria de 30/10/2026 apontou falta de backup externo e de restauração
provada. Estágio 37: reset da edição só em banco vazio, smokes restritos a
banco descartável e fora da imagem, backup com manifesto, ensaio de
restauração e docs/ops. Painéis, bucket e ensaio com dump real ficam com Stefan.

## Primeira visita sem jogador — issue #282
Auditoria de maturidade de 30/10/2026, bloqueio B4. Estágio 40: capa,
navegação e quizzes abrem sem escrita no servidor; o jogador anônimo nasce na
primeira jogada. A recusa da cota de jogos novos por rede tem aviso próprio,
com login Google e horário de liberação, e a janela passa ao dia editorial.
O limite de 3 por rede continua até a decisão Q4 da #277.
