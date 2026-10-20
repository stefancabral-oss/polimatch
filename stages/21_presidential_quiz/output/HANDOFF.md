# Handoff — issue #246

## Mudança
Edição presidencial 02: 20 perguntas, oito falas históricas/polêmicas de Lula, oito resumos do plano de Flávio registrado no TSE, duas falas de Janja e duas de Nikolas. Duas cartas por pergunta, autor correto sempre entre elas; posições variadas. Retratos autorizados do acervo preservados.

Resumo de proposta é identificado e não recebe aspas. Revelação mostra fonte e página, contexto e retratação quando pertinente. Inclui ligação entre a fala sobre democracia de 2023 e o posicionamento de 2025, sem declarar contradição comprovada automaticamente. Recorte editorial solicitado fica transparente em Sobre as falas desta edição. Reconhecimento do autor não valida a afirmação.

## Compatibilidade e jogo
Edição anterior permanece em ?edicao=1, com a chave de progresso antiga. A presidencial usa chave própria e ?edicao=2 para compartilhar. Pontuação local de conhecimento e nenhuma chamada às APIs de voto ou ranking. Feedback Acertou na mosca / Essa te pegou; resultado perfeito recebe mensagem correta e a instrução de escolher carta não aparece no fechamento.

## Verificação
208 testes frontend aprovados. Chromium local em 320/390/768/1440 px: todas as 20 perguntas, propostas sem aspas, quatro autores, fontes após responder, teclado, reload, reinício, compartilhar com edição, storage bloqueado e alternância preservando o progresso da edição antiga. Build multi-page e isolamento dos assets do piloto aprovados. git diff --check aprovado. CI remoto e deploy serão complementados por recibo na PR.

## Limites e gate
Seleção não é neutra nem exaustiva da carreira. Frases com conteúdo pejorativo são registros contextualizados e não humor dirigido a grupos protegidos. Propostas são intenções sujeitas à implementação, não garantias ou realizações. Sem sync entre dispositivos. Fontes externas podem mudar.

Base 5ddf9c6; branch feat/246-presidential-quiz. Usuário aprovou a etapa 20 e a nova direção editorial. Revisão humana da nova implementação ainda pendente; manter #246 aberta para esse retorno.
