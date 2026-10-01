import fs from 'node:fs';
import ts from '../../studio/frontend/node_modules/typescript/lib/typescript.js';
import postcss from '../../studio/frontend/node_modules/postcss/lib/postcss.mjs';
const extract=(path,name)=>{const text=fs.readFileSync(path,'utf8');const ast=ts.createSourceFile(path,text,99,true);let value;function walk(n){if(ts.isPropertyAssignment(n)&&n.name.getText(ast)===name)value=n.initializer.getText(ast);ts.forEachChild(n,walk)}walk(ast);return value};
const dir='studio/frontend/src/features/companion/eris';
fs.writeFileSync(dir+'/defaults.ts','// ErisHub default settings, preserved during adaptation.\nexport const vrmDefaults = '+extract('D:/Github/ErisHub/server/modules/vrm.ts','defaultSettings')+';\nexport const hypnoDefaults = '+extract('D:/Github/ErisHub/server/modules/hypno.ts','defaultSettings')+';\n');
const css=postcss.parse(fs.readFileSync('D:/Github/ErisHub/src/styles.css','utf8'));
css.walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name.includes('keyframes'))return;
if(!/(editor|vrm|hypno|voiceforge|native-|\.tk-|menu_button|text_pole|button-row|inline-drawer|empty-module-state|text_muted)/.test(rule.selector)){rule.remove();return;}
rule.selectors=rule.selectors.map(s=>'.eris-surface '+s);
});
css.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove()});
fs.writeFileSync(dir+'/presentation.css','/* Adapted ErisHub styles, scoped to Studio feature surfaces. */\n.eris-surface{--text:var(--foreground);--muted:var(--muted-foreground);--panel:var(--background);--accent:#a78bfa;--border:color-mix(in srgb,var(--foreground) 15%,transparent);--info:#a5b4fc;}\n'+css.toString()+'\n.eris-surface .vrm-stage{position:absolute;inset:0;width:100%;height:100%;pointer-events:auto}.eris-surface .vrm-stage canvas{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}.eris-surface .voiceforge-panel{width:100%;max-width:none}.eris-surface input,.eris-surface select,.eris-surface textarea{color:var(--foreground);background:var(--background)}\n');
