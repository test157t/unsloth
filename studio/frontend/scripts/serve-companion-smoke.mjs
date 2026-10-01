import {createServer} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const assetRoot=path.resolve(os.homedir(),'.unsloth/companion/assets');
const server=await createServer({server:{host:'127.0.0.1',port:8897,strictPort:true},plugins:[{
 name:'isolated-companion-fixtures',configureServer(server){server.middlewares.use((req,res,next)=>{
  // Match Studio's restriction: embedded texture blobs are images, not fetch targets.
  res.setHeader('Content-Security-Policy', "connect-src 'self'; img-src 'self' data: blob:");
  if(req.url==='/__smoke/background.png'){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));return;}
  if(req.url==='/__smoke/vrm-settings'){
    const db=new DatabaseSync(path.join(os.homedir(),'.unsloth/studio/studio.db'),{readOnly:true});
    try{const row=db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get('companion_presentation');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(JSON.parse(row?.value_json||'{}').vrm||{}));}finally{db.close();}return;
  }
  const url=new URL(req.url,'http://127.0.0.1');const prefix='/api/companion/assets/';if(!url.pathname.startsWith(prefix))return next();
  const file=path.resolve(assetRoot,decodeURIComponent(url.pathname.slice(prefix.length)));
  if(!file.startsWith(assetRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);
  if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
 });}
}]});
await server.listen();server.printUrls();
