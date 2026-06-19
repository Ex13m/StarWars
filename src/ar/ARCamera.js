// ARCamera — the "AR-lite" background: the device's rear camera feed shown behind
// the transparent WebGL canvas, so the space battle composites over the real world.
//
// Device-orientation aiming lives in core/Input.js; this module only owns the video.
// Everything degrades gracefully: no camera (or denied) -> we just keep the CSS
// space backdrop and play in "pure space" mode.

export class ARCamera {
  constructor() {
    this.video = null;
    this.stream = null;
    this.active = false;
  }

  /** Request the rear camera and show it full-screen behind the canvas. */
  async enable() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      return false; // denied or unavailable — caller falls back to pure space
    }

    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.autoplay = true;
    v.muted = true;
    v.srcObject = this.stream;
    Object.assign(v.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: '0', // behind #game-root (z-index 1)
    });
    document.body.appendChild(v);
    try { await v.play(); } catch { /* some browsers resolve play lazily */ }

    this.video = v;
    this.active = true;
    return true;
  }

  disable() {
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    if (this.video && this.video.parentNode) this.video.parentNode.removeChild(this.video);
    this.video = null;
    this.stream = null;
    this.active = false;
  }
}
