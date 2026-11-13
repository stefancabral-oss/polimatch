# Referências do estágio 67

## `prototipo-pesquisa.html`

Protótipo navegável da pesquisa por foto. O Stefan o aprovou em 12/11/2026
como direção das telas novas.

- É uma página única, sem servidor. Abra o arquivo num navegador, de
  preferência em largura de celular.
- Nomes, rostos e camisas são fictícios e desenhados no próprio arquivo. Não
  há foto de pessoa real.
- Nada é enviado nem guardado. O campo de CPF está desligado e os botões de
  compartilhar só mostram um aviso.
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
