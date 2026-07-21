import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Music.js — soft looping background music for the whole gallery.
//
// A non-positional THREE.Audio (heard everywhere, unlike the fountain's
// spatial PositionalAudio) sharing the camera's AudioListener. Browsers block
// autoplay, so it starts on the first user gesture — the same click / keypress
// / tap that enters the gallery. If the AudioListener isn't on the camera yet
// (e.g. the fountain hasn't created it), we add one; otherwise we reuse it.
//
//   import { buildMusic } from './audio/Music.js';
//   const music = buildMusic(camera);           // uses the default track
//
// Options (all optional): buildMusic(camera, {
//   url: 'assets/music/…mp3',   // track to loop
//   volume: 0.3,                // kept low so it sits under the room + fountain
//   loop: true,
// });
// ---------------------------------------------------------------------------

export function buildMusic(camera, opts = {}) {
  const o = Object.assign({
    url: 'assets/music/kenny-barron-type-piano-melody_D_major.mp3',
    volume: 0.3,
    loop: true,
  }, opts);

  let listener = camera.children.find((c) => c.isAudioListener);
  if (!listener) { listener = new THREE.AudioListener(); camera.add(listener); }

  const sound = new THREE.Audio(listener);
  const ctx = listener.context;
  let ready = false, wantsPlay = false;
  // Track the desired volume separately: the audio controller may mute (set 0)
  // before the buffer finishes decoding, and we must not have the loader below
  // reset it back to the default when it applies the freshly-decoded buffer.
  let curVol = o.volume;

  new THREE.AudioLoader().load(
    o.url,
    (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(o.loop);
      sound.setVolume(curVol);
      ready = true;
      if (wantsPlay) start();          // a gesture already fired while loading
    },
    undefined,
    (e) => console.warn('[Music] could not load', o.url, e)
  );

  // Auto-start on the first interaction (browsers require a user gesture).
  // On mobile the buffer often isn't decoded yet when the entering tap fires,
  // so we resume the context in-gesture and defer the actual play; when the
  // context is still suspended at play time (common on iOS) we resume first
  // and play once that resolves, rather than starting into a silent context.
  function start() {
    if (ctx.state !== 'running') ctx.resume();   // must run inside the gesture
    if (!ready) { wantsPlay = true; return; }     // buffer not decoded yet
    play();
    remove();
  }
  function play() {
    if (sound.isPlaying) return;
    if (ctx.state !== 'running') ctx.resume().then(() => { if (!sound.isPlaying) sound.play(); });
    else sound.play();
  }
  const evs = ['pointerdown', 'keydown', 'touchend', 'click'];
  const remove = () => evs.forEach((e) => window.removeEventListener(e, start));
  evs.forEach((e) => window.addEventListener(e, start, { passive: true }));

  function setVolume(v) { curVol = v; sound.setVolume(v); }
  function dispose() { if (sound.isPlaying) sound.stop(); remove(); }

  // `started` is true once the entering gesture has fired; the audio controller
  // uses it to know whether music should be resumed after the page returns from
  // the background (iOS suspends the context there).
  return { sound, setVolume, dispose, play, get started() { return ready ? sound.isPlaying : wantsPlay; } };
}
