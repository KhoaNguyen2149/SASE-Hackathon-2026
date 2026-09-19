import { all } from './db';
import { localParts,localDaySlots } from '@/lib/time';
export type RankPeriod='daily'|'weekly'|'monthly';
export function rankWindow(period:RankPeriod,now=Date.now()) {
  const today=localParts(now).date;
  const date=new Date(`${today}T12:00:00Z`);
  if(period==='weekly')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  if(period==='monthly')date.setUTCDate(1);
  const day=date.toISOString().slice(0,10);
  return {start:localDaySlots(day)[0],end:now,day,timeZone:'America/Denver'};
}
export function rankings(period:RankPeriod,kind:'spots'|'users',metric:string,viewerId?:string){
  const window=rankWindow(period),now=Date.now();
  if(kind==='users'){
    const rows=all<{id:string;name:string;handle:string;theme:string;avatar:string;reviews:number;followers:number;score:number}>(`
      SELECT u.id,u.name,u.handle,COALESCE(p.theme,'forest') theme,COALESCE(p.avatar,'seedling') avatar,
      (SELECT COUNT(*) FROM reviews r JOIN first_reviews fr ON fr.user_id=r.user_id AND fr.spot_id=r.spot_id JOIN spots s ON s.id=r.spot_id WHERE r.user_id=u.id AND r.hidden=0 AND s.demo=0 AND s.published=1 AND fr.created_at>=? AND fr.created_at<=?) reviews,
      (SELECT COUNT(*) FROM first_follows ff JOIN follows f ON f.user_id=ff.user_id AND f.target_id=ff.target_id JOIN users fan ON fan.id=ff.user_id WHERE ff.target_id=u.id AND ff.created_at>=? AND ff.created_at<=? AND fan.verified=1 AND fan.suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=fan.id AND b.target_id=u.id) OR (b.target_id=fan.id AND b.user_id=u.id))) followers
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.verified=1 AND u.suspended=0 AND COALESCE(p.leaderboard,1)=1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.target_id=? AND b.user_id=u.id))`,window.start,now,window.start,now,viewerId||'',viewerId||'');
    for(const row of rows)row.score=metric==='followers'?row.followers:metric==='reviews'?row.reviews:row.reviews*5+row.followers*2;
    rows.sort((a,b)=>b.score-a.score||b.reviews-a.reviews||a.handle.localeCompare(b.handle));
    return {period,kind,metric,window,rows:rows.filter(r=>r.score>0).slice(0,50).map((r,i)=>({...r,rank:i+1})),explanation:'Community points = 5 per new public real-venue review + 2 per first-time follower who still follows. Only verified, active accounts count. Edits and repeated follows do not add points. You can opt out in Profile.'};
  }
  const rows=all<{id:string;name:string;city:string;image:string;reviews:number;rating:number;score:number}>(`
    SELECT s.id,s.name,s.city,s.image,COUNT(*) reviews,AVG(r.rating) rating
    FROM spots s JOIN reviews r ON r.spot_id=s.id JOIN users u ON u.id=r.user_id JOIN first_reviews fr ON fr.user_id=r.user_id AND fr.spot_id=r.spot_id
    WHERE s.published=1 AND s.demo=0 AND r.hidden=0 AND u.verified=1 AND u.suspended=0 AND fr.created_at>=? AND fr.created_at<=?
    GROUP BY s.id`,window.start,now);
  // Bayesian prior avoids one five-star review outranking a well-supported venue.
  for(const row of rows)row.score=metric==='rating'?(row.rating*row.reviews+3.5*5)/(row.reviews+5):row.reviews;
  const eligible=rows.filter(r=>metric!=='rating'||r.reviews>=3);
  eligible.sort((a,b)=>b.score-a.score||b.reviews-a.reviews||a.name.localeCompare(b.name));
  return {period,kind,metric,window,rows:eligible.slice(0,50).map((r,i)=>({...r,score:Math.round(r.score*100)/100,rank:i+1})),explanation:metric==='rating'?'Top-rated requires at least 3 distinct reviewers this period. Score blends the average with five reference ratings of 3.5 to reduce small-sample swings.':'Trending counts new public reviews by verified people this period. One review per person per spot; sample venues, hidden reviews, and edits do not add activity.'};
}
