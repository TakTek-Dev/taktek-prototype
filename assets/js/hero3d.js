// The hero in 3D: TakTek's original wordmark «تاك تيك», extruded from its own
// traced outlines, standing on a lattice of diamond tiles. The letters rise,
// then the three pairs of diamond dots fly in and click into place; tiles lift
// toward the pointer, and a click sends a ripple through them. Loaded by
// site.js on the first mouse move or scroll; the SVG lattice is the fallback.
import * as THREE from './vendor/three.module.min.js';
import { SVGLoader } from './vendor/SVGLoader.js';

const COLS = 9;
const ROWS = 13;
const S = 1; // lattice pitch in world units
const LOGO_HEIGHT = 5.4; // world units

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

export default async function start(canvas, art, delay = 0) {
  const svgText = await fetch(new URL(canvas.dataset.logo, document.baseURI)).then((r) => r.text());

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
  const tiles = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i <= COLS; i++) {
      const x = i * S + (j % 2 ? S / 2 : 0);
      const y = j * S / 2 + S / 2;
      if (x <= 0 || x >= w) continue;
      const p = new THREE.Vector2(x - cx, -(y - cy));
      tiles.push({ base: p, rx: 0, ry: 0, lift: 0, dist: p.length() });
    }
  }
  const side = (S / 2) * 0.86 * Math.SQRT2;
  const tileGeo = diamondGeometry(side, 0.16, side * 0.22);
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x2b3531, metalness: 0.12, roughness: 0.52 });
  const field = new THREE.InstancedMesh(tileGeo, tileMat, tiles.length);
  field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  field.position.z = -1.25; // far enough back that lifted tiles never reach the letters
  const baseColor = new THREE.Color(0x2b3531);
  const hotColor = new THREE.Color(0x56655e);
  const tmpColor = new THREE.Color();
  tiles.forEach((_, i) => field.setColorAt(i, baseColor));
  group.add(field);

  // ---------------------------------------------------------------- the wordmark, from its own outlines
  const limeMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfff00, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18,
    emissive: 0x6f8a00, emissiveIntensity: 0.35,
  });
  limeMat.toneMapped = false; // keep the original lime exact; ACES would wash it out
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf5f7f6, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const svg = new SVGLoader().parse(svgText);
  const vb = svg.xml.getAttribute('viewBox').split(/\s+/).map(Number);
  const k = LOGO_HEIGHT / vb[3];
  const logo = new THREE.Group();
  logo.scale.set(k, -k, k); // SVG y runs down
  logo.position.set(-(vb[0] + vb[2] / 2) * k, (vb[1] + vb[3] / 2) * k, 0);
  group.add(logo);
  const depth = 0.36 / k;
  const letters = [];
  const dots = [];
  svg.paths.forEach((path, n) => {
    const node = path.userData.node;
    const kind = node.getAttribute('data-kind');
    const lime = node.getAttribute('data-colour') === 'lime';
    const geo = new THREE.ExtrudeGeometry(SVGLoader.createShapes(path), {
      depth, bevelEnabled: true, bevelThickness: depth * 0.12, bevelSize: depth * 0.08, bevelSegments: 3, curveSegments: 10,
    });
    geo.computeBoundingBox();
    const centre = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-centre.x, -centre.y, -depth / 2); // animate each part about its own centre
    const mesh = new THREE.Mesh(geo, lime ? limeMat : whiteMat);
    mesh.position.set(centre.x, centre.y, 0);
    mesh.userData = { home: mesh.position.clone(), n };
    logo.add(mesh);
    (kind === 'dots' ? dots : letters).push(mesh);
  });
  // dots fly in from the side they sit nearest, one pair after another
  dots.sort((a, b) => a.userData.home.y - b.userData.home.y).forEach((dot, i) => {
    const fromRight = dot.userData.home.x > vb[0] + vb[2] / 2;
    dot.userData.from = new THREE.Vector3(dot.userData.home.x + (fromRight ? 1 : -1) * 5200, dot.userData.home.y - 600, 2600);
    dot.userData.at = 0.75 + i * 0.22;
    dot.userData.landed = false;
  });

  // ---------------------------------------------------------------- light
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2220, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(4, 6, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfff00, 0.9);
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
  const clock = new THREE.Clock();
  let clickAt = -10;
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
  let raf = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  // ---------------------------------------------------------------- animation
  const t0 = delay / 1000;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const logoToGroup = new THREE.Vector3();

  function frame() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime() - t0;
    const now = clock.getElapsedTime();
    const heroOut = clamp01(window.scrollY / Math.max(1, art.getBoundingClientRect().height));

    const tx = pointer.on ? pointer.nx * 0.28 : Math.sin(t * 0.35) * 0.08;
    const ty = pointer.on ? -pointer.ny * 0.2 : Math.cos(t * 0.3) * 0.05;
    group.rotation.y += (tx - group.rotation.y) * 0.06;
    group.rotation.x += (ty + heroOut * 0.55 - group.rotation.x) * 0.06;
    group.position.y = heroOut * 1.4;
    torch.intensity += ((pointer.on ? 7 : 0) - torch.intensity) * 0.1;
    torch.position.set(pointer.world.x, pointer.world.y, 2.2);

    // tiles: rise in from the centre, lift near the pointer, ride ripples
    tiles.forEach((tile, i) => {
      const kk = clamp01((t - tile.dist * 0.06) / 0.7);
      const appear = kk <= 0 ? 0 : easeOutBack(kk, 1.4);
      const d = pointer.on ? tile.base.distanceTo(pointer.world) : 99;
      const near = Math.exp(-(d * d) / (2 * 1.15 * 1.15));
      let wave = 0;
      for (const rp of ripples) {
        const age = now - rp.t;
        const dd = Math.hypot(tile.base.x - rp.x, tile.base.y - rp.y);
        wave += Math.exp(-((dd - age * 7) ** 2) / 0.5) * Math.max(0, 1 - age / 1.6);
      }
      tile.lift += (near * 0.85 + wave * 0.9 - tile.lift) * 0.14;
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

    // letters rise into place
    letters.forEach((mesh, i) => {
      const r = easeOutCubic(clamp01((t - 0.1 - i * 0.07) / 0.7));
      mesh.position.z = (1 - r) * -1800;
      mesh.scale.setScalar(0.85 + 0.15 * r);
      mesh.visible = r > 0;
    });

    // dots fly in and click, one pair after another
    const pulse = Math.max(0, 1 - (now - clickAt) / 0.35);
    dots.forEach((dot) => {
      const { home, from, at } = dot.userData;
      const fly = clamp01((t - at) / 0.6);
      const f = easeOutBack(fly, 2.1);
      dot.position.set(from.x + (home.x - from.x) * f, from.y + (home.y - from.y) * f, from.z * (1 - fly) + Math.sin(now * 1.6 + home.y) * 24);
      dot.rotation.set(0, (1 - f) * 2.4, (1 - f) * 3);
      dot.scale.setScalar(1 - pulse * 0.16);
      if (!dot.userData.landed && fly >= 1) {
        dot.userData.landed = true;
        logoToGroup.copy(home).applyMatrix4(logo.matrix);
        ripples.push({ x: logoToGroup.x, y: logoToGroup.y, t: now });
        clickAt = now;
      }
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
    tileGeo.dispose();
    [...letters, ...dots].forEach((mesh) => mesh.geometry.dispose());
    [tileMat, limeMat, whiteMat].forEach((mat) => mat.dispose());
  };
}
