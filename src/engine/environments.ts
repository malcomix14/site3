import {
  BackSide,
  BoxGeometry,
  Color,
  CubeCamera,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Texture,
  Vector3,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
  CylinderGeometry,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { SUN_DIRECTION } from '../journey/layout';

export interface Environments {
  /** raw sky cube (no sun disc) — fog colour + ocean reflections */
  skyCube: WebGLCubeRenderTarget;
  /** prefiltered environments for PBR materials */
  sky: Texture;
  interior: Texture;
  yacht: Texture;
  studio: Texture;
  cabin: Texture;
  elevator: Texture;
}

export const SKY_PARAMS = {
  turbidity: 4.2,
  rayleigh: 1.55,
  mieCoefficient: 0.0028,
  mieDirectionalG: 0.86,
  cloudCoverage: 0.22,
  cloudDensity: 0.35,
  cloudElevation: 0.62,
  cloudScale: 0.00016,
};

export function createSky(showSun: boolean): Sky {
  const sky = new Sky();
  const u = sky.material.uniforms;
  u.turbidity.value = SKY_PARAMS.turbidity;
  u.rayleigh.value = SKY_PARAMS.rayleigh;
  u.mieCoefficient.value = SKY_PARAMS.mieCoefficient;
  u.mieDirectionalG.value = SKY_PARAMS.mieDirectionalG;
  u.sunPosition.value.copy(SUN_DIRECTION).multiplyScalar(450000);
  u.showSunDisc.value = showSun ? 0.32 : 0;
  u.cloudCoverage.value = SKY_PARAMS.cloudCoverage;
  u.cloudDensity.value = SKY_PARAMS.cloudDensity;
  u.cloudElevation.value = SKY_PARAMS.cloudElevation;
  u.cloudScale.value = SKY_PARAMS.cloudScale;
  sky.frustumCulled = false;
  return sky;
}

const emissive = (r: number, g: number, b: number) =>
  new MeshBasicMaterial({ color: new Color(r, g, b), side: BackSide, toneMapped: false });
const emissiveFront = (r: number, g: number, b: number) =>
  new MeshBasicMaterial({ color: new Color(r, g, b), toneMapped: false });

function panel(w: number, h: number, mat: MeshBasicMaterial, pos: Vector3, lookAt: Vector3) {
  const m = new Mesh(new PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  m.lookAt(lookAt);
  return m;
}

function interiorScene(): Scene {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(24, 7, 24), emissive(0.3, 0.26, 0.21));
  room.position.y = 3.5;
  s.add(room);
  const floor = new Mesh(new PlaneGeometry(24, 24), emissiveFront(0.2, 0.15, 0.1));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  s.add(floor);
  const c = new Vector3(0, 2, 0);
  // the big glazing, sea light
  s.add(panel(20, 5, emissiveFront(2.6, 2.35, 2.1), new Vector3(0, 3, -11.9), c));
  // low warm sun patch on the floor
  const sun = new Mesh(new PlaneGeometry(8, 5), emissiveFront(7, 5, 3.2));
  sun.rotation.x = -Math.PI / 2;
  sun.position.set(-2, 0.02, -3);
  s.add(sun);
  // ceiling coves
  for (const x of [-7, 7]) s.add(panel(0.6, 20, emissiveFront(1.8, 1.45, 1.05), new Vector3(x, 6.95, 0), new Vector3(x, 0, 0)));
  s.add(panel(10, 0.6, emissiveFront(1.4, 1.15, 0.85), new Vector3(0, 6.95, 8), new Vector3(0, 0, 8)));
  return s;
}

function yachtScene(): Scene {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(16, 3, 9), emissive(0.12, 0.085, 0.06));
  room.position.y = 1.5;
  s.add(room);
  const c = new Vector3(0, 1.4, 0);
  for (const z of [-4.45, 4.45]) {
    s.add(panel(12, 1.2, emissiveFront(2.2, 2.3, 2.5), new Vector3(0, 1.5, z), c));
  }
  s.add(panel(5, 2.2, emissiveFront(2.0, 1.9, 1.8), new Vector3(7.95, 1.3, 0), c));
  for (const z of [-3.2, 3.2]) s.add(panel(14, 0.25, emissiveFront(2.4, 1.7, 1.0), new Vector3(0, 2.98, z), new Vector3(0, 0, z)));
  const sun = new Mesh(new PlaneGeometry(6, 2), emissiveFront(5.5, 3.8, 2.2));
  sun.rotation.x = -Math.PI / 2;
  sun.position.set(0, 0.02, -2.5);
  s.add(sun);
  return s;
}

function studioScene(): Scene {
  const s = new Scene();
  const room = new Mesh(new SphereGeometry(20, 32, 16), emissive(0.004, 0.004, 0.005));
  s.add(room);
  const c = new Vector3(0, 0, 0);
  // large overhead softbox
  s.add(panel(9, 5, emissiveFront(5.5, 5.4, 5.2), new Vector3(0, 10, -2), c));
  // tall strip lights left & right
  s.add(panel(1.2, 12, emissiveFront(3.4, 3.4, 3.5), new Vector3(-9, 2, 3), c));
  s.add(panel(0.9, 12, emissiveFront(3.0, 2.6, 2.1), new Vector3(9, 1, -4), c));
  // subtle back rim
  s.add(panel(10, 0.6, emissiveFront(2.2, 2.2, 2.4), new Vector3(0, 3, 12), c));
  // warm floor bounce
  const floor = new Mesh(new CylinderGeometry(8, 8, 0.1, 32), emissiveFront(0.09, 0.07, 0.05));
  floor.position.y = -6;
  s.add(floor);
  return s;
}

function elevatorScene(): Scene {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(2.3, 2.9, 2.2), emissive(0.09, 0.065, 0.045));
  room.position.y = 1.45;
  s.add(room);
  s.add(panel(2.0, 1.9, emissiveFront(2.4, 2.1, 1.7), new Vector3(0, 2.88, 0), new Vector3(0, 0, 0)));
  const floor = new Mesh(new PlaneGeometry(2.3, 2.2), emissiveFront(0.02, 0.02, 0.022));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  s.add(floor);
  return s;
}

function cabinScene(): Scene {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(6, 3, 6), emissive(0.012, 0.011, 0.01));
  s.add(room);
  // the window glow and a faint cove
  const disc = new Mesh(new CylinderGeometry(0.9, 0.9, 0.05, 48), emissiveFront(7, 7.2, 7.6));
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0, 2.9);
  s.add(disc);
  s.add(panel(5, 0.12, emissiveFront(1.1, 0.8, 0.5), new Vector3(0, 1.45, 0), new Vector3(0, 0, 0)));
  return s;
}

export function createEnvironments(renderer: WebGLRenderer, cubeSize = 256): Environments {
  // raw sky cube
  const skyCube = new WebGLCubeRenderTarget(cubeSize, {
    type: HalfFloatType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });
  const skyScene = new Scene();
  const sky = createSky(false);
  sky.scale.setScalar(1000);
  skyScene.add(sky);
  const cubeCam = new CubeCamera(1, 5000, skyCube);
  cubeCam.update(renderer, skyScene);

  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  pmrem.compileEquirectangularShader();
  const skyEnv = pmrem.fromCubemap(skyCube.texture).texture;
  const interior = pmrem.fromScene(interiorScene(), 0.035).texture;
  const yacht = pmrem.fromScene(yachtScene(), 0.03).texture;
  const studio = pmrem.fromScene(studioScene(), 0.01).texture;
  const cabin = pmrem.fromScene(cabinScene(), 0.02).texture;
  const elevator = pmrem.fromScene(elevatorScene(), 0.02, 0.05, 20).texture;
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();

  return { skyCube, sky: skyEnv, interior, yacht, studio, cabin, elevator };
}
