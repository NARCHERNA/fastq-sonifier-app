const MAPPING_VERSION = "CODON-MAP-02";

const state = {
  files: [],
  fileReports: [],
  reads: [],
  notes: [],
  metrics: emptyMetrics(),
  audio: null,
  audioGraph: null,
  startTime: 0,
  pausedAt: 0,
  isPlaying: false,
  animationId: 0,
  schedulerId: 0,
  nextNoteIndex: 0,
  scheduled: new Set(),
  particles: [],
  lastParticleNoteId: -1,
  activeNoteIndex: -1,
  lastDraw: 0,
  mutedVoices: new Set(),
  rebuildTimer: 0,
  toastTimer: 0,
  exportInProgress: false,
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  exampleButton: document.querySelector("#exampleButton"),
  fileList: document.querySelector("#fileList"),
  playButton: document.querySelector("#playButton"),
  pauseButton: document.querySelector("#pauseButton"),
  stopButton: document.querySelector("#stopButton"),
  clearButton: document.querySelector("#clearButton"),
  tempoInput: document.querySelector("#tempoInput"),
  tempoValue: document.querySelector("#tempoValue"),
  instrumentSelect: document.querySelector("#instrumentSelect"),
  rootSelect: document.querySelector("#rootSelect"),
  scaleSelect: document.querySelector("#scaleSelect"),
  ambienceInput: document.querySelector("#ambienceInput"),
  ambienceValue: document.querySelector("#ambienceValue"),
  stereoInput: document.querySelector("#stereoInput"),
  stereoValue: document.querySelector("#stereoValue"),
  volumeInput: document.querySelector("#volumeInput"),
  volumeValue: document.querySelector("#volumeValue"),
  densitySelect: document.querySelector("#densitySelect"),
  qualityThresholdSelect: document.querySelector("#qualityThresholdSelect"),
  readLimitInput: document.querySelector("#readLimitInput"),
  readLimitValue: document.querySelector("#readLimitValue"),
  noteLimitInput: document.querySelector("#noteLimitInput"),
  noteLimitValue: document.querySelector("#noteLimitValue"),
  qualityContrastInput: document.querySelector("#qualityContrastInput"),
  qualityContrastValue: document.querySelector("#qualityContrastValue"),
  diagnosticSoloInput: document.querySelector("#diagnosticSoloInput"),
  viewSelect: document.querySelector("#viewSelect"),
  motionInput: document.querySelector("#motionInput"),
  motionValue: document.querySelector("#motionValue"),
  trailsInput: document.querySelector("#trailsInput"),
  presetGroup: document.querySelector("#presetGroup"),
  wavButton: document.querySelector("#wavButton"),
  midiButton: document.querySelector("#midiButton"),
  scoreButton: document.querySelector("#scoreButton"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  fileNameLabel: document.querySelector("#fileNameLabel"),
  stageTitle: document.querySelector("#stageTitle"),
  miniSummary: document.querySelector("#miniSummary"),
  instrumentFrame: document.querySelector("#instrumentFrame"),
  voiceLegend: document.querySelector("#voiceLegend"),
  canvas: document.querySelector("#scoreCanvas"),
  emptyState: document.querySelector("#emptyState"),
  scrubber: document.querySelector("#scrubber"),
  elapsedLabel: document.querySelector("#elapsedLabel"),
  timeLabel: document.querySelector("#timeLabel"),
  currentCodon: document.querySelector("#currentCodon"),
  currentQuality: document.querySelector("#currentQuality"),
  currentEvent: document.querySelector("#currentEvent"),
  currentPosition: document.querySelector("#currentPosition"),
  currentMotif: document.querySelector("#currentMotif"),
  motifRepeat: document.querySelector("#motifRepeat"),
  activeReadout: document.querySelector("#activeReadout"),
  fingerprintLabel: document.querySelector("#fingerprintLabel"),
  readsMetric: document.querySelector("#readsMetric"),
  basesMetric: document.querySelector("#basesMetric"),
  qualityMetric: document.querySelector("#qualityMetric"),
  qualityMeter: document.querySelector("#qualityMeter"),
  lowQualityMetric: document.querySelector("#lowQualityMetric"),
  ambiguousMetric: document.querySelector("#ambiguousMetric"),
  gcMetric: document.querySelector("#gcMetric"),
  pageViewCounter: document.querySelector("#pageViewCounter"),
  pageViewCount: document.querySelector("#pageViewCount"),
  toast: document.querySelector("#toast"),
};

const ctx = els.canvas.getContext("2d", { alpha: false });
const noiseBuffers = new WeakMap();

const baseColors = {
  A: "#4de0cf",
  C: "#ffc857",
  G: "#ff6b6b",
  T: "#a98cff",
  U: "#a98cff",
  N: "#f5f3ee",
};

const qualityColors = {
  clean: "#7ee081",
  warning: "#ffb84d",
  critical: "#ff4f73",
  ambiguous: "#f5f3ee",
  homopolymer: "#ffc857",
  complexity: "#a98cff",
  adapter: "#4de0cf",
};

const voiceColors = ["#4de0cf", "#ff7a90", "#ffc857", "#a98cff", "#7ee081", "#6eb5ff"];

const scaleMap = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  hirajoshi: [0, 2, 3, 7, 8],
  whole: [0, 2, 4, 6, 8, 10],
};

const baseValue = { A: 0, C: 1, G: 2, T: 3, U: 3, N: 0 };
const basePan = { A: -0.72, C: -0.23, G: 0.24, T: 0.72, U: 0.72, N: 0 };
const baseWave = { A: "sine", C: "triangle", G: "sawtooth", T: "square", U: "square", N: "sine" };
const voicePitchOffsets = [0, 7, -5, 12, -12, 5];
const adapterSignatures = ["AGATCGGAAGAG", "CTCTTCCGATCT"];

const instrumentProfiles = {
  glass: { partialType: "sine", partialRatio: 2.01, attack: 0.012, release: 0.32, sustain: 0.34, brightness: 1.0 },
  strings: { partialType: "sawtooth", partialRatio: 1.5, attack: 0.075, release: 0.58, sustain: 0.62, brightness: 0.76 },
  marimba: { partialType: "sine", partialRatio: 3.98, attack: 0.006, release: 0.22, sustain: 0.16, brightness: 1.18 },
  pulse: { partialType: "square", partialRatio: 2.0, attack: 0.004, release: 0.16, sustain: 0.24, brightness: 0.9 },
};

const presets = {
  truth: {
    tempo: 88,
    instrument: "glass",
    ambience: 42,
    stereo: 78,
    density: 6,
    threshold: 30,
    contrast: 82,
    view: "flow",
    motion: 76,
  },
  cinema: {
    tempo: 76,
    instrument: "strings",
    ambience: 74,
    stereo: 96,
    density: 6,
    threshold: 30,
    contrast: 68,
    view: "helix",
    motion: 92,
  },
  microscope: {
    tempo: 58,
    instrument: "marimba",
    ambience: 16,
    stereo: 68,
    density: 3,
    threshold: 35,
    contrast: 100,
    view: "lanes",
    motion: 42,
  },
};

wireEvents();
syncControlOutputs();
renderFiles([]);
resizeCanvas();
draw(0);
void updatePageViewCounter();

async function updatePageViewCounter() {
  if (!els.pageViewCounter || !els.pageViewCount) return;
  if (!window.location || !/^https?:$/.test(window.location.protocol)) return;
  if (typeof window.fetch !== "function") return;

  try {
    const counterEndpoint = window.location.hostname === "narcherna.github.io"
      ? "https://fastq-sonifier.n47h4n1989.chatgpt.site/api/views"
      : "/api/views";
    const response = await window.fetch(counterEndpoint, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;

    const payload = await response.json();
    const value = typeof payload === "number" ? payload : payload && (payload.views ?? payload.count);
    const views = Number(value);
    if (!Number.isSafeInteger(views) || views < 0) return;

    els.pageViewCount.textContent = views.toLocaleString();
    els.pageViewCounter.hidden = false;
  } catch (error) {
    // The counter is optional. Static/file hosting and a missing endpoint leave it hidden.
  }
}

function wireEvents() {
  els.fileInput.addEventListener("change", function () {
    loadFiles(Array.from(els.fileInput.files));
  });

  ["dragenter", "dragover"].forEach(function (eventName) {
    els.dropZone.addEventListener(eventName, function (event) {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach(function (eventName) {
    els.dropZone.addEventListener(eventName, function (event) {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", function (event) {
    loadFiles(Array.from(event.dataTransfer.files));
  });

  els.exampleButton.addEventListener("click", loadSyntheticExample);

  els.playButton.addEventListener("click", play);
  els.pauseButton.addEventListener("click", pause);
  els.stopButton.addEventListener("click", stop);
  els.clearButton.addEventListener("click", clearAll);
  els.wavButton.addEventListener("click", exportWav);
  els.midiButton.addEventListener("click", exportMidi);
  els.scoreButton.addEventListener("click", exportScore);

  els.presetGroup.addEventListener("click", function (event) {
    const button = event.target.closest("[data-preset]");
    if (button) applyPreset(button.dataset.preset);
  });

  bindRange(els.tempoInput, els.tempoValue, function (value) {
    return value + " BPM";
  }, true);
  bindRange(els.readLimitInput, els.readLimitValue, function (value) {
    return Number(value).toLocaleString();
  }, false);
  bindRange(els.noteLimitInput, els.noteLimitValue, function (value) {
    return Number(value).toLocaleString();
  }, true);
  bindRange(els.qualityContrastInput, els.qualityContrastValue, asPercent, true);
  bindRange(els.ambienceInput, els.ambienceValue, asPercent, false, configureLiveAudio);
  bindRange(els.stereoInput, els.stereoValue, asPercent, false);
  bindRange(els.volumeInput, els.volumeValue, asPercent, false, configureLiveAudio);
  bindRange(els.motionInput, els.motionValue, asPercent, false, function () {
    draw(getCurrentPosition());
  });

  [els.scaleSelect, els.rootSelect, els.densitySelect, els.qualityThresholdSelect].forEach(function (element) {
    element.addEventListener("change", function () {
      clearPresetSelection();
      rebuildFromReads();
    });
  });

  els.readLimitInput.addEventListener("change", function () {
    clearPresetSelection();
    if (state.files.length) loadFiles(state.files);
  });

  els.instrumentSelect.addEventListener("change", function () {
    clearPresetSelection();
    restartLiveAudio();
  });

  els.stereoInput.addEventListener("change", restartLiveAudio);
  els.diagnosticSoloInput.addEventListener("change", restartLiveAudio);
  els.viewSelect.addEventListener("change", function () {
    clearPresetSelection();
    draw(getCurrentPosition());
  });
  els.trailsInput.addEventListener("change", function () {
    draw(getCurrentPosition());
  });

  els.scrubber.addEventListener("input", function () {
    if (!state.notes.length) return;
    const next = (Number(els.scrubber.value) / 1000) * getDuration();
    state.pausedAt = next;
    if (state.isPlaying && state.audio) {
      stopScheduled();
      state.startTime = state.audio.currentTime - next;
      scheduleFrom(next);
    }
    draw(next);
    updateTime(next);
  });

  window.addEventListener("resize", function () {
    resizeCanvas();
    draw(getCurrentPosition());
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state.isPlaying) pause();
  });
}

function bindRange(input, output, formatter, rebuild, sideEffect) {
  input.addEventListener("input", function () {
    output.textContent = formatter(input.value);
    clearPresetSelection();
    if (sideEffect) sideEffect();
    if (rebuild) queueRebuild();
  });
}

function queueRebuild() {
  window.clearTimeout(state.rebuildTimer);
  state.rebuildTimer = window.setTimeout(rebuildFromReads, 90);
}

function syncControlOutputs() {
  els.tempoValue.textContent = els.tempoInput.value + " BPM";
  els.readLimitValue.textContent = Number(els.readLimitInput.value).toLocaleString();
  els.noteLimitValue.textContent = Number(els.noteLimitInput.value).toLocaleString();
  els.qualityContrastValue.textContent = asPercent(els.qualityContrastInput.value);
  els.ambienceValue.textContent = asPercent(els.ambienceInput.value);
  els.stereoValue.textContent = asPercent(els.stereoInput.value);
  els.volumeValue.textContent = asPercent(els.volumeInput.value);
  els.motionValue.textContent = asPercent(els.motionInput.value);
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  els.tempoInput.value = preset.tempo;
  els.instrumentSelect.value = preset.instrument;
  els.ambienceInput.value = preset.ambience;
  els.stereoInput.value = preset.stereo;
  els.densitySelect.value = preset.density;
  els.qualityThresholdSelect.value = preset.threshold;
  els.qualityContrastInput.value = preset.contrast;
  els.viewSelect.value = preset.view;
  els.motionInput.value = preset.motion;
  syncControlOutputs();
  selectPreset(name);
  configureLiveAudio();
  rebuildFromReads();
}

function selectPreset(name) {
  els.presetGroup.querySelectorAll("[data-preset]").forEach(function (button) {
    const selected = button.dataset.preset === name;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function clearPresetSelection() {
  selectPreset("");
}

function getOptions() {
  return {
    tempo: Number(els.tempoInput.value),
    noteLimit: Number(els.noteLimitInput.value),
    density: Number(els.densitySelect.value),
    qualityThreshold: Number(els.qualityThresholdSelect.value),
    qualityContrast: Number(els.qualityContrastInput.value) / 100,
    scaleName: els.scaleSelect.value,
    rootMidi: Number(els.rootSelect.value),
    instrument: els.instrumentSelect.value,
    ambience: Number(els.ambienceInput.value) / 100,
    stereo: Number(els.stereoInput.value) / 100,
    volume: Number(els.volumeInput.value) / 100,
    motion: Number(els.motionInput.value) / 100,
    view: els.viewSelect.value,
    trails: els.trailsInput.checked,
    diagnosticSolo: els.diagnosticSoloInput.checked,
  };
}

async function loadFiles(files) {
  const supported = files.filter(isFastqName);
  if (!supported.length) {
    setStatus("Error", "Choose FASTQ or gzipped FASTQ files.");
    showToast("No supported FASTQ files were selected.");
    return;
  }

  stop();
  state.files = supported;
  state.fileReports = [];
  state.reads = [];
  state.notes = [];
  state.metrics = emptyMetrics();
  state.mutedVoices.clear();
  state.particles = [];
  renderFiles(supported);
  setStatus("Reading", "Opening sequence and quality records.");
  els.emptyState.classList.add("hidden");
  els.stageTitle.textContent = "Reading FASTQ signal";
  els.fileNameLabel.textContent = supported.map(function (file) {
    return file.name;
  }).join(" + ");

  try {
    const readLimit = Number(els.readLimitInput.value);
    const readsPerFile = Math.max(1, Math.floor(readLimit / supported.length));
    const allReads = [];

    for (let fileIndex = 0; fileIndex < supported.length; fileIndex += 1) {
      const file = supported[fileIndex];
      setStatus("Reading", "Reading " + file.name);
      const result = await readFastqFile(file, readsPerFile, fileIndex);
      state.fileReports.push(result.report);
      allReads.push.apply(allReads, result.reads);
    }

    state.reads = allReads;
    renderFiles(supported);
    rebuildFromReads();
    if (!state.notes.length) {
      throw new Error("No complete FASTQ records were found.");
    }

    const warningCount = state.fileReports.reduce(function (sum, report) {
      return sum + report.warnings;
    }, 0);
    const warningText = warningCount ? " " + warningCount.toLocaleString() + " malformed fragments skipped." : "";
    setStatus(
      "Ready",
      state.notes.length.toLocaleString() + " notes from " + state.reads.length.toLocaleString() + " reads." + warningText
    );
  } catch (error) {
    console.error(error);
    state.notes = [];
    state.metrics = emptyMetrics();
    updateMetrics(state.metrics);
    els.emptyState.classList.remove("hidden");
    els.wavButton.disabled = true;
    els.midiButton.disabled = true;
    els.scoreButton.disabled = true;
    setStatus("Error", error.message || "The selected FASTQ data could not be read.");
  }
}

async function loadSyntheticExample() {
  if (els.exampleButton.disabled) return;

  const example = window.fastqSonifierExample;
  if (!example || typeof example.createFiles !== "function") {
    setStatus("Error", "The synthetic example is not available.");
    showToast("The synthetic example could not be opened. Reload the page and try again.");
    return;
  }

  const buttonLabel = els.exampleButton.querySelector("strong");
  const previousLabel = buttonLabel.textContent;
  els.exampleButton.disabled = true;
  els.exampleButton.setAttribute("aria-busy", "true");
  buttonLabel.textContent = "Preparing example…";
  setStatus("Preparing", "Generating synthetic FASTQ reads on this device.");

  try {
    const result = await Promise.resolve(example.createFiles());
    const files = normalizeExampleFiles(result);
    if (!files.length) throw new Error("No synthetic FASTQ files were created.");
    els.fileInput.value = "";
    await loadFiles(files);
  } catch (error) {
    console.error(error);
    setStatus("Error", "The synthetic example could not be prepared.");
    showToast(error.message || "The synthetic example could not be prepared.");
  } finally {
    els.exampleButton.disabled = false;
    els.exampleButton.removeAttribute("aria-busy");
    buttonLabel.textContent = previousLabel;
  }
}

function normalizeExampleFiles(result) {
  if (!result) return [];
  if (typeof File !== "undefined" && result instanceof File) return [result];
  if (result.files) return Array.from(result.files).filter(Boolean);
  if (Array.isArray(result)) return result.filter(Boolean);

  const pair = [result.r1, result.r2].filter(Boolean);
  if (pair.length) return pair;

  if (typeof result[Symbol.iterator] === "function") {
    return Array.from(result).filter(Boolean);
  }
  return [];
}

async function readFastqFile(file, readLimit, fileIndex) {
  const compressed = /\.gz$/i.test(file.name);
  if (compressed && !("DecompressionStream" in window)) {
    throw new Error("This browser cannot open gzip streams. Decompress the FASTQ first or use a current Chromium browser.");
  }
  if (!("TextDecoderStream" in window)) {
    throw new Error("This browser does not support streamed text decoding.");
  }

  let stream = file.stream();
  if (compressed) {
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  }

  const reader = stream.pipeThrough(new TextDecoderStream("ascii")).getReader();
  const parser = createFastqParser(file, fileIndex);
  const reads = [];
  let buffer = "";
  let reachedLimit = false;

  try {
    while (reads.length < readLimit) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += chunk.value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (let index = 0; index < lines.length; index += 1) {
        const read = parser.pushLine(lines[index]);
        if (read) {
          read.readIndex = reads.length;
          reads.push(read);
          if (reads.length % 100 === 0) {
            setStatus("Reading", file.name + ": " + reads.length.toLocaleString() + " reads");
            await nextFrame();
          }
          if (reads.length >= readLimit) {
            reachedLimit = true;
            break;
          }
        }
      }
    }

    if (!reachedLimit && buffer) {
      const read = parser.pushLine(buffer);
      if (read && reads.length < readLimit) {
        read.readIndex = reads.length;
        reads.push(read);
      }
    }
    parser.finish();
  } catch (error) {
    if (compressed) {
      throw new Error("Could not decompress " + file.name + ". The gzip stream may be incomplete or corrupt.");
    }
    throw error;
  } finally {
    if (reachedLimit) {
      try {
        await reader.cancel();
      } catch {
        // The stream may already have closed at the requested read limit.
      }
    }
  }

  return {
    reads,
    report: {
      fileIndex,
      reads: reads.length,
      warnings: parser.warningCount(),
      truncated: reachedLimit,
      pair: reads.length ? reads[0].pair : detectPair(file.name, ""),
    },
  };
}

function createFastqParser(file, fileIndex) {
  let mode = "header";
  let header = "";
  let sequenceParts = [];
  let qualityParts = [];
  let sequenceLength = 0;
  let warnings = 0;

  function reset() {
    mode = "header";
    header = "";
    sequenceParts = [];
    qualityParts = [];
    sequenceLength = 0;
  }

  function pushLine(rawLine) {
    const line = rawLine.replace(/\r$/, "");

    if (mode === "header") {
      if (!line) return null;
      if (!line.startsWith("@")) {
        warnings += 1;
        return null;
      }
      header = line;
      mode = "sequence";
      return null;
    }

    if (mode === "sequence") {
      if (line.startsWith("+")) {
        sequenceLength = sequenceParts.reduce(function (sum, part) {
          return sum + part.length;
        }, 0);
        if (!sequenceLength) {
          warnings += 1;
          reset();
          return null;
        }
        mode = "quality";
        return null;
      }
      if (line.startsWith("@") && !sequenceParts.length) {
        warnings += 1;
        header = line;
        return null;
      }
      sequenceParts.push(line.trim().toUpperCase());
      return null;
    }

    qualityParts.push(line);
    const qualityLength = qualityParts.reduce(function (sum, part) {
      return sum + part.length;
    }, 0);
    if (qualityLength < sequenceLength) return null;

    const sequence = sequenceParts.join("");
    const joinedQuality = qualityParts.join("");
    if (joinedQuality.length > sequenceLength) warnings += 1;
    const read = {
      header,
      sequence,
      quality: joinedQuality.slice(0, sequenceLength),
      fileIndex,
      pair: detectPair(file.name, header),
      readIndex: 0,
    };
    reset();
    return read;
  }

  return {
    pushLine,
    finish: function () {
      if (mode !== "header") warnings += 1;
      reset();
    },
    warningCount: function () {
      return warnings;
    },
  };
}

function detectPair(fileName, header) {
  const headerMatch = header.match(/\s([12]):[YN]:\d+:/);
  if (headerMatch) return Number(headerMatch[1]);
  const stem = fileName.replace(/\.(fastq|fq)(\.gz)?$/i, "");
  const nameMatch = stem.match(/(?:^|[_.-])R?([12])(?:[_.-]|$)/i);
  return nameMatch ? Number(nameMatch[1]) : 1;
}

function rebuildFromReads() {
  window.clearTimeout(state.rebuildTimer);
  state.rebuildTimer = 0;
  stop();

  if (!state.reads.length) {
    state.metrics = emptyMetrics();
    updateMetrics(state.metrics);
    draw(0);
    return;
  }

  const result = buildScore(state.reads, getOptions());
  state.notes = result.notes;
  state.metrics = result.metrics;
  state.activeNoteIndex = -1;
  state.lastParticleNoteId = -1;
  state.particles = [];
  updateMetrics(result.metrics);
  renderVoiceLegend();
  els.stageTitle.textContent = result.metrics.lowQualityNotes
    ? "Sequence signal with " + result.metrics.lowQualityNotes.toLocaleString() + " audible quality events"
    : "Sequence translated into stable motifs";
  els.fileNameLabel.textContent = state.files.map(function (file) {
    return file.name;
  }).join(" + ");
  els.emptyState.classList.toggle("hidden", Boolean(state.notes.length));
  els.scrubber.value = 0;
  state.pausedAt = 0;
  els.wavButton.disabled = !state.notes.length;
  els.midiButton.disabled = !state.notes.length;
  els.scoreButton.disabled = !state.notes.length;
  resetActiveReadout();
  draw(0);
}

function buildScore(reads, options) {
  const scale = scaleMap[options.scaleName] || scaleMap.dorian;
  const secondsPerBeat = 60 / options.tempo;
  const metrics = collectMetrics(reads);
  const notes = [];
  const readGroups = groupReadsByFile(reads);
  const voiceTimes = readGroups.map(function (_, index) {
    return index * secondsPerBeat * 0.42;
  });
  const motifCounts = countMotifs(reads, options.density);

  function addReadToVoice(read, voiceIndex, startTime) {
    let time = startTime;
    const usableLength = Math.min(read.sequence.length, read.quality.length);
    if (usableLength < 3) return time;

    const sequence = read.sequence;
    const quality = read.quality;
    const readMeanQ = averageQuality(quality, usableLength);
    const readGc = gcFraction(sequence, usableLength);
    time += (1 - clamp(readMeanQ / 41, 0, 1)) * secondsPerBeat * 0.13;

    for (let position = 0; position <= usableLength - 3 && notes.length < options.noteLimit; position += options.density) {
      const codon = normalizeSequence(sequence.slice(position, position + 3), 3);
      const motifLength = Math.min(9, usableLength - position);
      const contextLength = Math.min(18, usableLength - position);
      const motif = normalizeSequence(sequence.slice(position, position + motifLength), motifLength);
      const context = normalizeSequence(sequence.slice(position, position + contextLength), contextLength);
      const qValues = [
        phred(quality[position]),
        phred(quality[position + 1]),
        phred(quality[position + 2]),
      ];
      const qMean = average(qValues);
      const qMin = Math.min.apply(Math, qValues);
      const qNorm = clamp(qMean / 41, 0, 1);
      const ambiguous = codon.indexOf("N") >= 0;
      const codonValue = codonToValue(codon);
      const grayValue = codonValue ^ (codonValue >> 1);
      const scaleDegree = grayValue % scale.length;
      const octaveBand = Math.floor(grayValue / scale.length) % 3;
      const voiceOffset = voicePitchOffsets[voiceIndex % voicePitchOffsets.length];
      const midi = clamp(options.rootMidi + 12 + octaveBand * 12 + scale[scaleDegree] + voiceOffset, 40, 98);
      const gc = gcFraction(codon, codon.length);
      const longestRun = longestBaseRun(motif);
      const complexity = sequenceComplexity(motif);
      const adapter = adapterSignatures.some(function (signature) {
        return context.indexOf(signature) >= 0;
      });
      const severity = qualitySeverity(qMean, qMin, options.qualityThreshold, options.qualityContrast, ambiguous);
      const eventType = classifyEvent({
        ambiguous,
        adapter,
        longestRun,
        complexity,
        severity,
        qMean,
      });
      const motifHash = hashText(motif);
      const repeats = motifCounts.get(motif) || 1;
      const jitter = (seededUnit(motifHash ^ (position + 1) ^ ((read.readIndex + 1) * 7919)) - 0.5)
        * severity * secondsPerBeat * 0.09;
      const noteTime = Math.max(startTime, time + jitter);
      const durationBeats = ambiguous
        ? 0.18
        : 0.25 + qNorm * 0.32 + gc * 0.07 + Math.min(0.08, (repeats - 1) * 0.008);
      const onsetBeats = 0.17 + (1 - qNorm) * 0.075 + (ambiguous ? 0.075 : 0);
      const driftCents = (seededUnit(motifHash ^ 0x9e3779b9) - 0.5) * 2 * severity * 72;
      const anchorBase = codon[0];

      notes.push({
        id: notes.length,
        time: noteTime,
        duration: durationBeats * secondsPerBeat,
        midi,
        frequency: midiToFrequency(midi),
        velocity: 0.09 + qNorm * 0.15 + Math.min(0.036, Math.log2(repeats) * 0.01),
        q: qMean,
        qMin,
        qValues,
        qNorm,
        severity,
        eventType,
        codon,
        motif,
        motifId: hexHash(motifHash, 4),
        motifHash,
        repeats,
        base: anchorBase,
        color: baseColors[anchorBase] || baseColors.N,
        qualityColor: qualityColors[eventType] || qualityColors.clean,
        pan: (basePan[anchorBase] || 0) * (read.pair === 2 ? -1 : 1),
        wave: ambiguous ? "sine" : (baseWave[anchorBase] || "sine"),
        fileIndex: read.fileIndex,
        voiceIndex,
        pair: read.pair,
        readIndex: read.readIndex,
        position,
        gc,
        complexity,
        longestRun,
        ambiguous,
        adapter,
        driftCents,
        y: 1 - clamp((midi - 40) / 58, 0, 1),
        phase: (motifHash % 6283) / 1000,
      });

      if (eventType !== "clean") metrics.lowQualityNotes += 1;
      if (eventType === "homopolymer") metrics.homopolymerEvents += 1;
      if (eventType === "adapter") metrics.adapterEvents += 1;
      time += onsetBeats * secondsPerBeat;
    }

    return time + secondsPerBeat * (0.18 + readGc * 0.16 + (1 - clamp(readMeanQ / 41, 0, 1)) * 0.16);
  }

  const maxReads = Math.max.apply(Math, readGroups.map(function (group) {
    return group.length;
  }).concat([0]));

  for (let readIndex = 0; readIndex < maxReads && notes.length < options.noteLimit; readIndex += 1) {
    for (let voiceIndex = 0; voiceIndex < readGroups.length && notes.length < options.noteLimit; voiceIndex += 1) {
      const read = readGroups[voiceIndex][readIndex];
      if (!read) continue;
      voiceTimes[voiceIndex] = addReadToVoice(read, voiceIndex, voiceTimes[voiceIndex]);
    }
  }

  notes.sort(function (left, right) {
    return left.time - right.time || left.voiceIndex - right.voiceIndex;
  });
  notes.forEach(function (note, index) {
    note.id = index;
  });
  metrics.notes = notes.length;
  metrics.duration = notes.length
    ? notes.reduce(function (latest, note) {
      return Math.max(latest, note.time + note.duration);
    }, 0)
    : 0;
  metrics.repeatedMotifs = Array.from(motifCounts.values()).filter(function (count) {
    return count > 1;
  }).length;
  metrics.voiceCount = readGroups.length;
  return { notes, metrics };
}

function collectMetrics(reads) {
  const metrics = emptyMetrics();
  const qualityByPosition = [];
  let fingerprint = 2166136261;

  reads.forEach(function (read) {
    const usableLength = Math.min(read.sequence.length, read.quality.length);
    if (!usableLength) return;
    metrics.reads += 1;
    metrics.bases += usableLength;
    fingerprint = mixHash(fingerprint, hashText(read.sequence.slice(0, usableLength)));

    for (let index = 0; index < usableLength; index += 1) {
      const base = normalizeBase(read.sequence[index]);
      const q = phred(read.quality[index]);
      metrics.baseCounts[base] = (metrics.baseCounts[base] || 0) + 1;
      metrics.qualityTotal += q;
      if (q < 20) metrics.lowQualityBases += 1;
      if (base === "N") metrics.ambiguousBases += 1;
      if (base === "G" || base === "C") metrics.gc += 1;
      const bin = clamp(Math.floor(q / 5), 0, metrics.qualityHistogram.length - 1);
      metrics.qualityHistogram[bin] += 1;
      if (!qualityByPosition[index]) qualityByPosition[index] = { total: 0, count: 0 };
      qualityByPosition[index].total += q;
      qualityByPosition[index].count += 1;
    }
  });

  metrics.meanQ = metrics.bases ? metrics.qualityTotal / metrics.bases : 0;
  metrics.gcPercent = metrics.bases ? metrics.gc / metrics.bases : 0;
  metrics.qualityByPosition = qualityByPosition.map(function (slot) {
    return slot.count ? slot.total / slot.count : 0;
  });
  metrics.fingerprint = hexHash(fingerprint, 8);
  return metrics;
}

function countMotifs(reads, step) {
  const counts = new Map();
  reads.forEach(function (read) {
    const usableLength = Math.min(read.sequence.length, read.quality.length);
    for (let position = 0; position <= usableLength - 3; position += step) {
      const motifLength = Math.min(9, usableLength - position);
      const motif = normalizeSequence(read.sequence.slice(position, position + motifLength), motifLength);
      counts.set(motif, (counts.get(motif) || 0) + 1);
    }
  });
  return counts;
}

function classifyEvent(details) {
  if (details.ambiguous) return "ambiguous";
  if (details.adapter) return "adapter";
  if (details.qMean < 20 || details.severity >= 0.68) return "critical";
  if (details.severity >= 0.08) return "warning";
  if (details.longestRun >= 5) return "homopolymer";
  if (details.complexity < 0.54) return "complexity";
  return "clean";
}

function qualitySeverity(qMean, qMin, threshold, contrast, ambiguous) {
  if (ambiguous) return 1;
  const meanDeficit = clamp((threshold - qMean) / Math.max(1, threshold), 0, 1);
  const minDeficit = clamp((threshold - qMin) / Math.max(1, threshold), 0, 1);
  const raw = meanDeficit * 0.82 + minDeficit * 0.72;
  return clamp(raw * (0.45 + contrast * 1.85), 0, 1);
}

function groupReadsByFile(reads) {
  const groups = new Map();
  reads.forEach(function (read) {
    if (!groups.has(read.fileIndex)) groups.set(read.fileIndex, []);
    groups.get(read.fileIndex).push(read);
  });
  return Array.from(groups.entries())
    .sort(function (left, right) {
      return left[0] - right[0];
    })
    .map(function (entry) {
      return entry[1];
    });
}

async function play() {
  if (!state.notes.length) {
    setStatus("Waiting", "Load FASTQ data before playing.");
    return;
  }

  await ensureAudio();
  if (state.audio.state === "suspended") await state.audio.resume();
  stopScheduled();
  state.isPlaying = true;
  state.startTime = state.audio.currentTime - state.pausedAt;
  setStatus("Playing", "Sequence, quality and detected motifs are sounding now.");
  scheduleFrom(state.pausedAt);
  animate();
}

function pause() {
  if (!state.isPlaying) return;
  state.pausedAt = getCurrentPosition();
  state.isPlaying = false;
  stopScheduled();
  cancelAnimationFrame(state.animationId);
  setStatus("Paused", formatTime(state.pausedAt) + " / " + formatTime(getDuration()));
  draw(state.pausedAt);
}

function stop() {
  stopScheduled();
  state.isPlaying = false;
  state.pausedAt = 0;
  els.scrubber.value = 0;
  updateTime(0);
  cancelAnimationFrame(state.animationId);
  state.particles = [];
  state.activeNoteIndex = -1;
  state.lastParticleNoteId = -1;
  draw(0);
  if (state.notes.length) {
    setStatus("Ready", state.notes.length.toLocaleString() + " notes ready.");
  }
}

function clearAll() {
  stop();
  state.files = [];
  state.fileReports = [];
  state.reads = [];
  state.notes = [];
  state.metrics = emptyMetrics();
  state.mutedVoices.clear();
  els.fileInput.value = "";
  renderFiles([]);
  renderVoiceLegend();
  updateMetrics(state.metrics);
  els.emptyState.classList.remove("hidden");
  els.stageTitle.textContent = "Sequence awaiting signal";
  els.fileNameLabel.textContent = "NO FILE LOADED";
  els.wavButton.disabled = true;
  els.midiButton.disabled = true;
  els.scoreButton.disabled = true;
  resetActiveReadout();
  setStatus("Waiting", "Load a file to begin.");
}

async function ensureAudio() {
  if (state.audio) {
    configureLiveAudio();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio is not available in this browser.");
  }
  state.audio = new AudioContextClass({ latencyHint: "interactive" });
  state.audioGraph = createAudioGraph(state.audio, state.audio.destination, getOptions());
}

function createAudioGraph(context, destination, options) {
  const input = context.createGain();
  const dryGain = context.createGain();
  const delay = context.createDelay(1.2);
  const delayFeedback = context.createGain();
  const delayGain = context.createGain();
  const convolver = context.createConvolver();
  const reverbGain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();

  delay.delayTime.value = 0.245;
  delayFeedback.gain.value = 0.18;
  convolver.buffer = createImpulseResponse(context, 1.75, 2.8);

  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 4.5;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.22;

  input.connect(dryGain);
  dryGain.connect(compressor);
  input.connect(delay);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(compressor);
  input.connect(convolver);
  convolver.connect(reverbGain);
  reverbGain.connect(compressor);
  compressor.connect(output);
  output.connect(destination);

  const graph = {
    context,
    input,
    dryGain,
    delay,
    delayFeedback,
    delayGain,
    convolver,
    reverbGain,
    compressor,
    output,
  };
  configureAudioGraph(graph, options);
  return graph;
}

function configureAudioGraph(graph, options) {
  if (!graph) return;
  const now = graph.context.currentTime;
  const ambience = clamp(options.ambience, 0, 1);
  setParamSmooth(graph.dryGain.gain, 0.88 - ambience * 0.12, now);
  setParamSmooth(graph.delayGain.gain, ambience * 0.24, now);
  setParamSmooth(graph.reverbGain.gain, ambience * 0.34, now);
  setParamSmooth(graph.delayFeedback.gain, 0.1 + ambience * 0.26, now);
  setParamSmooth(graph.output.gain, Math.pow(clamp(options.volume, 0, 1), 1.25), now);
}

function configureLiveAudio() {
  if (state.audioGraph) configureAudioGraph(state.audioGraph, getOptions());
}

function setParamSmooth(param, value, at) {
  param.cancelScheduledValues(at);
  param.setTargetAtTime(value, at, 0.025);
}

function createImpulseResponse(context, seconds, decay) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  let seed = 0x5f3759df;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      seed = lcg(seed + channel + 1);
      const noise = ((seed >>> 0) / 4294967295) * 2 - 1;
      data[index] = noise * Math.pow(1 - index / length, decay) * (channel ? 0.92 : 1);
    }
  }
  return buffer;
}

function scheduleFrom(position) {
  state.nextNoteIndex = lowerBoundNoteTime(position - 0.025);
  const options = getOptions();
  if (!options.diagnosticSolo) {
    scheduleDataBed(
      state.audio,
      state.audioGraph,
      state.audio.currentTime + 0.02,
      Math.max(0.1, getDuration() - position + 0.5),
      state.metrics,
      options,
      state.scheduled
    );
  }
  pumpSchedule();
  state.schedulerId = window.setInterval(pumpSchedule, 120);
}

function pumpSchedule() {
  if (!state.isPlaying || !state.audio || !state.audioGraph) return;
  const position = getCurrentPosition();
  const scheduleAhead = 2.4;
  const options = getOptions();

  while (state.nextNoteIndex < state.notes.length) {
    const note = state.notes[state.nextNoteIndex];
    if (note.time - position > scheduleAhead) break;
    const audible = !state.mutedVoices.has(note.fileIndex)
      && (!options.diagnosticSolo || note.eventType !== "clean");
    if (audible) {
      const at = Math.max(state.audio.currentTime + 0.018, state.startTime + note.time);
      scheduleNoteToGraph(note, state.audio, state.audioGraph, at, options, state.scheduled);
    }
    state.nextNoteIndex += 1;
  }
}

function scheduleNoteToGraph(note, context, graph, at, options, collector) {
  const profile = instrumentProfiles[options.instrument] || instrumentProfiles.glass;
  const primary = context.createOscillator();
  const partial = context.createOscillator();
  const partialGain = context.createGain();
  const filter = context.createBiquadFilter();
  const amplitude = context.createGain();
  const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
  const attackEnd = at + Math.min(profile.attack, note.duration * 0.28);
  const bodyEnd = at + Math.max(profile.attack + 0.02, note.duration * 0.62);
  const releaseEnd = at + note.duration + profile.release * (0.55 + note.qNorm * 0.45);
  const stereoPan = note.pan * options.stereo;
  const eventBoost = note.eventType === "clean" ? 1 : 1.08 + note.severity * 0.14;
  const peak = Math.max(0.0002, note.velocity * eventBoost);

  primary.type = note.wave;
  primary.frequency.setValueAtTime(note.frequency, at);
  primary.detune.setValueAtTime(note.driftCents, at);
  primary.detune.linearRampToValueAtTime(note.driftCents * -0.18, releaseEnd);

  partial.type = profile.partialType;
  partial.frequency.setValueAtTime(note.frequency * profile.partialRatio * (note.pair === 2 ? 0.75 : 1), at);
  partial.detune.setValueAtTime(note.driftCents * 0.54, at);
  partialGain.gain.setValueAtTime(0.0001, at);
  partialGain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, 0.045 + note.gc * 0.055 + note.qNorm * 0.045),
    attackEnd + 0.008
  );
  partialGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

  filter.type = "lowpass";
  const cutoff = (420 + Math.pow(note.qNorm, 1.7) * 7200) * profile.brightness;
  filter.frequency.setValueAtTime(clamp(cutoff, 260, 11000), at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * (0.58 + note.qNorm * 0.25)), releaseEnd);
  filter.Q.setValueAtTime(0.8 + note.gc * 2.2 + note.severity * 1.2, at);

  amplitude.gain.setValueAtTime(0.0001, at);
  amplitude.gain.exponentialRampToValueAtTime(peak, attackEnd);
  amplitude.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * profile.sustain), bodyEnd);
  amplitude.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

  if (panner.pan) panner.pan.setValueAtTime(clamp(stereoPan, -1, 1), at);

  primary.connect(filter);
  partial.connect(partialGain);
  partialGain.connect(filter);
  filter.connect(amplitude);
  amplitude.connect(panner);
  panner.connect(graph.input);

  startTrackedSource(primary, at, releaseEnd + 0.04, collector);
  startTrackedSource(partial, at, releaseEnd + 0.04, collector);

  if (note.severity >= 0.04) {
    scheduleQualityTexture(note, context, panner, primary, partial, at, releaseEnd, collector);
  }
  if (note.longestRun >= 5) {
    scheduleHomopolymerPulse(note, context, panner, at, collector);
  }
  if (note.eventType === "complexity") {
    scheduleComplexityMarker(note, context, panner, at, collector);
  }
  if (note.adapter) {
    scheduleAdapterMarker(note, context, panner, at, collector);
  }
  if (note.repeats >= 3 && note.eventType !== "ambiguous") {
    scheduleMotifEcho(note, context, panner, at, collector);
  }
}

function scheduleQualityTexture(note, context, panner, primary, partial, at, releaseEnd, collector) {
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(4.2 + (note.motifHash % 37) / 10, at);
  lfoGain.gain.setValueAtTime(5 + note.severity * 43, at);
  lfo.connect(lfoGain);
  lfoGain.connect(primary.detune);
  lfoGain.connect(partial.detune);

  const warning = context.createOscillator();
  const warningGain = context.createGain();
  warning.type = note.ambiguous ? "square" : "sine";
  warning.frequency.setValueAtTime(note.frequency * (note.ambiguous ? 1.18 : 0.5), at);
  warning.frequency.exponentialRampToValueAtTime(
    Math.max(28, note.frequency * (note.ambiguous ? 0.31 : 0.46)),
    Math.min(releaseEnd, at + 0.24 + note.severity * 0.16)
  );
  lfoGain.connect(warning.detune);
  warningGain.gain.setValueAtTime(0.0001, at);
  warningGain.gain.exponentialRampToValueAtTime(0.008 + note.severity * 0.052, at + 0.012);
  warningGain.gain.exponentialRampToValueAtTime(0.0001, Math.min(releaseEnd, at + 0.22 + note.severity * 0.16));
  warning.connect(warningGain);
  warningGain.connect(panner);

  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = getNoiseBuffer(context);
  noise.loop = true;
  noise.playbackRate.setValueAtTime(0.7 + (note.motifHash % 70) / 100, at);
  noiseFilter.type = note.ambiguous ? "bandpass" : "highpass";
  noiseFilter.frequency.setValueAtTime(480 + (note.motifHash % 3600), at);
  noiseFilter.Q.setValueAtTime(note.ambiguous ? 4.5 : 1.2, at);
  noiseGain.gain.setValueAtTime(0.0001, at);
  noiseGain.gain.exponentialRampToValueAtTime(0.006 + note.severity * 0.046, at + 0.009);
  const noiseEnd = Math.min(releaseEnd, at + 0.1 + note.severity * 0.22);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, noiseEnd);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(panner);

  startTrackedSource(lfo, at, releaseEnd + 0.02, collector);
  startTrackedSource(warning, at, Math.min(releaseEnd, at + 0.45), collector);
  startTrackedBuffer(noise, at, noiseEnd + 0.02, (note.motifHash % 900) / 1000, collector);
}

function scheduleHomopolymerPulse(note, context, panner, at, collector) {
  const pulse = context.createOscillator();
  const gain = context.createGain();
  pulse.type = "triangle";
  pulse.frequency.setValueAtTime(Math.max(28, note.frequency * 0.5), at);
  gain.gain.setValueAtTime(0.0001, at);
  const pulses = Math.min(5, note.longestRun - 2);
  for (let index = 0; index < pulses; index += 1) {
    const pulseAt = at + index * 0.045;
    gain.gain.setValueAtTime(0.0001, pulseAt);
    gain.gain.exponentialRampToValueAtTime(0.025, pulseAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, pulseAt + 0.032);
  }
  pulse.connect(gain);
  gain.connect(panner);
  startTrackedSource(pulse, at, at + pulses * 0.045 + 0.04, collector);
}

function scheduleComplexityMarker(note, context, panner, at, collector) {
  const marker = context.createOscillator();
  const gain = context.createGain();
  const ratio = note.motifHash % 2 ? 0.5 : 0.667;
  marker.type = "triangle";
  marker.frequency.setValueAtTime(Math.max(28, note.frequency * ratio), at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.023, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  gain.gain.setValueAtTime(0.0001, at + 0.09);
  gain.gain.exponentialRampToValueAtTime(0.017, at + 0.102);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
  marker.connect(gain);
  gain.connect(panner);
  startTrackedSource(marker, at, at + 0.19, collector);
}

function scheduleAdapterMarker(note, context, panner, at, collector) {
  const marker = context.createOscillator();
  const gain = context.createGain();
  marker.type = "sine";
  marker.frequency.setValueAtTime(note.frequency * 2.82, at);
  marker.frequency.exponentialRampToValueAtTime(note.frequency * 0.71, at + 0.34);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.045, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
  marker.connect(gain);
  gain.connect(panner);
  startTrackedSource(marker, at, at + 0.39, collector);
}

function scheduleMotifEcho(note, context, panner, at, collector) {
  const echo = context.createOscillator();
  const gain = context.createGain();
  const echoAt = at + Math.min(0.14, note.duration * 0.38);
  const echoEnd = echoAt + 0.12 + Math.min(0.16, Math.log2(note.repeats) * 0.025);
  echo.type = "sine";
  echo.frequency.setValueAtTime(note.frequency * 2, echoAt);
  gain.gain.setValueAtTime(0.0001, echoAt);
  gain.gain.exponentialRampToValueAtTime(Math.min(0.035, 0.012 + Math.log2(note.repeats) * 0.004), echoAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, echoEnd);
  echo.connect(gain);
  gain.connect(panner);
  startTrackedSource(echo, echoAt, echoEnd + 0.02, collector);
}

function scheduleDataBed(context, graph, at, duration, metrics, options, collector) {
  if (!metrics.bases || duration <= 0.05) return;
  const rootShift = Math.round(metrics.gcPercent * 5);
  const fingerprintSeed = parseInt(metrics.fingerprint.slice(-6), 16) || 1;
  const rootFrequency = midiToFrequency(options.rootMidi - 12 + rootShift);
  const qNorm = clamp(metrics.meanQ / 41, 0, 1);
  const end = at + duration;
  const fade = Math.min(1.2, duration * 0.2);
  const bedGain = context.createGain();
  const filter = context.createBiquadFilter();
  const left = context.createOscillator();
  const right = context.createOscillator();
  const width = context.createStereoPanner ? context.createStereoPanner() : context.createGain();

  left.type = "sine";
  right.type = "sine";
  left.frequency.setValueAtTime(rootFrequency, at);
  right.frequency.setValueAtTime(rootFrequency * 1.5, at);
  right.detune.setValueAtTime(((fingerprintSeed % 17) - 8) * 0.35, at);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(280 + qNorm * 1250, at);
  filter.Q.setValueAtTime(0.6 + metrics.gcPercent * 1.5, at);
  bedGain.gain.setValueAtTime(0.0001, at);
  bedGain.gain.exponentialRampToValueAtTime(0.012 + qNorm * 0.013, at + Math.max(0.02, fade));
  bedGain.gain.setValueAtTime(0.012 + qNorm * 0.013, Math.max(at + fade, end - fade));
  bedGain.gain.exponentialRampToValueAtTime(0.0001, end);
  if (width.pan) width.pan.setValueAtTime((metrics.gcPercent - 0.5) * options.stereo * 0.4, at);

  left.connect(filter);
  right.connect(filter);
  filter.connect(bedGain);
  bedGain.connect(width);
  width.connect(graph.input);
  startTrackedSource(left, at, end + 0.03, collector);
  startTrackedSource(right, at, end + 0.03, collector);
}

function getNoiseBuffer(context) {
  if (noiseBuffers.has(context)) return noiseBuffers.get(context);
  const length = Math.max(1, Math.floor(context.sampleRate * 1.25));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x1a2b3c4d;
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    seed = lcg(seed);
    const white = ((seed >>> 0) / 4294967295) * 2 - 1;
    previous = previous * 0.68 + white * 0.32;
    data[index] = previous;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

function startTrackedSource(source, startAt, stopAt, collector) {
  if (collector) {
    collector.add(source);
    source.addEventListener("ended", function () {
      collector.delete(source);
    }, { once: true });
  }
  source.start(startAt);
  source.stop(stopAt);
}

function startTrackedBuffer(source, startAt, stopAt, offset, collector) {
  if (collector) {
    collector.add(source);
    source.addEventListener("ended", function () {
      collector.delete(source);
    }, { once: true });
  }
  source.start(startAt, offset);
  source.stop(stopAt);
}

function stopScheduled() {
  window.clearInterval(state.schedulerId);
  state.schedulerId = 0;
  state.nextNoteIndex = 0;
  state.scheduled.forEach(function (node) {
    try {
      node.stop();
    } catch {
      // The source may already have ended.
    }
  });
  state.scheduled.clear();
}

function restartLiveAudio() {
  configureLiveAudio();
  if (!state.isPlaying || !state.audio) return;
  const position = getCurrentPosition();
  stopScheduled();
  state.pausedAt = position;
  state.startTime = state.audio.currentTime - position;
  scheduleFrom(position);
}

function animate() {
  cancelAnimationFrame(state.animationId);
  const tick = function () {
    if (!state.isPlaying) return;
    const position = getCurrentPosition();
    if (position >= getDuration()) {
      stop();
      return;
    }
    draw(position);
    updateScrubber(position);
    state.animationId = requestAnimationFrame(tick);
  };
  tick();
}

function draw(position) {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = els.canvas.width;
  const height = els.canvas.height;
  if (!width || !height) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);
  const w = width / pixelRatio;
  const h = height / pixelRatio;
  const options = getOptions();
  const viewport = getViewport(position);

  drawBackground(w, h, position, options);
  drawQualityRibbon(w, h, options);
  if (state.notes.length) {
    drawScore(w, h, position, viewport, options);
    const active = updateActiveNote(position);
    drawPlayhead(w, h, position, viewport, active);
    drawParticles(w, h, options);
  }
  ctx.restore();
}

function drawBackground(w, h, position, options) {
  const counts = state.metrics.baseCounts || {};
  const ranked = ["A", "C", "G", "T"].sort(function (left, right) {
    return (counts[right] || 0) - (counts[left] || 0);
  });
  const first = baseColors[ranked[0]] || "#4de0cf";
  const second = baseColors[ranked[1]] || "#ff6b6b";
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#0b0d11");
  gradient.addColorStop(0.48, mixCanvasColor("#0b0d11", first, state.metrics.bases ? 0.075 : 0.02));
  gradient.addColorStop(1, mixCanvasColor("#0b0d11", second, state.metrics.bases ? 0.09 : 0.025));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const motion = prefersReducedMotion() ? 0 : options.motion;
  const drift = (position * 13 * motion) % 44;
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = "#d8dde8";
  ctx.lineWidth = 1;
  for (let x = -44 + drift; x < w + 44; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 44; y < h; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  if (state.metrics.bases) {
    const gcY = h * (0.88 - state.metrics.gcPercent * 0.16);
    ctx.save();
    ctx.strokeStyle = colorWithAlpha(first, 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gcY);
    for (let x = 0; x <= w; x += 16) {
      const phase = (x / Math.max(1, w)) * Math.PI * 8 + position * 0.2 * motion;
      ctx.lineTo(x, gcY + Math.sin(phase) * (3 + state.metrics.gcPercent * 7));
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawQualityRibbon(w, h, options) {
  const qualities = state.metrics.qualityByPosition || [];
  if (!qualities.length) return;
  const top = h * 0.075;
  const ribbonHeight = Math.min(58, h * 0.12);
  const baseline = top + ribbonHeight;
  const thresholdY = top + ribbonHeight * (1 - clamp(options.qualityThreshold / 41, 0, 1));
  const lineGradient = ctx.createLinearGradient(0, top, 0, baseline);
  lineGradient.addColorStop(0, colorWithAlpha(qualityColors.clean, 0.52));
  lineGradient.addColorStop(0.55, colorWithAlpha(qualityColors.warning, 0.38));
  lineGradient.addColorStop(1, colorWithAlpha(qualityColors.critical, 0.26));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, baseline);
  qualities.forEach(function (quality, index) {
    const x = (index / Math.max(1, qualities.length - 1)) * w;
    const y = top + ribbonHeight * (1 - clamp(quality / 41, 0, 1));
    ctx.lineTo(x, y);
  });
  ctx.lineTo(w, baseline);
  ctx.closePath();
  ctx.fillStyle = lineGradient;
  ctx.globalAlpha = 0.36;
  ctx.fill();

  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = qualityColors.warning;
  ctx.setLineDash([5, 7]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colorWithAlpha("#f5f3ee", 0.48);
  ctx.font = "9px Consolas, monospace";
  ctx.fillText("Q" + options.qualityThreshold, 10, Math.max(11, thresholdY - 4));
  ctx.restore();
}

function drawScore(w, h, position, viewport, options) {
  const startIndex = lowerBoundNoteTime(viewport.start - 1);
  const visible = [];
  for (let index = startIndex; index < state.notes.length; index += 1) {
    const note = state.notes[index];
    if (note.time > viewport.end) break;
    if (note.time + note.duration >= viewport.start) visible.push(note);
  }

  if (options.view === "lanes") drawLaneGuides(w, h);
  if (options.view === "helix") drawHelixThreads(visible, w, h, position, viewport, options);

  visible.forEach(function (note) {
    drawNote(note, w, h, position, viewport, options);
  });
}

function drawLaneGuides(w, h) {
  const voiceCount = Math.max(1, state.metrics.voiceCount);
  const top = h * 0.2;
  const usable = h * 0.62;
  ctx.save();
  for (let index = 0; index <= voiceCount; index += 1) {
    const y = top + usable * (index / voiceCount);
    ctx.strokeStyle = colorWithAlpha(voiceColors[index % voiceColors.length], index === voiceCount ? 0.08 : 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHelixThreads(notes, w, h, position, viewport, options) {
  const byVoice = new Map();
  notes.forEach(function (note) {
    if (!byVoice.has(note.voiceIndex)) byVoice.set(note.voiceIndex, []);
    byVoice.get(note.voiceIndex).push(note);
  });

  ctx.save();
  byVoice.forEach(function (voiceNotes, voiceIndex) {
    ctx.beginPath();
    voiceNotes.forEach(function (note, index) {
      const x = timeToX(note.time, w, viewport);
      const y = noteY(note, x, w, h, position, options);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colorWithAlpha(voiceColors[voiceIndex % voiceColors.length], 0.22);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
  ctx.restore();
}

function drawNote(note, w, h, position, viewport, options) {
  const x = timeToX(note.time, w, viewport);
  const y = noteY(note, x, w, h, position, options);
  const length = Math.max(4, (note.duration / viewport.size) * w);
  const muted = state.mutedVoices.has(note.fileIndex);
  const soloMuted = options.diagnosticSolo && note.eventType === "clean";
  const alpha = (0.24 + note.qNorm * 0.68) * (muted || soloMuted ? 0.14 : 1);
  const size = 2.4 + note.qNorm * 3.7 + Math.min(2.5, Math.log2(note.repeats));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = note.color;
  ctx.fillStyle = note.color;
  ctx.lineWidth = 1 + note.qNorm * 1.8;

  if (note.severity > 0.24) {
    const fragments = 3 + Math.round(note.severity * 3);
    const seed = note.motifHash ^ note.position;
    for (let fragment = 0; fragment < fragments; fragment += 1) {
      const from = (fragment / fragments) * length;
      const to = ((fragment + 0.58) / fragments) * length;
      const offset = (seededUnit(seed + fragment * 97) - 0.5) * note.severity * 12;
      ctx.beginPath();
      ctx.moveTo(x + from, y + offset);
      ctx.lineTo(x + to, y - offset * 0.45);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }

  if (note.repeats >= 3) {
    ctx.strokeStyle = colorWithAlpha(note.qualityColor, 0.72);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + Math.min(length + 7, 28), y - 5);
    ctx.stroke();
  }

  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  if (note.ambiguous) {
    ctx.strokeStyle = note.qualityColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-size, -size, size * 2, size * 2);
  } else {
    ctx.fillRect(-size, -size, size * 2, size * 2);
  }
  ctx.restore();

  if (note.eventType !== "clean") {
    ctx.save();
    ctx.globalAlpha = (0.35 + note.severity * 0.55) * (muted ? 0.14 : 1);
    ctx.strokeStyle = note.qualityColor;
    ctx.lineWidth = note.adapter ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.84);
    ctx.lineTo(x, h * (0.86 + note.severity * 0.07));
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayhead(w, h, position, viewport, active) {
  if (!getDuration()) return;
  const x = timeToX(position, w, viewport);
  ctx.save();
  ctx.strokeStyle = colorWithAlpha("#f5f3ee", 0.68);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, h * 0.055);
  ctx.lineTo(x, h * 0.94);
  ctx.stroke();

  if (active) {
    const y = noteY(active, x, w, h, position, getOptions());
    ctx.strokeStyle = colorWithAlpha(active.qualityColor, 0.74);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.lineTo(x + 9, y);
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x, y + 9);
    ctx.stroke();
  }
  ctx.restore();
}

function updateActiveNote(position) {
  if (!state.notes.length) {
    resetActiveReadout();
    return null;
  }
  const candidateIndex = clamp(lowerBoundNoteTime(position + 0.055) - 1, 0, state.notes.length - 1);
  const note = state.notes[candidateIndex];
  if (state.activeNoteIndex !== candidateIndex) {
    state.activeNoteIndex = candidateIndex;
    updateActiveReadout(note);
    if (state.isPlaying && state.lastParticleNoteId !== note.id) {
      state.lastParticleNoteId = note.id;
      spawnParticles(note);
    }
  }
  return note;
}

function updateActiveReadout(note) {
  const spans = els.currentCodon.querySelectorAll("span");
  Array.from(note.codon).forEach(function (base, index) {
    const span = spans[index];
    span.textContent = base;
    span.style.setProperty("--base-color", baseColors[base] || baseColors.N);
  });
  els.currentQuality.textContent = "Q" + note.q.toFixed(1);
  els.currentEvent.textContent = eventLabel(note);
  els.currentPosition.textContent = "R" + note.pair + " / READ " + (note.readIndex + 1)
    + " / BP " + (note.position + 1) + "-" + (note.position + 3);
  els.currentMotif.textContent = "M-" + note.motifId;
  els.motifRepeat.textContent = note.repeats.toLocaleString() + (note.repeats === 1 ? " echo" : " echoes");
  els.activeReadout.dataset.event = note.eventType;
}

function resetActiveReadout() {
  els.currentCodon.querySelectorAll("span").forEach(function (span) {
    span.textContent = "-";
    span.style.removeProperty("--base-color");
  });
  els.currentQuality.textContent = "Q--";
  els.currentEvent.textContent = state.notes.length ? "Ready" : "Awaiting data";
  els.currentPosition.textContent = "READ -- / BP --";
  els.currentMotif.textContent = "----";
  els.motifRepeat.textContent = "0 echoes";
  els.activeReadout.dataset.event = "clean";
}

function spawnParticles(note) {
  const count = Math.min(18, 3 + Math.round(note.qNorm * 4 + note.severity * 8 + Math.log2(note.repeats + 1)));
  let seed = note.motifHash ^ (note.id * 2654435761);
  for (let index = 0; index < count; index += 1) {
    seed = lcg(seed + index);
    const angle = seededUnit(seed) * Math.PI * 2;
    const speed = 0.35 + seededUnit(seed ^ 0xa511e9b3) * (1.2 + note.severity * 1.8);
    state.particles.push({
      note,
      angle,
      speed,
      distance: 0,
      life: 1,
      width: 1 + note.qNorm * 2,
      length: 4 + seededUnit(seed ^ 0x63d83595) * 10,
      color: note.eventType === "clean" ? note.color : note.qualityColor,
    });
  }
  if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
}

function drawParticles(w, h, options) {
  const now = performance.now();
  const delta = state.lastDraw ? Math.min(40, now - state.lastDraw) / 16.67 : 1;
  state.lastDraw = now;
  const motion = prefersReducedMotion() ? 0 : options.motion;
  const viewport = getViewport(getCurrentPosition());
  const playheadX = timeToX(getCurrentPosition(), w, viewport);

  ctx.save();
  state.particles.forEach(function (particle) {
    particle.life -= (options.trails ? 0.018 : 0.033) * delta;
    particle.distance += particle.speed * delta * (0.35 + motion);
    if (particle.life <= 0) return;
    const originY = noteY(particle.note, playheadX, w, h, getCurrentPosition(), options);
    const x = playheadX + Math.cos(particle.angle) * particle.distance;
    const y = originY + Math.sin(particle.angle) * particle.distance;
    ctx.globalAlpha = particle.life * 0.74;
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.width * particle.life;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - Math.cos(particle.angle) * particle.length * particle.life,
      y - Math.sin(particle.angle) * particle.length * particle.life
    );
    ctx.stroke();
  });
  state.particles = state.particles.filter(function (particle) {
    return particle.life > 0;
  });
  ctx.restore();
}

function noteY(note, x, w, h, position, options) {
  const top = h * 0.18;
  const usable = h * 0.64;
  if (options.view === "lanes") {
    const voices = Math.max(1, state.metrics.voiceCount);
    const laneHeight = usable / voices;
    const laneTop = top + laneHeight * note.voiceIndex;
    return laneTop + laneHeight * (0.18 + note.y * 0.64);
  }
  if (options.view === "helix") {
    const voices = Math.max(1, state.metrics.voiceCount);
    const laneHeight = usable / voices;
    const center = top + laneHeight * (note.voiceIndex + 0.5);
    const motion = prefersReducedMotion() ? 0 : options.motion;
    const phase = note.phase + (x / Math.max(1, w)) * Math.PI * 5 + position * motion * 0.5;
    const amplitude = Math.min(laneHeight * 0.36, 22 + note.gc * 16);
    return center + Math.sin(phase) * amplitude + (note.y - 0.5) * laneHeight * 0.22;
  }
  return top + note.y * usable;
}

function getViewport(position) {
  const duration = getDuration();
  const tempoFactor = clamp(Number(els.tempoInput.value) / 88, 0.55, 1.7);
  const size = Math.min(Math.max(9, 23 / tempoFactor), Math.max(9, duration || 9));
  const start = Math.max(0, position - size * 0.22);
  return { start, end: start + size, size };
}

function timeToX(time, width, viewport) {
  return ((time - viewport.start) / Math.max(0.001, viewport.size)) * width;
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  els.canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
}

function renderFiles(files) {
  els.fileList.innerHTML = "";
  if (!files.length) {
    const empty = document.createElement("p");
    empty.className = "status-text";
    empty.textContent = "No voices loaded.";
    els.fileList.append(empty);
    return;
  }

  files.forEach(function (file, index) {
    const report = state.fileReports.find(function (item) {
      return item.fileIndex === index;
    });
    const item = document.createElement("div");
    item.className = "file-item";
    const swatch = document.createElement("i");
    swatch.className = "file-swatch";
    swatch.style.setProperty("--voice-color", voiceColors[index % voiceColors.length]);
    const copy = document.createElement("div");
    copy.className = "file-copy";
    const name = document.createElement("strong");
    name.textContent = file.name;
    const meta = document.createElement("small");
    if (report) {
      meta.textContent = "R" + report.pair + " / " + report.reads.toLocaleString() + " reads"
        + (report.warnings ? " / " + report.warnings + " skipped" : "");
    } else {
      meta.textContent = formatBytes(file.size);
    }
    copy.append(name, meta);
    item.append(swatch, copy);
    els.fileList.append(item);
  });
}

function renderVoiceLegend() {
  els.voiceLegend.innerHTML = "";
  state.files.forEach(function (file, index) {
    const report = state.fileReports.find(function (item) {
      return item.fileIndex === index;
    });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "voice-button";
    button.style.setProperty("--voice-color", voiceColors[index % voiceColors.length]);
    button.setAttribute("aria-pressed", String(state.mutedVoices.has(index)));
    button.title = state.mutedVoices.has(index) ? "Unmute voice" : "Mute voice";
    button.textContent = "R" + (report ? report.pair : index + 1) + " / V" + (index + 1);
    button.addEventListener("click", function () {
      if (state.mutedVoices.has(index)) state.mutedVoices.delete(index);
      else state.mutedVoices.add(index);
      renderVoiceLegend();
      restartLiveAudio();
      draw(getCurrentPosition());
    });
    els.voiceLegend.append(button);
  });
}

function updateMetrics(metrics) {
  els.readsMetric.textContent = metrics.reads.toLocaleString();
  els.basesMetric.textContent = metrics.bases.toLocaleString();
  els.qualityMetric.textContent = metrics.meanQ.toFixed(1);
  els.lowQualityMetric.textContent = metrics.lowQualityBases.toLocaleString();
  els.ambiguousMetric.textContent = metrics.ambiguousBases.toLocaleString();
  els.gcMetric.textContent = Math.round(metrics.gcPercent * 100) + "%";
  els.qualityMeter.style.transform = "scaleX(" + clamp(metrics.meanQ / 41, 0, 1) + ")";
  els.fingerprintLabel.textContent = "MAP / " + (metrics.fingerprint || "--------");
  els.timeLabel.textContent = formatTime(metrics.duration || 0);
  ["A", "C", "G", "T"].forEach(function (base) {
    const node = els.miniSummary.querySelector("[data-base='" + base + "'] b");
    if (node) node.textContent = compactNumber(metrics.baseCounts[base] || 0);
  });
}

function updateScrubber(position) {
  const duration = getDuration();
  els.scrubber.value = duration ? Math.round((position / duration) * 1000) : 0;
  updateTime(position);
}

function updateTime(position) {
  els.elapsedLabel.textContent = formatTime(position);
  els.timeLabel.textContent = formatTime(getDuration());
}

function setStatus(label, text) {
  els.statusPill.textContent = label;
  els.statusPill.dataset.state = label.toLowerCase();
  els.statusText.textContent = text;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(function () {
    els.toast.classList.remove("is-visible");
  }, 3200);
}

async function exportWav() {
  if (!state.notes.length || state.exportInProgress) return;
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) {
    showToast("Offline WAV rendering is not available in this browser.");
    return;
  }

  const options = getOptions();
  const duration = getDuration() + 2.2;
  if (duration > 600) {
    showToast("This score is over 10 minutes. Reduce maximum notes before WAV export.");
    return;
  }

  state.exportInProgress = true;
  els.wavButton.disabled = true;
  els.midiButton.disabled = true;
  els.scoreButton.disabled = true;
  setStatus("Rendering", "Building the WAV from the current data score.");
  await nextFrame();

  try {
    const sampleRate = duration > 240 ? 32000 : 44100;
    const offline = new OfflineContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const graph = createAudioGraph(offline, offline.destination, options);
    if (!options.diagnosticSolo) {
      scheduleDataBed(offline, graph, 0.04, duration - 0.08, state.metrics, options, null);
    }
    state.notes.forEach(function (note) {
      if (state.mutedVoices.has(note.fileIndex)) return;
      if (options.diagnosticSolo && note.eventType === "clean") return;
      scheduleNoteToGraph(note, offline, graph, note.time + 0.04, options, null);
    });
    const rendered = await offline.startRendering();
    const blob = audioBufferToWav(rendered);
    downloadBlob(blob, outputStem() + "_sonified.wav");
    setStatus("Ready", "WAV rendered from " + state.notes.length.toLocaleString() + " data notes.");
    showToast("WAV rendered.");
  } catch (error) {
    console.error(error);
    setStatus("Error", "WAV rendering failed.");
    showToast(error.message || "Could not render the WAV.");
  } finally {
    state.exportInProgress = false;
    els.wavButton.disabled = !state.notes.length;
    els.midiButton.disabled = !state.notes.length;
    els.scoreButton.disabled = !state.notes.length;
  }
}

function exportMidi() {
  if (!state.notes.length || state.exportInProgress) return;
  try {
    const bytes = buildMidiFile();
    downloadBlob(new Blob([bytes], { type: "audio/midi" }), outputStem() + "_sonified.mid");
    showToast("MIDI exported with pitch, rhythm, velocity and brightness from the FASTQ score.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not create the MIDI file.");
  }
}

function exportScore() {
  if (!state.notes.length || state.exportInProgress) return;
  const score = {
    format: "FASTQ Sonifier score",
    mappingVersion: MAPPING_VERSION,
    createdAt: new Date().toISOString(),
    files: state.files.map(function (file, index) {
      return {
        name: file.name,
        size: file.size,
        report: state.fileReports[index] || null,
      };
    }),
    settings: getOptions(),
    mutedVoices: Array.from(state.mutedVoices),
    metrics: state.metrics,
    notes: state.notes.map(function (note) {
      return {
        time: note.time,
        duration: note.duration,
        midi: note.midi,
        quality: note.q,
        minimumQuality: note.qMin,
        qualityValues: note.qValues,
        codon: note.codon,
        motif: note.motif,
        motifId: note.motifId,
        repeats: note.repeats,
        event: note.eventType,
        fileIndex: note.fileIndex,
        pair: note.pair,
        readIndex: note.readIndex,
        basePosition: note.position,
      };
    }),
  };
  const blob = new Blob([JSON.stringify(score, null, 2)], { type: "application/json" });
  downloadBlob(blob, outputStem() + "_sonified_score.json");
  showToast("Exact mapping and data score exported.");
}

function buildMidiFile() {
  const options = getOptions();
  const ppq = 480;
  const ticksPerSecond = ppq * options.tempo / 60;
  const microseconds = Math.round(60000000 / options.tempo);
  const events = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x51, 0x03, (microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff],
    },
  ];
  const nameBytes = asciiBytes("FASTQ Sonifier " + MAPPING_VERSION);
  events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, nameBytes.length].concat(nameBytes) });

  const programMap = { glass: 10, strings: 48, marimba: 12, pulse: 80 };
  const usedChannels = new Set();
  state.notes.forEach(function (note) {
    if (state.mutedVoices.has(note.fileIndex)) return;
    if (options.diagnosticSolo && note.eventType === "clean") return;
    let channel = note.fileIndex % 15;
    if (channel >= 9) channel += 1;
    if (!usedChannels.has(channel)) {
      usedChannels.add(channel);
      events.push({ tick: 0, order: 1, bytes: [0xc0 | channel, programMap[options.instrument] || 10] });
    }
    const startTick = Math.max(0, Math.round(note.time * ticksPerSecond));
    const endTick = Math.max(startTick + 1, Math.round((note.time + note.duration) * ticksPerSecond));
    const midi = clamp(Math.round(note.midi), 0, 127);
    const velocity = clamp(Math.round(24 + note.qNorm * 92 + note.severity * 8), 1, 127);
    const brightness = clamp(Math.round(note.qNorm * 127), 0, 127);
    events.push({ tick: startTick, order: 2, bytes: [0xb0 | channel, 74, brightness] });
    events.push({ tick: startTick, order: 3, bytes: [0x90 | channel, midi, velocity] });
    events.push({ tick: endTick, order: 1, bytes: [0x80 | channel, midi, 0] });
  });

  events.sort(function (left, right) {
    return left.tick - right.tick || left.order - right.order;
  });
  const track = [];
  let previousTick = 0;
  events.forEach(function (event) {
    track.push.apply(track, encodeVariableLength(event.tick - previousTick));
    track.push.apply(track, event.bytes);
    previousTick = event.tick;
  });
  track.push(0x00, 0xff, 0x2f, 0x00);

  const header = asciiBytes("MThd").concat([
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (ppq >> 8) & 0xff, ppq & 0xff,
  ]);
  const trackHeader = asciiBytes("MTrk").concat(uint32Bytes(track.length));
  return new Uint8Array(header.concat(trackHeader, track));
}

function encodeVariableLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(arrayBuffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, frameCount * blockAlign, true);

  const channelData = [];
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel));
  }
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(channelData[channel][frame], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1500);
}

function outputStem() {
  if (!state.files.length) return "fastq";
  const names = state.files.map(function (file) {
    return file.name.replace(/\.(fastq|fq)(\.gz)?$/i, "");
  });
  let prefix = names[0];
  names.slice(1).forEach(function (name) {
    while (prefix && name.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
  });
  return (prefix.replace(/[_\-.]+$/, "") || "fastq").replace(/[^a-z0-9_.-]+/gi, "_");
}

function getCurrentPosition() {
  if (state.isPlaying && state.audio) {
    return Math.max(0, state.audio.currentTime - state.startTime);
  }
  return state.pausedAt;
}

function getDuration() {
  return state.metrics.duration || 0;
}

function lowerBoundNoteTime(time) {
  let low = 0;
  let high = state.notes.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (state.notes[middle].time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function eventLabel(note) {
  if (note.eventType === "ambiguous") return "Ambiguous base call";
  if (note.eventType === "adapter") return "Adapter-like sequence";
  if (note.eventType === "critical") return "Low quality fracture";
  if (note.eventType === "warning") return "Quality warning";
  if (note.eventType === "homopolymer") return note.longestRun + "-base homopolymer";
  if (note.eventType === "complexity") return "Low-complexity motif";
  return "Clean codon";
}

function emptyMetrics() {
  return {
    reads: 0,
    bases: 0,
    baseCounts: { A: 0, C: 0, G: 0, T: 0, N: 0 },
    qualityTotal: 0,
    qualityHistogram: Array(20).fill(0),
    meanQ: 0,
    gc: 0,
    gcPercent: 0,
    lowQualityBases: 0,
    ambiguousBases: 0,
    lowQualityNotes: 0,
    homopolymerEvents: 0,
    adapterEvents: 0,
    repeatedMotifs: 0,
    notes: 0,
    duration: 0,
    qualityByPosition: [],
    fingerprint: "",
    voiceCount: 0,
  };
}

function normalizeSequence(sequence, length) {
  let normalized = "";
  for (let index = 0; index < length; index += 1) {
    normalized += normalizeBase(sequence[index] || "N");
  }
  return normalized;
}

function normalizeBase(base) {
  const upper = String(base || "N").toUpperCase();
  if (upper === "U") return "T";
  return upper === "A" || upper === "C" || upper === "G" || upper === "T" ? upper : "N";
}

function codonToValue(codon) {
  return Array.from(codon).reduce(function (value, base) {
    return value * 4 + (baseValue[base] || 0);
  }, 0);
}

function averageQuality(quality, length) {
  if (!length) return 0;
  let total = 0;
  for (let index = 0; index < length; index += 1) total += phred(quality[index]);
  return total / length;
}

function gcFraction(sequence, length) {
  if (!length) return 0;
  let gc = 0;
  for (let index = 0; index < length; index += 1) {
    const base = normalizeBase(sequence[index]);
    if (base === "G" || base === "C") gc += 1;
  }
  return gc / length;
}

function longestBaseRun(sequence) {
  let longest = 0;
  let current = 0;
  let previous = "";
  Array.from(sequence).forEach(function (base) {
    if (base === previous && base !== "N") current += 1;
    else current = base === "N" ? 0 : 1;
    previous = base;
    longest = Math.max(longest, current);
  });
  return longest;
}

function sequenceComplexity(sequence) {
  if (!sequence.length) return 0;
  const counts = { A: 0, C: 0, G: 0, T: 0, N: 0 };
  Array.from(sequence).forEach(function (base) {
    counts[normalizeBase(base)] += 1;
  });
  let entropy = 0;
  Object.keys(counts).forEach(function (base) {
    const probability = counts[base] / sequence.length;
    if (probability > 0) entropy -= probability * Math.log2(probability);
  });
  return clamp(entropy / Math.log2(5), 0, 1);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixHash(left, right) {
  let value = (left ^ right) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  return (value ^ (value >>> 16)) >>> 0;
}

function hexHash(value, length) {
  return (value >>> 0).toString(16).toUpperCase().padStart(length, "0").slice(-length);
}

function seededUnit(seed) {
  return (lcg(seed) >>> 0) / 4294967295;
}

function lcg(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function phred(char) {
  return char ? Math.max(0, char.charCodeAt(0) - 33) : 0;
}

function average(values) {
  return values.length
    ? values.reduce(function (sum, value) {
      return sum + value;
    }, 0) / values.length
    : 0;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isFastqName(file) {
  return /\.(fastq|fq)(\.gz)?$/i.test(file.name);
}

function asPercent(value) {
  return Number(value) + "%";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units.shift();
  while (value >= 1024 && units.length) {
    value /= 1024;
    unit = units.shift();
  }
  return value.toFixed(value >= 100 ? 0 : 1) + " " + unit;
}

function compactNumber(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return String(value);
}

function formatTime(seconds) {
  const rounded = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return mins + ":" + String(secs).padStart(2, "0");
}

function colorWithAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function mixCanvasColor(leftHex, rightHex, amount) {
  const left = hexChannels(leftHex);
  const right = hexChannels(rightHex);
  const mixed = left.map(function (value, index) {
    return Math.round(value + (right[index] - value) * amount);
  });
  return "rgb(" + mixed.join(",") + ")";
}

function hexChannels(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function asciiBytes(text) {
  return Array.from(text).map(function (character) {
    return character.charCodeAt(0) & 0x7f;
  });
}

function uint32Bytes(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function nextFrame() {
  return new Promise(function (resolve) {
    requestAnimationFrame(resolve);
  });
}

window.fastqSonifierTest = {
  buildScore,
  createFastqParser,
  detectPair,
  normalizeSequence,
  qualitySeverity,
  sequenceComplexity,
  longestBaseRun,
  hashText,
  mappingVersion: MAPPING_VERSION,
};
