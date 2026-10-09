import "./read-env.mjs";
import {spawnSync} from 'node:child_process';
const project=process.env.GCLOUD_PROJECT;
if(!project||project.startsWith('demo-'))throw new Error('Set GCLOUD_PROJECT to the explicitly selected staging project');
for(const [cmd,args] of [['pnpm',['preflight','--live']],['pnpm',['build']],['pnpm',['exec','firebase','deploy','--project',project]]]){const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}
