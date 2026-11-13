# Referências do estágio 67

## `prototipo-pesquisa.html`

Protótipo navegável da pesquisa por foto. O Stefan o aprovou em 12/11/2026
como direção das telas novas e, no mesmo dia, pediu três acréscimos que já
estão nesta cópia: compartilhar o resultado, avisos e indicação de amigos.

- É uma página única, sem servidor. Abra o arquivo num navegador, de
  preferência em largura de celular.
- Nomes, rostos e camisas são fictícios e desenhados no próprio arquivo. Não
  há foto de pessoa real.
- Nada é enviado nem guardado. Os campos de CPF e de celular estão desligados,
  e os botões de postar, avisar e enviar convite só mostram uma mensagem. O
  botão "Copiar" copia um link de indicação fictício.
- As perguntas são exemplos. Nenhuma foi aprovada como pesquisa real.
- O arquivo não tem `<!doctype>` nem `<html>`, porque foi escrito para uma
  página de pré-visualização que acrescenta essa moldura. O navegador abre
  mesmo assim.
- Carrega as fontes Inter e Manrope do Google Fonts. Sem rede, usa a fonte do
  sistema.

O protótipo é referência visual e de fluxo. Não é código de produto e não
entra no build do `app/`.

O que ele mostra: início com a próxima pesquisa em destaque, quatro telas de
quatro fotos e uma final com um toque por tela, fechamento com a escolha da
pessoa, compartilhamento por iniciativa dela, coleção e convite ao cadastro
depois da primeira pesquisa.

Acréscimos pedidos depois da aprovação:

- **Compartilhar.** A pessoa gera uma imagem da própria escolha para postar,
  ou convida sem mostrar a escolha.
- **Avisos.** A pessoa escolhe ser avisada quando o resultado de uma pesquisa
  sair e quando chegar pesquisa nova, pelo próprio celular ou por WhatsApp.
- **Indicação.** Cada pessoa tem um link próprio. Três amigos cadastrados por
  ele liberam uma carta especial na coleção. O botão "Simular um amigo
  entrando" existe só para a demonstração.

Esses acréscimos são proposta de tela. Nenhum está decidido como regra de
produto nem liberado. Eles levantam pendências que vão para a revisão jurídica
junto com as do registro de decisão: o aviso por WhatsApp pede o celular da
pessoa e tem custo por mensagem; a recompensa por indicação pode esbarrar na
regra de distribuição gratuita de prêmios. No iPhone, a notificação pelo
navegador só funciona se a pessoa adicionar o site à tela de início.
