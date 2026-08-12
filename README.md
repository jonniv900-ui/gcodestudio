# G-Code Studio 0.8 — WebGL Edition

**G-Code Studio** é um editor, visualizador e simulador de G-code desenvolvido com foco principal em **CNC Router**.

A versão **0.8** consolida o simulador CNC com visualização 2D e 3D acelerada por **WebGL2**, simulação progressiva de remoção de material, análise de programa, ferramentas, offsets, limites de máquina e reprodução da trajetória.

O aplicativo também possui suporte complementar para **G-code de impressão 3D FDM**, com detecção automática do tipo de arquivo, visualização de extrusão e representação do hotend/nozzle.

## Principais recursos

* Visualização **XY, XZ, YZ e 3D ISO**
* Renderização 3D com **WebGL2 puro**
* Simulação progressiva de usinagem do bloco de material
* Representação de fresa e porta-ferramenta
* Suporte a múltiplas ferramentas
* Biblioteca de ferramentas
* G0, G1, G2 e G3
* Ciclos de furação
* G54–G59
* G28 / G30
* G90 / G91
* G20 / G21
* Compensação G40 / G41 / G42
* Spindle M3 / M4 / M5
* Coolant M7 / M8 / M9
* M0 / M1 / M30
* Subprogramas M98 / M99
* Macros simples
* Soft Limits
* Safe Z
* Fixtures e volumes de fixação
* Análise aproximada de colisões
* Playback com velocidade ajustável
* Step forward / backward
* Breakpoints
* Estatísticas de usinagem
* Estimativa de tempo
* Distância de corte
* Volume aproximado removido
* MRR
* Biblioteca de materiais
* Vc e Fz aproximados
* Editor de G-code com syntax highlighting
* Autocomplete
* Buscar / substituir
* Ir para linha
* Undo / Redo
* Marcadores
* Comparação entre arquivos
* Abrir múltiplos arquivos sequencialmente
* Reprodução de múltiplos arquivos como um único programa
* Exportação PNG
* Relatório de simulação
* Interface responsiva para desktop e mobile
* Zoom, pan e rotação 3D
* Projeção axonométrica e perspectiva
* Raio-X
* Mapa de profundidade
* Corte/seção da peça
* Detecção automática de CNC ou impressão 3D

## Impressão 3D

O suporte a impressão 3D é um recurso complementar do G-Code Studio.

Quando um arquivo FDM é detectado, o programa adapta automaticamente a visualização:

* representação de hotend/nozzle;
* leitura do eixo `E`;
* suporte a M82 / M83;
* reconhecimento de G92 E;
* detecção de movimentos de extrusão;
* visualização progressiva do material depositado;
* diferenciação entre extrusão, travel e retração.

O objetivo principal do projeto continua sendo **CNC Router**.

## Arquivos CNC

A versão 0.8 vem sendo testada principalmente com G-codes reais gerados por **ArtCAM**, além de arquivos de teste para diferentes comandos e trajetórias.

## Plataforma

O projeto é desenvolvido em:

* HTML5
* CSS
* JavaScript
* WebGL2

Também pode ser distribuído como aplicativo Windows utilizando **Electron**, com Chromium embutido.

## Status

**Versão:** 0.8
**Status:** Beta / Public Preview
**Foco principal:** CNC Router
**Suporte adicional:** Impressão 3D FDM

A série 0.x será utilizada para testes, correções e estabilização antes da versão 1.0.

## Aviso

O G-Code Studio é uma ferramenta de visualização e simulação.

Antes de executar qualquer programa em uma máquina CNC real, verifique sempre:

* origem da peça;
* work offsets;
* ferramentas;
* comprimento da ferramenta;
* limites da máquina;
* sentido do spindle;
* avanços e velocidades;
* fixação da peça;
* profundidades de usinagem.

**Wtec Sistemas — 2026**
