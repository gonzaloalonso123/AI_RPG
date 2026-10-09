import {existsSync} from 'node:fs';
for(const file of ['.env','apps/web/.env.local'])if(existsSync(file))process.loadEnvFile(file);
if(process.env.GCLOUD_PROJECT){const file=`functions/lib/.env.${process.env.GCLOUD_PROJECT}`;if(existsSync(file))process.loadEnvFile(file);}
