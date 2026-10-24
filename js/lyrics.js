/**
 * Lyrics — ambil lirik tersinkron (LRC) dari LRCLIB, parse, dan cache di localStorage.
 */
const Lyrics = {
  parse(txt) {
    const out = [];
    for (const raw of String(txt).split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
      if (!stamps.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of stamps) out.push({ time: +m[1] * 60 + parseFloat(m[2].replace(':', '.')), text });
    }
    return out.sort((a, b) => a.time - b.time);
  },

  clean: (s) => String(s).replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s+/g, ' ').trim(),

  async find(artist, track) {
    const a = artist === 'Unknown' ? '' : this.clean(artist), t = this.clean(track), key = 'tapeflow-lrc:' + a + '|' + t;
    try { const c = localStorage.getItem(key); if (c) return this.parse(c); } catch (e) {}

    let synced = null;
    try {
      let r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(t)}`);
      if (r.ok) synced = (await r.json()).syncedLyrics;
      if (!synced) {
        r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent((a + ' ' + t).trim())}`);
        if (r.ok) synced = ((await r.json()).find((x) => x.syncedLyrics) || {}).syncedLyrics;
      }
    } catch (e) { return null; }

    if (!synced) return null;
    try { localStorage.setItem(key, synced); } catch (e) {}
    return this.parse(synced);
  }
};