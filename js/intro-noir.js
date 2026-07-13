const INTRO_DURATION = 26;

export function createNoirIntro({ onComplete }) {
  const introEl = document.getElementById('intro-noir');
  const canvas = document.getElementById('noir-canvas');
  const ctx = canvas.getContext('2d');
  const skipBtn = document.getElementById('noir-skip');
  const soundBtn = document.getElementById('noir-sound');
  const recTime = introEl.querySelector('.noir-rec-time');
  const countdownFill = introEl.querySelector('.countdown-fill');
  const flashEl = introEl.querySelector('.noir-flash');

  let w = 0;
  let h = 0;
  let elapsed = 0;
  let playing = false;
  let rafId = null;
  let lastTime = 0;
  let audioCtx = null;
  let audioStarted = false;
  const phases = [];

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function addPhase(time, fn) { phases.push({ time, fn, fired: false }); }

  addPhase(0, () => introEl.classList.add('phase-static'));
  addPhase(2.5, () => introEl.classList.remove('phase-static'));
  addPhase(3, () => introEl.classList.add('phase-liquid'));
  addPhase(6, () => introEl.classList.add('phase-line1'));
  addPhase(10, () => introEl.classList.add('phase-splits'));
  addPhase(13, () => introEl.classList.add('phase-line2'));
  addPhase(16, () => introEl.classList.add('phase-burn'));
  addPhase(19, () => introEl.classList.add('phase-name'));
  addPhase(23.5, () => introEl.classList.add('phase-exit'));
  addPhase(24.5, () => introEl.classList.add('phase-flash'));
  addPhase(25.5, () => finish());

  function drawLiquid(t, progress) {
    ctx.fillStyle = '#060204';
    ctx.fillRect(0, 0, w, h);

    const layers = [
      { color: 'rgba(120, 8, 24, 0.55)', speed: 0.6, amp: 90, freq: 0.006 },
      { color: 'rgba(180, 24, 48, 0.35)', speed: 0.9, amp: 70, freq: 0.009 },
      { color: 'rgba(220, 60, 80, 0.2)', speed: 1.2, amp: 50, freq: 0.012 },
      { color: 'rgba(240, 200, 180, 0.08)', speed: 0.4, amp: 110, freq: 0.004 },
    ];

    const intensity = Math.min(progress / 0.35, 1);

    layers.forEach((layer, i) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const wave = Math.sin(x * layer.freq + t * layer.speed + i) * layer.amp * intensity;
        const wave2 = Math.sin(x * layer.freq * 2.3 - t * 0.7) * layer.amp * 0.4 * intensity;
        const y = h * (0.45 + i * 0.06) + wave + wave2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    });

    if (progress > 0.65) {
      const nameGlow = (progress - 0.65) / 0.35;
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
      grad.addColorStop(0, `rgba(255, 220, 200, ${nameGlow * 0.15})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    if (progress > 0.85) {
      const fade = (progress - 0.85) / 0.15;
      ctx.fillStyle = `rgba(6, 2, 4, ${fade * 0.9})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 24);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }

  function tick(now) {
    if (!playing) return;
    elapsed += (now - lastTime) / 1000;
    lastTime = now;

    for (const phase of phases) {
      if (!phase.fired && elapsed >= phase.time) {
        phase.fired = true;
        phase.fn();
      }
    }

    if (recTime) recTime.textContent = formatTime(elapsed);
    drawLiquid(elapsed, elapsed / INTRO_DURATION);
    if (playing) rafId = requestAnimationFrame(tick);
  }

  function initAudio() {
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = audioCtx.createGain();
    master.gain.value = 0.4;
    master.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    const drone = audioCtx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 42;
    const droneGain = audioCtx.createGain();
    droneGain.gain.value = 0;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(0.08, now + 4);

    const heartbeat = audioCtx.createOscillator();
    heartbeat.type = 'sine';
    heartbeat.frequency.value = 60;
    const hbGain = audioCtx.createGain();
    hbGain.gain.value = 0;
    heartbeat.connect(hbGain);
    hbGain.connect(master);
    heartbeat.start();

    [6, 10, 14, 18].forEach((t) => {
      hbGain.gain.setValueAtTime(0, now + t);
      hbGain.gain.linearRampToValueAtTime(0.5, now + t + 0.05);
      hbGain.gain.exponentialRampToValueAtTime(0.01, now + t + 0.3);
    });

    const sub = audioCtx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 35;
    const subGain = audioCtx.createGain();
    subGain.gain.value = 0;
    sub.connect(subGain);
    subGain.connect(master);
    sub.start();
    subGain.gain.setValueAtTime(0, now + 18.5);
    subGain.gain.linearRampToValueAtTime(0.9, now + 19);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 21);

    master.gain.setValueAtTime(0.4, now + 23);
    master.gain.linearRampToValueAtTime(0, now + 26);
    audioStarted = true;
    soundBtn?.classList.add('active');
  }

  function resetPhases() {
    introEl.classList.remove(
      'phase-static', 'phase-liquid', 'phase-line1', 'phase-splits',
      'phase-line2', 'phase-burn', 'phase-name', 'phase-exit', 'phase-flash'
    );
    phases.forEach((p) => { p.fired = false; });
    introEl.querySelectorAll('.noir-line, .noir-name').forEach((el) => {
      el.style.cssText = '';
    });
    flashEl.style.animation = 'none';
    flashEl.offsetHeight;
    flashEl.style.animation = '';
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
    }, 1000);
  }

  function start({ withAudio = false } = {}) {
    playing = true;
    elapsed = 0;
    lastTime = performance.now();
    resize();
    resetPhases();
    introEl.style.display = '';
    introEl.style.opacity = '1';
    introEl.style.transform = 'none';
    introEl.classList.add('playing');
    introEl.classList.remove('exiting');
    countdownFill.style.animation = 'none';
    countdownFill.offsetHeight;
    countdownFill.style.animation = '';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    if (withAudio) initAudio();
  }

  skipBtn?.addEventListener('click', finish);
  soundBtn?.addEventListener('click', () => {
    if (!audioStarted) initAudio();
    else if (audioCtx?.state === 'suspended') audioCtx.resume();
  });

  resize();
  return { start, finish, onResize: resize, isSoundEnabled: () => audioStarted };
}
