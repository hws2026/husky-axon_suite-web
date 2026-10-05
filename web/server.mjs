import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { agencyAccess, validateAccessConfig } from './access.mjs';

const required = name => { if (!process.env[name]) throw new Error(`Missing ${name}`); return process.env[name]; };
const base = new URL(required('PUBLIC_URL'));
const local = base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname);
if (base.protocol !== 'https:' && !local) throw new Error('PUBLIC_URL requires HTTPS except loopback development.');
if (base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('PUBLIC_URL must be an origin.');
const clientId = required('DISCORD_CLIENT_ID'), secret = required('DISCORD_CLIENT_SECRET'), guildId = required('DISCORD_GUILD_ID');
if (!/^\d{17,20}$/.test(clientId) || !/^\d{17,20}$/.test(guildId)) throw new Error('Invalid Discord IDs.');
const configPath = process.env.ACCESS_CONFIG || new URL('./access.json', import.meta.url);
const config = validateAccessConfig(JSON.parse(await readFile(configPath, 'utf8')));
const port = Number(process.env.PORT || 8790);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT.');
const callback = new URL('/auth/discord/callback', base).href;
const sessions = new Map(), states = new Map(), attempts = new Map();
const sidName = local ? 'husky_session' : '__Host-husky_session';
const stateName = local ? 'husky_oauth' : '__Host-husky_oauth';
const nonce = () => randomBytes(32).toString('hex');
const cookie = (name,value,seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${local?'':'; Secure'}`;
const cookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(s=>s.trim().split('=')).filter(parts=>parts.length===2));
const equal = (a,b) => typeof a==='string' && typeof b==='string' && a.length===b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data)); };
const redirect = (res,url) => {res.writeHead(302,{Location:url});res.end();};
async function discord(path, token) {
  const res = await fetch(`https://discord.com/api/v10${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if (!res.ok) throw new Error('Discord verification failed');
  return res.json();
}
async function identity(req,res) {
  const id = cookies(req)[sidName], session = sessions.get(id);
  if (!session || session.expires <= Date.now()) {sessions.delete(id);return null;}
  try {
    const member = await discord(`/users/@me/guilds/${guildId}/member`,session.token);
    if (!Array.isArray(member.roles)) throw new Error('Invalid member');
    const access = agencyAccess(session.user.id,member.roles,config);
    if (!access.allowed) throw new Error('Access removed');
    return {...session.user,...access};
  } catch {sessions.delete(id);res.setHeader('Set-Cookie',cookie(sidName,'',0));return null;}
}
setInterval(()=>{
 const now=Date.now();for(const [id,s] of sessions)if(s.expires<=now)sessions.delete(id);
 for(const [id,s] of states)if(s<=now)states.delete(id);
 for(const [id,s] of attempts)if(s.until<=now)attempts.delete(id);
},60000).unref();
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(base.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
 if(req.headers.host!==base.host)return json(res,400,{error:'Invalid host'});
 try {
  const url=new URL(req.url,base);
  if(req.method==='GET' && url.pathname==='/auth/discord') {
   const ip=req.socket.remoteAddress,now=Date.now();let count=attempts.get(ip);
   if(!count || count.until<=now){count={n:0,until:now+60000};attempts.set(ip,count);}
   if(++count.n>20 || states.size>=1000 || sessions.size>=10000)return json(res,429,{error:'Try again later'});
   const state=nonce();states.set(state,now+300000);res.setHeader('Set-Cookie',cookie(stateName,state,300));
   const authorize=new URL('https://discord.com/oauth2/authorize');
   authorize.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:'identify guilds.members.read',state}).toString();
   return redirect(res,authorize.href);
  }
  if(req.method==='GET' && url.pathname==='/auth/discord/callback') {
   const state=url.searchParams.get('state'),expiry=states.get(state);
   states.delete(state);res.setHeader('Set-Cookie',cookie(stateName,'',0));
   if(!expiry || expiry<Date.now() || !equal(state,cookies(req)[stateName]) || !url.searchParams.get('code'))return json(res,400,{error:'Login expired or cancelled. Start again.'});
   const tokenRes=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:callback}),signal:AbortSignal.timeout(8000)});
   if(!tokenRes.ok)throw new Error('OAuth failed');const token=await tokenRes.json();
   if(!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in<=0)throw new Error('Invalid token');
   const user=await discord('/users/@me',token.access_token),member=await discord(`/users/@me/guilds/${guildId}/member`,token.access_token);
   if(!/^\d{17,20}$/.test(user.id) || !Array.isArray(member.roles))throw new Error('Invalid identity');
   if(!agencyAccess(user.id,member.roles,config).allowed)return json(res,403,{error:'No authorized agency role in this Discord server.'});
   const id=nonce(),ttl=Math.min(3600,token.expires_in);
   sessions.delete(cookies(req)[sidName]);sessions.set(id,{user:{id:user.id,name:user.global_name||user.username},token:token.access_token,expires:Date.now()+ttl*1000});
   res.setHeader('Set-Cookie',[cookie(stateName,'',0),cookie(sidName,id,ttl)]);return redirect(res,'/dashboard');
  }
  if(req.method==='POST' && url.pathname==='/auth/logout') {
   if(req.headers.origin!==base.origin)return json(res,403,{error:'Invalid origin'});
   sessions.delete(cookies(req)[sidName]);res.setHeader('Set-Cookie',cookie(sidName,'',0));return json(res,200,{ok:true});
  }
  if(req.method==='GET' && ['/','/dashboard','/api/me'].includes(url.pathname)) {
   if(url.pathname==='/') {res.setHeader('Content-Type','text/html');return res.end(await readFile(new URL('./login.html',import.meta.url)));}
   const user=await identity(req,res);
   if(!user)return url.pathname==='/dashboard'?redirect(res,'/'):json(res,401,{error:'Discord login required'});
   if(url.pathname==='/api/me')return json(res,200,user);
   res.setHeader('Content-Type','text/html');return res.end(await readFile(new URL('./dashboard.html',import.meta.url)));
  }
  if(req.method==='GET' && ['/portal.css','/portal.js'].includes(url.pathname)) {
   res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'text/javascript');return res.end(await readFile(new URL('.'+url.pathname,import.meta.url)));
  }
  if(url.pathname.startsWith('/api/')) {
   if(!await identity(req,res))return json(res,401,{error:'Discord login required'});
   return json(res,503,{error:'Camera backend not connected. Preview sync is unavailable on this service.'});
  }
  return json(res,404,{error:'Not found'});
 } catch {return json(res,503,{error:'Discord login verification unavailable. Try again later.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Discord-only portal listening on loopback port ${port}`));
