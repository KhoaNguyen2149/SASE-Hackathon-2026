import { NextRequest,NextResponse } from 'next/server';
import { beginGoogle,appOrigin } from '@/server/google-auth';
import { currentUser,cookieName } from '@/server/auth';
import { AppError } from '@/server/errors';
export const runtime='nodejs';
export async function GET(req:NextRequest){
  try {
    const current=currentUser(req.cookies.get(cookieName)?.value);
    if(req.nextUrl.searchParams.get('link')==='1'&&!current)throw new AppError(401,'UNAUTHENTICATED','Sign in before connecting Google.');
    const result=beginGoogle(req.nextUrl.searchParams.get('next'),req.nextUrl.searchParams.get('link')==='1'?current:null);
    const res=NextResponse.redirect(result.url);
    res.cookies.set('deskhop_oauth_state',result.state,{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/api/auth/google',maxAge:600});
    res.headers.set('Cache-Control','no-store');return res;
  }catch(e){const url=new URL('/login',appOrigin());url.searchParams.set('error',e instanceof AppError?e.message:'Google sign-in is temporarily unavailable.');return NextResponse.redirect(url);}
}
