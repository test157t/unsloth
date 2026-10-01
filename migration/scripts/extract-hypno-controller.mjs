import fs from 'node:fs';
import ts from '../../studio/frontend/node_modules/typescript/lib/typescript.js';
const app=fs.readFileSync('D:/Github/ErisHub/src/App.tsx','utf8');
const ast=ts.createSourceFile('App.tsx',app,99,true,ts.ScriptKind.TSX);
const wanted=new Set(['hypnoStageIndex','sanitizeHypnoTrackerText','parseJsonArraySetting','hypnoScore','sanitizeHypnoBranchEffects','sanitizeHypnoBranches','appendHypnoPathNode','extractJsonObject','validateHypnoTrackerDecision']);
let output='// Pure session controller adapted from ErisHub App.tsx and actionBus.ts.\n';
for(const n of ast.statements){
 const name=n.name?.getText(ast);
 if((ts.isTypeAliasDeclaration(n)&&['HypnoTrackerDecision','HypnoBranch','HypnoBranchEffects'].includes(name))||(ts.isFunctionDeclaration(n)&&wanted.has(name))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast).startsWith('HYPNO_'))))output+='export '+n.getText(ast)+'\n';
}
const actions=fs.readFileSync('D:/Github/ErisHub/server/modules/actionBus.ts','utf8');
const actionAst=ts.createSourceFile('actions.ts',actions,99,true);
output+='export '+actionAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='initialHypnoSessionTree').getText(actionAst)+'\n';
fs.writeFileSync('studio/frontend/src/features/companion/eris/session-controller.ts',output);
