# Vinte Chromas Políticos — issue #263

Renovadas as vinte artes da categoria politicos, individualmente com image_gen,
retrato original e referência visual explícita. Molduras malaquita/ouro mais
esculpidas, gravuras, foil e composição individual; nomes e Arte com IA legíveis.
Masters anteriores preservados. Prompts/fontes em references/prompts.json;
20 PNGs em output/artwork; hashes/dimensões/derivados em manifest.json.
Jeffrey tem origem 1061×1483, os demais 1060×1484; exportação integral sem crop.

Quarenta WebPs responsivos (530/1060), cada um abaixo de 600 KB, com URL por hash.
A página da corrida usa a nova edição nas cartas, perfis, showcase e pódio.
Capa principal e outras categorias preservadas. Foto/nome/moldura originais são
reserva quando a arte falha. Regras, ranking, votos e inventário não mudaram.

Validação local: 217 testes aprovados, build concluída; 20 perfis a 390 e 1440 px
em Chromium, controles, identidade, proporção e falha de arte aprovados; regressão
dos dez perfis inaugurais aprovada nas duas larguras. Integridade SHA-256 dos
quarenta WebPs conferida. A gravação é atômica, com readback integral.
Matriz Chromium/WebKit, merge/deploy e QA público serão registrados na PR ligada
à issue #263 antes da comunicação de publicação. Gate visual final com Stefan;
esta revisão técnica não substitui aprovação humana de produto.

CI WebKit revelou duas condições de tempo em testes existentes da home/quiz:
feedback de 1050ms amostrado com espera fixa e Enter enviado pelo foco global.
Amostragem de feedback agora é atômica e por estado, e Enter usa a própria
carta como alvo. Mesmas asserções funcionais, sem alterar runtime do produto.
