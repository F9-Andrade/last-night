import {VisibleGroup} from './static-chunk.ts';
import * as THREE from 'three';
import { LOOT_POINTS } from '../game/loot';
import { DEFENSE_POINTS, damageStage, defenseMaxHP, gateStep } from '../game/defenses';
import { itemKeys } from '../game/inventory';
import type { Item } from '../game/inventory';
import type { Simulation } from '../game/simulation';
import { distance } from '../game/world';
import { voxelGeometry, voxelMesh, voxelMaterial } from './voxel';
import { defenseRecipe, containerRecipe, itemRecipe } from './survival-assets';
/** Persistent visual instances. State changes swap cached geometry; retries allocate nothing here. */
export class SurvivalView {
  private containers: { root: THREE.Group; lid: THREE.Group; marker: THREE.Mesh; found: THREE.Mesh; reveal: number; searched: boolean }[] = [];
  private defenses: { mesh: THREE.Mesh; paint: THREE.MeshStandardMaterial; stage: number; key:string; gate:number }[] = [];
  private drops:THREE.InstancedMesh;private dropPose=new THREE.Object3D();
  private bandage = voxelMesh(itemRecipe('med'));
  constructor(scene: THREE.Scene) {
    this.drops=new THREE.InstancedMesh(voxelGeometry(containerRecipe('outside',false)),voxelMaterial,512);this.drops.count=0;this.drops.frustumCulled=false;scene.add(this.drops);
    for (const key of itemKeys) voxelGeometry(itemRecipe(key));
    const markerGeo = new THREE.OctahedronGeometry(.11), markerPaint = new THREE.MeshBasicMaterial({ color: 0xdab67b });
    for (const point of LOOT_POINTS) {
      const root = new VisibleGroup(); root.position.set(point.x, .18, point.z); root.add(voxelMesh(containerRecipe(point.area, false)));
      const lid = new THREE.Group(); lid.position.set(0, .74, -.4); lid.add(voxelMesh(containerRecipe(point.area, true))); root.add(lid);
      const marker = new THREE.Mesh(markerGeo, markerPaint); marker.position.y = 1.45; root.add(marker);
      const key: Item = point.area === 'hospital' ? 'med' : point.area === 'police' || point.area === 'base' ? 'ammo' : point.area === 'gas' ? 'scrap' : 'wood';
      const found = voxelMesh(itemRecipe(key)); found.scale.setScalar(.7); found.visible = false; root.add(found);
      scene.add(root); this.containers.push({ root, lid, marker, found, reveal: 0, searched: false });
    }
    for (const point of DEFENSE_POINTS) {
      for (let stage = 0; stage < 4; stage++) voxelGeometry(defenseRecipe(point, stage));
      const paint = voxelMaterial.clone(), mesh = voxelMesh(defenseRecipe(point, 0), paint); mesh.position.set(point.x, .18, point.z);mesh.rotation.y=point.d>point.w?Math.PI/2:0; scene.add(mesh);
      this.defenses.push({ mesh, paint, stage: 0,key:'',gate:0 });
    }
    this.bandage.visible = false; scene.add(this.bandage);
  }
  update(sim: Simulation, dt: number, elapsed: number, menu: boolean): void {
    this.containers.forEach((view, i) => {
      const loot = sim.loot[i]; view.root.visible=distance(sim.player,loot)<55;
      if (loot.searched && !view.searched) { view.reveal = loot.lastFound ? 2 : 0; if (loot.lastFound) view.found.geometry = voxelGeometry(itemRecipe(loot.lastFound)); }
      if (!loot.searched) view.reveal = 0;
      view.searched = loot.searched; view.reveal = Math.max(0, view.reveal - dt);
      const searching = sim.action?.kind === 'search' && sim.action.target === loot.id;
      const progress = searching ? sim.action!.elapsed / sim.action!.duration : 0;
      view.lid.rotation.x += ((loot.searched ? -1.9 : -progress * .4) - view.lid.rotation.x) * (1 - Math.exp(-dt * 12));
      view.root.rotation.z = searching ? Math.sin(elapsed * 25) * .015 : 0;
      view.marker.visible = !menu && (!loot.searched || (loot.coins??0)>0 || itemKeys.some(k => loot.contents[k])) && distance(sim.player, loot) < 9;
      view.marker.position.y = 1.45 + Math.sin(elapsed * 2 + i) * .08;
      view.found.visible = view.reveal > 0; view.found.position.y = 1.1 + (2 - view.reveal) * .25;
    });
    let dropCount=0;for(const loot of sim.loot.slice(LOOT_POINTS.length)){if(dropCount>=512||!(loot.coins??0)&&!itemKeys.some(k=>loot.contents[k])||distance(sim.player,loot)>55)continue;this.dropPose.position.set(loot.x,.18,loot.z);this.dropPose.scale.setScalar(.8);this.dropPose.updateMatrix();this.drops.setMatrixAt(dropCount++,this.dropPose.matrix);}this.drops.count=dropCount;this.drops.instanceMatrix.needsUpdate=true;
    this.defenses.forEach((view, i) => {
      const b = sim.barricades[i], stage = damageStage(b.hp,defenseMaxHP(b));
      const key=`${stage}:${b.tier??0}`;
      if(view.key!==key){view.mesh.geometry=voxelGeometry(defenseRecipe(b,stage));view.key=key;view.stage=stage;}
      view.mesh.visible=b.built;
      if(b.id==='bed-gate'){
        view.gate=gateStep(view.gate,!!b.open,dt);
        view.mesh.rotation.y=view.gate;
        // Rotate the panel around its left hinge instead of teleporting its center.
        view.mesh.position.set(b.x-b.w/2+Math.cos(view.gate)*b.w/2,.18,b.z-Math.sin(view.gate)*b.w/2);
      }else {view.mesh.rotation.y=b.d>b.w?Math.PI/2:0;view.mesh.position.set(b.x,.18,b.z);}
      view.paint.emissive.setHex(b.flash > 0 ? 0x91633b : 0);
      view.mesh.rotation.z = b.flash > 0 ? Math.sin(b.flash * 60) * .014 : 0;
    });
    this.bandage.visible = sim.action?.kind === 'heal';
    if (this.bandage.visible) { this.bandage.position.set(sim.player.x + Math.sin(sim.player.angle) * .65, 1.2 + Math.sin(elapsed * 8) * .06, sim.player.z + Math.cos(sim.player.angle) * .65); this.bandage.rotation.y = sim.player.angle; }
  }
}
