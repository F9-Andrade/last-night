# Phase 11 — surface and environment notes

This pass extends the existing Santa Luz renderer. It does not change world footprints, navigation, collision, loot, spawning, network messages or simulation state.

## Surfaces

`src/render/surface-materials.ts` creates eight deterministic, original 256 × 256 detail tiles: general voxel paint, asphalt, paving, plaster, roof, oxidized metal, glass and earth. Their world-space mapping survives merged static geometry and keeps color variation continuous across voxel faces. Granularity, repair patches, angular fractures, paving joints, plaster flakes, vertical water streaks and oxidation are deliberately restrained; the geometry remains visibly voxel.

Static batches encode a surface family per vertex and use a single 1024 × 512 atlas material. The fragment shader retains each family's scale, roughness and metalness, so reducing draw calls does not turn glass and rust into identical surfaces. Animated or unmerged surfaces can use individual shared family materials. All lighting remains Three.js MeshStandardMaterial lighting.

The atlas is approximately 2.67 MiB including mipmaps. The eight standalone source textures have the same combined upper bound; only textures actually compiled and sampled are uploaded by the renderer. `surfaceStats()` reports the total created texture budget; `renderer.info.memory.textures` measures allocated renderer textures. The atlas and source textures are generated once, cached and reused.

## Decay and composition

`facade-weathering.ts` attaches foundation damp, exposed corner masonry, runoff streaks and small parapet chips. Selected urban houses receive asymmetrical chimney caps and rooftop debris. Existing roads get a neutral gray asphalt base instead of the previous green-gray/brown cast; the lighting supplies warmth.

`environmental-dressing.ts` deterministically places 5,674 cosmetic pieces and 1,054 small weed clumps around existing roads, parked vehicles, building foundations and authored story scenes. Litter concentrates in gutters, oil lies near engines, and bags or scattered medical paper reinforce existing evacuation and triage scenes. It adds no vehicles or new blocking objects. Lane centers, intersections and doorways remain available for gameplay.

The dressing uses 98 spatial cells of 32 m. Solid debris is merged per cell; weeds instance a single cached grass geometry per cell. All small pieces receive shadows and do not cast expensive sub-pixel shadows. No new dressing is spawned during play, so memory and draw count cannot grow with session length.

Extra-detail radii are approximately 39 m on Low, 54 m on Medium and 70 m on High/Ultra. Low also hides these additional weed instances. Existing scene vegetation remains under its existing renderer management.

## Interiors and transparent surfaces

The two existing interior point lights use warm-neutral or cool hospital colors, increasing from intensity 12 in daytime to 18 at night. Matching fixtures provide a visible source; no additional shadow-casting lights were created. Existing window break/open states and portal behavior remain untouched. Fixed vehicle glass is opaque stylized geometry with a smoother material response; this pass does not implement refraction or screen-space reflections.

## Assets and licenses

All surface tiles and new dressing are original procedural project code created in this phase. There are no downloaded world textures, HDRIs, skyboxes or fonts in this pass. The previously supplied UI background and item artwork remain unchanged. No new external asset license is required for these generated surfaces.

## Validation and limits

TypeScript validation and all 168 existing/current unit tests passed after atlas integration. Browser shader compilation, comparative screenshots, real Photon regression and before/after performance are recorded by the main Phase 11 validation report. Do not treat the tile memory estimate as a GPU timing measurement.

The material pass provides diffuse/roughness variation and geometric details; it does not add displacement, parallax, real reflections, dynamic destruction, new collision geometry or extra enemy AI. Its visual result still depends on view direction, time of day, quality preset and existing Santa Luz layout.
