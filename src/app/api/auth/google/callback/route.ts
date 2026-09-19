import { NextRequest,NextResponse } from 'next/server';
import { appOrigin,consumeGoogleState,finishGoogle } from '@/server/google-auth';
import { currentUser,cookieName } from '@/server/auth';
import { AppError } from '@/server/errors';
export const runtime='nodejs';
export async function GET(req:NextRequest){
  let res:NextResponse;
  try{
    const state=consumeGoogleState(req.nextUrl.searchParams.get('state')||'',req.cookies.get('deskhop_oauth_state')?.value);
    const code=req.nextUrl.searchParams.get('code');
    if(!code)throw new AppError(400,'OAUTH_CANCELLED','Google sign-in was cancelled. You can try again or continue as a guest.');
    const result=await finishGoogle(code,state,currentUser(req.cookies.get(cookieName)?.value));
    res=NextResponse.redirect(new URL(result.next,appOrigin()));
    res.cookies.set(cookieName,result.token,{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/',maxAge:30*86400});
  }catch(e){const url=new URL('/login',appOrigin());url.searchParams.set('error',e instanceof AppError?e.message:'Google sign-in could not be completed. Please try again.');res=NextResponse.redirect(url);}
  res.cookies.set('deskhop_oauth_state','',{httpOnly:true,sameSite:'lax',path:'/api/auth/google',maxAge:0});res.headers.set('Cache-Control','no-store');return res;
}
