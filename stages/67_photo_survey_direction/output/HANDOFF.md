# HANDOFF — [ICM 67] Registrar a mudança de direção: pesquisa de preferência por foto

## Status

- Estado: pronto para gate humano
- Issue: #318, continua aberta
- Relacionada: #277, com a Q1 respondida em comentário de 12/11/2026
- Base: `5e52ba8` (#317 já mesclada em main)
- Branch: `icm/67-photo-survey-direction`
- PR: PR_URL_PENDENTE
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
  `AGENTS.md` e `docs/decisions/`: duas ocorrências, as duas como citação
  histórica.
- `npm run test:shared`: 93 passaram, 0 falharam.
- `npm test --prefix app`: 245 passaram, 0 falharam.
- Os quatro arquivos apontados por links novos existem.

Não rodados:

- Testes do `back/`. As dependências do back não estão instaladas neste clone,
  e nenhum arquivo do back mudou.
- Workflows do GitHub. Os quatro workflows filtram por caminho (`app/**`,
  `back/**`, `shared/**`, `docs/design/**`, `docs/editorial/**` e alguns
  arquivos de estágios antigos). Nenhum dispara para os caminhos deste PR.

## Riscos conhecidos

- **Conflito com a [ICM 61] #303**, que reescreve a documentação de entrada e
  mexe no mesmo `CONTEXT.md`. Quem entrar depois faz o rebase.
- **Direção lida como produto no ar.** O registro, o `CONTEXT.md`, o
  `README.md` e o `AGENTS.md` dizem em destaque que nada disso está em
  produção.
- **Repositório público.** A decisão fica pública. O registro não traz detalhe
  comercial nem afirma enquadramento jurídico.
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

## Próximo passo exato

1. Stefan revisa e, se aceitar, mescla. Nenhum agente aprova o gate, mescla ou
   publica.
2. Depois do aceite: decidir a prioridade frente ao programa de maturidade
   (#309) e só então abrir as etapas de produto.

## Human gate

- Decisão: pendente
- Responsável: Stefan
- Observação: a issue #318 só fecha no aceite dele.
