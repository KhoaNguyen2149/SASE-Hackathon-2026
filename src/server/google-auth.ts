import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { one,run,transaction } from './db';
import { hash,id,rateLimit } from './shared';
import { assert } from './errors';
import { passwordHash,signIn } from './auth';
import type { User } from '@/lib/types';
export const googleEnabled=()=>!!process.env.GOOGLE_CLIENT_ID&&!!process.env.GOOGLE_CLIENT_SECRET;
export const appOrigin=()=>new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:3000').origin;
export const safeNext=(value:string|null)=>value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'/discover';
const client=()=>new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,`${appOrigin()}/api/auth/google/callback`);
type State={nonce:string;verifier:string;next_path:string;link_user_id:string|null;expires_at:number};
export function beginGoogle(next:string|null,linkUser?:User|null){
  assert(googleEnabled(),'GOOGLE_UNAVAILABLE','Google sign-in is not configured yet.',503);
  if(linkUser)assert(linkUser.verified,'VERIFY_EMAIL','Verify your email before linking Google.',403);
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  run('DELETE FROM oauth_states WHERE expires_at<?',Date.now());
  run('INSERT INTO oauth_states VALUES(?,?,?,?,?,?)',hash(state),nonce,verifier,safeNext(next),linkUser?.id||null,Date.now()+600000);
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:`${appOrigin()}/api/auth/google/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:Buffer.from(hash(verifier),'hex').toString('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return {state,url:url.toString()};
}
export function consumeGoogleState(state:string,cookie?:string):State {
  assert(state&&state===cookie,'OAUTH_STATE','This sign-in request expired. Please start again.',400);
  return transaction(()=>{
    const row=one<State>('SELECT * FROM oauth_states WHERE state_hash=?',hash(state));
    assert(row&&row.expires_at>Date.now(),'OAUTH_STATE','This sign-in request expired. Please start again.',400);
    run('DELETE FROM oauth_states WHERE state_hash=?',hash(state));return row;
  });
}
export async function resolveGoogleIdentity(identity:{sub:string;email:string;name?:string},linkUserId:string|null,current:User|null){
  const existing=one<{user_id:string}>('SELECT user_id FROM oauth_accounts WHERE provider=? AND subject=?','google',identity.sub);
  if(linkUserId){
    assert(current?.id===linkUserId&&current.verified&&current.email.toLowerCase()===identity.email.toLowerCase(),'LINK_REJECTED','Sign in to the matching DeskHop account before linking Google.',403);
    assert(!existing||existing.user_id===current.id,'LINK_REJECTED','This Google account is already linked to another profile.',409);
    run('INSERT OR IGNORE INTO oauth_accounts VALUES(?,?,?)','google',identity.sub,current.id);
    return current.id;
  }
  if(existing){assert(one('SELECT 1 FROM users WHERE id=? AND suspended=0',existing.user_id),'ACCOUNT_UNAVAILABLE','This account is unavailable.',403);return existing.user_id;}
  // Never silently merge by email: an existing password account must link explicitly.
  assert(!one('SELECT 1 FROM users WHERE email=?',identity.email),'ACCOUNT_EXISTS','An account already uses this email. Sign in with its password, then connect Google in Profile.',409);
  const pwd=await passwordHash(randomBytes(48).toString('base64url'));
  return transaction(()=>{
    const uid=id(),handle='explorer_'+randomBytes(6).toString('hex');
    run('INSERT INTO users(id,name,handle,email,password_hash,verified,created_at,password_enabled) VALUES(?,?,?,?,?,1,?,0)',uid,(identity.name||'Colorado Explorer').slice(0,60),handle,identity.email.toLowerCase(),pwd,Date.now());
    run('INSERT INTO availability(user_id) VALUES(?)',uid);
    run('INSERT INTO oauth_accounts VALUES(?,?,?)','google',identity.sub,uid);return uid;
  });
}
export async function finishGoogle(code:string,state:State,current:User|null){
  const oauth=client();
  const {tokens}=await oauth.getToken({code,codeVerifier:state.verifier});
  assert(tokens.id_token,'OAUTH_TOKEN','Google did not return a valid sign-in.',400);
  const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID});
  const payload=ticket.getPayload() as (ReturnType<typeof ticket.getPayload>&{nonce?:string});
  assert(payload?.sub&&payload.email&&payload.email_verified&&payload.nonce===state.nonce,'OAUTH_TOKEN','Google identity could not be verified.',400);
  rateLimit(`google:${hash(payload.sub)}`,20,3600000);
  const uid=await resolveGoogleIdentity({sub:payload.sub,email:payload.email,name:payload.name},state.link_user_id,current);
  return {token:signIn(uid,true),next:state.next_path};
}
