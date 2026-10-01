import fs from 'node:fs';
import ts from '../../studio/frontend/node_modules/typescript/lib/typescript.js';
const source=fs.readFileSync('D:/Github/ErisHub/src/App.tsx','utf8');
const ast=ts.createSourceFile('App.tsx',source,99,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='callModeHypnoSettings');
fs.writeFileSync('studio/frontend/src/features/companion/eris/hypno-mapping.ts','// Adapted from ErisHub App.tsx.\nexport '+fn.getText(ast));
