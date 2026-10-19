/**
 * Main Application Orchestrator (v2) — satu kaset, rak kaset, display & live lyrics
 */
document.addEventListener('DOMContentLoaded', () => {
  const audio = new TapeAudioEngine();
  const visual = new TapeVisualizer(audio);
  const $ = (id) => document.getElementById(id);

  const el = {
    status: $('deckStatus'), body: $('cassetteBody'), sticker: $('tapeSticker'),
    title: $('tapeTitle'), side: $('tapeSide'), genre: $('tapeSourceType'), badge: $('presetBadge'),
    lcdWin: $('lcdWin'), lcdTrack: $('lcdTrack'), embedBox: $('embedBox'), embedMount: $('embedMount'), lyBox: $('lyricsBox'), lyTrack: $('lyTrack'),
    shelf: $('shelf'), grid: $('shelfGrid'), shelfMsg: $('shelfMsg'),
    fArtist: $('fArtist'), fTitle: $('fTitle'), fUrl: $('fUrl'), fFile: $('fFile'),
    lrcInput: $('lrcInput')
  };

  const TONES = {
    idle: 'text-zinc-500 border-zinc-800', warn: 'text-amber-400 border-amber-900',
    ok: 'text-emerald-400 border-emerald-900', stop: 'text-red-400 border-red-900'
  };
  const PALETTE = [
    ['#fef3c7', '#a1a1aa'], ['#e0e7ff', '#818cf8'], ['#fed7aa', '#fb923c'],
    ['#dcfce7', '#4ade80'], ['#fce7f3', '#f472b6'], ['#cffafe', '#22d3ee']
  ];

  let tapeIdx = -1;      // -1 = tidak ada kaset di deck
  let busy = false;
  let lyr = null, lyrIdx = -2, lyrToken = 0, lyrOffset = 0;
  let pendingFile = null;

  const hasTape = () => tapeIdx >= 0;

  function setStatus(text, tone = 'idle') {
    el.status.textContent = text;
    el.status.className = `font-retro text-xl uppercase tracking-wider bg-zinc-950 px-3 py-1 rounded border ${TONES[tone]}`;
  }

  // ---------- Display (running text) ----------
  const mkSpan = (t) => { const s = document.createElement('span'); s.textContent = t; return s; };

  function setLCD(text) {
    const t = text.toUpperCase();
    el.lcdTrack.classList.remove('marquee');
    el.lcdTrack.replaceChildren(mkSpan(t));
    requestAnimationFrame(() => {
      if (el.lcdTrack.offsetWidth - 48 > el.lcdWin.clientWidth) {
        el.lcdTrack.append(mkSpan(t));
        el.lcdTrack.style.setProperty('--dur', `${Math.max(8, t.length * 0.3)}s`);
        el.lcdTrack.classList.add('marquee');
      }
    });
  }

  // ---------- Lyrics ----------
  const LINE_H = 32;
  let marked = [];

  function place(idx) {
    const kids = el.lyTrack.children;
    marked.forEach((n) => n.classList.remove('cur', 'near'));
    marked = [];
    [[idx - 1, 'near'], [idx, 'cur'], [idx + 1, 'near']].forEach(([i, cls]) => {
      if (kids[i]) { kids[i].classList.add(cls); marked.push(kids[i]); }
    });
    const eff = Math.max(idx, -1);
    const y = el.lyBox.clientHeight / 2 - (eff * LINE_H + LINE_H / 2);
    el.lyTrack.style.transform = `translateY(${y}px)`;
  }

  function setLyrics(arr) {
    lyr = arr; lyrIdx = -2; marked = [];
    el.lyTrack.replaceChildren(...arr.map((l) => {
      const p = document.createElement('p');
      p.className = 'ly';
      p.textContent = l.text || '♪';
      return p;
    }));
    place(-1);
  }

  function lyricsMsg(text) {
    lyr = null; lyrIdx = -2; marked = [];
    const p = document.createElement('p');
    p.className = 'ly msg';
    p.textContent = text;
    el.lyTrack.replaceChildren(p);
    el.lyTrack.style.transform = `translateY(${el.lyBox.clientHeight / 2 - LINE_H / 2}px)`;
  }

  function tickLyrics() {
    requestAnimationFrame(tickLyrics);
    if (!lyr || !hasTape()) return;
    const pos = curPos() + lyrOffset + 0.1;
    let idx = -1;
    for (let i = 0; i < lyr.length && lyr[i].time <= pos; i++) idx = i;
    if (idx !== lyrIdx) { lyrIdx = idx; place(idx); }
  }
  tickLyrics();

  async function loadLyricsFor(p) {
    const token = ++lyrToken;
    lyrOffset = 0;
    if (p.autoMeta) { lyricsMsg('MEMBACA JUDUL VIDEO...'); return; }
    if (p.lrc) { setLyrics(Lyrics.parse(p.lrc)); return; }
    lyricsMsg('MENCARI LIRIK...');
    const found = await Lyrics.find(p.artist, p.track);
    if (token !== lyrToken) return;
    if (found && found.length) setLyrics(found);
    else lyricsMsg('LIRIK TIDAK DITEMUKAN — COBA LOAD .LRC');
  }

  // ---------- Cassette visuals ----------
  function showBlank() {
    el.title.textContent = 'BLANK TAPE';
    el.side.textContent = 'SIDE A';
    el.genre.textContent = '-';
    el.badge.textContent = 'NO TAPE';
    el.sticker.style.backgroundColor = '#f4f4f5';
    el.body.style.borderColor = '#52525b';
  }

  function applyTape(p) {
    el.title.textContent = (p.title || `${p.artist} // ${p.track}`).toUpperCase();
    el.side.textContent = p.side || 'SIDE A';
    el.genre.textContent = p.genre || 'CASSETTE';
    el.badge.textContent = p.track.toUpperCase();
    el.sticker.style.backgroundColor = p.labelColor;
    el.body.style.borderColor = p.shellBorder;
  }

  // ---------- Transport ----------
  async function handlePlay() {
    if (busy) return;
    if (!hasTape()) { openShelf(); return; }
    if (ext) { ext.play(); return; }
    setStatus('LOADING...', 'warn');
    visual.updateReels('play');
    visual.startCounter(1, 1000);
    await audio.play();
    if (audio.isPlaying && hasTape()) setStatus('PLAYING', 'ok');
  }

  function handleStop() {
    if (ext) { ext.pause(); extState(false); return; }
    audio.stop();
    visual.updateReels('stop');
    visual.stopCounter();
    if (hasTape() && !busy) setStatus('STOPPED', 'stop');
  }

  function handleWind(dir) {
    if (busy || !hasTape() || ext) return;
    audio.stop();
    audio.playMechanicalClick();
    visual.updateReels(dir > 0 ? 'ff' : 'rew');
    visual.startCounter(dir, 100);
    setStatus(dir > 0 ? 'FAST FWD' : 'REWIND', 'warn');
  }

  function handleEject() {
    if (busy) return;
    if (!hasTape()) { openShelf(); return; }
    handleStop();
    destroyExt();
    audio.playEjectSound();
    tapeIdx = -1;
    lyrToken++;
    showBlank();
    setLCD('NO MUSIC PLAYED');
    lyricsMsg('');
    el.body.classList.add('cassette-ejected');
    setStatus('NO TAPE');
    setTimeout(openShelf, 450);
  }

  async function selectTape(i) {
    if (busy) return;
    busy = true;
    el.shelf.close();
    if (isOn()) handleStop();
    destroyExt();

    setStatus('SWAPPING...', 'warn');
    audio.playEjectSound();
    el.body.classList.remove('cassette-ejected', 'cassette-slide-in');
    el.body.classList.add('cassette-slide-out');
    await new Promise((r) => setTimeout(r, 320));

    tapeIdx = i;
    const p = audio.presets[i];
    applyTape(p);
    setLCD(lcdText(p));
    el.body.classList.replace('cassette-slide-out', 'cassette-slide-in');
    audio.playInsertSound();
    let loading;
    if (p.type) {
      el.embedBox.classList.remove('hidden');
      loading = (p.type === 'yt' ? createYT(p) : createSP(p)).catch((err) => {
        console.error(err);
        lyricsMsg('GAGAL MEMUAT PLAYER');
        setStatus('ERROR', 'stop');
      });
    } else {
      loading = audio.setPreset(i);
    }
    loadLyricsFor(p);
    renderShelf();

    await new Promise((r) => setTimeout(r, 450));
    el.body.classList.remove('cassette-slide-in');
    await loading;
    busy = false;
    if (!p.type) handlePlay();
  }

  // ---------- Embed: YouTube & Spotify ----------
  const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
  const SP_RE = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/(\w+)|spotify:track:(\w+)/;

  let ext = null; // { playing, pos(), play(), pause(), destroy() }
  const curPos = () => (ext ? ext.pos() : audio.getPosition());
  const isOn = () => (ext ? ext.playing : audio.isPlaying);
  const lcdText = (p) => (p.artist && p.artist !== 'Unknown' ? `${p.artist} — ${p.track}` : p.track);

  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src));
    document.head.appendChild(s);
  });

  function destroyExt() {
    if (ext) { try { ext.destroy(); } catch (e) {} ext = null; }
    audio.fakeVU = false;
    el.embedBox.classList.add('hidden');
    el.embedMount.replaceChildren();
  }

  function extState(playing) {
    if (!ext) return;
    ext.playing = playing;
    audio.fakeVU = playing;
    if (playing) { visual.updateReels('play'); visual.startCounter(1, 1000); setStatus('PLAYING', 'ok'); }
    else { visual.updateReels('stop'); visual.stopCounter(); setStatus('STOPPED', 'stop'); }
  }

  function fillMeta(p, data) {
    if (!p.autoMeta || !data || !data.title) return;
    const g = guessMeta(data.title, false);
    p.artist = g.artist || (data.author || '').replace(/ - Topic$/, '') || 'Unknown';
    p.track = Lyrics.clean(g.track) || data.title;
    p.autoMeta = false;
    if (audio.presets[tapeIdx] === p) { applyTape(p); setLCD(lcdText(p)); loadLyricsFor(p); }
    renderShelf();
  }

  async function createYT(p) {
    if (!(window.YT && YT.Player)) {
      await new Promise((res, rej) => {
        window.onYouTubeIframeAPIReady = res;
        loadScript('https://www.youtube.com/iframe_api').catch(rej);
      });
    }
    const mount = document.createElement('div');
    el.embedMount.replaceChildren(mount);
    let player, metaDone = false;
    const e = {
      playing: false,
      pos: () => { try { return player.getCurrentTime() || 0; } catch (x) { return 0; } },
      play: () => player.playVideo(),
      pause: () => player.pauseVideo(),
      destroy: () => player.destroy()
    };
    ext = e;
    player = new YT.Player(mount, {
      videoId: p.vid, width: '100%', height: '200', playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () => { try { player.playVideo(); } catch (x) {} },
        onStateChange: (ev) => {
          if (ext !== e) return;
          if (ev.data === 1) {
            if (!metaDone) { metaDone = true; fillMeta(p, player.getVideoData()); }
            extState(true);
          } else if (ev.data === 2 || ev.data === 0) extState(false);
        },
        onError: () => { if (ext === e) { setStatus('ERROR', 'stop'); lyricsMsg('VIDEO INI TIDAK BISA DIPUTAR DI SINI'); } }
      }
    });
  }

  async function createSP(p) {
    const api = await new Promise((res, rej) => {
      if (window.__spApi) return res(window.__spApi);
      window.onSpotifyIframeApiReady = (a) => { window.__spApi = a; res(a); };
      loadScript('https://open.spotify.com/embed/iframe-api/v1').catch(rej);
    });
    const mount = document.createElement('div');
    el.embedMount.replaceChildren(mount);
    let ctrl = null, base = 0, ts = performance.now(), started = false;
    const e = {
      playing: false,
      pos: () => base + (e.playing ? (performance.now() - ts) / 1000 : 0),
      play: () => { if (ctrl && !e.playing) (started ? ctrl.resume() : ctrl.play()); },
      pause: () => { if (ctrl) ctrl.pause(); },
      destroy: () => { if (ctrl) ctrl.destroy(); }
    };
    ext = e;
    api.createController(mount, { uri: p.uri, width: '100%', height: 152 }, (c) => {
      ctrl = c;
      c.addListener('ready', () => c.play());
      c.addListener('playback_update', (ev) => {
        if (ext !== e) return;
        const d = ev.data;
        base = d.position / 1000; ts = performance.now();
        const playing = !d.isPaused;
        if (playing) started = true;
        if (playing !== e.playing) extState(playing);
      });
    });
  }

  async function addEmbedTape(url, yt, sp) {
    const artist = el.fArtist.value.trim(), track = el.fTitle.value.trim();
    const [labelColor, shellBorder] = PALETTE[audio.presets.length % PALETTE.length];
    const p = {
      artist: artist || 'Unknown', track: track || (yt ? 'Loading...' : 'Spotify track'),
      genre: yt ? 'YOUTUBE' : 'SPOTIFY', side: 'SIDE A', labelColor, shellBorder,
      type: yt ? 'yt' : 'sp', vid: yt && yt[1], uri: sp && `spotify:track:${sp[1] || sp[2]}`,
      autoMeta: !!yt && !(artist && track)
    };
    if (sp && !track) {
      try {
        const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + (sp[1] || sp[2])));
        if (r.ok) p.track = (await r.json()).title || p.track;
      } catch (err) {}
    }
    audio.presets.push(p);
    el.fArtist.value = el.fTitle.value = el.fUrl.value = '';
    selectTape(audio.presets.length - 1);
  }

  // ---------- Rak otomatis dari folder songs/ ----------
  const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|flac|weba)$/i;
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };

  async function listSongFiles() {
    let files = null;
    try { // 1) listing folder dari server (python http.server, Live Server, dll.)
      const r = await fetch('songs/');
      if (r.ok) {
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        files = [...doc.querySelectorAll('a')]
          .map((a) => safeDecode((a.getAttribute('href') || '').split('?')[0].split('/').pop()))
          .filter((n) => AUDIO_RE.test(n));
      }
    } catch (e) {}
    if (!files || !files.length) { // 2) cadangan: songs/songs.json berisi array nama file
      try { const r = await fetch('songs/songs.json'); if (r.ok) files = await r.json(); } catch (e) {}
    }
    return files && files.length ? [...new Set(files)].sort((x, y) => x.localeCompare(y)) : null;
  }

  async function scanSongs() {
    const files = await listSongFiles();
    if (!files || busy) return;                       // gagal -> pakai daftar bawaan
    const old = audio.presets;
    const byUrl = new Map(old.filter((p) => p.audioUrl).map((p) => [p.audioUrl, p]));
    const cur = old[tapeIdx];
    const scanned = files.map((name, n) => {
      const url = 'songs/' + encodeURIComponent(name);
      const known = byUrl.get(url) || byUrl.get('songs/' + name);
      if (known) return known;
      const g = guessMeta(name);
      const [labelColor, shellBorder] = PALETTE[n % PALETTE.length];
      return { artist: g.artist || 'Unknown', track: g.track, genre: 'LOCAL', side: n % 2 ? 'SIDE B' : 'SIDE A', labelColor, shellBorder, audioUrl: url };
    });
    const customs = old.filter((p) => (p.buffer || p.type) && !scanned.includes(p));
    const list = [...scanned, ...customs];
    if (cur && !list.includes(cur)) list.push(cur);
    audio.presets = list;
    tapeIdx = cur ? list.indexOf(cur) : -1;
    audio.currentPresetIndex = Math.max(tapeIdx, 0);
    if (el.shelf.open) renderShelf();
  }

  // ---------- Rak kaset ----------
  function openShelf() {
    if (busy || el.shelf.open) return;
    renderShelf();
    el.shelfMsg.textContent = '';
    el.shelf.showModal();
    scanSongs();
  }

  function renderShelf() {
    el.grid.replaceChildren(...audio.presets.map((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rack-tape bg-zinc-950 border-2 rounded-lg p-2 text-left flex flex-col gap-1 ' +
        (i === tapeIdx ? 'active-in-deck border-amber-500' : 'border-zinc-700');
      const label = document.createElement('div');
      label.className = 'text-zinc-900 px-1 py-0.5 rounded text-xs font-bold font-retro truncate text-center';
      label.style.backgroundColor = p.labelColor;
      label.textContent = p.artist.toUpperCase();
      const name = document.createElement('div');
      name.className = 'text-[11px] text-zinc-300 truncate';
      name.textContent = p.track;
      const st = document.createElement('div');
      st.className = 'text-[9px] font-retro tracking-wider ' + (i === tapeIdx ? 'text-emerald-400' : 'text-zinc-500');
      st.textContent = i === tapeIdx ? 'IN DECK' : ((p.buffer || p.type) ? 'CUSTOM' : 'READY');
      b.append(label, name, st);
      b.addEventListener('click', () => selectTape(i));
      return b;
    }));
  }

  function guessMeta(name, strip = true) {
    let n = name;
    try { n = decodeURIComponent(name); } catch (e) {}
    const base = (strip ? n.replace(/\.[^/.]+$/, '') : n).replace(/[_]+/g, ' ').trim();
    const parts = base.split(' - ');
    return parts.length > 1 ? { artist: parts[0].trim(), track: parts.slice(1).join(' - ').trim() }
                            : { artist: '', track: base };
  }

  async function addCustomTape() {
    const url = el.fUrl.value.trim();
    if (!pendingFile && !url) { el.shelfMsg.textContent = 'Pilih file atau isi link dulu.'; return; }
    const yt = !pendingFile && url.match(YT_RE);
    const sp = !pendingFile && url.match(SP_RE);
    if (yt || sp) return addEmbedTape(url, yt, sp);
    if (!pendingFile && /youtu|spotify/i.test(url)) {
      el.shelfMsg.textContent = 'Link tidak dikenali. Pakai link video YouTube atau lagu (track) Spotify.';
      return;
    }
    el.shelfMsg.textContent = 'Membaca audio...';
    let buffer, fallbackName;
    try {
      if (pendingFile) {
        fallbackName = pendingFile.name;
        buffer = await audio.decode(await pendingFile.arrayBuffer());
      } else {
        fallbackName = url.split('?')[0].split('/').pop() || 'Unknown';
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        buffer = await audio.decode(await res.arrayBuffer());
      }
    } catch (err) {
      console.error(err);
      el.shelfMsg.textContent = 'Gagal membuka audio. Untuk link, server harus mengizinkan CORS.';
      return;
    }
    const g = guessMeta(fallbackName);
    const [labelColor, shellBorder] = PALETTE[audio.presets.length % PALETTE.length];
    audio.presets.push({
      artist: el.fArtist.value.trim() || g.artist || 'Unknown',
      track: el.fTitle.value.trim() || g.track || 'Untitled',
      genre: pendingFile ? 'LOCAL FILE' : 'FROM LINK', side: 'SIDE A', labelColor, shellBorder, buffer
    });
    pendingFile = null;
    el.fArtist.value = el.fTitle.value = el.fUrl.value = '';
    selectTape(audio.presets.length - 1);
  }

  // ---------- Events ----------
  $('btnPlay').addEventListener('click', handlePlay);
  $('btnStop').addEventListener('click', handleStop);
  $('btnFF').addEventListener('click', () => handleWind(1));
  $('btnRewind').addEventListener('click', () => handleWind(-1));
  $('btnEject').addEventListener('click', handleEject);
  $('btnShelf').addEventListener('click', openShelf);
  $('dropZone').addEventListener('click', openShelf);
  $('shelfClose').addEventListener('click', () => el.shelf.close());
  el.shelf.addEventListener('click', (e) => { if (e.target === el.shelf) el.shelf.close(); });

  $('fPick').addEventListener('click', () => el.fFile.click());
  el.fFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    pendingFile = f;
    const g = guessMeta(f.name);
    el.fArtist.value = g.artist; el.fTitle.value = g.track; el.fUrl.value = '';
    el.shelfMsg.textContent = `File: ${f.name}`;
    el.fFile.value = '';
  });
  el.fUrl.addEventListener('input', () => { if (el.fUrl.value) pendingFile = null; });
  el.fUrl.addEventListener('change', () => {
    if (!el.fUrl.value.trim() || el.fArtist.value || el.fTitle.value) return;
    const g = guessMeta(el.fUrl.value.split('?')[0].split('/').pop() || '');
    el.fArtist.value = g.artist; el.fTitle.value = g.track;
  });
  $('fAdd').addEventListener('click', addCustomTape);

  $('btnLrc').addEventListener('click', () => { if (hasTape()) el.lrcInput.click(); });
  el.lrcInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    el.lrcInput.value = '';
    if (!f || !hasTape()) return;
    const parsed = Lyrics.parse(await f.text());
    if (!parsed.length) { lyricsMsg('FILE LRC TIDAK VALID'); return; }
    audio.presets[tapeIdx].lrc = await f.text();
    lyrToken++; lyrOffset = 0; setLyrics(parsed);
  });

  // Slider
  const bindSlider = (id, valId, fmt, apply) => $(id).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $(valId).textContent = fmt(v);
    apply(v);
  });
  bindSlider('sliderSynth', 'valSynth', (v) => `${Math.round(v * 100)}%`, (v) => audio.synthGain && (audio.synthGain.gain.value = v));
  bindSlider('sliderRain', 'valRain', (v) => `${Math.round(v * 100)}%`, (v) => audio.rainGain && (audio.rainGain.gain.value = v));
  bindSlider('sliderHiss', 'valHiss', (v) => `${Math.round(v * 100)}%`, (v) => audio.hissGain && (audio.hissGain.gain.value = v));
  bindSlider('sliderWarmth', 'valWarmth', (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}Hz`, (v) => audio.warmthFilter && (audio.warmthFilter.frequency.value = v));

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || el.shelf.open) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); isOn() ? handleStop() : handlePlay(); }
    else if (k === 's') handleStop();
    else if (k === 'e') handleEject();
    else if (k === 'l') openShelf();
    else if (k === 'f') handleWind(1);
    else if (k === 'r') handleWind(-1);
    else if (k === '[') lyrOffset -= 0.5;
    else if (k === ']') lyrOffset += 0.5;
  });

  // ---------- Initial state: kaset kosong keluar dari deck, "NO MUSIC PLAYED" ----------
  scanSongs();
  showBlank();
  setLCD('NO MUSIC PLAYED');
  lyricsMsg('');
  setStatus('NO TAPE');
  setTimeout(() => el.body.classList.add('cassette-ejected'), 350);
});