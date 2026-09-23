import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import { useAssets } from '../engine/assets';
import { Assembler } from '../engine/Assembler';
import { journey } from '../journey/journeyState';
import { ELEVATOR, LOBBY, PENTHOUSE } from '../journey/layout';
import { CAMERA_TRACKS } from '../journey/timeline';
import { bx } from './builders/hotel';
import { polyTube, rbox } from './builders/shapes';
import { elevatorState } from './JourneyLights';
import { useVisibleRange } from './useVisibleRange';

/**
 * 02 — THE RIDE UP
 * A bronze-lined car with a tinted mirror, a backlit ceiling and a real floor
 * indicator. Doors open on the lobby, close, the car climbs the shaft with
 * the camera inside, and opens again on the penthouse.
 */
const Z = ELEVATOR.zDoor; // car front plane
const HALF = ELEVATOR.width / 2;
const DEPTH = ELEVATOR.depth;
const H = ELEVATOR.height;
const OPEN = 0.7;

function makeIndicator() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  let last = '';
  const draw = (label: string, dir: number) => {
    const key = `${label}${dir}`;
    if (key === last) return;
    last = key;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#060504';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#f2d7a8';
    g.font = '300 58px "Cormorant Garamond", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 128, 52);
    if (dir !== 0) {
      g.beginPath();
      const y = dir > 0 ? 30 : 66;
      g.moveTo(206, y + (dir > 0 ? 8 : -8));
      g.lineTo(214, y);
      g.lineTo(222, y + (dir > 0 ? 8 : -8));
      g.strokeStyle = '#f2d7a8';
      g.lineWidth = 2;
      g.stroke();
    }
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

export function ElevatorScene() {
  const { mats } = useAssets();

  const built = useMemo(() => {
    const I = mats.int;
    const root = new Group();
    root.name = 'elevator';

    // ---------------------------------------------------------------- the car (moves)
    const car = new Group();
    const a = new Assembler();
    const B = I.carBronze;
    const zb = Z + DEPTH;
    bx(a, I.marbleDark, -HALF, -0.12, Z, HALF, 0, zb); // floor
    bx(a, B, -HALF - 0.05, 0, Z, -HALF, H, zb); // side walls
    bx(a, B, HALF, 0, Z, HALF + 0.05, H, zb);
    bx(a, B, -HALF, 0, zb, HALF, 0.95, zb + 0.05); // back wall low
    bx(a, I.carMirror, -HALF + 0.05, 0.95, zb - 0.01, HALF - 0.05, H - 0.2, zb + 0.04); // tinted mirror
    bx(a, B, -HALF, H - 0.2, zb, HALF, H, zb + 0.05);
    // front returns + transom (inside the car)
    bx(a, B, -HALF, 0, Z, -OPEN, H, Z + 0.05);
    bx(a, B, OPEN, 0, Z, HALF, H, Z + 0.05);
    bx(a, B, -OPEN, 2.5, Z, OPEN, H, Z + 0.05);
    // wall panelling reveals
    for (const s of [-1, 1]) {
      for (const zz of [Z + 0.75, Z + 1.5]) bx(a, I.black, s * (HALF - 0.004) - 0.004, 0.1, zz - 0.004, s * (HALF - 0.004) + 0.004, H - 0.1, zz + 0.004, false);
    }
    // leather handrail on the back and sides
    a.add(polyTube([new Vector3(-HALF + 0.12, 0.92, zb - 0.07), new Vector3(HALF - 0.12, 0.92, zb - 0.07)], 0.02, 10), I.leatherBlack);
    for (const s of [-1, 1]) a.add(polyTube([new Vector3(s * (HALF - 0.07), 0.92, Z + 0.4), new Vector3(s * (HALF - 0.07), 0.92, zb - 0.2)], 0.02, 10), I.leatherBlack);
    // backlit ceiling with a bronze frame
    bx(a, B, -HALF, H - 0.02, Z, HALF, H + 0.05, zb, false);
    bx(a, I.ledSoft, -HALF + 0.12, H - 0.04, Z + 0.12, HALF - 0.12, H - 0.02, zb - 0.12, false);
    // control panel column
    bx(a, I.black, HALF - 0.04, 0.9, Z + 0.3, HALF - 0.01, 1.5, Z + 0.46, false);
    for (let i = 0; i < 5; i++) a.put(rbox(0.02, 0.035, 0.035, 0.008), I.brass, HALF - 0.045, 1.0 + i * 0.1, Z + 0.38, { castShadow: false });
    car.add(a.build('car'));

    // floor indicator above the door (inside)
    const ind = makeIndicator();
    const indicator = new Mesh(new PlaneGeometry(0.34, 0.13), new MeshBasicMaterial({ map: ind.tex, toneMapped: false }));
    indicator.position.set(0, 2.68, Z + 0.056);
    car.add(indicator);

    // car doors
    const leafGeo = rbox(OPEN + 0.02, 2.5, 0.03, 0.006, 2);
    const carL = new Mesh(leafGeo, I.elevatorBronze);
    const carR = new Mesh(leafGeo, I.elevatorBronze);
    carL.position.set(-OPEN / 2, 1.25, Z - 0.025);
    carR.position.set(OPEN / 2, 1.25, Z - 0.025);
    car.add(carL, carR);
    root.add(car);

    // ---------------------------------------------------------------- landing doors
    const landing = (y: number) => {
      const l = new Mesh(leafGeo, I.elevatorBronze);
      const r = new Mesh(leafGeo, I.elevatorBronze);
      l.position.set(-OPEN / 2, y + 1.25, Z - 0.09);
      r.position.set(OPEN / 2, y + 1.25, Z - 0.09);
      l.castShadow = r.castShadow = true;
      root.add(l, r);
      return { l, r };
    };
    const lobbyDoors = landing(LOBBY.floor);
    const phDoors = landing(PENTHOUSE.floor);

    // dark shaft lining behind the car (visible only through gaps)
    const s = new Assembler();
    bx(s, I.black, -HALF - 0.4, LOBBY.floor - 0.5, Z + DEPTH + 0.2, HALF + 0.4, PENTHOUSE.floor + 3.5, Z + DEPTH + 0.3, false);
    root.add(s.build('shaft'));

    return { root, car, carL, carR, lobbyDoors, phDoors, ind };
  }, [mats]);

  useVisibleRange(built.root, 13.8, 24.2);

  useFrame(() => {
    const p = journey.progress;
    const camBaseY = CAMERA_TRACKS.y.evaluate(p);
    let floor = LOBBY.floor;
    if (p >= 19.8 && p <= 21.8) floor = Math.min(PENTHOUSE.floor, Math.max(LOBBY.floor, camBaseY - ELEVATOR.eye));
    else if (p > 21.8) floor = PENTHOUSE.floor;
    elevatorState.carFloor = floor;
    built.car.position.y = floor;

    const c = journey.cues;
    const lob = c.lobbyDoors;
    const ph = c.phDoors;
    const carOpen = floor < LOBBY.floor + 0.05 ? lob : floor > PENTHOUSE.floor - 0.05 ? ph : 0;
    const slide = (k: number) => OPEN / 2 + k * (OPEN + 0.05);
    built.carL.position.x = -slide(carOpen);
    built.carR.position.x = slide(carOpen);
    built.lobbyDoors.l.position.x = -slide(lob);
    built.lobbyDoors.r.position.x = slide(lob);
    built.phDoors.l.position.x = -slide(ph);
    built.phDoors.r.position.x = slide(ph);

    // floor indicator: L · 1 · 2 · 3 · PH
    const t = (floor - LOBBY.floor) / (PENTHOUSE.floor - LOBBY.floor);
    const labels = ['L', '1', '2', '3', 'PH'];
    const label = labels[Math.min(4, Math.max(0, Math.round(t * 4)))];
    const moving = p > 19.9 && p < 21.6 ? 1 : 0;
    built.ind.draw(label, moving);
  });

  return <primitive object={built.root} />;
}
