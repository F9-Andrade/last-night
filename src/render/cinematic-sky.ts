import * as THREE from 'three';

// Original directional sky; no downloaded skybox, HDRI or texture. All colours
// below are linear. The renderer (or the composer's OutputPass) handles display.
const vertexShader = /* glsl */`
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = mat3(modelMatrix) * position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uNight;
  uniform float uTime;
  uniform vec3 uSunDirection;
  varying vec3 vSkyDirection;

  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float cloudNoise(vec3 p) {
    // Four bounded octaves, independent of view distance and render resolution.
    float value = noise(p) * 0.55;
    p = p * 2.03 + vec3(17.3, 3.1, 9.2);
    value += noise(p) * 0.25;
    p = p * 2.01 + vec3(2.7, 19.1, 5.3);
    value += noise(p) * 0.13;
    value += noise(p * 2.02 + vec3(11.1, 7.2, 1.3)) * 0.07;
    return value;
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float height = clamp(direction.y, 0.0, 1.0);
    float horizon = pow(1.0 - height, 2.7);
    float towardsSun = max(dot(direction, uSunDirection), 0.0);
    float sunHaze = pow(towardsSun, 12.0);

    vec3 day = mix(vec3(0.155, 0.195, 0.260), vec3(0.66, 0.46, 0.30), horizon);
    day += vec3(0.14, 0.075, 0.022) * sunHaze;
    vec3 night = mix(vec3(0.004, 0.009, 0.021), vec3(0.016, 0.023, 0.035), horizon);
    vec3 sky = mix(day, night, uNight);

    // A shallow cloud deck compresses towards the horizon. Sampling a 3D field
    // from a direction avoids seams and never attaches clouds to screen space.
    vec3 cloudPosition = vec3(direction.xz / (0.22 + height), height * 0.7).xzy;
    cloudPosition = cloudPosition * 3.0 + vec3(uTime * 0.003, 0.7, uTime * 0.001);
    float cloud = cloudNoise(cloudPosition);
    float coverage = smoothstep(0.37, 0.67, cloud);
    coverage *= smoothstep(-0.035, 0.07, direction.y);
    float litEdge = (1.0 - smoothstep(0.43, 0.66, cloud)) * (0.3 + sunHaze * 0.7);
    vec3 cloudDay = mix(vec3(0.12, 0.132, 0.151), vec3(0.43, 0.365, 0.29), litEdge);
    cloudDay = mix(cloudDay, vec3(0.365, 0.305, 0.255), horizon * 0.48);
    vec3 cloudNight = mix(vec3(0.0045, 0.008, 0.014), vec3(0.018, 0.024, 0.036), litEdge);
    sky = mix(sky, mix(cloudDay, cloudNight, uNight), coverage * 0.82);

    // A restrained source sits behind the cloud deck, aligned with the actual
    // directional light. It stays below bloom's emissive threshold.
    float sunDisc = smoothstep(0.99935, 0.99983, towardsSun);
    sky += vec3(0.28, 0.18, 0.085) * sunDisc * (1.0 - uNight) * (1.0 - coverage * 0.94);
    sky = mix(sky, mix(vec3(0.28, 0.25, 0.22), vec3(0.01, 0.014, 0.021), uNight), (1.0 - smoothstep(-0.3, 0.0, direction.y)));

    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class CinematicSky {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  constructor(scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      name: 'Santa Luz cloud deck',
      vertexShader,
      fragmentShader,
      uniforms: {
        uNight: { value: 0 },
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(-1, 0.45, 0.5).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
    this.mesh.name = 'Santa Luz atmospheric sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.userData.skipAO = true;
    scene.add(this.mesh);
  }

  update(camera: THREE.Camera, night: number, sunDirection: THREE.Vector3, elapsed: number): void {
    camera.getWorldPosition(this.mesh.position);
    const far = (camera as THREE.PerspectiveCamera).far;
    this.mesh.scale.setScalar(Number.isFinite(far) ? Math.max(1, far * 0.92) : 400);
    const uniforms = this.mesh.material.uniforms;
    uniforms.uNight.value = THREE.MathUtils.clamp(night, 0, 1);
    uniforms.uTime.value = elapsed;
    const direction = uniforms.uSunDirection.value as THREE.Vector3;
    if (sunDirection.lengthSq() > 0) direction.copy(sunDirection).normalize();
  }
}
