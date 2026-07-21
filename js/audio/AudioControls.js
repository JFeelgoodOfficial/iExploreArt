// ---------------------------------------------------------------------------
// AudioControls.js — the gallery's audio UI + Web Audio unlock.
//
// Two independent mute toggles (music + ambient sound) rendered as frosted
// corner buttons that work on touch, plus M / N keyboard shortcuts for desktop
// (where pointer-lock hides the cursor and makes the DOM buttons unclickable
// while walking). It also owns the mobile audio unlock: browsers create the
// AudioContext suspended, so we resume it and play a one-sample silent buffer
// inside a real gesture (the "Enter" tap), which iOS needs before any later
// buffered sound will actually sound.
//
//   import { buildAudioControls } from './audio/AudioControls.js';
//   const audio = buildAudioControls({ music, fountain, camera });
//   // inside the enter-gesture handler:
//   audio.unlock(); audio.reveal();
//
// `music`   — the object returned by buildMusic()   ({ sound, setVolume, play, … })
// `fountain`— the object returned by buildWallFountain() ({ setVolume, sound, … })
// `camera`  — carries the shared THREE.AudioListener (music + fountain reuse it)
// ---------------------------------------------------------------------------

const LS_MUSIC = 'iea.muteMusic';
const LS_SOUND = 'iea.muteSound';

// Inline SVGs — a music note and a speaker. The `.slash` line is revealed by
// the `.muted` class on the button (see gallery.css). No icon assets exist in
// the repo, so the glyphs live here alongside the buttons that use them.
const NOTE_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="glyph" d="M9 17.5V6.2l9-1.9v9.6" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="glyph" cx="6.6" cy="17.6" r="2.4" fill="none" stroke-width="1.8"/>
    <circle class="glyph" cx="15.6" cy="15.6" r="2.4" fill="none" stroke-width="1.8"/>
    <line class="slash" x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke-width="1.9" stroke-linecap="round"/>
  </svg>`;
const SPEAKER_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="glyph" d="M4 9v6h3.5L13 19.5V4.5L7.5 9H4z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
    <path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="1.7" stroke-linecap="round"/>
    <line class="slash" x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke-width="1.9" stroke-linecap="round"/>
  </svg>`;

export function buildAudioControls({ music, fountain, camera }) {
  // The shared AudioContext: read it straight off a THREE.Audio (each exposes
  // `.context`), which is created synchronously with the sound and is far more
  // reliable than scanning camera.children for the listener.
  const ctx =
    (music && music.sound && music.sound.context) ||
    (fountain && fountain.sound && fountain.sound.context) ||
    (() => {
      const l = camera && camera.children.find((c) => c.isAudioListener);
      return l ? l.context : null;
    })();

  // remembered "on" volumes so a mute → unmute restores the original level
  const onVol = { music: 0.3, sound: 0.75 };

  const state = {
    music: readStored(LS_MUSIC),   // true = muted
    sound: readStored(LS_SOUND),
  };

  // ── the buttons ──────────────────────────────────────────────────────────
  const wrap = document.getElementById('audio-controls');
  const btnMusic = document.getElementById('btn-music');
  const btnSound = document.getElementById('btn-sound');
  if (btnMusic) btnMusic.innerHTML = NOTE_SVG;
  if (btnSound) btnSound.innerHTML = SPEAKER_SVG;

  function apply(kind) {
    const muted = state[kind];
    if (kind === 'music' && music) music.setVolume(muted ? 0 : onVol.music);
    if (kind === 'sound' && fountain) fountain.setVolume(muted ? 0 : onVol.sound);
    const btn = kind === 'music' ? btnMusic : btnSound;
    if (btn) {
      btn.classList.toggle('muted', muted);
      const label = kind === 'music' ? 'music' : 'sound';
      btn.setAttribute('aria-label', `${muted ? 'Unmute' : 'Mute'} ${label}`);
      btn.setAttribute('aria-pressed', String(muted));
    }
  }

  function toggle(kind) {
    state[kind] = !state[kind];
    store(kind === 'music' ? LS_MUSIC : LS_SOUND, state[kind]);
    apply(kind);
  }

  if (btnMusic) btnMusic.addEventListener('click', () => { unlock(); toggle('music'); });
  if (btnSound) btnSound.addEventListener('click', () => { unlock(); toggle('sound'); });

  // Desktop keyboard toggles — pointer-lock hides the cursor, so the buttons
  // aren't clickable while walking; M / N always work. No text inputs exist.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyM') toggle('music');
    else if (e.code === 'KeyN') toggle('sound');
  });

  // apply persisted mute state up-front (volumes take effect once sources load)
  apply('music');
  apply('sound');

  // ── Web Audio unlock (mobile) ────────────────────────────────────────────
  let unlocked = false;
  function unlock() {
    if (!ctx || unlocked) return;
    try {
      if (ctx.state !== 'running') ctx.resume();
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      unlocked = true;
    } catch (e) { /* non-fatal — the per-source gesture handlers still try */ }
  }

  // iOS suspends the context when the page is backgrounded; resume on return
  // and nudge music back to playing if it was meant to be on.
  function resumeForeground() {
    if (!ctx || document.hidden) return;
    if (ctx.state !== 'running') ctx.resume();
    if (music && music.started && !state.music && music.play) music.play();
  }
  document.addEventListener('visibilitychange', resumeForeground);
  window.addEventListener('focus', resumeForeground);

  function reveal() { if (wrap) wrap.hidden = false; }

  return { unlock, reveal, toggle, isMuted: (k) => !!state[k] };
}

function readStored(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function store(key, val) {
  try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) { /* private mode */ }
}
