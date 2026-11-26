/**
 * NIPPON MAGNETICS CO., LTD. (日本磁気株式会社) — DIV. 04
 * Unified Runtime: Theme Manager, EST/UTC Clock, Audio Synth Engine,
 * NWS Meteorology & IEM NEXRAD Radar, and GitHub Public Archive.
 *
 * Zero-build, zero-dependency, strictly live APIs & real Web Audio DSP.
 */
(function (global) {
  'use strict';

  global.NMModules = global.NMModules || {};

  /* ==========================================================================
     SECTION 0: Shared Utilities, Theme Manager, Status Ledger & Live Clock
     ========================================================================== */

  const THEME_COLORS = {
    roppongi: '#11100e',
    atrium: '#edf3ef',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (el) {
      el.textContent = value;
    }
  }

  /**
   * Toggle visibility across hidden attribute, .is-hidden/.hidden classes, and inline display
   * without clobbering stylesheet display values (flex/grid/block) when showing elements.
   */
  function setElementVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.classList.toggle('is-hidden', !visible);
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (visible) {
      if (el.style.display === 'none') {
        el.style.display = '';
      }
      if (typeof global.getComputedStyle === 'function' && global.getComputedStyle(el).display === 'none') {
        el.classList.add('is-visible');
        if (global.getComputedStyle(el).display === 'none') {
          el.style.display = 'block';
        }
      }
    } else {
      el.classList.remove('is-visible');
      el.style.display = 'none';
    }
  }

  function toFiniteNumber(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function formatEtAndUtc(isoOrDate) {
    if (!isoOrDate) return '—';
    const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(date.getTime())) return '—';

    try {
      const etText = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'short',
      }).format(date);

      const utcHour = String(date.getUTCHours()).padStart(2, '0');
      const utcMin = String(date.getUTCMinutes()).padStart(2, '0');
      return `${etText} (${utcHour}:${utcMin}Z)`;
    } catch (_) {
      return date.toISOString();
    }
  }

  function formatShortClock(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'short',
      }).format(d);
    } catch (_) {
      return d.toISOString().slice(11, 19) + 'Z';
    }
  }

  function formatUtcClock(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    try {
      const hms = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(d);
      return `${hms} UTC`;
    } catch (_) {
      return `${d.toISOString().slice(11, 19)} UTC`;
    }
  }

  async function fetchResponse(url, headers, externalSignal, timeoutMs = 12000) {
    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timer = global.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (err) {
      if (timedOut) {
        throw new Error('Request timed out contacting remote endpoint.');
      }
      throw err;
    } finally {
      global.clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  async function fetchJson(url, headers, externalSignal, timeoutMs = 12000) {
    const res = await fetchResponse(url, headers, externalSignal, timeoutMs);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${res.statusText || 'Error'})`);
    }
    return await res.json();
  }

  function getButtonLabelTarget(btn) {
    if (!btn) return null;
    const span = btn.querySelector('.btn-label, span:not(.material-symbols-rounded):not(.icon)');
    if (span && span.children.length === 0) {
      return span;
    }
    if (btn.children.length === 0) {
      return btn;
    }
    for (let i = 0; i < btn.childNodes.length; i += 1) {
      const node = btn.childNodes[i];
      if (node.nodeType === 3 && node.nodeValue.trim()) {
        return node;
      }
    }
    return btn;
  }

  function readLabelTarget(target, fallback) {
    if (!target) return fallback;
    const raw = target.nodeType === 3 ? target.nodeValue : target.textContent;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed || fallback;
  }

  function writeLabelTarget(target, text) {
    if (!target) return;
    if (target.nodeType === 3) {
      target.nodeValue = ` ${text}`;
    } else {
      target.textContent = text;
    }
  }

  function getTheme() {
    return document.documentElement.dataset.theme === 'atrium' ? 'atrium' : 'roppongi';
  }

  function applyTheme(theme, persist) {
    const normalized = theme === 'atrium' ? 'atrium' : 'roppongi';
    document.documentElement.dataset.theme = normalized;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', THEME_COLORS[normalized]);
    }

    const toggleBtn = $('theme-toggle');
    const toggleLabel = $('theme-toggle-label');
    const toggleIcon = $('theme-toggle-icon');

    if (toggleLabel) {
      toggleLabel.textContent = normalized === 'atrium' ? 'ATRIUM DAYLIGHT' : 'ROPPONGI NIGHT';
    }
    if (toggleIcon) {
      toggleIcon.textContent = normalized === 'atrium' ? '\u2600' : '\u263D';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', normalized === 'atrium' ? 'true' : 'false');
    }

    if (persist) {
      try {
        localStorage.setItem('nm-theme', normalized);
      } catch (_) {
        // Ignore storage errors in restricted environments
      }
    }

    global.dispatchEvent(new CustomEvent('nm:themechange', { detail: { theme: normalized } }));
  }

  function bindThemeToggle() {
    const toggleBtn = $('theme-toggle');
    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
      const nextTheme = getTheme() === 'atrium' ? 'roppongi' : 'atrium';
      applyTheme(nextTheme, true);
    });
  }

  function setStatus(id, label, state) {
    const el = $(id);
    if (!el) return;
    el.textContent = label;
    const normalized = state || 'idle';
    el.dataset.state = normalized;
    el.classList.toggle('is-live', normalized === 'live');
    el.classList.toggle('is-standby', normalized === 'standby');
    el.classList.toggle('is-error', normalized === 'error');
  }

  let clockIntervalId = null;

  function updateClocks() {
    const now = new Date();
    setText($('live-clock-est'), formatShortClock(now));
    setText($('live-clock-utc'), formatUtcClock(now));
  }

  function startClock() {
    updateClocks();
    if (clockIntervalId !== null) {
      global.clearInterval(clockIntervalId);
    }
    clockIntervalId = global.setInterval(updateClocks, 1000);
  }

  /* ==========================================================================
     SECTION 1: Audio Division Module (Web Audio DSP & Real AnalyserNode VFD)
     ========================================================================== */

  const MAX_VOICES = 8;
  const BPM = 82;
  const BEAT_MS = (60 / BPM) * 1000;
  const SEQ_STEP_MS = BEAT_MS * 2;
  const SEQ_GATE_MS = SEQ_STEP_MS * 0.84;
  const CHORD_CLICK_HOLD_MS = 2600;

  const SEQ_PROGRESSION = ['Cmaj9', 'Fmaj7#11', 'Dm9', 'G13sus4'];

  const CHORD_DEFINITIONS = {
    Cmaj9: {
      freqs: [261.63, 329.63, 392.00, 493.88, 587.33],
      notes: ['C4', 'E4', 'G4', 'B4', 'D5'],
    },
    'Fmaj7#11': {
      freqs: [349.23, 440.00, 523.25, 659.25, 493.88],
      notes: ['F4', 'A4', 'C5', 'E5', 'B4'],
    },
    Am9: {
      freqs: [220.00, 261.63, 329.63, 392.00, 493.88],
      notes: ['A3', 'C4', 'E4', 'G4', 'B4'],
    },
    Dm9: {
      freqs: [293.66, 349.23, 440.00, 523.25, 659.25],
      notes: ['D4', 'F4', 'A4', 'C5', 'E5'],
    },
    G13sus4: {
      freqs: [196.00, 261.63, 293.66, 349.23, 440.00, 659.25],
      notes: ['G3', 'C4', 'D4', 'F4', 'A4', 'E5'],
    },
    Ebmaj9: {
      freqs: [311.13, 392.00, 466.16, 587.33, 698.46],
      notes: ['Eb4', 'G4', 'Bb4', 'D5', 'F5'],
    },
  };

  const KEY_FALLBACK = {
    a: { note: 'C4', freq: 261.63 },
    w: { note: 'C#4', freq: 277.18 },
    s: { note: 'D4', freq: 293.66 },
    e: { note: 'D#4', freq: 311.13 },
    d: { note: 'E4', freq: 329.63 },
    f: { note: 'F4', freq: 349.23 },
    t: { note: 'F#4', freq: 369.99 },
    g: { note: 'G4', freq: 392.00 },
    y: { note: 'G#4', freq: 415.30 },
    h: { note: 'A4', freq: 440.00 },
    u: { note: 'A#4', freq: 466.16 },
    j: { note: 'B4', freq: 493.88 },
    k: { note: 'C5', freq: 523.25 },
  };

  const VFD_FREQ_MIN = 40;
  const VFD_FREQ_MAX = 16000;
  const SPECTRUM_BARS = 64;
  const GRID_MARKERS = [
    { hz: 100, label: '100Hz' },
    { hz: 1000, label: '1kHz' },
    { hz: 4000, label: '4kHz' },
    { hz: 12000, label: '12kHz' },
  ];

  function initAudio(options) {
    const opts = options || {};
    const reportStatusFn = typeof opts.setStatus === 'function' ? opts.setStatus : null;

    function reportStatus(label, stateClass) {
      if (reportStatusFn) {
        reportStatusFn('status-audio', label, stateClass);
      }
    }

    const powerBadge = $('synth-power-badge');
    const spectrumCanvas = $('synth-spectrum');
    const activeNotesEl = $('synth-active-notes');
    const chordsContainer = $('synth-chords');
    const keyboardContainer = $('synth-keyboard');

    const holdBtn = $('synth-hold-btn');
    const seqBtn = $('synth-seq-btn');
    const stopBtn = $('synth-stop-btn');

    const cutoffSlider = $('synth-cutoff');
    const cutoffValEl = $('synth-cutoff-val');
    const resonanceSlider = $('synth-resonance');
    const resonanceValEl = $('synth-resonance-val');
    const flutterSlider = $('synth-flutter');
    const flutterValEl = $('synth-flutter-val');
    const chorusSlider = $('synth-chorus');
    const chorusValEl = $('synth-chorus-val');
    const detuneSlider = $('synth-detune');
    const detuneValEl = $('synth-detune-val');
    const gainSlider = $('synth-gain');
    const gainValEl = $('synth-gain-val');

    const chordButtons = chordsContainer
      ? Array.from(chordsContainer.querySelectorAll('.chord-btn'))
      : Array.from(document.querySelectorAll('#synth-chords .chord-btn'));

    const keyButtons = keyboardContainer
      ? Array.from(keyboardContainer.querySelectorAll('.synth-key'))
      : Array.from(document.querySelectorAll('#synth-keyboard .synth-key'));

    const keyEntries = [];
    const keyByQwerty = new Map();

    keyButtons.forEach((btn, idx) => {
      const qwerty = String(btn.dataset.key || '').trim().toLowerCase();
      const fallback = KEY_FALLBACK[qwerty];
      const note = String(btn.dataset.note || (fallback ? fallback.note : `N${idx}`)).trim();
      const parsedFreq = parseFloat(btn.dataset.freq);
      const freq = Number.isFinite(parsedFreq) && parsedFreq > 0
        ? parsedFreq
        : (fallback ? fallback.freq : 261.63);
      const keyId = qwerty || `${note}@${idx}`;
      const entry = { btn, qwerty, note, freq, keyId };
      keyEntries.push(entry);
      if (qwerty) {
        keyByQwerty.set(qwerty, entry);
      }
    });

    Object.keys(KEY_FALLBACK).forEach((qwerty) => {
      if (!keyByQwerty.has(qwerty)) {
        const fb = KEY_FALLBACK[qwerty];
        keyByQwerty.set(qwerty, {
          btn: null,
          qwerty,
          note: fb.note,
          freq: fb.freq,
          keyId: qwerty,
        });
      }
    });

    const params = {
      cutoffHz: 1800,
      resonanceQ: 2.4,
      flutterNorm: 0.28,
      chorusNorm: 0.55,
      detuneCents: 12,
      gainNorm: 0.72,
    };

    function readNormalizedSlider(slider, fallbackNorm) {
      if (!slider) return fallbackNorm;
      const val = parseFloat(slider.value);
      if (!Number.isFinite(val)) return fallbackNorm;
      const max = parseFloat(slider.max);
      if (Number.isFinite(max) && max > 0 && max <= 1.0001) {
        return Math.max(0, Math.min(1, val));
      }
      return Math.max(0, Math.min(1, val / 100));
    }

    function readRawSlider(slider, fallbackVal) {
      if (!slider) return fallbackVal;
      const val = parseFloat(slider.value);
      return Number.isFinite(val) ? val : fallbackVal;
    }

    function updateSliderReadouts() {
      params.cutoffHz = Math.max(20, Math.min(20000, readRawSlider(cutoffSlider, 1800)));
      params.resonanceQ = Math.max(0.05, Math.min(25, readRawSlider(resonanceSlider, 2.4)));
      params.flutterNorm = readNormalizedSlider(flutterSlider, 0.28);
      params.chorusNorm = readNormalizedSlider(chorusSlider, 0.55);
      params.detuneCents = Math.max(0, Math.min(100, readRawSlider(detuneSlider, 12)));
      params.gainNorm = readNormalizedSlider(gainSlider, 0.72);

      if (cutoffValEl) cutoffValEl.textContent = `${Math.round(params.cutoffHz)} Hz`;
      if (resonanceValEl) resonanceValEl.textContent = `${params.resonanceQ.toFixed(1)} Q`;
      if (flutterValEl) flutterValEl.textContent = `${Math.round(params.flutterNorm * 100)}%`;
      if (chorusValEl) chorusValEl.textContent = `${Math.round(params.chorusNorm * 100)}%`;
      if (detuneValEl) {
        const ctText = Number.isInteger(params.detuneCents)
          ? String(params.detuneCents)
          : params.detuneCents.toFixed(1);
        detuneValEl.textContent = `${ctText} ct`;
      }
      if (gainValEl) gainValEl.textContent = `${Math.round(params.gainNorm * 100)}%`;
    }

    let ctx = null;
    let graphReady = false;
    let audioBlocked = false;
    let lowpassFilter = null;
    let dryGain = null;
    let chorusWetGain = null;
    let chorusDelayL = null;
    let chorusDelayR = null;
    let chorusPanL = null;
    let chorusPanR = null;
    let chorusLfoL = null;
    let chorusLfoR = null;
    let chorusDepthL = null;
    let chorusDepthR = null;
    let echoSendGain = null;
    let echoDelay = null;
    let echoFilter = null;
    let echoFeedbackGain = null;
    let echoReturnGain = null;
    let masterPreGain = null;
    let compressor = null;
    let analyser = null;
    let wowOsc = null;
    let flutterOsc = null;
    let wowWeightGain = null;
    let flutterWeightGain = null;
    let flutterDepthGain = null;

    let freqBins = null;
    let waveBins = null;

    let nextVoiceId = 1;
    const voicePool = [];
    const heldVoicesByKeyId = new Map();
    const physicallyHeldKeys = new Set();

    let holdEnabled = false;
    let seqRunning = false;
    let seqStepIndex = 0;
    let seqTimerId = null;
    let seqExpectedNextMs = 0;
    let activeChordName = null;
    let chordAutoReleaseTimer = null;
    let activePointerChordBtn = null;
    let chordReleaseOnPointerUp = false;
    let stoppingMode = false;

    const ctx2d = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;
    const initialAttrW = spectrumCanvas && spectrumCanvas.width ? spectrumCanvas.width : 600;
    const initialAttrH = spectrumCanvas && spectrumCanvas.height ? spectrumCanvas.height : 200;
    let canvasWidth = initialAttrW;
    let canvasHeight = initialAttrH;
    let rafId = null;
    let hasObservedSignal = false;
    let silentFrameStreak = 0;
    const peakCaps = new Float32Array(SPECTRUM_BARS);

    let vfdPalette = {
      bg: '#08120e',
      grid: 'rgba(123, 199, 166, 0.14)',
      trace: '#7bc7a6',
      accent: '#e4b86a',
      muted: '#5d977e',
    };

    function readVfdPalette() {
      if (typeof global.getComputedStyle !== 'function') return;
      const styles = global.getComputedStyle(document.documentElement);
      const getVar = (name, fallback) => {
        const val = styles.getPropertyValue(name).trim();
        return val || fallback;
      };
      vfdPalette = {
        bg: getVar('--vfd-bg', '#08120e'),
        grid: getVar('--vfd-grid', 'rgba(123, 199, 166, 0.14)'),
        trace: getVar('--vfd-trace', '#7bc7a6'),
        accent: getVar('--vfd-accent', '#e4b86a'),
        muted: getVar('--vfd-muted', '#5d977e'),
      };
    }

    function applyAudioParameters() {
      if (!ctx || !graphReady) return;
      const now = ctx.currentTime;
      const safeCutoff = Math.max(20, Math.min(ctx.sampleRate * 0.45, params.cutoffHz));

      lowpassFilter.frequency.setTargetAtTime(safeCutoff, now, 0.015);
      lowpassFilter.Q.setTargetAtTime(params.resonanceQ, now, 0.015);
      flutterDepthGain.gain.setTargetAtTime(params.flutterNorm * 32, now, 0.02);
      chorusWetGain.gain.setTargetAtTime(params.chorusNorm * 0.68, now, 0.02);
      masterPreGain.gain.setTargetAtTime(params.gainNorm * 0.9, now, 0.02);

      const halfDetune = params.detuneCents * 0.5;
      for (let i = 0; i < voicePool.length; i += 1) {
        const v = voicePool[i];
        if (!v.released && !v.disposed) {
          v.oscA.detune.setTargetAtTime(-halfDetune, now, 0.015);
          v.oscB.detune.setTargetAtTime(halfDetune, now, 0.015);
        }
      }
    }

    function buildAudioGraph() {
      if (graphReady || !ctx) return;
      const now = ctx.currentTime;

      lowpassFilter = ctx.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.setValueAtTime(
        Math.max(20, Math.min(ctx.sampleRate * 0.45, params.cutoffHz)),
        now
      );
      lowpassFilter.Q.setValueAtTime(params.resonanceQ, now);

      dryGain = ctx.createGain();
      dryGain.gain.setValueAtTime(0.82, now);

      chorusWetGain = ctx.createGain();
      chorusWetGain.gain.setValueAtTime(params.chorusNorm * 0.68, now);

      chorusDelayL = ctx.createDelay(0.1);
      chorusDelayL.delayTime.setValueAtTime(0.018, now);
      chorusDelayR = ctx.createDelay(0.1);
      chorusDelayR.delayTime.setValueAtTime(0.025, now);

      chorusLfoL = ctx.createOscillator();
      chorusLfoL.type = 'sine';
      chorusLfoL.frequency.setValueAtTime(0.34, now);
      chorusDepthL = ctx.createGain();
      chorusDepthL.gain.setValueAtTime(0.0032, now);

      chorusLfoR = ctx.createOscillator();
      chorusLfoR.type = 'sine';
      chorusLfoR.frequency.setValueAtTime(0.47, now);
      chorusDepthR = ctx.createGain();
      chorusDepthR.gain.setValueAtTime(0.0038, now);

      chorusLfoL.connect(chorusDepthL);
      chorusDepthL.connect(chorusDelayL.delayTime);
      chorusLfoR.connect(chorusDepthR);
      chorusDepthR.connect(chorusDelayR.delayTime);
      chorusLfoL.start(now);
      chorusLfoR.start(now);

      if (typeof ctx.createStereoPanner === 'function') {
        chorusPanL = ctx.createStereoPanner();
        chorusPanL.pan.setValueAtTime(-0.75, now);
        chorusPanR = ctx.createStereoPanner();
        chorusPanR.pan.setValueAtTime(0.75, now);
      } else {
        chorusPanL = ctx.createGain();
        chorusPanR = ctx.createGain();
      }

      echoSendGain = ctx.createGain();
      echoSendGain.gain.setValueAtTime(0.24, now);

      echoDelay = ctx.createDelay(1.0);
      echoDelay.delayTime.setValueAtTime(0.365, now);

      echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.setValueAtTime(2100, now);

      echoFeedbackGain = ctx.createGain();
      echoFeedbackGain.gain.setValueAtTime(0.24, now);

      echoReturnGain = ctx.createGain();
      echoReturnGain.gain.setValueAtTime(1.0, now);

      masterPreGain = ctx.createGain();
      masterPreGain.gain.setValueAtTime(params.gainNorm * 0.9, now);

      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, now);
      compressor.knee.setValueAtTime(12, now);
      compressor.ratio.setValueAtTime(5, now);
      compressor.attack.setValueAtTime(0.006, now);
      compressor.release.setValueAtTime(0.18, now);

      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      analyser.minDecibels = -95;
      analyser.maxDecibels = -12;

      freqBins = new Uint8Array(analyser.frequencyBinCount);
      waveBins = new Uint8Array(analyser.fftSize);

      wowOsc = ctx.createOscillator();
      wowOsc.type = 'sine';
      wowOsc.frequency.setValueAtTime(0.42, now);
      wowWeightGain = ctx.createGain();
      wowWeightGain.gain.setValueAtTime(0.65, now);

      flutterOsc = ctx.createOscillator();
      flutterOsc.type = 'sine';
      flutterOsc.frequency.setValueAtTime(3.6, now);
      flutterWeightGain = ctx.createGain();
      flutterWeightGain.gain.setValueAtTime(0.35, now);

      flutterDepthGain = ctx.createGain();
      flutterDepthGain.gain.setValueAtTime(params.flutterNorm * 32, now);

      wowOsc.connect(wowWeightGain);
      wowWeightGain.connect(flutterDepthGain);
      flutterOsc.connect(flutterWeightGain);
      flutterWeightGain.connect(flutterDepthGain);
      wowOsc.start(now);
      flutterOsc.start(now);

      lowpassFilter.connect(dryGain);
      dryGain.connect(masterPreGain);

      lowpassFilter.connect(chorusWetGain);
      chorusWetGain.connect(chorusDelayL);
      chorusWetGain.connect(chorusDelayR);
      chorusDelayL.connect(chorusPanL);
      chorusDelayR.connect(chorusPanR);
      chorusPanL.connect(masterPreGain);
      chorusPanR.connect(masterPreGain);

      lowpassFilter.connect(echoSendGain);
      echoSendGain.connect(echoDelay);
      echoDelay.connect(echoFilter);
      echoFilter.connect(echoFeedbackGain);
      echoFeedbackGain.connect(echoDelay);
      echoFilter.connect(echoReturnGain);
      echoReturnGain.connect(masterPreGain);

      masterPreGain.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      graphReady = true;
    }

    function ensureAudioContextFromGesture() {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) {
        audioBlocked = true;
        syncUI();
        return false;
      }

      if (!ctx) {
        try {
          ctx = new AudioCtx();
        } catch (_) {
          audioBlocked = true;
          syncUI();
          return false;
        }
      }

      if (!graphReady) {
        buildAudioGraph();
      }

      if (ctx.state === 'suspended') {
        try {
          const resumePromise = ctx.resume();
          if (resumePromise && typeof resumePromise.then === 'function') {
            resumePromise.then(
              () => {
                audioBlocked = ctx.state !== 'running';
                if (!audioBlocked) {
                  applyAudioParameters();
                  ensureSpectrumLoop();
                } else if (seqRunning) {
                  stopSequencer({ keepVoices: false });
                }
                syncUI();
              },
              () => {
                audioBlocked = true;
                if (seqRunning) {
                  stopSequencer({ keepVoices: false });
                }
                syncUI();
              }
            );
          }
        } catch (_) {
          audioBlocked = true;
          syncUI();
          return false;
        }
      } else {
        audioBlocked = ctx.state !== 'running';
      }

      return true;
    }

    function restoreEchoReturn() {
      if (!ctx || !graphReady) return;
      const now = ctx.currentTime;
      echoSendGain.gain.setTargetAtTime(0.24, now, 0.01);
      echoFeedbackGain.gain.setTargetAtTime(0.24, now, 0.01);
      echoReturnGain.gain.setTargetAtTime(1.0, now, 0.01);
    }

    function finalizeVoice(voice) {
      if (!voice || voice.disposed) return;
      voice.disposed = true;
      voice.released = true;

      if (voice.cleanupTimer) {
        clearTimeout(voice.cleanupTimer);
        voice.cleanupTimer = null;
      }

      const idx = voicePool.indexOf(voice);
      if (idx !== -1) {
        voicePool.splice(idx, 1);
      }

      if (voice.keyId && heldVoicesByKeyId.get(voice.keyId) === voice) {
        heldVoicesByKeyId.delete(voice.keyId);
      }

      try {
        if (flutterDepthGain) {
          flutterDepthGain.disconnect(voice.oscA.detune);
          flutterDepthGain.disconnect(voice.oscB.detune);
          flutterDepthGain.disconnect(voice.oscSub.detune);
        }
      } catch (_) {
        // Ignore if already disconnected
      }

      try { voice.oscA.onended = null; } catch (_) {}
      try { voice.oscA.disconnect(); } catch (_) {}
      try { voice.oscB.disconnect(); } catch (_) {}
      try { voice.oscSub.disconnect(); } catch (_) {}
      try { voice.subGain.disconnect(); } catch (_) {}
      try { voice.voiceGain.disconnect(); } catch (_) {}

      syncUI();
    }

    function getEstimatedGain(voice, now) {
      const elapsed = Math.max(0, now - voice.startTime);
      if (elapsed < 0.16) {
        return Math.max(0.0001, (elapsed / 0.16) * 0.26);
      }
      if (elapsed < 0.30) {
        const progress = (elapsed - 0.16) / 0.14;
        return 0.26 * Math.pow(0.22 / 0.26, progress);
      }
      return 0.22;
    }

    function cancelAndAnchorGain(voice, now) {
      const param = voice.voiceGain.gain;
      if (typeof param.cancelAndHoldAtTime === 'function') {
        param.cancelAndHoldAtTime(now);
        const held = Math.max(0.0001, param.value);
        param.setValueAtTime(held, now);
      } else {
        const current = Math.max(0.0001, param.value, getEstimatedGain(voice, now));
        param.cancelScheduledValues(now);
        param.setValueAtTime(current, now);
      }
    }

    function forceStopVoice(voice) {
      if (!voice || voice.disposed) return;
      voice.released = true;

      if (voice.cleanupTimer) {
        clearTimeout(voice.cleanupTimer);
        voice.cleanupTimer = null;
      }

      const idx = voicePool.indexOf(voice);
      if (idx !== -1) {
        voicePool.splice(idx, 1);
      }

      if (voice.keyId && heldVoicesByKeyId.get(voice.keyId) === voice) {
        heldVoicesByKeyId.delete(voice.keyId);
      }

      if (!ctx) {
        finalizeVoice(voice);
        return;
      }

      const now = ctx.currentTime;
      cancelAndAnchorGain(voice, now);
      voice.voiceGain.gain.linearRampToValueAtTime(0, now + 0.022);

      if (!voice.stopScheduled) {
        voice.stopScheduled = true;
        try {
          voice.oscA.stop(now + 0.026);
          voice.oscB.stop(now + 0.026);
          voice.oscSub.stop(now + 0.026);
        } catch (_) {}
      }

      voice.cleanupTimer = setTimeout(() => {
        finalizeVoice(voice);
      }, 32);
    }

    function releaseVoice(voice) {
      if (!voice || voice.disposed || voice.released) return;
      voice.released = true;

      if (voice.keyId && heldVoicesByKeyId.get(voice.keyId) === voice) {
        heldVoicesByKeyId.delete(voice.keyId);
      }

      if (!ctx) {
        finalizeVoice(voice);
        return;
      }

      const now = ctx.currentTime;
      cancelAndAnchorGain(voice, now);
      voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      voice.voiceGain.gain.linearRampToValueAtTime(0, now + 0.87);

      if (!voice.stopScheduled) {
        voice.stopScheduled = true;
        try {
          voice.oscA.stop(now + 0.88);
          voice.oscB.stop(now + 0.88);
          voice.oscSub.stop(now + 0.88);
        } catch (_) {}
      }

      voice.oscA.onended = () => {
        finalizeVoice(voice);
      };

      voice.cleanupTimer = setTimeout(() => {
        finalizeVoice(voice);
      }, 940);
    }

    function stealOldestVoiceIfFull() {
      while (voicePool.length >= MAX_VOICES) {
        let victim = null;
        for (let i = 0; i < voicePool.length; i += 1) {
          if (voicePool[i].released) {
            victim = voicePool[i];
            break;
          }
        }
        if (!victim) {
          victim = voicePool[0];
        }
        if (!victim) break;
        forceStopVoice(victim);
      }
    }

    function createVoice(note, freq, source, keyId) {
      if (!ensureAudioContextFromGesture() || !ctx || !graphReady) {
        return null;
      }

      stoppingMode = false;
      restoreEchoReturn();
      stealOldestVoiceIfFull();

      const now = ctx.currentTime;
      const halfDetune = params.detuneCents * 0.5;

      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.setValueAtTime(freq, now);
      oscA.detune.setValueAtTime(-halfDetune, now);

      const oscB = ctx.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.setValueAtTime(freq, now);
      oscB.detune.setValueAtTime(halfDetune, now);

      const oscSub = ctx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(freq * 0.5, now);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.16, now);

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.26, now + 0.16);
      voiceGain.gain.exponentialRampToValueAtTime(0.22, now + 0.30);

      flutterDepthGain.connect(oscA.detune);
      flutterDepthGain.connect(oscB.detune);
      flutterDepthGain.connect(oscSub.detune);

      oscA.connect(voiceGain);
      oscB.connect(voiceGain);
      oscSub.connect(subGain);
      subGain.connect(voiceGain);
      voiceGain.connect(lowpassFilter);

      oscA.start(now);
      oscB.start(now);
      oscSub.start(now);

      const voice = {
        id: nextVoiceId++,
        note,
        freq,
        source,
        keyId: keyId || null,
        startTime: now,
        released: false,
        disposed: false,
        stopScheduled: false,
        cleanupTimer: null,
        oscA,
        oscB,
        oscSub,
        subGain,
        voiceGain,
      };

      voicePool.push(voice);
      hasObservedSignal = false;
      silentFrameStreak = 0;
      ensureSpectrumLoop();
      return voice;
    }

    function releaseVoicesBySource(source) {
      for (let i = voicePool.length - 1; i >= 0; i -= 1) {
        const v = voicePool[i];
        if (v.source === source && !v.released) {
          releaseVoice(v);
        }
      }
    }

    function getActiveVoices() {
      const active = [];
      for (let i = 0; i < voicePool.length; i += 1) {
        if (!voicePool[i].released && !voicePool[i].disposed) {
          active.push(voicePool[i]);
        }
      }
      return active;
    }

    function freqMatches(a, b) {
      return Math.abs(a - b) < 1.0;
    }

    function syncUI() {
      const active = getActiveVoices();

      if (activeNotesEl) {
        if (active.length === 0) {
          activeNotesEl.textContent = 'ACTIVE VOICES: NONE';
        } else {
          const sorted = active.slice().sort((a, b) => a.freq - b.freq);
          const uniqueNotes = [];
          for (let i = 0; i < sorted.length; i += 1) {
            if (!uniqueNotes.includes(sorted[i].note)) {
              uniqueNotes.push(sorted[i].note);
            }
          }
          activeNotesEl.textContent = `ACTIVE VOICES: ${uniqueNotes.join(' \u00b7 ')}`;
        }
      }

      for (let i = 0; i < keyEntries.length; i += 1) {
        const entry = keyEntries[i];
        if (!entry.btn) continue;
        const isSounding = active.some((v) => freqMatches(v.freq, entry.freq));
        entry.btn.classList.toggle('is-active', isSounding);
        if (entry.btn.hasAttribute('aria-pressed')) {
          entry.btn.setAttribute('aria-pressed', isSounding ? 'true' : 'false');
        }
      }

      const hasChordVoice = active.some((v) => v.source === 'chord' || v.source === 'seq');
      const currentChord = hasChordVoice ? activeChordName : null;
      if (!hasChordVoice && !seqRunning) {
        activeChordName = null;
      }

      for (let i = 0; i < chordButtons.length; i += 1) {
        const btn = chordButtons[i];
        const isActiveChord = Boolean(currentChord && btn.dataset.chord === currentChord);
        btn.classList.toggle('is-active', isActiveChord);
        if (btn.hasAttribute('aria-pressed')) {
          btn.setAttribute('aria-pressed', isActiveChord ? 'true' : 'false');
        }
      }

      if (holdBtn) {
        holdBtn.classList.toggle('is-active', holdEnabled);
        holdBtn.setAttribute('aria-pressed', holdEnabled ? 'true' : 'false');
      }
      if (seqBtn) {
        seqBtn.classList.toggle('is-active', seqRunning);
        seqBtn.setAttribute('aria-pressed', seqRunning ? 'true' : 'false');
      }

      let badgeText = 'STANDBY // ZERO SIGNAL';
      let statusLabel = 'STANDBY';
      let statusClass = 'idle';

      if (audioBlocked) {
        badgeText = 'AUDIO BLOCKED // CLICK TO ENABLE';
        statusLabel = 'AUDIO BLOCKED';
        statusClass = 'error';
      } else if (seqRunning) {
        badgeText = 'SEQUENCE // 82 BPM';
        statusLabel = 'SEQUENCE // 82 BPM';
        statusClass = 'live';
      } else if (holdEnabled && active.length > 0) {
        badgeText = 'HOLD // LATCHED';
        statusLabel = 'HOLD // LATCHED';
        statusClass = 'live';
      } else if (active.length > 0) {
        badgeText = `LIVE // ${active.length} ${active.length === 1 ? 'VOICE' : 'VOICES'}`;
        statusLabel = 'ACTIVE // POLYPHONIC';
        statusClass = 'live';
      } else if (!stoppingMode && rafId !== null && hasObservedSignal) {
        badgeText = 'LIVE // DECAY';
        statusLabel = 'ACTIVE // POLYPHONIC';
        statusClass = 'live';
      }

      if (powerBadge) {
        powerBadge.textContent = badgeText;
        powerBadge.dataset.state = statusClass;
        powerBadge.classList.toggle('is-live', statusClass === 'live');
        powerBadge.classList.toggle('is-error', statusClass === 'error');
      }
      reportStatus(statusLabel, statusClass);
    }

    function clearChordTimer() {
      if (chordAutoReleaseTimer) {
        clearTimeout(chordAutoReleaseTimer);
        chordAutoReleaseTimer = null;
      }
    }

    function playChord(chordName, source) {
      const def = CHORD_DEFINITIONS[chordName];
      if (!def) return;

      clearChordTimer();
      releaseVoicesBySource(source);
      activeChordName = chordName;

      for (let i = 0; i < def.freqs.length; i += 1) {
        createVoice(def.notes[i], def.freqs[i], source, null);
      }
      syncUI();
    }

    function triggerManualChord(chordName, pointerBtn) {
      if (seqRunning) {
        stopSequencer({ keepVoices: false });
      }
      clearChordTimer();
      chordReleaseOnPointerUp = false;
      playChord(chordName, 'chord');

      if (!holdEnabled) {
        chordAutoReleaseTimer = setTimeout(() => {
          chordAutoReleaseTimer = null;
          if (holdEnabled) return;
          if (pointerBtn && activePointerChordBtn === pointerBtn) {
            chordReleaseOnPointerUp = true;
            return;
          }
          releaseVoicesBySource('chord');
          activeChordName = null;
          syncUI();
        }, CHORD_CLICK_HOLD_MS);
      }
    }

    function triggerKeyPress(entry) {
      if (!entry) return;
      const existing = heldVoicesByKeyId.get(entry.keyId);

      if (holdEnabled && existing && !existing.released) {
        releaseVoice(existing);
        syncUI();
        return;
      }

      if (existing && !existing.released) {
        releaseVoice(existing);
      }

      const voice = createVoice(entry.note, entry.freq, 'key', entry.keyId);
      if (voice) {
        heldVoicesByKeyId.set(entry.keyId, voice);
      }
      syncUI();
    }

    function releaseKeyPress(entry) {
      if (!entry) return;
      if (holdEnabled) return;
      const voice = heldVoicesByKeyId.get(entry.keyId);
      if (voice && !voice.released) {
        releaseVoice(voice);
        syncUI();
      }
    }

    function setHold(enabled) {
      holdEnabled = Boolean(enabled);
      if (holdEnabled) {
        clearChordTimer();
        chordReleaseOnPointerUp = false;
      } else {
        releaseVoicesBySource('chord');
        if (!seqRunning) {
          activeChordName = null;
        }
        heldVoicesByKeyId.forEach((voice, keyId) => {
          if (!physicallyHeldKeys.has(keyId)) {
            releaseVoice(voice);
          }
        });
      }
      syncUI();
    }

    function scheduleNextSeqStep() {
      if (!seqRunning) return;
      const chordName = SEQ_PROGRESSION[seqStepIndex % SEQ_PROGRESSION.length];
      seqStepIndex = (seqStepIndex + 1) % SEQ_PROGRESSION.length;

      playChord(chordName, 'seq');

      clearChordTimer();
      chordAutoReleaseTimer = setTimeout(() => {
        chordAutoReleaseTimer = null;
        if (seqRunning) {
          releaseVoicesBySource('seq');
          syncUI();
        }
      }, SEQ_GATE_MS);

      const nowMs = performance.now();
      seqExpectedNextMs += SEQ_STEP_MS;
      const delayMs = Math.max(20, seqExpectedNextMs - nowMs);
      seqTimerId = setTimeout(scheduleNextSeqStep, delayMs);
    }

    function startSequencer() {
      if (seqRunning) return;
      if (!ensureAudioContextFromGesture()) return;
      clearChordTimer();
      releaseVoicesBySource('chord');
      seqRunning = true;
      seqStepIndex = 0;
      seqExpectedNextMs = performance.now();
      scheduleNextSeqStep();
      syncUI();
    }

    function stopSequencer(optsSeq) {
      const keepVoices = optsSeq && optsSeq.keepVoices;
      if (seqTimerId) {
        clearTimeout(seqTimerId);
        seqTimerId = null;
      }
      clearChordTimer();
      seqRunning = false;
      if (!keepVoices) {
        releaseVoicesBySource('seq');
        activeChordName = null;
      }
      syncUI();
    }

    function panicStop() {
      stopSequencer({ keepVoices: true });
      clearChordTimer();
      stoppingMode = true;
      holdEnabled = false;
      activePointerChordBtn = null;
      chordReleaseOnPointerUp = false;
      activeChordName = null;
      physicallyHeldKeys.clear();
      heldVoicesByKeyId.clear();

      for (let i = voicePool.length - 1; i >= 0; i -= 1) {
        forceStopVoice(voicePool[i]);
      }

      if (ctx && graphReady) {
        const now = ctx.currentTime;
        echoSendGain.gain.setTargetAtTime(0, now, 0.008);
        echoFeedbackGain.gain.setTargetAtTime(0, now, 0.008);
        echoReturnGain.gain.setTargetAtTime(0, now, 0.008);
      }

      hasObservedSignal = false;
      silentFrameStreak = 0;
      peakCaps.fill(0);

      for (let i = 0; i < keyEntries.length; i += 1) {
        if (keyEntries[i].btn) {
          keyEntries[i].btn.classList.remove('is-active');
        }
      }
      for (let i = 0; i < chordButtons.length; i += 1) {
        chordButtons[i].classList.remove('is-active');
      }
      if (holdBtn) {
        holdBtn.classList.remove('is-active');
        holdBtn.setAttribute('aria-pressed', 'false');
      }
      if (seqBtn) {
        seqBtn.classList.remove('is-active');
        seqBtn.setAttribute('aria-pressed', 'false');
      }
      if (activeNotesEl) {
        activeNotesEl.textContent = 'ACTIVE VOICES: NONE';
      }
      if (powerBadge && !audioBlocked) {
        powerBadge.textContent = 'STANDBY // ZERO SIGNAL';
        powerBadge.dataset.state = 'idle';
        powerBadge.classList.remove('is-live', 'is-error');
      }
      if (!audioBlocked) {
        reportStatus('STANDBY', 'idle');
      }
      drawStandbyFrame();
    }

    function bindSlider(slider) {
      if (!slider) return;
      const onSlide = () => {
        updateSliderReadouts();
        applyAudioParameters();
      };
      slider.addEventListener('input', onSlide);
      slider.addEventListener('change', onSlide);
    }

    bindSlider(cutoffSlider);
    bindSlider(resonanceSlider);
    bindSlider(flutterSlider);
    bindSlider(chorusSlider);
    bindSlider(detuneSlider);
    bindSlider(gainSlider);

    chordButtons.forEach((btn) => {
      const chordName = btn.dataset.chord;
      if (!chordName || !CHORD_DEFINITIONS[chordName]) return;

      let handledPointer = false;

      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        handledPointer = true;
        activePointerChordBtn = btn;
        triggerManualChord(chordName, btn);
      });

      const onPointerRelease = () => {
        if (activePointerChordBtn === btn) {
          activePointerChordBtn = null;
        }
        if (chordReleaseOnPointerUp && !holdEnabled) {
          chordReleaseOnPointerUp = false;
          releaseVoicesBySource('chord');
          activeChordName = null;
          syncUI();
        }
        setTimeout(() => {
          handledPointer = false;
        }, 0);
      };

      btn.addEventListener('pointerup', onPointerRelease);
      btn.addEventListener('pointercancel', onPointerRelease);
      btn.addEventListener('pointerleave', () => {
        if (activePointerChordBtn === btn) {
          activePointerChordBtn = null;
          if (chordReleaseOnPointerUp && !holdEnabled) {
            chordReleaseOnPointerUp = false;
            releaseVoicesBySource('chord');
            activeChordName = null;
            syncUI();
          }
        }
      });

      btn.addEventListener('click', () => {
        if (handledPointer) {
          handledPointer = false;
          return;
        }
        triggerManualChord(chordName, null);
      });
    });

    keyEntries.forEach((entry) => {
      const btn = entry.btn;
      if (!btn) return;

      let handledPointer = false;
      let activePointerId = null;

      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        handledPointer = true;
        activePointerId = e.pointerId !== undefined ? e.pointerId : 'mouse';
        physicallyHeldKeys.add(entry.keyId);
        triggerKeyPress(entry);
      });

      const handleKeyPointerUp = (e) => {
        const pid = e.pointerId !== undefined ? e.pointerId : 'mouse';
        if (activePointerId !== null && pid !== activePointerId) return;
        activePointerId = null;
        physicallyHeldKeys.delete(entry.keyId);
        releaseKeyPress(entry);
        setTimeout(() => {
          handledPointer = false;
        }, 0);
      };

      btn.addEventListener('pointerup', handleKeyPointerUp);
      btn.addEventListener('pointercancel', handleKeyPointerUp);
      btn.addEventListener('pointerleave', (e) => {
        if (activePointerId !== null) {
          handleKeyPointerUp(e);
        }
      });

      btn.addEventListener('click', () => {
        if (handledPointer) {
          handledPointer = false;
          return;
        }
        triggerKeyPress(entry);
        if (!holdEnabled) {
          setTimeout(() => {
            if (!physicallyHeldKeys.has(entry.keyId)) {
              releaseKeyPress(entry);
            }
          }, 420);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      const key = String(e.key || '').toLowerCase();
      const entry = keyByQwerty.get(key);
      if (!entry) return;
      e.preventDefault();
      physicallyHeldKeys.add(entry.keyId);
      triggerKeyPress(entry);
    });

    document.addEventListener('keyup', (e) => {
      const key = String(e.key || '').toLowerCase();
      const entry = keyByQwerty.get(key);
      if (!entry) return;
      physicallyHeldKeys.delete(entry.keyId);
      releaseKeyPress(entry);
    });

    global.addEventListener('blur', () => {
      if (physicallyHeldKeys.size === 0) return;
      const heldSnapshot = Array.from(physicallyHeldKeys);
      physicallyHeldKeys.clear();
      if (!holdEnabled) {
        heldSnapshot.forEach((keyId) => {
          const voice = heldVoicesByKeyId.get(keyId);
          if (voice && !voice.released) {
            releaseVoice(voice);
          }
        });
        syncUI();
      }
    });

    if (holdBtn) {
      holdBtn.addEventListener('click', () => {
        ensureAudioContextFromGesture();
        setHold(!holdEnabled);
      });
    }

    if (seqBtn) {
      seqBtn.addEventListener('click', () => {
        if (seqRunning) {
          stopSequencer({ keepVoices: false });
        } else {
          startSequencer();
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        panicStop();
      });
    }

    if (powerBadge) {
      powerBadge.addEventListener('click', () => {
        if (audioBlocked || !ctx) {
          ensureAudioContextFromGesture();
          syncUI();
        }
      });
    }

    function freqToX(hz, left, plotWidth) {
      const clamped = Math.max(VFD_FREQ_MIN, Math.min(VFD_FREQ_MAX, hz));
      const norm = Math.log(clamped / VFD_FREQ_MIN) / Math.log(VFD_FREQ_MAX / VFD_FREQ_MIN);
      return left + norm * plotWidth;
    }

    function drawStaticVfdGrid(left, top, plotWidth, plotHeight) {
      if (!ctx2d) return;
      ctx2d.fillStyle = vfdPalette.bg;
      ctx2d.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx2d.save();
      ctx2d.lineWidth = 1;
      ctx2d.strokeStyle = vfdPalette.grid;

      const rows = 4;
      for (let r = 0; r <= rows; r += 1) {
        const y = Math.round(top + (plotHeight * r) / rows) + 0.5;
        ctx2d.beginPath();
        ctx2d.moveTo(left, y);
        ctx2d.lineTo(left + plotWidth, y);
        ctx2d.stroke();
      }

      ctx2d.font = '10px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx2d.textBaseline = 'top';

      let lastLabelRight = -Infinity;
      const maxLabelRight = left + plotWidth;
      for (let m = 0; m < GRID_MARKERS.length; m += 1) {
        const marker = GRID_MARKERS[m];
        const x = Math.round(freqToX(marker.hz, left, plotWidth)) + 0.5;
        ctx2d.strokeStyle = vfdPalette.grid;
        ctx2d.beginPath();
        ctx2d.moveTo(x, top);
        ctx2d.lineTo(x, top + plotHeight);
        ctx2d.stroke();

        ctx2d.fillStyle = vfdPalette.muted;
        const textAlignRight = m === GRID_MARKERS.length - 1;
        const labelW = ctx2d.measureText(marker.label).width;
        const labelLeft = textAlignRight ? x - 4 - labelW : x + 4;
        const labelRight = labelLeft + labelW;
        if (labelLeft >= lastLabelRight + 8 && labelRight <= maxLabelRight) {
          ctx2d.textAlign = textAlignRight ? 'right' : 'left';
          ctx2d.fillText(marker.label, textAlignRight ? x - 4 : x + 4, top + plotHeight + 5);
          lastLabelRight = labelRight;
        }
      }

      ctx2d.restore();
    }

    function drawStandbyFrame() {
      if (!ctx2d || !spectrumCanvas) return;
      const padX = 12;
      const padTop = 12;
      const padBottom = 22;
      const plotWidth = Math.max(40, canvasWidth - padX * 2);
      const plotHeight = Math.max(40, canvasHeight - padTop - padBottom);

      drawStaticVfdGrid(padX, padTop, plotWidth, plotHeight);

      const baselineY = Math.round(padTop + plotHeight * 0.5) + 0.5;
      ctx2d.save();
      ctx2d.strokeStyle = vfdPalette.trace;
      ctx2d.globalAlpha = 0.45;
      ctx2d.lineWidth = 1.25;
      ctx2d.beginPath();
      ctx2d.moveTo(padX, baselineY);
      ctx2d.lineTo(padX + plotWidth, baselineY);
      ctx2d.stroke();

      ctx2d.globalAlpha = 0.92;
      ctx2d.fillStyle = vfdPalette.muted;
      ctx2d.font = '600 11px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText('STANDBY // ZERO SIGNAL', padX + plotWidth * 0.5, baselineY - 14);
      ctx2d.restore();
    }

    function stopSpectrumLoop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function ensureSpectrumLoop() {
      if (!ctx2d || !spectrumCanvas) return;
      if (rafId === null) {
        rafId = requestAnimationFrame(renderSpectrumFrame);
      }
    }

    function renderSpectrumFrame() {
      rafId = null;
      if (!ctx2d || !spectrumCanvas) return;

      if (!ctx || !analyser || !freqBins || !waveBins || ctx.state !== 'running') {
        hasObservedSignal = false;
        peakCaps.fill(0);
        drawStandbyFrame();
        syncUI();
        return;
      }

      analyser.getByteFrequencyData(freqBins);
      analyser.getByteTimeDomainData(waveBins);

      let maxFreqByte = 0;
      for (let i = 0; i < freqBins.length; i += 1) {
        if (freqBins[i] > maxFreqByte) {
          maxFreqByte = freqBins[i];
        }
      }

      let maxWaveDev = 0;
      for (let i = 0; i < waveBins.length; i += 1) {
        const dev = Math.abs(waveBins[i] - 128);
        if (dev > maxWaveDev) {
          maxWaveDev = dev;
        }
      }

      const signalPresent = !(maxFreqByte < 2 && maxWaveDev <= 1);
      if (signalPresent) {
        hasObservedSignal = true;
        silentFrameStreak = 0;
      } else {
        silentFrameStreak += 1;
      }

      const activeVoicesCount = getActiveVoices().length;
      const shouldStayAlive = signalPresent || activeVoicesCount > 0 || seqRunning || (voicePool.length > 0 && silentFrameStreak < 16);

      if (!signalPresent && !shouldStayAlive) {
        hasObservedSignal = false;
        peakCaps.fill(0);
        drawStandbyFrame();
        syncUI();
        return;
      }

      if (!signalPresent) {
        drawStandbyFrame();
      } else {
        const padX = 12;
        const padTop = 12;
        const padBottom = 22;
        const plotWidth = Math.max(40, canvasWidth - padX * 2);
        const plotHeight = Math.max(40, canvasHeight - padTop - padBottom);

        drawStaticVfdGrid(padX, padTop, plotWidth, plotHeight);

        const nyquist = ctx.sampleRate * 0.5;
        const binHz = nyquist / freqBins.length;
        const slotW = plotWidth / SPECTRUM_BARS;
        const barW = Math.max(2, slotW - 1.5);
        const ratio = VFD_FREQ_MAX / VFD_FREQ_MIN;

        ctx2d.save();
        for (let b = 0; b < SPECTRUM_BARS; b += 1) {
          const fLow = VFD_FREQ_MIN * Math.pow(ratio, b / SPECTRUM_BARS);
          const fHigh = VFD_FREQ_MIN * Math.pow(ratio, (b + 1) / SPECTRUM_BARS);
          const fCenter = (fLow + fHigh) * 0.5;
          const idxStart = Math.max(1, Math.floor(fLow / binHz));
          const idxEnd = Math.min(freqBins.length - 1, Math.floor(fHigh / binHz));

          let byteVal = 0;
          if (idxEnd <= idxStart) {
            const exactBin = fCenter / binHz;
            const lo = Math.max(1, Math.min(freqBins.length - 1, Math.floor(exactBin)));
            const hi = Math.min(freqBins.length - 1, lo + 1);
            const frac = exactBin - lo;
            byteVal = freqBins[lo] * (1 - frac) + freqBins[hi] * frac;
          } else {
            for (let k = idxStart; k <= idxEnd; k += 1) {
              if (freqBins[k] > byteVal) {
                byteVal = freqBins[k];
              }
            }
          }

          const norm = Math.max(0, Math.min(1, byteVal / 255));
          if (norm >= peakCaps[b]) {
            peakCaps[b] = norm;
          } else {
            peakCaps[b] = Math.max(0, peakCaps[b] - 0.012);
          }

          const x = padX + b * slotW;
          const barH = norm * (plotHeight - 4);
          if (barH > 0.5) {
            ctx2d.fillStyle = vfdPalette.trace;
            ctx2d.globalAlpha = 0.28 + norm * 0.55;
            ctx2d.fillRect(x, padTop + plotHeight - barH, barW, barH);
          }

          if (peakCaps[b] > 0.01) {
            const capY = padTop + plotHeight - peakCaps[b] * (plotHeight - 4) - 2;
            ctx2d.fillStyle = vfdPalette.accent;
            ctx2d.globalAlpha = 0.92;
            ctx2d.fillRect(x, Math.max(padTop, capY), barW, 2);
          }
        }

        let triggerOffset = 0;
        const searchLimit = Math.floor(waveBins.length * 0.5);
        for (let i = 1; i < searchLimit; i += 1) {
          if (waveBins[i - 1] < 128 && waveBins[i] >= 128) {
            triggerOffset = i;
            break;
          }
        }

        const windowSamples = Math.min(waveBins.length - triggerOffset, 768);
        const midY = padTop + plotHeight * 0.45;
        const ampY = plotHeight * 0.36;

        ctx2d.strokeStyle = vfdPalette.accent;
        ctx2d.globalAlpha = 0.95;
        ctx2d.lineWidth = 1.75;
        ctx2d.lineJoin = 'round';
        ctx2d.beginPath();

        const sampleStep = Math.max(1, Math.floor(windowSamples / Math.max(120, Math.floor(plotWidth))));
        let first = true;
        for (let s = 0; s < windowSamples; s += sampleStep) {
          const px = padX + (s / Math.max(1, windowSamples - 1)) * plotWidth;
          const normalizedSample = (waveBins[triggerOffset + s] - 128) / 128;
          const py = midY - normalizedSample * ampY;
          if (first) {
            ctx2d.moveTo(px, py);
            first = false;
          } else {
            ctx2d.lineTo(px, py);
          }
        }
        ctx2d.stroke();
        ctx2d.restore();
      }

      if (shouldStayAlive) {
        rafId = requestAnimationFrame(renderSpectrumFrame);
      } else {
        stopSpectrumLoop();
      }
    }

    function resizeSpectrumCanvas() {
      if (!spectrumCanvas || !ctx2d) return;
      const rect = spectrumCanvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || spectrumCanvas.clientWidth || initialAttrW));
      const height = Math.max(1, Math.round(rect.height || spectrumCanvas.clientHeight || initialAttrH));
      const dpr = global.devicePixelRatio || 1;

      canvasWidth = width;
      canvasHeight = height;

      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (spectrumCanvas.width !== targetW || spectrumCanvas.height !== targetH) {
        spectrumCanvas.width = targetW;
        spectrumCanvas.height = targetH;
      }

      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (rafId === null) {
        drawStandbyFrame();
      }
    }

    if (spectrumCanvas) {
      if (typeof global.ResizeObserver === 'function') {
        const ro = new global.ResizeObserver(() => {
          resizeSpectrumCanvas();
        });
        ro.observe(spectrumCanvas);
      } else {
        global.addEventListener('resize', resizeSpectrumCanvas);
      }
    }

    const onThemeChange = () => {
      readVfdPalette();
      if (rafId === null) {
        drawStandbyFrame();
      }
    };
    document.addEventListener('nm:themechange', onThemeChange);
    global.addEventListener('nm:themechange', onThemeChange);

    readVfdPalette();
    updateSliderReadouts();
    resizeSpectrumCanvas();
    syncUI();
  }

  /* ==========================================================================
     SECTION 2: Meteorology, KMLB AFD & Central Florida NEXRAD Module
     ========================================================================== */

  const NWS_USER_AGENT = 'midnightatrium.github.io (Nippon Magnetics Div.04 Telemetry)';
  const NWS_OBS_HEADERS = {
    'User-Agent': NWS_USER_AGENT,
    Accept: 'application/geo+json',
  };
  const NWS_LD_HEADERS = {
    'User-Agent': NWS_USER_AGENT,
    Accept: 'application/ld+json',
  };

  const STATIONS = {
    KISM: {
      id: 'KISM',
      fallbackName: 'Kissimmee Gateway Airport',
      url: 'https://api.weather.gov/stations/KISM/observations/latest',
    },
    KMCO: {
      id: 'KMCO',
      fallbackName: 'Orlando International Airport',
      url: 'https://api.weather.gov/stations/KMCO/observations/latest',
    },
  };

  const AFD_LIST_URL = 'https://api.weather.gov/products/types/AFD/locations/MLB';
  const AFD_SECTION_RE = /^\.([A-Z][A-Z0-9 /\-]{2,28})\.\.\./gm;

  const RADAR_CENTER = [28.33, -81.65];
  const RADAR_DEFAULT_ZOOM = 8;
  const DEFAULT_RADAR_OPACITY = 0.72;
  const IEM_NEXRAD_BASE_URL =
    'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
  const ESRI_BASEMAPS = {
    roppongi: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ref: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    },
    atrium: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ref: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    },
  };
  const REFERENCE_MARKERS = [
    { label: 'Four Corners, FL', coords: [28.33, -81.65], radius: 6, primary: true },
    { label: 'KISM — Kissimmee Gateway', coords: [28.29, -81.44], radius: 5, primary: false },
    { label: 'KMCO — Orlando Intl', coords: [28.43, -81.31], radius: 5, primary: false },
  ];

  const COMPASS_16 = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];

  function isValidNwsProductUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('https://api.weather.gov/products/')) {
      return false;
    }
    try {
      const parsed = new URL(rawUrl);
      return (
        parsed.protocol === 'https:' &&
        parsed.hostname === 'api.weather.gov' &&
        parsed.pathname.startsWith('/products/')
      );
    } catch (_) {
      return false;
    }
  }

  function convertTemp(metricObj) {
    const val = toFiniteNumber(metricObj?.value);
    if (val === null) return null;

    const unit = String(metricObj?.unitCode || '').toLowerCase();
    let c;
    let f;

    if (unit.includes('degf')) {
      f = val;
      c = ((f - 32) * 5) / 9;
    } else if (unit === 'wmounit:k' || unit.endsWith(':k')) {
      c = val - 273.15;
      f = (c * 9) / 5 + 32;
    } else {
      c = val;
      f = (c * 9) / 5 + 32;
    }

    return {
      f,
      c,
      fStr: `${f.toFixed(1)} °F`,
      cStr: `${c.toFixed(1)} °C`,
    };
  }

  function convertPressureHpa(barometricObj, seaLevelObj) {
    const baroVal = toFiniteNumber(barometricObj?.value);
    const seaVal = toFiniteNumber(seaLevelObj?.value);
    const targetObj = baroVal !== null ? barometricObj : seaVal !== null ? seaLevelObj : null;
    const raw = baroVal !== null ? baroVal : seaVal;
    if (raw === null) return '—';

    const unit = String(targetObj?.unitCode || '').toLowerCase();
    const hpa = unit.includes('hpa') || unit.includes('mb') ? raw : raw / 100;
    return `${hpa.toFixed(1)} hPa`;
  }

  function convertWindSpeed(metricObj, fallbackUnitCode) {
    const val = toFiniteNumber(metricObj?.value);
    if (val === null) return null;

    const unit = String(metricObj?.unitCode || fallbackUnitCode || '').toLowerCase();
    let mph;
    let kt;

    if (unit.includes('m_s-1') || unit.includes('m/s')) {
      mph = val * 2.23694;
      kt = val * 1.94384;
    } else if (/(^|:|\b)(kt|kn|knots?)($|\b)/i.test(unit)) {
      mph = val * 1.15078;
      kt = val;
    } else if (unit.includes('mi_h') || unit.includes('[mi_i]/h') || unit.includes('mph')) {
      mph = val;
      kt = val * 0.868976;
    } else {
      mph = val * 0.621371;
      kt = val * 0.539957;
    }

    return { raw: val, mph, kt };
  }

  function formatWind(props) {
    const speed = convertWindSpeed(props.windSpeed);
    const gust = convertWindSpeed(props.windGust, props.windSpeed?.unitCode);
    const dirDeg = toFiniteNumber(props.windDirection?.value);

    let speedText = '—';
    if (speed !== null) {
      if (speed.raw === 0) {
        speedText = 'CALM (0 mph)';
      } else {
        speedText = `${Math.round(speed.mph)} mph (${Math.round(speed.kt)} kt)`;
        if (gust !== null && gust.raw > 0) {
          speedText += ` · G ${Math.round(gust.mph)} mph (${Math.round(gust.kt)} kt)`;
        }
      }
    }

    let dirText = '—';
    if (dirDeg !== null) {
      const normalized = Math.round(((dirDeg % 360) + 360) % 360) % 360;
      const idx = Math.round(normalized / 22.5) % 16;
      dirText = `${COMPASS_16[idx]} (${normalized}°)`;
    } else if (speed !== null && speed.raw > 0) {
      dirText = 'VRB';
    } else if (speed !== null && speed.raw === 0) {
      dirText = 'CALM';
    }

    return { speedText, dirText };
  }

  function initWeatherObservations({ setStatus: reportStatus }) {
    const kismBtn = $('wx-station-kism');
    const kmcoBtn = $('wx-station-kmco');
    const refreshBtn = $('wx-refresh');
    const retryBtn = $('wx-retry');

    const loadingEl = $('wx-loading');
    const errorEl = $('wx-error');
    const errorMsgEl = $('wx-error-msg');
    const contentEl = $('wx-content');

    const stationLabelEl = $('wx-station-label');
    const stationBadgeEl = $('wx-station-badge');
    const conditionEl = $('wx-condition');
    const timestampEl = $('wx-timestamp');

    const tempFEl = $('wx-temp-f');
    const tempCEl = $('wx-temp-c');
    const dewFEl = $('wx-dewpoint-f');
    const dewCEl = $('wx-dewpoint-c');
    const pressureEl = $('wx-pressure-hpa');
    const humidityEl = $('wx-humidity');
    const windEl = $('wx-wind');
    const windDirEl = $('wx-wind-dir');

    let activeStation = 'KISM';
    let requestCounter = 0;
    let activeController = null;

    function updateStationButtons(stationId) {
      const isKism = stationId === 'KISM';
      if (kismBtn) {
        kismBtn.classList.toggle('is-active', isKism);
        kismBtn.setAttribute('aria-pressed', String(isKism));
      }
      if (kmcoBtn) {
        kmcoBtn.classList.toggle('is-active', !isKism);
        kmcoBtn.setAttribute('aria-pressed', String(!isKism));
      }
    }

    function showLoading() {
      setElementVisible(loadingEl, true);
      setElementVisible(errorEl, false);
      setElementVisible(contentEl, false);
    }

    function showError(message) {
      setElementVisible(loadingEl, false);
      setElementVisible(contentEl, false);
      setText(errorMsgEl, message);
      setElementVisible(errorEl, true);
    }

    function showContent(stationId, props, usedFallback) {
      const stationMeta = STATIONS[stationId] || STATIONS.KISM;
      const stationName =
        typeof props.stationName === 'string' && props.stationName.trim()
          ? props.stationName.trim()
          : stationMeta.fallbackName;

      const temp = convertTemp(props.temperature);
      const dew = convertTemp(props.dewpoint);
      const pressureText = convertPressureHpa(props.barometricPressure, props.seaLevelPressure);
      const rhVal = toFiniteNumber(props.relativeHumidity?.value);
      const rhText = rhVal !== null ? `${Math.round(rhVal)}%` : '—';
      const { speedText, dirText } = formatWind(props);

      const conditionText =
        typeof props.textDescription === 'string' && props.textDescription.trim()
          ? props.textDescription.trim()
          : '—';

      const badgeText = usedFallback
        ? 'KMCO // AUTO-FALLBACK'
        : stationId === 'KISM'
          ? 'KISM // PRIMARY'
          : 'KMCO // SECONDARY';

      setText(stationLabelEl, `${stationId} — ${stationName}`);
      setText(stationBadgeEl, badgeText);
      setText(conditionEl, conditionText);
      setText(timestampEl, `OBS ${formatEtAndUtc(props.timestamp)}`);

      setText(tempFEl, temp ? temp.fStr : '—');
      setText(tempCEl, temp ? temp.cStr : '—');
      setText(dewFEl, dew ? dew.fStr : '—');
      setText(dewCEl, dew ? dew.cStr : '—');
      setText(pressureEl, pressureText);
      setText(humidityEl, rhText);
      setText(windEl, speedText);
      setText(windDirEl, dirText);

      updateStationButtons(stationId);
      setElementVisible(loadingEl, false);
      setElementVisible(errorEl, false);
      setElementVisible(contentEl, true);

      const statusTemp = temp ? temp.fStr : '—';
      reportStatus('status-weather', `${stationId} // ${statusTemp}`, 'live');
    }

    async function fetchStationProps(stationId, signal) {
      const stationMeta = STATIONS[stationId];
      const data = await fetchJson(stationMeta.url, NWS_OBS_HEADERS, signal);
      if (!data || typeof data !== 'object' || !data.properties || typeof data.properties !== 'object') {
        throw new Error(`Malformed observation payload from ${stationId}.`);
      }
      return data.properties;
    }

    async function loadObservation(targetStation, allowFallback) {
      const reqId = ++requestCounter;
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      const { signal } = activeController;

      updateStationButtons(targetStation);
      showLoading();
      reportStatus('status-weather', 'SYNCING', 'standby');

      let resolvedStation = targetStation;
      let resolvedProps = null;
      let usedFallback = false;
      let kismFailureReason = null;

      try {
        if (targetStation === 'KISM') {
          try {
            const props = await fetchStationProps('KISM', signal);
            const tempNull = toFiniteNumber(props.temperature?.value) === null;
            const presNull = toFiniteNumber(props.barometricPressure?.value) === null;

            if (tempNull && presNull) {
              if (!allowFallback) {
                throw new Error('KISM observation has null temperature and barometric pressure.');
              }
              kismFailureReason = 'KISM returned null temperature and pressure';
            } else {
              resolvedProps = props;
            }
          } catch (err) {
            if (err?.name === 'AbortError') throw err;
            if (!allowFallback) throw err;
            kismFailureReason = err?.message || 'KISM request failed';
          }

          if (!resolvedProps && allowFallback) {
            resolvedStation = 'KMCO';
            usedFallback = true;
            resolvedProps = await fetchStationProps('KMCO', signal);
          }
        } else {
          resolvedProps = await fetchStationProps('KMCO', signal);
        }

        if (reqId !== requestCounter || signal.aborted) return;

        activeStation = resolvedStation;
        showContent(resolvedStation, resolvedProps, usedFallback);
      } catch (err) {
        if (err?.name === 'AbortError' || reqId !== requestCounter) return;

        const detail = err?.message || 'Unable to reach api.weather.gov.';
        const fullMessage = kismFailureReason
          ? `KISM (${kismFailureReason}) and KMCO fallback both failed: ${detail}`
          : `${targetStation} observation unavailable: ${detail}`;

        showError(fullMessage);
        reportStatus('status-weather', 'ERROR', 'error');
      }
    }

    if (kismBtn) {
      kismBtn.addEventListener('click', () => {
        activeStation = 'KISM';
        loadObservation('KISM', true);
      });
    }

    if (kmcoBtn) {
      kmcoBtn.addEventListener('click', () => {
        activeStation = 'KMCO';
        loadObservation('KMCO', false);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadObservation(activeStation, activeStation === 'KISM');
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadObservation(activeStation, activeStation === 'KISM');
      });
    }

    loadObservation('KISM', true);
  }

  function initAfd({ setStatus: reportStatus }) {
    const refreshBtn = $('afd-refresh');
    const copyBtn = $('afd-copy');
    const expandBtn = $('afd-expand');
    const retryBtn = $('afd-retry');

    const metaEl = $('afd-meta');
    const sectionsEl = $('afd-sections');
    const loadingEl = $('afd-loading');
    const errorEl = $('afd-error');
    const errorMsgEl = $('afd-error-msg');
    const textEl = $('afd-text');

    const copyLabelTarget = getButtonLabelTarget(copyBtn);
    const expandLabelTarget = getButtonLabelTarget(expandBtn);
    const originalCopyLabel = readLabelTarget(copyLabelTarget, 'COPY');
    const originalExpandLabel = readLabelTarget(expandLabelTarget, 'EXPAND');

    let currentAfdText = '';
    let copyResetTimer = null;
    let requestCounter = 0;
    let activeController = null;

    function showLoading() {
      setElementVisible(loadingEl, true);
      setElementVisible(errorEl, false);
      setElementVisible(textEl, false);
    }

    function showError(message) {
      setElementVisible(loadingEl, false);
      setElementVisible(textEl, false);
      setText(errorMsgEl, message);
      setElementVisible(errorEl, true);
    }

    function scrollToSectionAnchor(anchorEl) {
      if (!anchorEl) return;
      if (textEl && textEl.scrollHeight > textEl.clientHeight + 2) {
        const anchorRect = anchorEl.getBoundingClientRect();
        const containerRect = textEl.getBoundingClientRect();
        const targetTop = Math.max(0, anchorRect.top - containerRect.top + textEl.scrollTop - 8);
        textEl.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        anchorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function renderAfdTextAndSections(rawText) {
      const normalized = rawText.replace(/\r\n/g, '\n');
      currentAfdText = normalized;

      if (textEl) {
        textEl.replaceChildren();
      }
      if (sectionsEl) {
        sectionsEl.replaceChildren();
      }

      AFD_SECTION_RE.lastIndex = 0;
      const matches = [];
      let match;
      while ((match = AFD_SECTION_RE.exec(normalized)) !== null) {
        matches.push({
          title: match[1].trim(),
          fullHeader: match[0],
          index: match.index,
        });
      }

      if (!textEl) return;

      if (matches.length === 0) {
        textEl.textContent = normalized;
        return;
      }

      const textFrag = document.createDocumentFragment();
      const chipsFrag = document.createDocumentFragment();
      const chipButtons = [];
      let cursor = 0;

      matches.forEach((sec, idx) => {
        if (sec.index > cursor) {
          textFrag.appendChild(document.createTextNode(normalized.slice(cursor, sec.index)));
        }

        const anchor = document.createElement('span');
        anchor.className = 'afd-section-anchor';
        anchor.dataset.section = sec.title;
        anchor.textContent = sec.fullHeader;
        textFrag.appendChild(anchor);
        cursor = sec.index + sec.fullHeader.length;

        if (sectionsEl) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'afd-chip';
          chip.textContent = sec.title;
          chip.addEventListener('click', () => {
            chipButtons.forEach((btn, i) => {
              btn.classList.toggle('is-active', i === idx);
            });
            scrollToSectionAnchor(anchor);
          });
          chipButtons.push(chip);
          chipsFrag.appendChild(chip);
        }
      });

      if (cursor < normalized.length) {
        textFrag.appendChild(document.createTextNode(normalized.slice(cursor)));
      }

      textEl.appendChild(textFrag);
      if (sectionsEl) {
        sectionsEl.appendChild(chipsFrag);
      }
    }

    async function loadAfd() {
      const reqId = ++requestCounter;
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      const { signal } = activeController;

      showLoading();
      reportStatus('status-afd', 'SYNCING', 'standby');

      try {
        const listData = await fetchJson(AFD_LIST_URL, NWS_LD_HEADERS, signal);
        const graph = listData?.['@graph'];
        if (!Array.isArray(graph) || graph.length === 0) {
          throw new Error('No AFD products returned for KMLB.');
        }

        const latestEntry = graph[0];
        const productUrl = latestEntry?.['@id'];
        if (!isValidNwsProductUrl(productUrl)) {
          throw new Error('AFD product URL failed validation.');
        }

        const productData = await fetchJson(productUrl, NWS_LD_HEADERS, signal);
        if (reqId !== requestCounter || signal.aborted) return;

        if (typeof productData?.productText !== 'string' || !productData.productText.trim()) {
          throw new Error('NWS AFD response contained empty product text.');
        }

        const office =
          typeof productData.issuingOffice === 'string' && productData.issuingOffice.trim()
            ? productData.issuingOffice.trim()
            : typeof latestEntry.issuingOffice === 'string' && latestEntry.issuingOffice.trim()
              ? latestEntry.issuingOffice.trim()
              : 'KMLB';
        const issuanceTime = productData.issuanceTime || latestEntry.issuanceTime;

        setText(metaEl, `${office} // ISSUED ${formatEtAndUtc(issuanceTime)}`);
        renderAfdTextAndSections(productData.productText);

        setElementVisible(loadingEl, false);
        setElementVisible(errorEl, false);
        setElementVisible(textEl, true);

        reportStatus('status-afd', 'KMLB // LIVE', 'live');
      } catch (err) {
        if (err?.name === 'AbortError' || reqId !== requestCounter) return;

        currentAfdText = '';
        if (sectionsEl) sectionsEl.replaceChildren();
        setText(metaEl, 'KMLB // UNAVAILABLE');
        showError(err?.message || 'Unable to load NWS Melbourne AFD.');
        reportStatus('status-afd', 'ERROR', 'error');
      }
    }

    async function copyAfdText() {
      if (!currentAfdText || !copyBtn) return;

      let copied = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(currentAfdText);
          copied = true;
        }
      } catch (_) {
        copied = false;
      }

      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = currentAfdText;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (_) {
          copied = false;
        }
      }

      if (copyResetTimer) {
        global.clearTimeout(copyResetTimer);
      }
      writeLabelTarget(copyLabelTarget, copied ? 'COPIED' : 'COPY FAILED');
      copyResetTimer = global.setTimeout(() => {
        writeLabelTarget(copyLabelTarget, originalCopyLabel);
      }, 1800);
    }

    function toggleExpand() {
      if (!textEl || !expandBtn) return;
      const expanded = textEl.classList.toggle('is-expanded');
      expandBtn.setAttribute('aria-expanded', String(expanded));
      expandBtn.classList.toggle('is-active', expanded);
      writeLabelTarget(expandLabelTarget, expanded ? 'COLLAPSE' : originalExpandLabel);
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadAfd);
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', loadAfd);
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', copyAfdText);
    }
    if (expandBtn) {
      expandBtn.setAttribute('aria-expanded', String(Boolean(textEl && textEl.classList.contains('is-expanded'))));
      expandBtn.addEventListener('click', toggleExpand);
    }

    loadAfd();
  }

  function initRadar({ getTheme: getCurrentTheme }) {
    const mapEl = $('nexrad-map');
    const radarErrorEl = $('radar-error');
    const toggleBtn = $('radar-toggle-btn');
    const opacityInput = $('radar-opacity');
    const opacityValEl = $('radar-opacity-val');
    const recenterBtn = $('radar-recenter-btn');
    const refreshBtn = $('radar-refresh-btn');
    const radarStatusEl = $('radar-status');

    function setRadarStatus(text, state) {
      setText(radarStatusEl, text);
      if (!radarStatusEl) return;
      radarStatusEl.classList.remove('is-live', 'is-standby', 'is-error');
      if (state) {
        radarStatusEl.classList.add(`is-${state}`);
        radarStatusEl.dataset.state = state;
      }
    }

    function showRadarError(message) {
      if (!radarErrorEl) return;
      const targetChild = radarErrorEl.querySelector(
        '[data-radar-error-msg], .state-box__text, .radar-error-msg, .error-msg, p'
      );

      if (targetChild) {
        targetChild.textContent = message;
      } else if (radarErrorEl.children.length === 0) {
        radarErrorEl.textContent = message;
      } else {
        let span = radarErrorEl.querySelector('.radar-error-text');
        if (!span) {
          span = document.createElement('span');
          span.className = 'radar-error-text';
          radarErrorEl.appendChild(span);
        }
        span.textContent = message;
      }
      setElementVisible(radarErrorEl, true);
    }

    function hideRadarError() {
      setElementVisible(radarErrorEl, false);
    }

    if (typeof global.L === 'undefined') {
      showRadarError('Leaflet mapping library failed to load.');
      setRadarStatus('RADAR // LEAFLET UNAVAILABLE', 'error');
      return;
    }

    if (!mapEl) return;

    hideRadarError();

    const L = global.L;
    let currentTheme = getCurrentTheme() === 'atrium' ? 'atrium' : 'roppongi';
    let radarVisible = true;
    let tileLoads = 0;
    let tileErrors = 0;
    let lastUpdatedAt = null;

    const map = L.map('nexrad-map', {
      center: RADAR_CENTER,
      zoom: RADAR_DEFAULT_ZOOM,
      zoomControl: true,
    });

    function createBasemapLayer(theme) {
      const cfg = ESRI_BASEMAPS[theme] || ESRI_BASEMAPS.roppongi;
      const baseTiles = L.tileLayer(cfg.base, {
        maxZoom: 16,
        zIndex: 1,
        attribution: 'Basemap &copy; Esri, HERE, Garmin, OpenStreetMap contributors',
      });
      const refTiles = L.tileLayer(cfg.ref, {
        maxZoom: 16,
        zIndex: 2,
      });
      return L.layerGroup([baseTiles, refTiles]);
    }

    let basemapLayer = createBasemapLayer(currentTheme).addTo(map);

    if (opacityInput) {
      opacityInput.value = String(Math.round(DEFAULT_RADAR_OPACITY * 100));
    }
    setText(opacityValEl, `${Math.round(DEFAULT_RADAR_OPACITY * 100)}%`);

    const nexradLayer = L.tileLayer(IEM_NEXRAD_BASE_URL, {
      opacity: DEFAULT_RADAR_OPACITY,
      maxNativeZoom: 12,
      zIndex: 10,
      attribution: 'NEXRAD N0Q © IEM / NOAA',
    }).addTo(map);

    function markerStyleForTheme(theme, isPrimary) {
      if (theme === 'atrium') {
        return {
          color: isPrimary ? '#0061a4' : '#0f766e',
          fillColor: isPrimary ? '#38bdf8' : '#14b8a6',
          fillOpacity: 0.9,
          weight: 2,
        };
      }
      return {
        color: isPrimary ? '#f59e0b' : '#2dd4bf',
        fillColor: isPrimary ? '#fbbf24' : '#14b8a6',
        fillOpacity: 0.9,
        weight: 2,
      };
    }

    const markerLayerGroup = L.layerGroup().addTo(map);
    const markerEntries = REFERENCE_MARKERS.map((item) => {
      const marker = L.circleMarker(item.coords, {
        radius: item.radius,
        ...markerStyleForTheme(currentTheme, item.primary),
      });
      marker.bindTooltip(item.label, { direction: 'top', offset: [0, -6] });
      marker.addTo(markerLayerGroup);
      return { marker, primary: item.primary };
    });

    const toggleLabelTarget = getButtonLabelTarget(toggleBtn);

    function syncToggleButton() {
      if (!toggleBtn) return;
      toggleBtn.classList.toggle('is-active', radarVisible);
      toggleBtn.setAttribute('aria-pressed', String(radarVisible));
      writeLabelTarget(toggleLabelTarget, radarVisible ? 'RADAR ON' : 'RADAR OFF');
    }

    function setRadarVisible(nextVisible) {
      radarVisible = Boolean(nextVisible);
      if (radarVisible) {
        if (!map.hasLayer(nexradLayer)) {
          nexradLayer.addTo(map);
        }
        nexradLayer.bringToFront();
        if (lastUpdatedAt) {
          setRadarStatus(`IEM N0Q LIVE // UPDATED ${formatShortClock(lastUpdatedAt)}`, 'live');
        } else {
          setRadarStatus('IEM N0Q // LOADING TILES', 'standby');
        }
      } else {
        if (map.hasLayer(nexradLayer)) {
          map.removeLayer(nexradLayer);
        }
        setRadarStatus('IEM N0Q // OVERLAY OFF', 'standby');
      }
      syncToggleButton();
    }

    syncToggleButton();
    setRadarStatus('IEM N0Q // LOADING TILES', 'standby');

    nexradLayer.on('tileload', () => {
      tileLoads += 1;
      lastUpdatedAt = new Date();
      hideRadarError();
      if (radarVisible) {
        setRadarStatus(`IEM N0Q LIVE // UPDATED ${formatShortClock(lastUpdatedAt)}`, 'live');
      }
    });

    nexradLayer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 4 && tileLoads === 0) {
        showRadarError('IEM NEXRAD tiles unreachable.');
        setRadarStatus('IEM N0Q // TILES UNREACHABLE', 'error');
      }
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        setRadarVisible(!radarVisible);
      });
    }

    if (opacityInput) {
      const onOpacityChange = () => {
        const parsed = Number(opacityInput.value);
        const pct = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 72;
        nexradLayer.setOpacity(pct / 100);
        setText(opacityValEl, `${Math.round(pct)}%`);
      };
      opacityInput.addEventListener('input', onOpacityChange);
      opacityInput.addEventListener('change', onOpacityChange);
    }

    if (recenterBtn) {
      recenterBtn.addEventListener('click', () => {
        map.setView(RADAR_CENTER, RADAR_DEFAULT_ZOOM);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        tileLoads = 0;
        tileErrors = 0;
        hideRadarError();
        if (!radarVisible) {
          setRadarVisible(true);
        }
        const now = new Date();
        setRadarStatus(`IEM N0Q // REFRESHED ${formatShortClock(now)}`, 'standby');
        nexradLayer.setUrl(`${IEM_NEXRAD_BASE_URL}?_ts=${now.getTime()}`);
      });
    }

    function applyRadarTheme(nextTheme) {
      const normalized = nextTheme === 'atrium' ? 'atrium' : 'roppongi';
      if (normalized === currentTheme) return;
      currentTheme = normalized;

      const prevBasemap = basemapLayer;
      basemapLayer = createBasemapLayer(currentTheme).addTo(map);
      if (typeof basemapLayer.eachLayer === 'function') {
        basemapLayer.eachLayer((layer) => {
          if (typeof layer.bringToBack === 'function') {
            layer.bringToBack();
          }
        });
      } else if (typeof basemapLayer.bringToBack === 'function') {
        basemapLayer.bringToBack();
      }
      if (prevBasemap && map.hasLayer(prevBasemap)) {
        map.removeLayer(prevBasemap);
      }
      if (radarVisible && map.hasLayer(nexradLayer)) {
        nexradLayer.bringToFront();
      }
      markerEntries.forEach(({ marker, primary }) => {
        marker.setStyle(markerStyleForTheme(currentTheme, primary));
      });
    }

    global.addEventListener('nm:themechange', (event) => {
      const detail = event?.detail;
      const nextTheme =
        detail && typeof detail === 'object'
          ? detail.theme
          : typeof detail === 'string'
            ? detail
            : getCurrentTheme();
      applyRadarTheme(nextTheme || getCurrentTheme());
    });

    global.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    if (typeof global.ResizeObserver !== 'undefined') {
      let resizeRaf = null;
      const observer = new global.ResizeObserver(() => {
        if (resizeRaf !== null) {
          global.cancelAnimationFrame(resizeRaf);
        }
        resizeRaf = global.requestAnimationFrame(() => {
          resizeRaf = null;
          map.invalidateSize();
        });
      });
      observer.observe(mapEl);
    } else {
      global.addEventListener('resize', () => {
        map.invalidateSize();
      });
    }
  }

  function initWeather(options) {
    const opts = options || {};
    const reportStatus = typeof opts.setStatus === 'function' ? opts.setStatus : () => {};
    const getCurrentTheme = typeof opts.getTheme === 'function' ? opts.getTheme : () => 'roppongi';

    initWeatherObservations({ setStatus: reportStatus });
    initAfd({ setStatus: reportStatus });
    initRadar({ getTheme: getCurrentTheme });
  }

  /* ==========================================================================
     SECTION 3: Live GitHub Public Repositories Module
     ========================================================================== */

  const GITHUB_REPOS_URL = 'https://api.github.com/users/MIDNIGHTATRIUM/repos?sort=updated&per_page=6';
  const GITHUB_HEADERS = {
    Accept: 'application/vnd.github+json',
  };

  const LANG_COLORS = {
    HTML: '#e34c26',
    CSS: '#563d7c',
    JavaScript: '#f1e05a',
    Python: '#3572a5',
    TypeScript: '#3178c6',
    Shell: '#89e051',
    Rust: '#dea584',
    Go: '#00add8',
    C: '#555555',
    'C++': '#f34b7d',
    'Jupyter Notebook': '#da5b0b',
    Nix: '#7e7eff',
    Lua: '#000080',
  };

  function getLanguageColor(language) {
    return LANG_COLORS[language] || 'var(--md-primary)';
  }

  function isValidGitHubRepoUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('https://github.com/')) {
      return false;
    }
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
    } catch (_) {
      return false;
    }
  }

  function formatRepoTimestamp(isoStr) {
    if (typeof isoStr !== 'string' || !isoStr) return 'UPD —';
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return 'UPD —';

    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    let relStr;
    if (mins < 1) {
      relStr = 'just now';
    } else if (hours < 1) {
      relStr = `${mins}m ago`;
    } else if (days < 1) {
      relStr = `${hours}h ago`;
    } else {
      relStr = `${days}d ago`;
    }

    return `UPD ${dateStr} (${relStr})`;
  }

  function buildRepoCardElement(repo) {
    const validUrl = isValidGitHubRepoUrl(repo?.html_url);
    const card = document.createElement(validUrl ? 'a' : 'article');
    card.className = 'repo-card';

    if (validUrl) {
      card.href = repo.html_url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    const head = document.createElement('div');
    head.className = 'repo-card__head';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'repo-card__title';
    titleSpan.textContent =
      typeof repo?.name === 'string' && repo.name.trim() ? repo.name.trim() : 'unnamed-repository';

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'repo-card__badge';
    badgeSpan.textContent = repo?.fork ? 'FORK' : 'PUBLIC';

    head.appendChild(titleSpan);
    head.appendChild(badgeSpan);

    const descP = document.createElement('p');
    descP.className = 'repo-card__desc';
    descP.textContent =
      typeof repo?.description === 'string' && repo.description.trim()
        ? repo.description.trim()
        : 'No description provided.';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'repo-card__meta';

    if (typeof repo?.language === 'string' && repo.language.trim()) {
      const langName = repo.language.trim();
      const langPill = document.createElement('span');
      langPill.className = 'lang-pill';

      const langDot = document.createElement('span');
      langDot.className = 'lang-dot';
      langDot.style.backgroundColor = getLanguageColor(langName);

      langPill.appendChild(langDot);
      langPill.appendChild(document.createTextNode(langName));
      metaDiv.appendChild(langPill);
    }

    const starsCount = toFiniteNumber(repo?.stargazers_count) ?? 0;
    const starsSpan = document.createElement('span');
    starsSpan.className = 'repo-stat';
    starsSpan.textContent = `\u2605 ${starsCount}`;
    metaDiv.appendChild(starsSpan);

    const forksCount = toFiniteNumber(repo?.forks_count) ?? 0;
    const forksSpan = document.createElement('span');
    forksSpan.className = 'repo-stat';
    forksSpan.textContent = `\u2442 ${forksCount}`;
    metaDiv.appendChild(forksSpan);

    const updatedSpan = document.createElement('span');
    updatedSpan.className = 'repo-updated';
    updatedSpan.textContent = formatRepoTimestamp(repo?.pushed_at || repo?.updated_at);
    metaDiv.appendChild(updatedSpan);

    card.appendChild(head);
    card.appendChild(descP);
    card.appendChild(metaDiv);

    return card;
  }

  function initGitHub(options) {
    const opts = options || {};
    const reportStatus = typeof opts.setStatus === 'function' ? opts.setStatus : () => {};

    const refreshBtn = $('gh-refresh');
    const retryBtn = $('gh-retry');
    const metaEl = $('gh-meta');
    const loadingEl = $('gh-loading');
    const errorEl = $('gh-error');
    const errorMsgEl = $('gh-error-msg');
    const gridEl = $('gh-repos-grid');

    let requestCounter = 0;
    let activeController = null;

    function showLoading() {
      setElementVisible(loadingEl, true);
      setElementVisible(errorEl, false);
      setElementVisible(gridEl, false);
    }

    function showError(message) {
      setElementVisible(loadingEl, false);
      setElementVisible(gridEl, false);
      setText(errorMsgEl, message);
      setElementVisible(errorEl, true);
    }

    function renderRepositories(repos) {
      if (!gridEl) return;
      gridEl.replaceChildren();

      if (repos.length === 0) {
        const emptyBox = document.createElement('div');
        emptyBox.className = 'state-box';
        emptyBox.style.gridColumn = '1 / -1';

        const emptyText = document.createElement('span');
        emptyText.className = 'state-box__text';
        emptyText.textContent = 'No public repositories returned by api.github.com.';
        emptyBox.appendChild(emptyText);
        gridEl.appendChild(emptyBox);
      } else {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < repos.length; i += 1) {
          frag.appendChild(buildRepoCardElement(repos[i]));
        }
        gridEl.appendChild(frag);
      }

      setElementVisible(loadingEl, false);
      setElementVisible(errorEl, false);
      setElementVisible(gridEl, true);
    }

    async function loadRepositories() {
      const reqId = ++requestCounter;
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      const { signal } = activeController;

      showLoading();
      reportStatus('status-github', 'POLLING...', 'standby');

      try {
        const res = await fetchResponse(GITHUB_REPOS_URL, GITHUB_HEADERS, signal);

        if (!res.ok) {
          if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
            const resetRaw = res.headers.get('X-RateLimit-Reset');
            const resetSec = toFiniteNumber(resetRaw);
            const resetDetail =
              resetSec !== null && resetSec > 0
                ? ` Resets ${formatEtAndUtc(new Date(resetSec * 1000))}.`
                : '';
            throw new Error(`GitHub API rate limit exceeded (HTTP 403).${resetDetail}`);
          }
          throw new Error(`GitHub API HTTP ${res.status}`);
        }

        const repos = await res.json();
        if (reqId !== requestCounter || signal.aborted) return;

        if (!Array.isArray(repos)) {
          throw new Error('GitHub API returned unexpected payload.');
        }

        setText(
          metaEl,
          `USER: MIDNIGHTATRIUM // ${repos.length} PUBLIC REPO${repos.length === 1 ? '' : 'S'}`
        );
        renderRepositories(repos);
        reportStatus('status-github', `${repos.length} PUBLIC`, 'live');
      } catch (err) {
        if (err?.name === 'AbortError' || reqId !== requestCounter) return;

        setText(metaEl, 'USER: MIDNIGHTATRIUM // UNAVAILABLE');
        showError(err?.message || 'Unable to retrieve public repositories from api.github.com.');
        reportStatus('status-github', 'ERROR', 'error');
      }
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadRepositories);
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', loadRepositories);
    }

    loadRepositories();
  }

  /* ==========================================================================
     SECTION 4: Module Exports & DOMContentLoaded Bootstrap
     ========================================================================== */

  global.NMModules.initAudio = initAudio;
  global.NMModules.initWeather = initWeather;
  global.NMModules.initGitHub = initGitHub;

  function bootstrap() {
    applyTheme(getTheme(), false);
    bindThemeToggle();
    startClock();

    try {
      initAudio({ setStatus });
    } catch (_) {
      setStatus('status-audio', 'ERROR', 'error');
    }

    try {
      initWeather({ setStatus, getTheme });
    } catch (_) {
      setStatus('status-weather', 'ERROR', 'error');
      setStatus('status-afd', 'ERROR', 'error');
    }

    try {
      initGitHub({ setStatus });
    } catch (_) {
      setStatus('status-github', 'ERROR', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
