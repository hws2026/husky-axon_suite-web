import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFile, access } from 'node:fs/promises';
import { validateAccessConfig } from './access.mjs';
const rl=createInterface({input:stdin,output:stdout});
const ask=async(question,pattern)=>{const answer=(await rl.question(question)).trim();if(!pattern.test(answer))throw new Error('Invalid value. Run setup again.');return answer;};
try{
 const app=await ask('Discord application ID: ',/^\d{17,20}$/);
 const guild=await ask('Discord server ID: ',/^\d{17,20}$/);
 const owner=await ask('Overall owner Discord user ID: ',/^\d{17,20}$/);
 const origin=new URL(await rl.question('Portal origin (https://camera.example.com): '));
 if(origin.protocol!=='https:' && !(origin.protocol==='http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))throw new Error('HTTPS required outside loopback.');
 if(origin.pathname!=='/' || origin.search || origin.hash || origin.username || origin.password)throw new Error('Use an origin only.');
 const config={overallAdminIds:[owner],overallAdminRoles:[],agencies:[]};
 do{
  const id=await ask('Agency ID (e.g. lspd): ',/^[a-z0-9_-]{1,40}$/);
  const name=(await rl.question('Agency name: ')).trim();if(!name)throw new Error('Name required');
  const roles={};for(const role of ['agencyadmin','supervisor','officer','dispatcher']){
   const input=(await rl.question(`${role} Discord role ID (blank to skip): `)).trim();if(input&&!/^\d{17,20}$/.test(input))throw new Error('Invalid role ID');roles[role]=input?[input]:[];
  }
  config.agencies.push({id,name,enabled:true,roles});
 }while((await rl.question('Add another agency? (y/N): ')).trim().toLowerCase()==='y');
 validateAccessConfig(config);
 const configFile=new URL('./access.json',import.meta.url),envFile=new URL('../.env',import.meta.url);
 for(const file of [configFile,envFile]){try{await access(file);throw new Error('Existing configuration found. Edit it directly; setup does not overwrite it.')}catch(error){if(error.code!=='ENOENT')throw error;}}
 await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
 await writeFile(envFile,`PUBLIC_URL=${origin.origin}\nPORT=8790\nDISCORD_CLIENT_ID=${app}\nDISCORD_GUILD_ID=${guild}\nDISCORD_CLIENT_SECRET=REPLACE_ON_SERVER_ONLY\n`,{flag:'wx',mode:0o600});
 console.log('\nCreated web/access.json and .env. Put your client secret in .env on the host.');
 console.log('Register this exact OAuth redirect: '+origin.origin+'/auth/discord/callback');
 console.log('Application settings: https://discord.com/developers/applications/'+app+'/oauth2');
 console.log('Login link: '+origin.origin+'/auth/discord');
 console.log('No bot installation needed for login. Start: npm run start:web');
}finally{rl.close()}
