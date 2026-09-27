import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file, globals={}) {
 const source=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:(name)=>name==='./research'?load('lib/research.ts'):require(name),console,setTimeout,clearTimeout,AbortSignal,Map,...globals});
 return module.exports;
}
test('URL deduplication and six-company bound',()=>{
 const c=load('lib/comparison.ts');assert.equal(c.parseSymbols('aapl,AAPL,MSFT,?,NVDA,AMZN,META,TSLA,AMD').join(','),'AAPL,MSFT,NVDA,AMZN,META,TSLA');
});
test('peer median excludes incompatible years and currencies',()=>{
 const c=load('lib/comparison.ts');const p={value:10,unit:'money',basis:'FY',period:'2025-06-30',currency:'USD'};
 const base={comparisonMetrics:{revenue:p}};const peers=[{...p,value:20},{...p,value:500,currency:'EUR'},{...p,value:100,period:'2024-06-30'},{...p,value:40}].map(v=>({comparisonMetrics:{revenue:v}}));
 const stat=c.benchmark(base,peers,'revenue');assert.equal(stat.count,2);assert.equal(stat.value,30);
 assert.equal(c.difference({...p,unit:'percent',value:20},10),'+10.0 pp');
 assert.equal(c.difference({...p,unit:'multiple',value:20},10),'+100.0%');
});
test('visuals appear between relevant paragraphs',()=>{
 const {chatBlocks}=load('lib/chat-blocks.ts');const blocks=chatBlocks('Revenue grew.\n\nMargins improved.\n\nRisks remain.',[{type:'comparison',title:'Companies',companies:[{symbol:'A',revenue:100,margin:20}]}]);
 assert.equal(blocks.map(b=>b.type).join(','),'text,visual,text,visual,text');assert.equal(blocks[1].visual.metric,'revenue');assert.equal(blocks[3].visual.metric,'margin');
});
test('private storage is isolated and conflicts preserve unsynced changes',async()=>{
 const data=new Map();let count=0;const s=load('lib/user-storage.ts',{Event:class{},window:{dispatchEvent(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},fetch:async()=>({ok:++count===1,json:async()=>count===1?{revision:1}:{error:'Changed on another device'}})});
 s.initializeStorage('A',[]);s.userStorage.setItem('marketly.profile','A profile');await s.flushStorage();assert.equal(s.hasPendingChanges(),false);
 s.initializeStorage('B',[]);assert.equal(s.userStorage.getItem('marketly.profile'),null);
 s.userStorage.setItem('marketly.profile','B profile');await s.flushStorage();assert.equal(s.hasPendingChanges(),true);assert.equal(s.storageStatus().error,'Changed on another device');
});
