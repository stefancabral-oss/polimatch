# ICM 67 — Registrar a mudança de direção: pesquisa de preferência por foto — #318

Base main `5e52ba8c38929ca9ee552f32feccea18eb8add43` (merge da #317).
Ler o contexto raiz, o `AGENTS.md` e a issue #277.

## Objetivo

Registrar no repositório a decisão do Stefan de 12/11/2026: depois da eleição,
o PoliMatch passa a ser uma pesquisa de preferência por foto. Esta etapa
atualiza só o contexto e a documentação de entrada.

## Entradas

- Issue #318 e a resposta à Q1 na #277.
- `CONTEXT.md`, `README.md` e `AGENTS.md` da raiz.
- Protótipo navegável aprovado pelo Stefan em 12/11/2026, em `references/`.

## Escopo

- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: a decisão, o que
  ela substitui, o que continua valendo e o que não está decidido.
- `CONTEXT.md`: "Norte do produto" reescrito, seção nova com a direção e marca
  nas decisões que deixam de valer para as telas novas. Nada é apagado.
- `README.md`: aviso de direção na abertura e ponteiros na "Fonte de verdade".
- `AGENTS.md`: "Estado atual" aponta para a direção nova.
- Este estágio, com `output/HANDOFF.md`, `output/verification.json` e
  `references/`.

## Fora de escopo

- Qualquer código de produto: telas da pesquisa, servidor, cadastro por CPF,
  compartilhamento. `app/`, `back/` e `shared/` não mudam.
- Política de abuso, política de privacidade e fotos.
- Encerrar a edição Eleições 2026 (#285) e congelar o programa cívico (#304).
- Corrigir os números e descrições desatualizados do `README.md`. Isso é da
  [ICM 61] #303.
- O desenho detalhado do formato (eliminatória, limites, cálculo do resultado).
  Ele entra nas etapas do servidor e das telas.

## Critérios de aceite

- Nenhuma frase de `CONTEXT.md`, `README.md` ou `AGENTS.md` contradiz o registro
  de decisão.
- Cada decisão substituída aparece no registro com o lugar de origem e o que
  passa a valer.
- Nenhum texto do repositório afirma que cadastro por CPF, exibição dos cinco
  primeiros ou entrega de resultado somado já estão em produção.
- O PR não altera `app/`, `back/` nem `shared/`.
- O gate humano continua com o Stefan. A issue #318 só fecha no aceite dele.

## Dependências

- Decisão do Stefan, registrada na #318.
- [ICM 61] #303 reescreve a documentação de entrada e mexe no mesmo
  `CONTEXT.md`. Quem entrar depois faz o rebase.
- #277: Q1 respondida; Q2 a Q6 abertas.
