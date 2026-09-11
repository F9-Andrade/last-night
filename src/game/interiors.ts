import type { Building, Obstacle } from './world.ts';
export const hasInterior=(b:Building):boolean=>['hospital','police','market'].includes(b.kind);
export const ROOM_PROPS:Record<string,(Obstacle&{kind:'bed'|'desk'|'shelf'})[]>={
  hospital:[{x:-3.6,z:-1.6,w:1.5,d:3,kind:'bed'},{x:3.6,z:-1.6,w:1.5,d:3,kind:'bed'},{x:-3,z:2.8,w:3,d:1,kind:'desk'}],
  police:[{x:-3.3,z:-1.8,w:2.2,d:1.3,kind:'desk'},{x:3.3,z:1.6,w:2.2,d:1.3,kind:'desk'},{x:-4.8,z:1,w:.7,d:3.5,kind:'shelf'}],
  market:[{x:-3,z:-.5,w:1.3,d:4.5,kind:'shelf'},{x:3,z:-.5,w:1.3,d:4.5,kind:'shelf'},{x:3.5,z:3.5,w:3,d:1,kind:'desk'}],
};
export function roomObstacles(b:Building):Obstacle[]{
  const door=2.8,side=(b.w-door)/2;
  return [{x:b.x-b.w/2,z:b.z,w:.4,d:b.d},{x:b.x+b.w/2,z:b.z,w:.4,d:b.d},{x:b.x,z:b.z-b.d/2,w:b.w,d:.4},
    {x:b.x-(door+side)/2,z:b.z+b.d/2,w:side,d:.4},{x:b.x+(door+side)/2,z:b.z+b.d/2,w:side,d:.4},
    ...(ROOM_PROPS[b.kind]??[]).map(p=>({...p,x:b.x+p.x,z:b.z+p.z}))];
}
