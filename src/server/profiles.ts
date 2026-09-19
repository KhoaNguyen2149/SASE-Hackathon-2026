import { z } from 'zod';
import { all,one,run } from './db';
import { command,requireVerified } from './shared';
import { assert } from './errors';
import { themes,banners,avatars,stickerOptions,interestOptions,defaultDecoration,type ProfileDecoration } from '@/lib/profile-style';
import type { User } from '@/lib/types';
export const decorationSchema=z.object({bio:z.string().trim().max(240),theme:z.enum(themes),banner:z.enum(banners),avatar:z.enum(avatars),stickers:z.array(z.enum(stickerOptions)).max(5),pinned_spots:z.array(z.string().min(1).max(100)).max(3),interests:z.array(z.enum(interestOptions)).max(5),leaderboard:z.boolean()});
export function decoration(userId:string):ProfileDecoration {
  const row=one<{bio:string;theme:string;banner:string;avatar:string;stickers:string;pinned_spots:string;interests:string;leaderboard:number}>('SELECT * FROM profiles WHERE user_id=?',userId);
  return row?{bio:row.bio,theme:row.theme,banner:row.banner,avatar:row.avatar,stickers:JSON.parse(row.stickers),pinned_spots:JSON.parse(row.pinned_spots),interests:JSON.parse(row.interests),leaderboard:!!row.leaderboard}:{...defaultDecoration};
}
export function saveDecoration(user:User,input:ProfileDecoration,key:string|null){
  requireVerified(user);
  return command(user.id,'profile:decorate',key,input,()=>{
    const pins=[...new Set(input.pinned_spots)];
    for(const id of pins)assert(one('SELECT 1 FROM spots WHERE id=? AND published=1',id),'SPOT_UNAVAILABLE','Choose a published study spot.',400);
    run(`INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,theme=excluded.theme,banner=excluded.banner,avatar=excluded.avatar,stickers=excluded.stickers,pinned_spots=excluded.pinned_spots,interests=excluded.interests,leaderboard=excluded.leaderboard,updated_at=excluded.updated_at`,user.id,input.bio,input.theme,input.banner,input.avatar,JSON.stringify([...new Set(input.stickers)]),JSON.stringify(pins),JSON.stringify([...new Set(input.interests)]),Number(input.leaderboard),Date.now());
    return {decoration:decoration(user.id)};
  });
}
export function pinnedSpots(userId:string){return decoration(userId).pinned_spots.flatMap(id=>all<{id:string;name:string;category:string;image:string}>('SELECT id,name,category,image FROM spots WHERE id=? AND published=1',id));}
