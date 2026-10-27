import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const html = read('index.html');
const js = read('js/app.js');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const literalRefs = [...js.matchAll(/getElementById\(['"]([^'"]+)/g)].map(match => match[1]);
const missingRefs = [...new Set(literalRefs.filter(id => !ids.includes(id)))];

new vm.Script(js, { filename: 'app.js' });
if (duplicateIds.length) throw new Error(`IDs duplicados: ${duplicateIds.join(', ')}`);
if (missingRefs.length) throw new Error(`Referências DOM ausentes: ${missingRefs.join(', ')}`);
if (!html.includes('id="cadQueueGenerate"')) throw new Error('Fila CAM não encontrada.');
if (!js.includes("'ArrowLeft'") || !js.includes("'ArrowRight'")) throw new Error('Atalhos de navegação ausentes.');
if (html.includes('id="proDialog"') || js.includes('gcs_pro_v12')) throw new Error('Infraestrutura PRO antiga ainda presente.');
if (!js.includes('version:4')) throw new Error('Formato de projeto GCS v4 não encontrado.');
if (!html.includes('js/cam-profiles.js')) throw new Error('Módulo de perfis CAM não carregado.');
for (const id of ['btnToolZoom', 'btnFollowTool', 'executionWindow']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Controle de execução ausente: ${id}`);
}
if (!js.includes('toolZoomFactor:1.8') || !js.includes('executionWindow:0')) {
  throw new Error('Estado padrão do zoom/janela de execução não encontrado.');
}
for (const file of [
  'js/modules/01-runtime.js', 'js/modules/02-cad-cam.js',
  'js/modules/03-project-autosave.js', 'js/modules/04-input-touch.js',
  'js/modules/05-responsive.js', 'js/modules/06-dialogs.js',
  'js/modules/07-parser-editor.js', 'js/modules/08-webgl-renderer.js',
  'js/modules/09-desktop-tools.js', 'js/modules/10-panels-process.js',
  'js/modules/11-productivity.js'
]) {
  if (!fs.existsSync(new URL(file, root))) throw new Error(`Módulo-fonte ausente: ${file}`);
}
console.log(`OK: bundle sintaticamente válido, ${ids.length} IDs únicos, referências DOM válidas, zoom/janela presentes e 11 módulos-fonte disponíveis.`);
