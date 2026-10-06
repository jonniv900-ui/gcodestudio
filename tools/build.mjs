import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir=path.join(root,'js','modules');
const files=['01-runtime.js', '02-cad-cam.js', '03-project-autosave.js', '04-input-touch.js', '05-responsive.js', '06-dialogs.js', '07-parser-editor.js', '08-webgl-renderer.js', '09-desktop-tools.js', '10-panels-process.js', '11-productivity.js'];
const banner='// G-Code Studio — generated bundle. Source is split under js/modules/.\n';
const body=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n\n');
fs.writeFileSync(path.join(root,'js','app.js'),banner+body);
console.log(`Built js/app.js from ${files.length} modules.`);
