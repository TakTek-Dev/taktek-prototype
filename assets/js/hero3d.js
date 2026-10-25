// The hero in 3D: the diamond lattice as real tiles, and the T-Tak at its centre.
// Tiles lift toward the pointer like parts being picked up; the two signal
// diamonds fly in and click onto the stem; a click sends a ripple through the
// lattice. Loaded by site.js after the page is up; the SVG lattice is the fallback.
import * as THREE from './vendor/three.module.min.js';

const COLS = 9;
const ROWS = 13;
const S = 1; // lattice pitch in world units

const easeOutBack = (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function diamondGeometry(side, depth, radius) {
  const h = side / 2;
  const r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: depth * 0.22, bevelSize: side * 0.06, bevelSegments: 3, curveSegments: 6,
  });
  geo.center();
  geo.rotateZ(Math.PI / 4);
  return geo;
}

export default function start(canvas, art, delay = 0) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const group = new THREE.Group();
  scene.add(group);

  // ---------------------------------------------------------------- lattice (same layout as the SVG)
  const w = COLS * S;
  const h = (ROWS + 1) * S / 2;
  const cx = w / 2;
  const cy = h / 2;
  const markY = Math.floor(ROWS / 2) * S / 2 + S / 2;
  const toWorld = (x, y) => new THREE.Vector2(x - cx, -(y - cy));

  const tiles = [];
  const marks = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i <= COLS; i++) {
      const x = i * S + (j % 2 ? S / 2 : 0);
      const y = j * S / 2 + S / 2;
      if (x <= 0 || x >= w) continue;
      const isMark = Math.abs(y - markY) < 1e-6 && Math.abs(Math.abs(x - cx) - S / 2) < 1e-6;
      if (Math.abs(x - cx) < 1e-6 && !isMark) continue; // the stem's column stays open
      const p = toWorld(x, y);
      if (isMark) marks.push(p); else tiles.push({ base: p, z: 0, rx: 0, ry: 0, lift: 0, dist: p.length() });
    }
  }

  const side = (S / 2) * 0.86 * Math.SQRT2;
  const tileGeo = diamondGeometry(side, 0.16, side * 0.22);
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x2b3531, metalness: 0.12, roughness: 0.52 });
  const field = new THREE.InstancedMesh(tileGeo, tileMat, tiles.length);
  field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const baseColor = new THREE.Color(0x2b3531);
  const hotColor = new THREE.Color(0x56655e);
  const tmpColor = new THREE.Color();
  tiles.forEach((_, i) => field.setColorAt(i, baseColor));
  group.add(field);

  // ---------------------------------------------------------------- the T-Tak
  const markMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4f53c, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18,
    emissive: 0x7a9e00, emissiveIntensity: 0.55,
  });
  const markGeo = diamondGeometry(side * 1.04, 0.42, side * 0.24);
  const dots = marks.sort((a, b) => a.x - b.x).map((p, k) => {
    const mesh = new THREE.Mesh(markGeo, markMat);
    mesh.userData = { home: p.clone(), from: new THREE.Vector3(k ? 9 : -9, 1.2, 3), spin: k ? -1 : 1 };
    group.add(mesh);
    return mesh;
  });

  const stemMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f5f4, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const r = S * 0.21;
  const v = (x, y) => { const p = toWorld(x, y); return new THREE.Vector3(p.x, p.y, 0.05); };
  const top = new THREE.LineCurve3(v(cx, markY - S * 3.1), v(cx, markY - S * 0.62));
  const lower = new THREE.CurvePath();
  lower.add(new THREE.LineCurve3(v(cx, markY + S * 0.62), v(cx, markY + S * 2.0)));
  lower.add(new THREE.QuadraticBezierCurve3(v(cx, markY + S * 2.0), v(cx, markY + S * 2.75), v(cx + S * 0.75, markY + S * 2.75)));
  lower.add(new THREE.LineCurve3(v(cx + S * 0.75, markY + S * 2.75), v(cx + S * 1.05, markY + S * 2.75)));
  const stem = new THREE.Group();
  const capGeo = new THREE.SphereGeometry(r, 20, 14);
  [top, lower].forEach((curve) => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, curve === top ? 8 : 48, r, 18), stemMat);
    stem.add(tube);
    [curve.getPoint(0), curve.getPoint(1)].forEach((pt) => {
      const cap = new THREE.Mesh(capGeo, stemMat);
      cap.position.copy(pt);
      stem.add(cap);
    });
  });
  group.add(stem);

  // ---------------------------------------------------------------- light
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2220, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd4f53c, 0.9);
  rim.position.set(-7, -3, -5);
  scene.add(rim);
  const torch = new THREE.PointLight(0xffffff, 0, 7, 1.6); // follows the pointer
  torch.position.set(0, 0, 2.2);
  group.add(torch);

  // ---------------------------------------------------------------- input
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const pointer = { on: false, world: new THREE.Vector2(99, 99), nx: 0, ny: 0 };
  const ripples = [];
  const toLocal = (e) => {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    pointer.nx = ndc.x;
    pointer.ny = ndc.y;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      group.worldToLocal(hit);
      pointer.world.set(hit.x, hit.y);
    }
  };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.on = true; toLocal(e); } });
  canvas.addEventListener('pointerleave', () => { pointer.on = false; });
  canvas.addEventListener('pointerdown', (e) => {
    toLocal(e);
    ripples.push({ x: pointer.world.x, y: pointer.world.y, t: clock.getElapsedTime() });
    clickAt = clock.getElapsedTime();
  });

  // ---------------------------------------------------------------- sizing and visibility
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fit = Math.max((h + 1.2) / 2, ((w + 0.8) / 2) / camera.aspect);
    camera.position.set(0, 0, fit / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  // ---------------------------------------------------------------- animation
  const clock = new THREE.Clock();
  const t0 = delay / 1000;
  let clickAt = -10;
  let landed = false;
  let raf = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  function frame() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime() - t0;
    const heroOut = clamp01(window.scrollY / Math.max(1, art.getBoundingClientRect().height));

    // group follows the pointer, with a slow sway when idle
    const tx = pointer.on ? pointer.nx * 0.28 : Math.sin(t * 0.35) * 0.08;
    const ty = pointer.on ? -pointer.ny * 0.2 : Math.cos(t * 0.3) * 0.05;
    group.rotation.y += (tx - group.rotation.y) * 0.06;
    group.rotation.x += (ty + heroOut * 0.55 - group.rotation.x) * 0.06;
    group.position.y = heroOut * 1.4;

    torch.intensity += ((pointer.on ? 7 : 0) - torch.intensity) * 0.1;
    torch.position.set(pointer.world.x, pointer.world.y, 2.2);

    // tiles: rise in from the centre, lift near the pointer, ride ripples
    const now = clock.getElapsedTime();
    tiles.forEach((tile, i) => {
      const k = clamp01((t - tile.dist * 0.06) / 0.7);
      const appear = k <= 0 ? 0 : easeOutBack(k, 1.4);
      const d = pointer.on ? tile.base.distanceTo(pointer.world) : 99;
      const near = Math.exp(-(d * d) / (2 * 1.15 * 1.15));
      let wave = 0;
      for (const rp of ripples) {
        const age = now - rp.t;
        const front = age * 7;
        const dd = Math.hypot(tile.base.x - rp.x, tile.base.y - rp.y);
        wave += Math.exp(-((dd - front) ** 2) / 0.5) * Math.max(0, 1 - age / 1.6);
      }
      const lift = near * 0.85 + wave * 0.9;
      tile.lift += (lift - tile.lift) * 0.14;
      tile.rx += (((pointer.world.y - tile.base.y) * near * 0.5) - tile.rx) * 0.12;
      tile.ry += ((-(pointer.world.x - tile.base.x) * near * 0.5) - tile.ry) * 0.12;
      pos.set(tile.base.x, tile.base.y, -2.2 * (1 - appear) + tile.lift);
      e3.set(-tile.rx, -tile.ry, (1 - appear) * 1.2);
      q.setFromEuler(e3);
      scl.setScalar(Math.max(0.001, appear));
      m.compose(pos, q, scl);
      field.setMatrixAt(i, m);
      tmpColor.copy(baseColor).lerp(hotColor, Math.min(1, near * 1.2 + wave));
      field.setColorAt(i, tmpColor);
    });
    field.instanceMatrix.needsUpdate = true;
    field.instanceColor.needsUpdate = true;
    for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > 1.8) ripples.splice(i, 1);

    // the stem grows, then the two dots fly in and click onto it
    const g = easeOutCubic(clamp01((t - 0.15) / 0.6));
    stem.scale.set(1, Math.max(0.001, g), 1);
    const fly = clamp01((t - 0.45) / 0.75);
    const f = easeOutBack(fly, 2.1);
    if (!landed && fly >= 1) {
      landed = true;
      ripples.push({ x: 0, y: toWorld(cx, markY).y, t: now });
      clickAt = now;
    }
    const pulse = Math.max(0, 1 - (now - clickAt) / 0.35);
    dots.forEach((dot) => {
      const { home, from, spin } = dot.userData;
      dot.position.set(from.x + (home.x - from.x) * f, from.y + (home.y - from.y) * f, from.z * (1 - f) + 0.08 + Math.sin(now * 1.6) * 0.04);
      dot.rotation.set(0, (1 - f) * spin * 2.5, (1 - f) * spin * 3);
      dot.scale.setScalar(1 - pulse * 0.16);
    });

    renderer.render(scene, camera);
    if (!art.classList.contains('is-3d')) art.classList.add('is-3d');
    loop();
  }

  function loop() {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  loop();

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    [tileGeo, markGeo, capGeo].forEach((geo) => geo.dispose());
    [tileMat, markMat, stemMat].forEach((mat) => mat.dispose());
  };
}
