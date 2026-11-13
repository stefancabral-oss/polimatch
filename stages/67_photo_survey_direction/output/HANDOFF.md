# HANDOFF — [ICM 67] Registrar a mudança de direção: pesquisa de preferência por foto

## Status

- Estado: aprovado
- Último commit: o que acompanha este handoff no PR #319
- Issue: #318, continua aberta
- Relacionada: #277, com a Q1 respondida pelo Stefan e, em comentário de
  12/11/2026, as Q2, Q3 e Q4 respondidas por delegação dele e uma proposta para
  a Q6. A Q5 segue aberta
- Base: `5e52ba8` (#317 já mesclada em main)
- Branch: `icm/67-photo-survey-direction`
- PR: https://github.com/stefancabral-oss/polimatch/pull/319
- Produção: não foi alterada

## O que este lote entrega

- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: a decisão do
  Stefan em oito pontos, a tabela do que ela substitui, o que continua valendo
  e o que não está decidido.
- `CONTEXT.md`: "Norte do produto" reescrito, com o norte anterior mantido como
  histórico; seção nova "Direção nova: pesquisa de preferência por foto"; marca
  "Substituída para as telas da pesquisa por foto" em sete decisões. Nenhuma
  linha foi apagada.
- `README.md`: aviso de direção logo depois da abertura e dois ponteiros na
  "Fonte de verdade".
- `AGENTS.md`: "Estado atual" manda ler o registro antes de mexer em tela,
  regra de voto ou cadastro, e diz o que do programa anterior não vale para as
  telas novas.
- `stages/67_photo_survey_direction/references/prototipo-pesquisa.html`: o
  protótipo navegável aprovado pelo Stefan, com nomes e rostos fictícios.
  Traz os três acréscimos que ele pediu depois da aprovação: compartilhar,
  avisos e indicação de amigos. São proposta de tela; as pendências que
  levantam estão em `references/README.md`.

## O que este lote não entrega

- **O desenho detalhado do formato.** A issue #318 previa esse texto em
  `references/`. Ficou só o protótipo. O desenho escrito mistura detalhe
  comercial e de revisão que não pertence a esta etapa e entra, limpo, nas
  etapas do servidor e das telas. A issue foi ajustada para dizer isso.
- **Correção dos números desatualizados do `README.md`** (125 pessoas, rotas,
  versão do Node). É da [ICM 61] #303.
- **Qualquer código de produto.** `app/`, `back/` e `shared/` não mudaram.

## Testes executados

- `git diff --name-only origin/main | grep -E '^(app|back|shared)/'`: sem
  resultado. Só documentação mudou.
- Busca por "Não é pesquisa eleitoral" em `CONTEXT.md`, `README.md`,
  `AGENTS.md` e `docs/decisions/`: duas linhas, nenhuma como definição da
  direção nova. A frase continua no rodapé do produto no ar
  (`app/src/presidential-page.js`) e em `docs/security/VOTE_ABUSE_POLICY.md`,
  e os textos novos dizem que ela segue valendo ali.
- `npm run test:shared`: 93 passaram, 0 falharam.
- `npm test --prefix app`: 245 passaram, 0 falharam.
- Os quatro arquivos apontados por links novos existem.

Não rodados:

- Testes do `back/`. As dependências do back não estão instaladas neste clone,
  e nenhum arquivo do back mudou.
- Workflows do GitHub. Os quatro workflows filtram por caminho (`app/**`,
  `back/**`, `shared/**`, `docs/design/**`, `docs/editorial/**` e alguns
  arquivos de estágios antigos). Nenhum dispara para os caminhos deste PR.

## Revisão

Um agente independente revisou o PR em 12/11/2026, a pedido do Stefan. Apontou
um bloqueio e nove ajustes:

- **Bloqueio.** O texto dizia que "Não é pesquisa eleitoral" deixava de valer e
  que o repositório não afirmava enquadramento, mas a frase segue no produto no
  ar. Corrigido: ela continua valendo no que está no ar e deixa de valer só
  para a direção nova.
- **Ajustes corrigidos.** Marca de "substituída" passou a remeter à tabela do
  registro; CPF como identificador "que faz a escolha contar"; três acréscimos
  do protótipo listados; `AGENTS.md` diz que nada está em produção e que o
  programa ativo é o de maturidade; detalhes de formato atribuídos ao
  protótipo; aviso do `README.md`; contagem da busca; redação de "desfazer a
  escolha"; título completo da seção das Chromas; botão "Copiar".
- **Levado ao Stefan.** O quanto da decisão deve ficar num repositório público,
  junto com a pergunta sobre a visibilidade do repositório.

## Riscos conhecidos

- **Conflito com a [ICM 61] #303**, que reescreve a documentação de entrada e
  mexe no mesmo `CONTEXT.md`. Quem entrar depois faz o rebase.
- **Direção lida como produto no ar.** O registro, o `CONTEXT.md`, o
  `README.md` e o `AGENTS.md` dizem em destaque que nada disso está em
  produção.
- **Repositório público.** A decisão fica pública. O registro não traz preço
  nem plano comercial, mas diz que o resultado completo fica com quem
  encomendou a pesquisa e lista as pendências jurídicas. Não afirma
  enquadramento jurídico.
- **Linhas citadas na #318.** A tabela da issue usa os números de linha da base
  `5e52ba8`. Depois deste PR as linhas do `CONTEXT.md` mudam; o registro de
  decisão cita seções, não linhas.

## Decisões tomadas

- Nada foi apagado do `CONTEXT.md`. As decisões substituídas receberam uma
  marca na própria linha.
- A pasta `docs/decisions/` é nova. O repositório não tinha lugar para
  registros de decisão.
- As decisões antigas continuam valendo para o que está no ar, até cada etapa
  da direção nova passar pelo gate humano.

## Correção posterior ao merge

Em 12/11/2026, depois do merge do PR #319, o Stefan reviu a resposta à Q3: as
fotos de pessoas públicas ficam enquanto o produto for gratuito, e a
regularização passa a ser condição para vender ou monetizar. O comentário da
#277 foi atualizado, e um PR pequeno ajustou as duas linhas do registro de
decisão que traziam a resposta antiga. Nada além disso mudou.

## Próximo passo exato

1. Merge deste PR e fechamento da #318, executados por agente por instrução do
   Stefan.
2. Seguir o programa de maturidade (#309), começando pelos bloqueios. As
   etapas de produto da pesquisa vêm depois.

## Human gate

- Decisão: aprovado
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em
  conversa de 12/11/2026 ("Revisar e mesclar o PR 319: pode você fazer"),
  transcrita no PR. A revisão foi feita por um agente independente e o merge
  fica a cargo do agente, a pedido dele. Vale só para este PR: a regra 6 do
  `AGENTS.md` não muda aqui. Produção não é alterada por este PR.
