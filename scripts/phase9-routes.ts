import {writeFileSync} from 'node:fs';
import {ROADS} from '../src/game/districts.ts';
import {findPath,move,distance,collides,URBAN} from '../src/game/world.ts';
const routes=[];
for(const [index,road] of ROADS.entries()){
 const horizontal=road.w>road.d,at=(n:number)=>({x:horizontal?n:road.x,z:horizontal?road.z:n});
 const start=at(-150),end=at(150),path=findPath(start,end),player={...start};let meters=0,stuck=false;
 if(!path.length)stuck=true;
 for(const target of path){let attempts=0;while(distance(player,target)>.1&&attempts++<1000){const dx=target.x-player.x,dz=target.z-player.z,d=Math.hypot(dx,dz),before={...player};move(player,dx/d*Math.min(.09,d),dz/d*Math.min(.09,d),.4);meters+=distance(player,before);}if(distance(player,target)>.12){stuck=true;break;}}
 routes.push({index,horizontal,axis:horizontal?road.z:road.x,start,end,meters:Math.round(meters),stuck,arrived:distance(player,end)<.2,waypoints:path.length});
}
writeFileSync('docs/phase9/street-routes.json',JSON.stringify({method:'Movement with collision along navigation paths; no combat or rendering',routes,urban:{buildings:URBAN.buildings.length,vehicles:URBAN.vehicles.length,scenes:URBAN.scenes.length,alleys:URBAN.alleys.length}},null,2));
console.log(routes);if(routes.some(r=>!r.arrived))process.exitCode=1;
