/**
 * TapeAudioEngine — Web Audio API Modular Synthesizer & Multi-Track Soundscape Engine
 */
class TapeAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.mode = 'custom'; // 'custom' | 'synth'
    
    // Core Audio Nodes
    this.masterGain = null;
    this.playbackGain = null;
    this.warmthFilter = null;
    this.analyser = null;
    
    // Channel Gains
    this.synthGain = null;
    this.rainGain = null;
    this.hissGain = null;
    
    // Audio Buffers & Cache
    this.bufferCache = new Map();
    this.customBuffer = null;
    this.customSourceNode = null;
    this.customPauseOffset = 0;
    this.customStartTime = 0;
    this.isLoadingAudio = false;

    this.currentPresetIndex = 0;

    // Cassette Library from songs folder
    this.presets = [
      {
        name: "Cigarettes After Sex",
        title: "CAS // AFFECTION",
        track: "Affection",
        artist: "Cigarettes After Sex",
        genre: "DREAM POP",
        side: "SIDE A",
        labelColor: "#fef3c7",
        shellBorder: "#a1a1aa",
        audioUrl: "songs/Affection - Cigarettes After Sex.mp3"
      },
      {
        name: "The 1975",
        title: "THE 1975 // ABOUT YOU",
        track: "About You",
        artist: "The 1975",
        genre: "INDIE / SHOEGAZE",
        side: "SIDE A",
        labelColor: "#e0e7ff",
        shellBorder: "#818cf8",
        audioUrl: "songs/The 1975 - About You (Official).mp3"
      },
      {
        name: "Glenn Fredly",
        title: "GLENN FREDLY // KASIH PUTIH",
        track: "Kasih Putih",
        artist: "Glenn Fredly",
        genre: "INDONESIAN SOUL",
        side: "SIDE B",
        labelColor: "#fed7aa",
        shellBorder: "#fb923c",
        audioUrl: "songs/Glenn Fredly - Kasih Putih.mp3"
      },
      {
        name: "Novo Amor",
        title: "NOVO AMOR // KEEP ME",
        track: "Keep Me",
        artist: "Novo Amor",
        genre: "INDIE ACOUSTIC",
        side: "SIDE B",
        labelColor: "#dcfce7",
        shellBorder: "#4ade80",
        audioUrl: "songs/Novo Amor - Keep Me (Lyrics).mp3"
      }
    ];
  }

  init() {
    if (this.ctx) return;
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtxClass();

    // Master Output DSP Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;

    this.playbackGain = this.ctx.createGain();
    this.playbackGain.gain.value = 0; // Starts muted until playback begins

    this.warmthFilter = this.ctx.createBiquadFilter();
    this.warmthFilter.type = 'lowpass';
    const sliderWarmth = document.getElementById('sliderWarmth');
    this.warmthFilter.frequency.value = sliderWarmth ? parseInt(sliderWarmth.value) : 2400;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.8;

    this.warmthFilter.connect(this.playbackGain);
    this.playbackGain.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Dynamic Channel Gains
    const sliderSynth = document.getElementById('sliderSynth');
    const sliderRain = document.getElementById('sliderRain');
    const sliderHiss = document.getElementById('sliderHiss');

    this.synthGain = this.ctx.createGain();
    this.synthGain.gain.value = sliderSynth ? parseFloat(sliderSynth.value) : 0.7;
    this.synthGain.connect(this.warmthFilter);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = sliderRain ? parseFloat(sliderRain.value) : 0.4;
    this.rainGain.connect(this.warmthFilter);

    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = sliderHiss ? parseFloat(sliderHiss.value) : 0.3;
    this.hissGain.connect(this.warmthFilter);

    this.initTapeHiss();
    this.initRainFX();
  }

  playMechanicalClick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.035);

    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  playEjectSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Resonant spring release thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Mechanical latch pop
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(380, now + 0.03);
    clickOsc.frequency.exponentialRampToValueAtTime(50, now + 0.07);

    clickGain.gain.setValueAtTime(0.25, now + 0.03);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now + 0.03);
    clickOsc.stop(now + 0.08);
  }

  playInsertSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // First slide click
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(260, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Solid latch snap
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(140, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.14);
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  initTapeHiss() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 1.0;

    noise.connect(filter);
    filter.connect(this.hissGain);
    noise.start();
  }

  initRainFX() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 950;

    noise.connect(filter);
    filter.connect(this.rainGain);
    noise.start();
  }

  // --- Audio Loading & Streaming Engine ---

  async loadPresetAudio(index) {
    this.init();
    const preset = this.presets[index];
    if (!preset || !preset.audioUrl) return null;

    if (preset.buffer) {
      this.customBuffer = preset.buffer;
      this.mode = 'custom';
      return preset.buffer;
    }

    if (this.bufferCache.has(preset.audioUrl)) {
      this.customBuffer = this.bufferCache.get(preset.audioUrl);
      this.mode = 'custom';
      return this.customBuffer;
    }

    try {
      this.isLoadingAudio = true;
      const res = await fetch(preset.audioUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(preset.audioUrl, decoded);
      this.customBuffer = decoded;
      this.mode = 'custom';
      this.isLoadingAudio = false;
      return decoded;
    } catch (err) {
      this.isLoadingAudio = false;
      console.error("Failed to load audio track:", err);
      return null;
    }
  }

  async decode(arrayBuffer) {
    this.init();
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  getPosition() {
    if (!this.customBuffer || !this.ctx) return 0;
    if (!this.isPlaying || !this.customSourceNode) return this.customPauseOffset || 0;
    return (this.ctx.currentTime - this.customStartTime) % this.customBuffer.duration;
  }

  async loadCustomAudio(file) {
    this.init();
    this.stop();
    const arrayBuffer = await file.arrayBuffer();
    this.customBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.mode = 'custom';
    this.customPauseOffset = 0;
  }

  playCustomAudio() {
    if (!this.customBuffer || !this.ctx) return;
    this.stopCustomAudio();

    this.customSourceNode = this.ctx.createBufferSource();
    this.customSourceNode.buffer = this.customBuffer;
    this.customSourceNode.connect(this.synthGain);
    this.customSourceNode.loop = true;

    this.customStartTime = this.ctx.currentTime - this.customPauseOffset;
    this.customSourceNode.start(0, this.customPauseOffset % this.customBuffer.duration);
  }

  stopCustomAudio() {
    if (this.customSourceNode) {
      try {
        if (this.ctx && this.customBuffer) {
          this.customPauseOffset = (this.ctx.currentTime - this.customStartTime) % this.customBuffer.duration;
        }
        this.customSourceNode.stop();
        this.customSourceNode.disconnect();
      } catch (e) {}
      this.customSourceNode = null;
    }
  }

  // --- Transport Controls ---

  async play() {
    this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.isPlaying = true;
    this.playMechanicalClick();

    // Smooth un-mute playback gate
    if (this.playbackGain) {
      this.playbackGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.playbackGain.gain.setValueAtTime(this.playbackGain.gain.value, this.ctx.currentTime);
      this.playbackGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.05);
    }

    if (!this.customBuffer) {
      await this.loadPresetAudio(this.currentPresetIndex);
    }

    if (this.isPlaying && this.customBuffer) {
      this.playCustomAudio();
    }
  }

  stop() {
    this.isPlaying = false;
    this.playMechanicalClick();
    this.stopCustomAudio();

    // Smooth mute playback gate
    if (this.playbackGain && this.ctx) {
      this.playbackGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.playbackGain.gain.setValueAtTime(this.playbackGain.gain.value, this.ctx.currentTime);
      this.playbackGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.03);
    }
  }

  async setPreset(index) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentPresetIndex = index;
    this.customPauseOffset = 0;
    this.customBuffer = null;

    await this.loadPresetAudio(index);

    if (wasPlaying) {
      this.play();
    }
  }
}