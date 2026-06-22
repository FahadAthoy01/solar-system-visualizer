/* ==========================================================================
   SOLAR SYSTEM VISUALIZER — MAIN ENGINE
   Built with Three.js (ES modules via CDN import map, see index.html).

   Structure:
     1. Imports & constants
     2. Planet data model (including moons)
     3. Scene / camera / renderer setup
     4. Lighting
     5. Sun construction
     6. Planet + orbit + moon construction
     7. Starfield construction
     8. Camera controls (OrbitControls) + zoom safety clamps
     9. State
    10. UI wiring (control panel, focus bar, info panel)
    11. Raycasting / click-to-select
    12. Animation loop
    13. Resize handling
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ==========================================================================
   1. CONSTANTS
   ========================================================================== */

// Scene-unit scale. Real astronomical distances/sizes are compressed
// non-linearly so the whole system is navigable and every planet stays
// visible and clickable, while preserving *relative* ordering and a
// recognizable size hierarchy (gas giants clearly dwarf rocky planets).
const AU = 18; // 1 astronomical unit -> scene units, baseline spacing

/* ==========================================================================
   2. PLANET DATA MODEL
   Each entry carries real-ish relative values (used for the info panel)
   plus scene-tuned radius / orbitRadius / orbitSpeed used for rendering.
   "moons" is an array of { name, radius, distance, speed, color } where
   distance/radius are in the same scene units as the parent planet (i.e.
   distance is measured from the planet's center, not the Sun's).
   ========================================================================== */

const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    color: 0x9c9690,
    radius: 0.55,
    orbitRadius: AU * 0.7,
    orbitSpeed: 4.15,
    rotationSpeed: 0.017,
    tilt: 0.001,
    moons: [],
    facts: {
      'Type': 'Terrestrial',
      'Diameter': '4,879 km',
      'Orbital period': '88 days',
      'Day length': '59 Earth days',
      'Moons': '0',
      'Distance from Sun': '57.9M km',
    },
  },
  {
    key: 'venus',
    name: 'Venus',
    color: 0xe0c08a,
    radius: 0.95,
    orbitRadius: AU * 1.0,
    orbitSpeed: 1.62,
    rotationSpeed: -0.004,
    tilt: 3.1,
    moons: [],
    facts: {
      'Type': 'Terrestrial',
      'Diameter': '12,104 km',
      'Orbital period': '225 days',
      'Day length': '243 Earth days',
      'Moons': '0',
      'Distance from Sun': '108.2M km',
    },
  },
  {
    key: 'earth',
    name: 'Earth',
    color: 0x4d8fdb,
    radius: 1.0,
    orbitRadius: AU * 1.4,
    orbitSpeed: 1.0,
    rotationSpeed: 2.0,
    tilt: 23.4,
    moons: [
      { name: 'Moon', radius: 0.27, distance: 1.7, speed: 2.6, color: 0xc9c5bc },
    ],
    facts: {
      'Type': 'Terrestrial',
      'Diameter': '12,742 km',
      'Orbital period': '365.25 days',
      'Day length': '24 hours',
      'Moons': '1',
      'Distance from Sun': '149.6M km',
    },
  },
  {
    key: 'mars',
    name: 'Mars',
    color: 0xc1583a,
    radius: 0.65,
    orbitRadius: AU * 1.9,
    orbitSpeed: 0.53,
    rotationSpeed: 1.95,
    tilt: 25.2,
    moons: [
      { name: 'Phobos', radius: 0.09, distance: 1.1, speed: 4.4, color: 0x8a7d6e },
      { name: 'Deimos', radius: 0.07, distance: 1.45, speed: 2.9, color: 0x9c8f80 },
    ],
    facts: {
      'Type': 'Terrestrial',
      'Diameter': '6,779 km',
      'Orbital period': '687 days',
      'Day length': '24.6 hours',
      'Moons': '2',
      'Distance from Sun': '227.9M km',
    },
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    color: 0xd3a374,
    radius: 2.6,
    orbitRadius: AU * 3.0,
    orbitSpeed: 0.084,
    rotationSpeed: 4.8,
    tilt: 3.1,
    moons: [
      { name: 'Io', radius: 0.22, distance: 3.4, speed: 3.1, color: 0xe2c879 },
      { name: 'Europa', radius: 0.19, distance: 3.9, speed: 2.5, color: 0xcfc9b8 },
      { name: 'Ganymede', radius: 0.3, distance: 4.5, speed: 1.9, color: 0x9a8f7e },
      { name: 'Callisto', radius: 0.28, distance: 5.2, speed: 1.4, color: 0x756c60 },
    ],
    facts: {
      'Type': 'Gas Giant',
      'Diameter': '139,820 km',
      'Orbital period': '11.9 years',
      'Day length': '9.9 hours',
      'Moons': '95',
      'Distance from Sun': '778.5M km',
    },
  },
  {
    key: 'saturn',
    name: 'Saturn',
    color: 0xe3c896,
    radius: 2.2,
    orbitRadius: AU * 4.0,
    orbitSpeed: 0.034,
    rotationSpeed: 4.5,
    tilt: 26.7,
    hasRing: true,
    moons: [
      { name: 'Titan', radius: 0.28, distance: 4.1, speed: 1.7, color: 0xd9b873 },
      { name: 'Rhea', radius: 0.14, distance: 3.3, speed: 2.2, color: 0xbdb6aa },
      { name: 'Iapetus', radius: 0.13, distance: 4.8, speed: 1.1, color: 0x8f8a82 },
      { name: 'Dione', radius: 0.11, distance: 2.9, speed: 2.6, color: 0xc7c2b8 },
    ],
    facts: {
      'Type': 'Gas Giant',
      'Diameter': '116,460 km',
      'Orbital period': '29.4 years',
      'Day length': '10.7 hours',
      'Moons': '146',
      'Distance from Sun': '1.43B km',
    },
  },
  {
    key: 'uranus',
    name: 'Uranus',
    color: 0x9fd6e0,
    radius: 1.5,
    orbitRadius: AU * 5.0,
    orbitSpeed: 0.012,
    rotationSpeed: 3.0,
    tilt: 97.8,
    hasRing: true,
    ringSubtle: true,
    moons: [
      { name: 'Titania', radius: 0.16, distance: 2.6, speed: 1.9, color: 0xa9b0b8 },
      { name: 'Oberon', radius: 0.15, distance: 3.2, speed: 1.5, color: 0x999fa6 },
      { name: 'Umbriel', radius: 0.12, distance: 2.1, speed: 2.4, color: 0x82878d },
      { name: 'Ariel', radius: 0.13, distance: 1.7, speed: 2.9, color: 0xbcc2c8 },
    ],
    facts: {
      'Type': 'Ice Giant',
      'Diameter': '50,724 km',
      'Orbital period': '84 years',
      'Day length': '17.2 hours',
      'Moons': '28',
      'Distance from Sun': '2.87B km',
    },
  },
  {
    key: 'neptune',
    name: 'Neptune',
    color: 0x4f6fd0,
    radius: 1.45,
    orbitRadius: AU * 6.0,
    orbitSpeed: 0.006,
    rotationSpeed: 3.2,
    tilt: 28.3,
    moons: [
      { name: 'Triton', radius: 0.24, distance: 2.6, speed: 1.8, color: 0xcdd6dd },
      { name: 'Proteus', radius: 0.1, distance: 1.9, speed: 2.6, color: 0x8b8f93 },
    ],
    facts: {
      'Type': 'Ice Giant',
      'Diameter': '49,244 km',
      'Orbital period': '164.8 years',
      'Day length': '16.1 hours',
      'Moons': '16',
      'Distance from Sun': '4.5B km',
    },
  },
];

const SUN_FACTS = {
  'Type': 'G-type star',
  'Diameter': '1,392,700 km',
  'Surface temp': '5,505 °C',
  'Age': '~4.6 billion years',
  'Mass (% of system)': '99.86%',
};

/* ==========================================================================
   3. SCENE / CAMERA / RENDERER
   ========================================================================== */

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.05,
  20000
);
camera.position.set(0, 38, 95);

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

/* ==========================================================================
   4. LIGHTING
   ========================================================================== */

const ambientLight = new THREE.AmbientLight(0x404868, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xfff1d6, 4.2, 0, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0x2a3a5c, 0x0a0806, 0.18);
scene.add(hemiLight);

/* ==========================================================================
   5. SUN
   ========================================================================== */

const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunGeometry = new THREE.SphereGeometry(5.2, 64, 64);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27a });
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.name = 'sun';
sunGroup.add(sunMesh);

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 230, 170, 0.9)');
  gradient.addColorStop(0.35, 'rgba(255, 190, 100, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const glowTexture = makeGlowTexture();
const glowMaterial = new THREE.SpriteMaterial({
  map: glowTexture,
  color: 0xffffff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const sunGlow = new THREE.Sprite(glowMaterial);
sunGlow.scale.set(26, 26, 1);
sunGroup.add(sunGlow);

/* ==========================================================================
   6. PLANETS + ORBITS + MOONS
   ========================================================================== */

const planetObjects = [];
const orbitLines = [];
const moonOrbitLines = [];
const moonMeshes = [];
const clickableMeshes = [];

function createOrbitPath(radius) {
  const segments = 256;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x44516e, transparent: true, opacity: 0.55 });
  return new THREE.LineLoop(geometry, material);
}

function createMoonOrbitPath(radius) {
  const segments = 64;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x6e7794, transparent: true, opacity: 0.35 });
  return new THREE.LineLoop(geometry, material);
}

function createLabelSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 48;
  ctx.font = `500 ${fontSize}px Inter, sans-serif`;
  const padding = 24;
  const textWidth = ctx.measureText(text).width;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 1.4;

  ctx.font = `500 ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = 'rgba(238, 240, 245, 0.92)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  const baseHeight = 1.8;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function createRing(planetRadius, subtle) {
  const inner = planetRadius * 1.4;
  const outer = planetRadius * 2.3;
  const geometry = new THREE.RingGeometry(inner, outer, 64, 1);

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const d = (v3.length() - inner) / (outer - inner);
    uv.setXY(i, d, 1);
  }

  const ringTexture = makeRingTexture(subtle);
  const material = new THREE.MeshBasicMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: subtle ? 0.55 : 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2 - 0.45;
  return mesh;
}

function makeRingTexture(subtle) {
  const width = 512;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  if (subtle) {
    gradient.addColorStop(0.00, 'rgba(159, 214, 224, 0)');
    gradient.addColorStop(0.18, 'rgba(159, 214, 224, 0.45)');
    gradient.addColorStop(0.35, 'rgba(190, 230, 235, 0.2)');
    gradient.addColorStop(0.50, 'rgba(159, 214, 224, 0.5)');
    gradient.addColorStop(0.68, 'rgba(190, 230, 235, 0.18)');
    gradient.addColorStop(0.85, 'rgba(159, 214, 224, 0.4)');
    gradient.addColorStop(1.00, 'rgba(159, 214, 224, 0)');
  } else {
    gradient.addColorStop(0.00, 'rgba(228, 206, 165, 0)');
    gradient.addColorStop(0.10, 'rgba(232, 211, 171, 0.95)');
    gradient.addColorStop(0.22, 'rgba(201, 178, 138, 0.55)');
    gradient.addColorStop(0.30, 'rgba(238, 218, 178, 0.92)');
    gradient.addColorStop(0.40, 'rgba(170, 148, 112, 0.35)');
    gradient.addColorStop(0.50, 'rgba(238, 218, 178, 0.97)');
    gradient.addColorStop(0.62, 'rgba(214, 190, 148, 0.6)');
    gradient.addColorStop(0.74, 'rgba(232, 211, 171, 0.9)');
    gradient.addColorStop(0.85, 'rgba(190, 168, 130, 0.45)');
    gradient.addColorStop(1.00, 'rgba(228, 206, 165, 0)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

PLANETS.forEach((data) => {
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.random() * Math.PI * 2;
  scene.add(pivot);

  const geometry = new THREE.SphereGeometry(data.radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    color: data.color,
    roughness: 0.85,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = data.orbitRadius;
  mesh.rotation.z = THREE.MathUtils.degToRad(data.tilt);
  mesh.name = data.key;
  mesh.userData.planetKey = data.key;
  pivot.add(mesh);
  clickableMeshes.push(mesh);

  material.emissive = new THREE.Color(data.color);
  material.emissiveIntensity = 0.04;

  let ringMesh = null;
  if (data.hasRing) {
    ringMesh = createRing(data.radius, !!data.ringSubtle);
    ringMesh.position.x = data.orbitRadius;
    pivot.add(ringMesh);
  }

  const orbit = createOrbitPath(data.orbitRadius);
  scene.add(orbit);
  orbitLines.push(orbit);

  const label = createLabelSprite(data.name);
  label.position.set(data.orbitRadius, data.radius + 1.4, 0);
  pivot.add(label);

  // --- Moons ---
  // Each moon's pivot is parented to the *planet mesh* (not the outer
  // "pivot" group), so it automatically inherits the planet's position
  // as it orbits the Sun, then spins independently around the planet.
  const moonObjects = [];
  (data.moons || []).forEach((moonData) => {
    const moonPivot = new THREE.Group();
    moonPivot.rotation.y = Math.random() * Math.PI * 2;
    mesh.add(moonPivot);

    const moonGeometry = new THREE.SphereGeometry(moonData.radius, 20, 20);
    const moonMaterial = new THREE.MeshStandardMaterial({
      color: moonData.color,
      roughness: 0.95,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.position.x = moonData.distance;
    moonPivot.add(moonMesh);
    moonMeshes.push(moonMesh);

    const moonOrbit = createMoonOrbitPath(moonData.distance);
    moonOrbit.rotation.x = Math.PI / 2;
    mesh.add(moonOrbit);
    moonOrbitLines.push(moonOrbit);

    moonObjects.push({ ...moonData, pivot: moonPivot, mesh: moonMesh });
  });

  planetObjects.push({
    ...data,
    pivot,
    mesh,
    ringMesh,
    label,
    moonObjects,
    angle: pivot.rotation.y,
  });
});

/* ==========================================================================
   7. STARFIELD
   ========================================================================== */

const STARFIELD_RADIUS_MIN = 600;
const STARFIELD_RADIUS_MAX = 3000;

function randomPointOnSphereShell(rMin, rMax) {
  const u = Math.random();
  const r = Math.cbrt(u * (rMax ** 3 - rMin ** 3) + rMin ** 3);
  const theta = Math.acos(2 * Math.random() - 1);
  const phi = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.cos(theta),
    r * Math.sin(theta) * Math.sin(phi)
  );
}

function buildStarLayer({ count, sizeMin, sizeMax, colorPalette, opacity }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const p = randomPointOnSphereShell(STARFIELD_RADIUS_MIN, STARFIELD_RADIUS_MAX);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const hex = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    color.set(hex);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = THREE.MathUtils.lerp(sizeMin, sizeMax, Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 1,
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

const starGroup = new THREE.Group();

const distantStars = buildStarLayer({
  count: 9000,
  sizeMin: 0.6,
  sizeMax: 1.2,
  colorPalette: [0xffffff, 0xcfd8ff, 0xffe9c7, 0xdce8ff],
  opacity: 0.75,
});
distantStars.material.size = 1.15;
starGroup.add(distantStars);

const majorStars = buildStarLayer({
  count: 220,
  sizeMin: 2.2,
  sizeMax: 3.4,
  colorPalette: [0xffffff, 0xfff3da, 0xbcd8ff, 0xffd9c2],
  opacity: 1.0,
});
majorStars.material.size = 3.0;
starGroup.add(majorStars);

scene.add(starGroup);

/* ==========================================================================
   8. CAMERA CONTROLS
   ========================================================================== */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = 7;
controls.maxDistance = 1800;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.55;
controls.maxPolarAngle = Math.PI - 0.05;
controls.minPolarAngle = 0.05;
controls.target.set(0, 0, 0);
controls.update();

const DEFAULT_CAMERA_POSITION = camera.position.clone();
const DEFAULT_TARGET = controls.target.clone();

/* ==========================================================================
   9. STATE
   ========================================================================== */

const state = {
  showMoons: true,
  showOrbits: true,
  showLabels: true,
  speedMultiplier: 1,
  playing: true,
  selectedKey: null,
  flyTarget: null,
  flyStartTime: 0,
  flyDuration: 900,
  flyFromPos: new THREE.Vector3(),
  flyFromTarget: new THREE.Vector3(),
};

/* ==========================================================================
   10. UI WIRING
   ========================================================================== */

const starsToggle = document.getElementById('stars-toggle'); // now controls moons, see below
const orbitsToggle = document.getElementById('orbits-toggle');
const labelsToggle = document.getElementById('labels-toggle');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetBtn = document.getElementById('reset-view');
const pausePlayBtn = document.getElementById('pause-play');
const pauseIcon = document.getElementById('pause-icon');
const playIcon = document.getElementById('play-icon');
const focusBar = document.getElementById('focus-bar');
const infoPanel = document.getElementById('info-panel');
const infoToggle = document.getElementById('info-toggle');
const infoClose = document.getElementById('info-close');
const infoName = document.getElementById('info-name');
const infoType = document.getElementById('info-type');
const infoStats = document.getElementById('info-stats');
const hintBar = document.getElementById('hint-bar');

// --- Moons toggle ---
// This listens on the control labeled "Show Stars" in the HTML/CSS
// (id="stars-toggle"); it has been repurposed to control moon visibility
// instead, per request. Moons and their orbit rings already exist in the
// scene graph at all times — this just flips their .visible flag, so the
// toggle is instant with no rebuild.
starsToggle.addEventListener('change', (e) => {
  state.showMoons = e.target.checked;
  moonMeshes.forEach((m) => { m.visible = state.showMoons; });
  moonOrbitLines.forEach((line) => { line.visible = state.showMoons; });
});

// --- Orbits toggle (planet orbits around the Sun) ---
orbitsToggle.addEventListener('change', (e) => {
  state.showOrbits = e.target.checked;
  orbitLines.forEach((line) => { line.visible = state.showOrbits; });
});

// --- Labels toggle ---
labelsToggle.addEventListener('change', (e) => {
  state.showLabels = e.target.checked;
  planetObjects.forEach((p) => { p.label.visible = state.showLabels; });
});

// --- Speed slider ---
speedSlider.addEventListener('input', (e) => {
  state.speedMultiplier = parseFloat(e.target.value);
  speedValue.textContent = `${state.speedMultiplier.toFixed(1)}\u00D7`;
});

// --- Zoom buttons ---
function dolly(factor) {
  const distance = camera.position.distanceTo(controls.target);
  const newDistance = THREE.MathUtils.clamp(distance * factor, controls.minDistance, controls.maxDistance);
  const newPos = camera.position.clone()
    .sub(controls.target)
    .normalize()
    .multiplyScalar(newDistance)
    .add(controls.target);
  camera.position.copy(newPos);
  controls.update();
}

zoomInBtn.addEventListener('click', () => dolly(0.78));
zoomOutBtn.addEventListener('click', () => dolly(1.28));

// --- Reset view ---
resetBtn.addEventListener('click', () => {
  beginCameraFlight(DEFAULT_CAMERA_POSITION, DEFAULT_TARGET);
  setActiveChip(null);
  closeInfoPanel();
});

// --- Pause / play ---
pausePlayBtn.addEventListener('click', () => {
  state.playing = !state.playing;
  pauseIcon.style.display = state.playing ? 'block' : 'none';
  playIcon.style.display = state.playing ? 'none' : 'block';
  pausePlayBtn.title = state.playing ? 'Pause' : 'Play';
});

// --- Info panel open/close ---
function openInfoPanel() {
  infoPanel.classList.remove('hidden');
}
function closeInfoPanel() {
  infoPanel.classList.add('hidden');
}
infoToggle.addEventListener('click', () => {
  if (infoPanel.classList.contains('hidden')) {
    if (!state.selectedKey) populateInfoPanel('sun');
    openInfoPanel();
  } else {
    closeInfoPanel();
  }
});
infoClose.addEventListener('click', closeInfoPanel);

function populateInfoPanel(key) {
  state.selectedKey = key;
  let name, type, facts;
  if (key === 'sun') {
    name = 'Sun';
    type = 'Star';
    facts = SUN_FACTS;
  } else {
    const p = PLANETS.find((pl) => pl.key === key);
    name = p.name;
    type = p.facts['Type'];
    facts = p.facts;
  }
  infoName.textContent = name;
  infoType.textContent = type;
  infoStats.innerHTML = '';
  Object.entries(facts).forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    infoStats.appendChild(dt);
    infoStats.appendChild(dd);
  });
}

// --- Focus bar (planet quick-select) ---
function setActiveChip(key) {
  [...focusBar.children].forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.target === key);
  });
}

function focusOnTarget(key) {
  setActiveChip(key);
  populateInfoPanel(key);
  openInfoPanel();
  fadeHint();

  if (key === 'sun') {
    const dist = 60;
    beginCameraFlight(new THREE.Vector3(0, dist * 0.35, dist), new THREE.Vector3(0, 0, 0));
    return;
  }

  const planet = planetObjects.find((p) => p.key === key);
  if (!planet) return;

  const worldPos = new THREE.Vector3();
  planet.mesh.getWorldPosition(worldPos);

  const viewDistance = Math.max(planet.radius * 9, 6);
  const camOffset = new THREE.Vector3(viewDistance * 0.6, viewDistance * 0.45, viewDistance * 0.8);
  const desiredPos = worldPos.clone().add(camOffset);

  beginCameraFlight(desiredPos, worldPos);
}

focusBar.addEventListener('click', (e) => {
  const chip = e.target.closest('.focus-chip');
  if (!chip) return;
  focusOnTarget(chip.dataset.target);
});

/* ==========================================================================
   11. RAYCASTING / CLICK-TO-SELECT
   ========================================================================== */

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

function getPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
    clientX,
    clientY,
  };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 6) return;

  const p = getPointerFromEvent(e);
  pointerNDC.set(p.x, p.y);
  raycaster.setFromCamera(pointerNDC, camera);

  const targets = [sunMesh, ...clickableMeshes];
  const intersects = raycaster.intersectObjects(targets, false);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const key = hit.name === 'sun' ? 'sun' : hit.userData.planetKey;
    focusOnTarget(key);
  }

  fadeHint();
});

function fadeHint() {
  hintBar.classList.add('faded');
}
renderer.domElement.addEventListener('pointerdown', fadeHint, { once: true });
controls.addEventListener('start', fadeHint);

/* ==========================================================================
   CAMERA FLIGHT
   ========================================================================== */

function beginCameraFlight(targetPos, targetLookAt) {
  state.flyFromPos.copy(camera.position);
  state.flyFromTarget.copy(controls.target);
  state.flyTarget = { position: targetPos.clone(), lookAt: targetLookAt.clone() };
  state.flyStartTime = performance.now();
  controls.enabled = false;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateCameraFlight() {
  if (!state.flyTarget) return;
  const elapsed = performance.now() - state.flyStartTime;
  const t = Math.min(elapsed / state.flyDuration, 1);
  const eased = easeInOutCubic(t);

  camera.position.lerpVectors(state.flyFromPos, state.flyTarget.position, eased);
  controls.target.lerpVectors(state.flyFromTarget, state.flyTarget.lookAt, eased);
  controls.update();

  if (t >= 1) {
    state.flyTarget = null;
    controls.enabled = true;
  }
}

/* ==========================================================================
   12. ANIMATION LOOP
   ========================================================================== */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (state.playing && !state.flyTarget) {
    const dt = delta * state.speedMultiplier;
    planetObjects.forEach((p) => {
      p.pivot.rotation.y += dt * p.orbitSpeed * 0.35;
      p.mesh.rotation.y += dt * p.rotationSpeed;
      // Each moon's pivot is parented to the planet mesh, so it already
      // inherits the planet's position as it orbits the Sun. Driving the
      // moon pivot's own rotation here makes it orbit the planet too.
      p.moonObjects.forEach((m) => {
        m.pivot.rotation.y += dt * m.speed;
      });
    });
    sunMesh.rotation.y += delta * 0.02;
  }

  updateCameraFlight();
  controls.update();

  // Scale labels to a constant angular size on screen, derived from the
  // camera's vertical FOV, so they stay legible at any zoom level.
  const labelWorldPos = new THREE.Vector3();
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  planetObjects.forEach((p) => {
    p.label.getWorldPosition(labelWorldPos);
    const distToCam = camera.position.distanceTo(labelWorldPos);
    const targetHeight = 2 * distToCam * Math.tan(vFovRad / 2) * 0.045;
    const baseHeight = THREE.MathUtils.clamp(targetHeight, 0.5, 3.2);
    p.label.scale.set(baseHeight * (p.label.userData.aspect || 3.2), baseHeight, 1);
  });

  renderer.render(scene, camera);
}

planetObjects.forEach((p) => {
  p.label.userData.aspect = p.label.scale.x / p.label.scale.y;
});

/* ==========================================================================
   13. RESIZE HANDLING
   ========================================================================== */

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

/* ==========================================================================
   STARTUP
   ========================================================================== */

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.classList.add('hidden');
}

requestAnimationFrame(() => {
  renderer.render(scene, camera);
  setTimeout(hideLoadingScreen, 350);
});

animate();
