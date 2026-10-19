/**
 * TapeVisualizer — Manages Canvas VU Meters, Reel Physics, and LCD Counter
 */
class TapeVisualizer {
  constructor(audioEngine) {
    this.audio = audioEngine;
    
    // Canvases
    this.canvasL = document.getElementById('vuLeft');
    this.ctxL = this.canvasL.getContext('2d');
    this.canvasR = document.getElementById('vuRight');
    this.ctxR = this.canvasR.getContext('2d');
    
    // LEDs & Reels
    this.peakLedL = document.getElementById('peakLedL');
    this.peakLedR = document.getElementById('peakLedR');
    this.leftReel = document.getElementById('leftReel');
    this.rightReel = document.getElementById('rightReel');
    this.leftTapeRoll = document.getElementById('leftTapeRoll');
    this.rightTapeRoll = document.getElementById('rightTapeRoll');
    this.tapeCounterEl = document.getElementById('tapeCounter');

    // State
    this.counterVal = 0;
    this.counterTimer = null;
    this.needleValL = 0;
    this.needleValR = 0;

    this.startRenderLoop();
  }

  drawVUMeter(ctx, val, peakLed) {
    const w = 220;
    const h = 75;
    ctx.clearRect(0, 0, w, h);

    // Dial Scale Curve
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h + 5, 60, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Red Danger Zone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath();
    ctx.arc(w / 2, h + 5, 60, Math.PI * 1.65, Math.PI * 1.85);
    ctx.stroke();

    // Needle Angle Interpolation
    const baseAngle = Math.PI * 1.22;
    const maxAngle = Math.PI * 1.78;
    const targetAngle = baseAngle + (val * (maxAngle - baseAngle));

    const needleLen = 54;
    const nx = (w / 2) + Math.cos(targetAngle) * needleLen;
    const ny = (h + 5) + Math.sin(targetAngle) * needleLen;

    // Draw Needle
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, h + 5);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    // Pivot Pin
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(w / 2, h + 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Peak LED logic
    if (val > 0.85) {
      peakLed.classList.add('led-active');
    } else {
      peakLed.classList.remove('led-active');
    }
  }

  updateReels(state) {
    this.leftReel.className = "w-14 h-14 rounded-full border-4 border-dashed border-zinc-300 flex items-center justify-center bg-zinc-950 relative z-10 shadow-inner";
    this.rightReel.className = "w-14 h-14 rounded-full border-4 border-dashed border-zinc-300 flex items-center justify-center bg-zinc-950 relative z-10 shadow-inner";

    if (state === 'play') {
      this.leftReel.classList.add('spinning-normal');
      this.rightReel.classList.add('spinning-normal');
    } else if (state === 'ff') {
      this.leftReel.classList.add('spinning-fast');
      this.rightReel.classList.add('spinning-fast');
    } else if (state === 'rew') {
      this.leftReel.classList.add('spinning-reverse');
      this.rightReel.classList.add('spinning-reverse');
    }
  }

  startCounter(direction = 1, speed = 1000) {
    this.stopCounter();
    this.counterTimer = setInterval(() => {
      this.counterVal = (this.counterVal + direction + 1000) % 1000;
      this.tapeCounterEl.innerText = String(this.counterVal).padStart(3, '0');
      
      // Dynamic tape roll thickness
      const percent = (this.counterVal % 300) / 300;
      const leftSize = Math.max(14, 22 - percent * 8);
      const rightSize = Math.max(14, 14 + percent * 8);
      this.leftTapeRoll.style.width = `${leftSize * 4}px`;
      this.leftTapeRoll.style.height = `${leftSize * 4}px`;
      this.rightTapeRoll.style.width = `${rightSize * 4}px`;
      this.rightTapeRoll.style.height = `${rightSize * 4}px`;
    }, speed);
  }

  stopCounter() {
    if (this.counterTimer) {
      clearInterval(this.counterTimer);
      this.counterTimer = null;
    }
  }

  startRenderLoop() {
    const render = () => {
      requestAnimationFrame(render);
      if (!this.audio.analyser || !this.audio.isPlaying) {
        this.needleValL *= 0.8;
        this.needleValR *= 0.8;
      } else {
        const data = new Uint8Array(this.audio.analyser.frequencyBinCount);
        this.audio.analyser.getByteFrequencyData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const targetNorm = Math.min(1, avg / 75);

        // Smooth needle inertia
        this.needleValL += (targetNorm * (0.9 + Math.random() * 0.1) - this.needleValL) * 0.25;
        this.needleValR += (targetNorm * (0.85 + Math.random() * 0.15) - this.needleValR) * 0.25;
      }

      this.drawVUMeter(this.ctxL, this.needleValL, this.peakLedL);
      this.drawVUMeter(this.ctxR, this.needleValR, this.peakLedR);
    };
    render();
  }
}