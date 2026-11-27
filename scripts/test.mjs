import {build} from 'vite';
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
for(const name of ['ranking','offers','sharing']) {
  await build({configFile:false,logLevel:'warn',build:{emptyOutDir:false,outDir:'outputs',lib:{entry:`lib/${name}.ts`,formats:['es'],fileName:()=>`${name}-test.mjs`},rollupOptions:{external:[]}}});
}
const tests=readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`tests/${name}`);
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
process.exit(result.status??1);
