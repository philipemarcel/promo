import {build} from 'vite';
import {spawnSync} from 'node:child_process';
await build({configFile:false,logLevel:'warn',build:{emptyOutDir:false,outDir:'outputs',lib:{entry:'lib/ranking.ts',formats:['es'],fileName:()=> 'ranking-test.mjs'},rollupOptions:{external:[]}}});
const result=spawnSync(process.execPath,['--test','tests/ranking.test.mjs'],{stdio:'inherit'});
process.exit(result.status??1);
