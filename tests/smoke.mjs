import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
const literalRefs=[...js.matchAll(/getElementById\(['"]([^'"]+)/g)].map(match=>match[1]);
const missingRefs=[...new Set(literalRefs.filter(id=>!ids.includes(id)))];

new vm.Script(js,{filename:'app.js'});
if(duplicateIds.length)throw new Error(`IDs duplicados: ${duplicateIds.join(', ')}`);
if(missingRefs.length)throw new Error(`Referências DOM ausentes: ${missingRefs.join(', ')}`);
if(!html.includes('id="cadQueueGenerate"'))throw new Error('Fila CAM não encontrada.');
if(!js.includes("'ArrowLeft'" )||!js.includes("'ArrowRight'"))throw new Error('Atalhos de navegação ausentes.');
if(html.includes('id="proDialog"')||js.includes('gcs_pro_v12'))throw new Error('Infraestrutura PRO antiga ainda presente.');
if(!js.includes("version:4"))throw new Error('Formato de projeto GCS v4 não encontrado.');
if(!html.includes('js/cam-profiles.js'))throw new Error('Módulo de perfis CAM não carregado.');

console.log(`OK: sintaxe JavaScript, ${ids.length} IDs únicos e referências DOM literais.`);
