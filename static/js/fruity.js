/**
 * Late Night Combat Robotics — Frutiger Aero × 2000s MySpace Atmosphere & Audio Controller
 */

(function () {
  const STICKERS_DATA = [
    { id: 'owl', name: 'Safety Owl', src: '/static/stickers/owl.webp', alt: 'Late Night Combat Robotics Safety Goggles Owl Sticker', side: 'left', top: 130, rot: -5, sound: 'boing', pitch: 0.95 },
    { id: 'hibiscus', name: 'Hawaii Hibiscus', src: '/static/stickers/hibiscus.webp', alt: 'Tropical Hawaii Hibiscus Flower Sticker with Dewdrops', side: 'left', top: 380, rot: 8, sound: 'bubble', pitch: 1.25 },
    { id: 'pipeline', name: 'Banzai Pipeline', src: '/static/stickers/pipeline.webp', alt: 'Banzai Pipeline Surfing Tube Wave Sticker', side: 'left', top: 640, rot: -6, sound: 'wave', pitch: 1.1 },
    { id: 'moon', name: 'Late Night Moon', src: '/static/stickers/moon.webp', alt: 'Smiling Late Night Crescent Moon Glass Sticker', side: 'right', top: 130, rot: 6, sound: 'sparkle', pitch: 1.45 },
    { id: 'palm', name: 'Tropical Island Orb', src: '/static/stickers/palm.webp', alt: 'Hawaiian Island and Palm Tree Glass Bubble Sticker', side: 'right', top: 380, rot: -5, sound: 'bubble', pitch: 0.85 },
    { id: 'owl-surfer', name: 'Pipeline Owl Surfer', src: '/static/stickers/owl-surfer.webp', alt: 'Funny Night Owl Surfing on a Surfboard Sticker', side: 'right', top: 640, rot: 7, sound: 'boing', pitch: 1.35 }
  ];

  const BUBBLES = [
    { size: 36, left: 6, duration: 12, delay: 0, sway: '25px' },
    { size: 22, left: 18, duration: 15, delay: 3, sway: '-20px' },
    { size: 52, left: 32, duration: 18, delay: 1, sway: '35px' },
    { size: 18, left: 45, duration: 14, delay: 6, sway: '-15px' },
    { size: 44, left: 58, duration: 16, delay: 2, sway: '28px' },
    { size: 28, left: 71, duration: 13, delay: 5, sway: '-30px' },
    { size: 60, left: 84, duration: 20, delay: 0.5, sway: '40px' },
    { size: 24, left: 93, duration: 11, delay: 4, sway: '-22px' }
  ];

  let sfxCtx = null;
  function playStickerPop(pitch = 1.0, soundType = 'boing') {
    if (!sfxCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) sfxCtx = new AC();
    }
    if (!sfxCtx) return;
    if (sfxCtx.state === 'suspended') sfxCtx.resume().catch(() => {});

    const now = sfxCtx.currentTime;
    const osc = sfxCtx.createOscillator();
    const gain = sfxCtx.createGain();
    const vol = 0.25;

    if (soundType === 'boing') {
      osc.type = 'sine';
      const f = 260 * pitch;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 2.8, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(f * 1.6, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(f * 2.2, now + 0.22);
      osc.frequency.exponentialRampToValueAtTime(f * 1.8, now + 0.32);
      gain.gain.setValueAtTime(vol * 0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(sfxCtx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (soundType === 'bubble') {
      osc.type = 'triangle';
      const f = 420 * pitch;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 2.4, now + 0.1);
      gain.gain.setValueAtTime(vol * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(sfxCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (soundType === 'sparkle') {
      osc.type = 'sine';
      const f = 880 * pitch;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.08);
      gain.gain.setValueAtTime(vol * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(sfxCtx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.type = 'sawtooth';
      const filter = sfxCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 * pitch, now);
      filter.Q.setValueAtTime(3, now);
      osc.frequency.setValueAtTime(300 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(900 * pitch, now + 0.12);
      gain.gain.setValueAtTime(vol * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxCtx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bgEl = document.getElementById('fa-bg');
    const stickerLayer = document.getElementById('fa-sticker-layer');
    const sparkleLayer = document.getElementById('sparkle-layer');
    const decorLayer = document.getElementById('fruity-decor-layer');
    const myspaceBar = document.getElementById('fa-myspace-bar');
    const sideToggle = document.getElementById('aero-side-toggle');
    const seriousSwitch = document.getElementById('footer-serious-switch');
    const seriousKnob = document.getElementById('footer-serious-knob');
    const seriousSublabel = document.getElementById('serious-sublabel');
    const odometerEl = document.getElementById('fa-odometer');

    // Audio player
    const audio = document.getElementById('lncr-bg-audio');
    const audioBtn = document.getElementById('audio-toggle-btn');
    const audioSymbol = document.getElementById('audio-symbol');
    const audioLabel = document.getElementById('audio-label');

    let userManuallyPaused = false;

    function updateAudioUI(playing) {
      if (!audioSymbol || !audioLabel) return;
      audioSymbol.textContent = playing ? '❚❚' : '▶';
      audioLabel.textContent = playing ? 'Pause' : 'Play';
    }

    if (audio) {
      const savedVol = parseInt(localStorage.getItem('lncr_music_vol') || '55', 10);
      audio.volume = isNaN(savedVol) ? 0.55 : Math.min(1, Math.max(0, savedVol / 100));
      audio.addEventListener('play', () => updateAudioUI(true));
      audio.addEventListener('pause', () => updateAudioUI(false));
    }

    if (audioBtn && audio) {
      audioBtn.addEventListener('click', () => {
        if (audio.paused) {
          userManuallyPaused = false;
          audio.play().catch(() => {});
        } else {
          userManuallyPaused = true;
          audio.pause();
        }
      });
    }

    // Populate Bubbles & Stars
    if (bgEl) {
      BUBBLES.forEach((b) => {
        const div = document.createElement('div');
        div.className = 'fa-bubble';
        div.style.width = `${b.size}px`;
        div.style.height = `${b.size}px`;
        div.style.left = `${b.left}%`;
        div.style.animationDuration = `${b.duration}s`;
        div.style.animationDelay = `${b.delay}s`;
        div.style.setProperty('--sway', b.sway);
        bgEl.appendChild(div);
      });

      for (let i = 0; i < 28; i++) {
        const star = document.createElement('div');
        star.className = 'fa-star';
        const left = (i * 3.65 + (i % 5) * 2.3) % 98;
        const top = (i * 4.2 + (i % 7) * 3.1) % 65;
        const delay = ((i * 0.37) % 3).toFixed(1);
        const size = i % 3 === 0 ? 3 : 2;
        star.style.left = `${left}%`;
        star.style.top = `${top}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.animationDelay = `${delay}s`;
        bgEl.appendChild(star);
      }
    }

    // Populate Interactive Draggable Stickers
    if (stickerLayer) {
      STICKERS_DATA.forEach((s, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = `fa-sticker fa-sticker--${s.side}`;
        wrapper.style.top = `${s.top}px`;
        wrapper.style.setProperty('--rot', `${s.rot}deg`);
        wrapper.style.setProperty('--delay', `${idx * 0.4}s`);
        wrapper.title = `${s.name} (Drag me anywhere or click to boing!)`;
        wrapper.setAttribute('role', 'img');
        wrapper.setAttribute('aria-label', s.alt);

        const img = document.createElement('img');
        img.src = s.src;
        img.alt = s.alt;
        img.draggable = false;
        wrapper.appendChild(img);

        let dragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0, elemX = 0, elemY = 0;

        wrapper.addEventListener('pointerdown', (e) => {
          const rect = wrapper.getBoundingClientRect();
          dragging = true;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          elemX = rect.left;
          elemY = rect.top;
          wrapper.setPointerCapture?.(e.pointerId);
        });

        wrapper.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
          wrapper.classList.remove('fa-sticker--left', 'fa-sticker--right');
          wrapper.style.left = `${elemX + dx}px`;
          wrapper.style.top = `${elemY + dy}px`;
          wrapper.style.right = 'auto';
        });

        wrapper.addEventListener('pointerup', (e) => {
          if (!dragging) return;
          dragging = false;
          wrapper.releasePointerCapture?.(e.pointerId);
          if (!hasMoved) {
            wrapper.classList.add('fa-boing');
            playStickerPop(s.pitch, s.sound);
            setTimeout(() => wrapper.classList.remove('fa-boing'), 700);
          }
        });

        stickerLayer.appendChild(wrapper);
      });
    }

    // Sparkle Cursor Trail
    let lastSparkle = 0;
    const SPARKLE_CHARS = ['✨', '⭐', '💫', '✦', '🌺', '💖'];
    const SPARKLE_COLORS = ['#38bdf8', '#4ade80', '#f472b6', '#facc15', '#a78bfa', '#22d3ee'];

    window.addEventListener('pointermove', (e) => {
      if (!document.documentElement.classList.contains('fruity') || !sparkleLayer) return;
      const now = performance.now();
      if (now - lastSparkle < 55) return;
      lastSparkle = now;

      const star = document.createElement('span');
      star.className = 'fa-sparkle';
      star.textContent = SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)];
      star.style.left = `${e.clientX}px`;
      star.style.top = `${e.clientY}px`;
      star.style.color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
      star.style.fontSize = `${Math.floor(Math.random() * 10 + 12)}px`;
      star.style.setProperty('--dx', `${(Math.random() * 40 - 20).toFixed(0)}px`);

      sparkleLayer.appendChild(star);
      setTimeout(() => star.remove(), 820);
    }, { passive: true });

    // Page Views Odometer
    if (odometerEl) {
      const key = 'lncr_stepsplitter_views_v1';
      let count = parseInt(localStorage.getItem(key) || '0', 10);
      if (isNaN(count)) count = 0;
      count += 1;
      localStorage.setItem(key, String(count));
      const digits = String(count).padStart(6, '0').slice(-6).split('');
      odometerEl.innerHTML = digits.map(d => `<span class="fa-digit">${d}</span>`).join('');
    }

    // Serious Mode vs Aero 2000s State Sync
    let seriousMode = localStorage.getItem('lncr_serious_mode') === 'true';

    function applySeriousMode(isSerious, skipAudioAuto) {
      seriousMode = isSerious;
      localStorage.setItem('lncr_serious_mode', String(isSerious));

      if (isSerious) {
        document.documentElement.classList.remove('fruity');
        if (decorLayer) decorLayer.classList.add('hidden');
        if (myspaceBar) myspaceBar.classList.add('hidden');
        if (sideToggle) sideToggle.textContent = 'SERIOUS MODE: ON';
        if (seriousSwitch) {
          seriousSwitch.setAttribute('aria-checked', 'true');
          seriousSwitch.classList.remove('bg-[#CBD5E1]');
          seriousSwitch.classList.add('bg-[#094AD8]');
        }
        if (seriousKnob) {
          seriousKnob.classList.remove('translate-x-0');
          seriousKnob.classList.add('translate-x-5');
        }
        if (seriousSublabel) seriousSublabel.textContent = 'Normal UI';
        if (audio && !audio.paused) audio.pause();
      } else {
        document.documentElement.classList.add('fruity');
        if (decorLayer) decorLayer.classList.remove('hidden');
        if (myspaceBar) myspaceBar.classList.remove('hidden');
        if (sideToggle) sideToggle.textContent = '✨ AERO 2000s: ON';
        if (seriousSwitch) {
          seriousSwitch.setAttribute('aria-checked', 'false');
          seriousSwitch.classList.remove('bg-[#094AD8]');
          seriousSwitch.classList.add('bg-[#CBD5E1]');
        }
        if (seriousKnob) {
          seriousKnob.classList.remove('translate-x-5');
          seriousKnob.classList.add('translate-x-0');
        }
        if (seriousSublabel) seriousSublabel.textContent = 'Aero 2000s';
        if (audio && !skipAudioAuto && !userManuallyPaused) {
          audio.play().catch(() => {});
        }
      }
    }

    // Initialize state (skip autoplay on initial mount unless triggered, or attempt play just like App.tsx)
    applySeriousMode(seriousMode, false);

    function toggleSerious() {
      applySeriousMode(!seriousMode, false);
    }

    if (sideToggle) sideToggle.addEventListener('click', toggleSerious);
    if (seriousSwitch) seriousSwitch.addEventListener('click', toggleSerious);
  });
})();
