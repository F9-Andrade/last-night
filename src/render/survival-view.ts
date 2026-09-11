import * as THREE from 'three';
import { LOOT_POINTS } from '../game/loot';
import { DEFENSE_POINTS, damageStage } from '../game/defenses';
import { itemKeys } from '../game/inventory';
import type { Item } from '../game/inventory';
import type { Simulation } from '../game/simulation';
import { distance } from '../game/world';
import { voxelGeometry, voxelMesh, voxelMaterial } from './voxel';
import { barricadeRecipe, containerRecipe, itemRecipe } from './survival-assets';
/** Persistent visual instances. State changes swap cached geometry; retries allocate nothing here. */
export class SurvivalView {
  private containers: { root: THREE.Group; lid: THREE.Group; marker: THREE.Mesh; found: THREE.Mesh; reveal: number; searched: boolean }[] = [];
  private defenses: { mesh: THREE.Mesh; anchor: THREE.Mesh; paint: THREE.MeshStandardMaterial; stage: number }[] = [];
  private bandage = voxelMesh(itemRecipe('med'));
  constructor(scene: THREE.Scene) {
    for (const key of itemKeys) voxelGeometry(itemRecipe(key));
    const markerGeo = new THREE.OctahedronGeometry(.11), markerPaint = new THREE.MeshBasicMaterial({ color: 0xdab67b });
    for (const point of LOOT_POINTS) {
      const root = new THREE.Group(); root.position.set(point.x, .18, point.z); root.add(voxelMesh(containerRecipe(point.area, false)));
      const lid = new THREE.Group(); lid.position.set(0, .74, -.4); lid.add(voxelMesh(containerRecipe(point.area, true))); root.add(lid);
      const marker = new THREE.Mesh(markerGeo, markerPaint); marker.position.y = 1.45; root.add(marker);
      const key: Item = point.area === 'hospital' ? 'med' : point.area === 'police' || point.area === 'base' ? 'ammo' : point.area === 'gas' ? 'scrap' : 'wood';
      const found = voxelMesh(itemRecipe(key)); found.scale.setScalar(.7); found.visible = false; root.add(found);
      scene.add(root); this.containers.push({ root, lid, marker, found, reveal: 0, searched: false });
    }
    const anchorPaint = new THREE.MeshBasicMaterial({ color: 0xc8a46b, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide });
    for (const point of DEFENSE_POINTS) {
      for (let stage = 0; stage < 4; stage++) voxelGeometry(barricadeRecipe(point.w, stage));
      const paint = voxelMaterial.clone(), mesh = voxelMesh(barricadeRecipe(point.w, 0), paint); mesh.position.set(point.x, .18, point.z); scene.add(mesh);
      const anchor = new THREE.Mesh(new THREE.PlaneGeometry(point.w, 1), anchorPaint); anchor.rotation.x = -Math.PI / 2; anchor.position.set(point.x, .26, point.z); scene.add(anchor);
      this.defenses.push({ mesh, anchor, paint, stage: 0 });
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
      view.marker.visible = !menu && (!loot.searched || itemKeys.some(k => loot.contents[k])) && distance(sim.player, loot) < 9;
      view.marker.position.y = 1.45 + Math.sin(elapsed * 2 + i) * .08;
      view.found.visible = view.reveal > 0; view.found.position.y = 1.1 + (2 - view.reveal) * .25;
    });
    this.defenses.forEach((view, i) => {
      const b = sim.barricades[i], stage = damageStage(b.hp);
      if (view.stage !== stage) { view.mesh.geometry = voxelGeometry(barricadeRecipe(b.w, stage)); view.stage = stage; }
      view.mesh.visible = b.built; view.anchor.visible = !menu && b.hp <= 0 && distance(sim.player, b) < 10;
      view.paint.emissive.setHex(b.flash > 0 ? 0x91633b : 0);
      view.mesh.rotation.z = b.flash > 0 ? Math.sin(b.flash * 60) * .014 : 0;
    });
    this.bandage.visible = sim.action?.kind === 'heal';
    if (this.bandage.visible) { this.bandage.position.set(sim.player.x + Math.sin(sim.player.angle) * .65, 1.2 + Math.sin(elapsed * 8) * .06, sim.player.z + Math.cos(sim.player.angle) * .65); this.bandage.rotation.y = sim.player.angle; }
  }
}
