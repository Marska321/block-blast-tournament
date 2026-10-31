// Compatibility entry point: run production behavior tests rather than source-string assertions.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const files=readdirSync('tests').filter(name=>name.endsWith('.test.ts')).map(name=>'tests/'+name);
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit'});
process.exitCode=result.status??1;
