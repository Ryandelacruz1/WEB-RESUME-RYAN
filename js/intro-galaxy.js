import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const INTRO_DURATION = 22;

export function createGalaxyIntro({ onComplete }) {
  const introEl = document.getElementById('intro-galaxy');
  const canvas = document.getElementById('galaxy-canvas');
  const skipBtn = document.getElementById('galaxy-skip');
  const soundBtn = document.getElementById('galaxy-sound');
  const countdownFill = introEl.querySelector('.countdown-fill');
  const titleChars = introEl.querySelectorAll('.title-char');
  const introTagline = introEl.querySelector('.intro-tagline');
  const introSub = introEl.querySelector('.intro-sub');
  const flashEl = introEl.querySelector('.flash');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000008, 0.015);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 120);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.8, 0.5, 0.2
  );
  composer.addPass(bloomPass);

  const PARTICLE_COUNT = 80000;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const originalPositions = new Float32Array(PARTICLE_COUNT * 3);
  const angles = new Float32Array(PARTICLE_COUNT);
  const radii = new Float32Array(PARTICLE_COUNT);

  const colorGold = new THREE.Color(0xc9a962);
  const colorPurple = new THREE.Color(0x6b5ce7);
  const colorWhite = new THREE.Color(0xf0ece4);
  const colorBlue = new THREE.Color(0x4488ff);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const arm = i % 3;
    const t = Math.random();
    const radius = 15 + t * 180 + Math.random() * 20;
    const spin = radius * 0.015 + arm * (Math.PI * 2 / 3);
    const spread = (Math.random() - 0.5) * 12 * (1 - t * 0.5);
    const x = Math.cos(spin) * radius + spread;
    const y = (Math.random() - 0.5) * 8 * (1 - t * 0.7);
    const z = Math.sin(spin) * radius + spread * 0.5;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;
    angles[i] = spin;
    radii[i] = radius;
    const mix = Math.random();
    let c;
    if (mix < 0.3) c = colorGold;
    else if (mix < 0.5) c = colorPurple;
    else if (mix < 0.7) c = colorBlue;
    else c = colorWhite;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = Math.random() * 2.5 + 0.5;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uGlobalOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uGlobalOpacity;
      void main() {
        vColor = color;
        vec3 pos = position;
        float pulse = sin(uTime * 2.0 + pos.x * 0.05) * 0.5 + 0.5;
        pos.y += pulse * 0.3;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = uGlobalOpacity * (0.4 + pulse * 0.6);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = pow(1.0 - smoothstep(0.0, 0.5, d), 1.5);
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  scene.add(new THREE.Points(particleGeo, particleMat));

  const singularityMat = new THREE.MeshBasicMaterial({ color: 0xf0d78c, transparent: true, opacity: 0 });
  const singularity = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 32), singularityMat);
  const singularityGlow = new THREE.PointLight(0xc9a962, 0, 200);
  singularity.add(singularityGlow);
  scene.add(singularity);
  scene.add(new THREE.AmbientLight(0x111122, 0.5));

  let audioCtx = null;
  let audioStarted = false;
  let elapsed = 0;
  let playing = false;
  let rafId = null;
  let lastTime = 0;
  const phases = [];

  function addPhase(time, fn) { phases.push({ time, fn, fired: false }); }

  addPhase(0.5, () => animateValue(particleMat.uniforms.uGlobalOpacity, 'value', 0, 1, 4));
  addPhase(2, () => introEl.classList.add('phase-wide'));
  addPhase(4, () => {
    introEl.classList.add('phase-burst');
    bloomPass.strength = 3.5;
    animateValue(singularityMat, 'opacity', 0, 1, 1.5);
    animateValue(singularityGlow, 'intensity', 0, 8, 1.5);
    setTimeout(() => introEl.classList.remove('phase-burst'), 800);
  });
  addPhase(7, () => introEl.classList.add('phase-title'));
  addPhase(10, () => introEl.classList.add('phase-sub'));
  addPhase(13, () => { introEl.classList.add('phase-warp'); bloomPass.strength = 2.5; });
  addPhase(18, () => introEl.classList.add('phase-flash'));
  addPhase(19.5, () => finish());

  function animateValue(obj, prop, from, to, duration) {
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / (duration * 1000), 1);
      obj[prop] = from + (to - from) * (1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateScene(t) {
    const progress = t / INTRO_DURATION;
    if (progress < 0.3) {
      const p = progress / 0.3;
      const ease = p * p * (3 - 2 * p);
      camera.position.z = 120 - ease * 40;
      camera.position.y = ease * 5;
    } else if (progress < 0.55) {
      const p = (progress - 0.3) / 0.25;
      camera.position.z = 80 - p * 50;
      camera.position.x = Math.sin(p * Math.PI) * 15;
      camera.rotation.z = p * 0.05;
    } else if (progress < 0.75) {
      const p = (progress - 0.55) / 0.2;
      camera.position.z = 30 - p * 20;
      camera.fov = 60 + p * 40;
      camera.updateProjectionMatrix();
    } else {
      const p = (progress - 0.75) / 0.25;
      const warp = p * p;
      camera.position.z = 10 - warp * 200;
      camera.fov = 100 + warp * 60;
      camera.updateProjectionMatrix();
      bloomPass.strength = 2.5 + warp * 4;
    }
    camera.lookAt(0, 0, 0);

    const posArr = particleGeo.attributes.position.array;
    const rotSpeed = 0.0003 + progress * 0.003;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = angles[i] + t * rotSpeed * (120 / radii[i]);
      const r = radii[i];
      if (progress > 0.75) {
        const warp = (progress - 0.75) / 0.25;
        posArr[i * 3] = Math.cos(angle) * r * (1 - warp * 0.8);
        posArr[i * 3 + 1] = originalPositions[i * 3 + 1] * (1 - warp);
        posArr[i * 3 + 2] = Math.sin(angle) * r * (1 + warp * 8);
      } else {
        posArr[i * 3] = Math.cos(angle) * r;
        posArr[i * 3 + 2] = Math.sin(angle) * r;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
    if (progress > 0.18 && progress < 0.5) {
      singularity.scale.setScalar(1 + (Math.sin(t * 4) * 0.5 + 0.5) * 0.5);
    }
    particleMat.uniforms.uTime.value = t;
  }

  function tick(now) {
    if (!playing) return;
    elapsed += (now - lastTime) / 1000;
    lastTime = now;
    for (const phase of phases) {
      if (!phase.fired && elapsed >= phase.time) { phase.fired = true; phase.fn(); }
    }
    updateScene(elapsed);
    composer.render();
    if (playing) rafId = requestAnimationFrame(tick);
  }

  function resetOverlayText() {
    introEl.classList.remove('phase-title', 'phase-sub');
    titleChars.forEach((char) => {
      char.style.cssText = '';
    });
    [introTagline, introSub].forEach((el) => { el.style.cssText = ''; });
  }

  function resetParticles() {
    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) posArr[i] = originalPositions[i];
    particleGeo.attributes.position.needsUpdate = true;
    singularity.scale.setScalar(1);
  }

  function initAudio() {
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = audioCtx.createGain();
    master.gain.value = 0.35;
    master.connect(audioCtx.destination);
    const drone = audioCtx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = audioCtx.createGain();
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    const now = audioCtx.currentTime;
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(0.6, now + 3);
    master.gain.setValueAtTime(0.35, now + 18);
    master.gain.linearRampToValueAtTime(0, now + 21);
    audioStarted = true;
    soundBtn?.classList.add('active');
  }

  function finish() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    introEl.classList.remove('playing');
    introEl.classList.add('exiting');
    setTimeout(() => {
      introEl.style.display = 'none';
      onComplete?.();
    }, 1200);
  }

  function start({ withAudio = false } = {}) {
    playing = true;
    elapsed = 0;
    lastTime = performance.now();
    introEl.style.display = '';
    introEl.style.opacity = '1';
    introEl.style.transform = 'none';
    introEl.classList.add('playing');
    introEl.classList.remove('exiting', 'phase-wide', 'phase-burst', 'phase-title', 'phase-sub', 'phase-warp', 'phase-flash');
    resetOverlayText();
    flashEl.style.animation = 'none';
    flashEl.offsetHeight;
    flashEl.style.animation = '';
    phases.forEach((p) => { p.fired = false; });
    camera.position.set(0, 0, 120);
    camera.fov = 60;
    camera.rotation.z = 0;
    camera.updateProjectionMatrix();
    bloomPass.strength = 1.8;
    singularityMat.opacity = 0;
    singularityGlow.intensity = 0;
    particleMat.uniforms.uGlobalOpacity.value = 0;
    resetParticles();
    countdownFill.style.animation = 'none';
    countdownFill.offsetHeight;
    countdownFill.style.animation = '';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    if (withAudio) initAudio();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  skipBtn?.addEventListener('click', finish);
  soundBtn?.addEventListener('click', () => {
    if (!audioStarted) initAudio();
    else if (audioCtx?.state === 'suspended') audioCtx.resume();
  });

  return { start, finish, onResize, isSoundEnabled: () => audioStarted };
}
