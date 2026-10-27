# Histórico de versões

## 1.0.0 — Estável

- Consolida a arquitetura JavaScript em módulos-fonte e bundle gerado.
- Mantém visualização 2D, WebGL2 e fallback 2D.
- Mantém controles de zoom/foco da ferramenta e acompanhamento durante playback.
- Mantém janela opcional para limitar o toolpath aos últimos movimentos executados.
- Mantém autosave agendado e monitor de FPS sob demanda.
- Preserva o formato de projeto GCS v4.

### Validação técnica deste pacote

- Build do bundle a partir dos 11 módulos-fonte.
- Teste smoke: sintaxe do bundle, IDs duplicados, referências DOM literais e verificações de recursos.
- Verificação de sintaxe dos arquivos JavaScript completos (`js/app.js`, `js/cam-profiles.js`, ferramentas e testes).
- O responsável pelo projeto informa ter realizado testes funcionais, incluindo programas com mais de 200 mil linhas de G-code.

### Observação

A simulação é uma ferramenta de apoio. Antes de executar programas numa máquina CNC real, confirme o programa, origem, offsets, ferramentas, limites, fixação, avanços e velocidades na máquina de destino.
