/** Art direction only. Never used by simulation, collision or network authority. */
export const VISUAL = {
 exposure: .94,
 sun: { day:3.5, night:.35, color:0xffd1a0, moon:0x9ebbd4, offset:[-58,35,26] as const },
 ambient: { day:.68, night:.48, sky:0xa9b8c9, ground:0x635b4d },
 fog: { day:0x9c9690, night:0x273545, density:.0038, nightDensity:.0068 },
 shadow: { span:42, near:1, far:190, bias:-.00012, normalBias:.025 },
 ao: { radius:1.05, thickness:1.1, intensity:.65, samples:12 },
 grade: { saturation:.93, contrast:1.055, vignette:.14 },
 bloom: { strength:.13, radius:.35, threshold:2.8 },
};
export const VISUAL_PRESETS = {
 low: {pixelRatio:1,shadow:0,aoScale:0,aoSamples:0,bloom:false,distance:105,detail:.35},
 medium: {pixelRatio:1.25,shadow:1024,aoScale:0,aoSamples:0,bloom:false,distance:125,detail:.65},
 high: {pixelRatio:1.5,shadow:2048,aoScale:.5,aoSamples:12,bloom:true,distance:150,detail:1},
 ultra: {pixelRatio:1.75,shadow:4096,aoScale:.75,aoSamples:16,bloom:true,distance:165,detail:1},
} as const;
export type VisualQuality=keyof typeof VISUAL_PRESETS;
export const visualPreset=(quality:string)=>VISUAL_PRESETS[quality as VisualQuality]??VISUAL_PRESETS.high;
