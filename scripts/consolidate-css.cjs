/* One-time migration from the reviewed release; source remains available in Git. */
const fs=require('node:fs'),cp=require('node:child_process'),csso=require('csso');
const base='cff8660a156671ac5562c751d1554eff0b3cf235';
const old=cp.execFileSync('git',['show',base+':index.html'],{encoding:'utf8'});
const head=old.slice(0,old.indexOf('</head>'));let chunks=[];
for(const m of head.matchAll(/<link\s+rel="stylesheet"\s+href="(?:\.\/)?([^"?]+)[^"]*"\s*\/?\s*>|<style[^>]*>([\s\S]*?)<\/style>/g))chunks.push(m[1]?cp.execFileSync('git',['show',base+':'+m[1]],{encoding:'utf8'}):m[2]);
const source=chunks.join('\n');
const css=csso.minify(source,{restructure:true}).css;
fs.writeFileSync('sales-board.css','/* Canonical Sales Board styles. Edit this file; historical layers are retired. */\n'+css+'\n');
fs.writeFileSync('docs/css-consolidation.json',JSON.stringify({baseline:base,sourceBytes:Buffer.byteLength(source),canonicalBytes:Buffer.byteLength(css),retiredRuntimeLayers:chunks.length},null,2)+'\n');
