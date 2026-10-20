# Handoff — issue #244

## Entrega
Modo independente Quem disse isso? com entrada na home, dez frases verificadas (cinco por pessoa), cartas sem CTA duplicado, fotos existentes e fonte/data/contexto revelados depois da resposta. Pontos e sequência locais separados de preferências; retomada, repetição e compartilhamento sem respostas. Edição fixa lula-flavio-01.

## Verificação executada
- Frontend: 206/206 testes aprovados.
- Build Vite multi-page concluído; 162 arquivos verificados, sem assets do piloto #176.
- Chromium: partida inteira em 320, 390, 768 e 1440 px; teclado, recarga após resposta e conclusão, revisão das fontes, reinício, fallback de compartilhar, armazenamento bloqueado; nenhum request /api e nenhuma exceção.
- Inspeção visual das capturas locais; fonte, nomes e rostos visíveis sem rolagem horizontal. Não equivale à validação humana ou teste em iPhone físico.
- git diff --check aprovado.

## Integração e publicação
Branch feat/244-quem-disse-isso. Base de670844. PR/CI remoto e deploy serão registrados na PR após execução. Autorização de implementar e publicar existente na conversa. Não considerar o deploy confirmado até conferir /quem-disse-isso.html em produção.

## Limites e gate
Progresso restrito ao navegador, sem sync de conta ou ranking público. Frases históricas não representam necessariamente programa atual e não afirmam composição oficial de segundo turno. Fontes externas podem mudar. Revisão humana do resultado implementado permanece aberta na issue #244.
