(function (root) {
  "use strict";

  // Every example is generated from a fixed pseudo-random seed. None is
  // derived from a person, organism, sequencing run, or supplied FASTQ file.
  const READS_PER_FILE = 600;
  const READ_LENGTH = 150;
  const BASES = ["A", "C", "G", "T"];
  const DEFAULT_DATASET_ID = "clean";
  const DATASET_ORDER = Object.freeze(["clean", "quality-crash", "pattern-storm"]);

  function frozenDataset(details) {
    return Object.freeze({
      id: details.id,
      name: details.name,
      shortName: details.shortName,
      description: details.description,
      qcSummary: details.qcSummary,
      readsPerFile: READS_PER_FILE,
      totalReads: READS_PER_FILE * 2,
      readLength: READ_LENGTH,
      paired: true,
      phredEncoding: "Phred+33",
      fileNames: Object.freeze(details.fileNames.slice()),
    });
  }

  const datasets = Object.freeze({
    clean: frozenDataset({
      id: "clean",
      name: "Crystal Clear",
      shortName: "Clean",
      description: "Balanced bases and consistently high quality create a calm reference run.",
      qcSummary: "Balanced composition; approximately Q38-Q40 throughout; no deliberate warning motifs.",
      fileNames: [
        "fastq-sonifier-crystal-clear_R1.fastq",
        "fastq-sonifier-crystal-clear_R2.fastq",
      ],
    }),
    "quality-crash": frozenDataset({
      id: "quality-crash",
      name: "Quality Crash",
      shortName: "Quality crash",
      description: "An AT-rich run with ambiguous calls and a severe 3-prime quality collapse.",
      qcSummary: "Strong positional quality decay, many Q<20 bases, and recurring N blocks; no deliberate adapters.",
      fileNames: [
        "fastq-sonifier-quality-crash_R1.fastq",
        "fastq-sonifier-quality-crash_R2.fastq",
      ],
    }),
    "pattern-storm": frozenDataset({
      id: "pattern-storm",
      name: "Pattern Storm",
      shortName: "Pattern storm",
      description: "A high-quality, GC-rich run packed with adapters, repeats, and homopolymers.",
      qcSummary: "Mostly Q37-Q40 with pronounced GC bias, adapter signatures, low complexity, and long G/C runs.",
      fileNames: [
        "fastq-sonifier-pattern-storm_R1.fastq",
        "fastq-sonifier-pattern-storm_R2.fastq",
      ],
    }),
  });

  const profiles = Object.freeze({
    clean: Object.freeze({
      id: "clean",
      seed: 0x434c4541,
      baseWeights: Object.freeze([0.25, 0.25, 0.25, 0.25]),
      maxBackgroundRun: 3,
      fileNames: datasets.clean.fileNames,
    }),
    "quality-crash": Object.freeze({
      id: "quality-crash",
      seed: 0x51435253,
      baseWeights: Object.freeze([0.38, 0.13, 0.13, 0.36]),
      maxBackgroundRun: 3,
      fileNames: datasets["quality-crash"].fileNames,
    }),
    "pattern-storm": Object.freeze({
      id: "pattern-storm",
      seed: 0x5053544d,
      baseWeights: Object.freeze([0.08, 0.42, 0.42, 0.08]),
      maxBackgroundRun: 3,
      fileNames: datasets["pattern-storm"].fileNames,
    }),
  });

  const metadata = Object.freeze({
    name: "FASTQ Sonifier synthetic paired examples",
    description: "Three wholly synthetic, deterministic FASTQ pairs generated locally in the browser.",
    provenance: "Generated algorithmically; not derived from real biological or sequencing data.",
    readsPerFile: READS_PER_FILE,
    totalReads: READS_PER_FILE * 2,
    readLength: READ_LENGTH,
    paired: true,
    phredEncoding: "Phred+33",
    fileNames: datasets[DEFAULT_DATASET_ID].fileNames,
    defaultDataset: DEFAULT_DATASET_ID,
    datasetCount: DATASET_ORDER.length,
    datasetOrder: DATASET_ORDER,
    datasets: datasets,
  });

  function assertMate(mate) {
    const value = Number(mate);
    if (value !== 1 && value !== 2) {
      throw new RangeError("FASTQ mate must be 1 or 2.");
    }
    return value;
  }

  function assertReadNumber(readNumber) {
    const value = Number(readNumber);
    if (!Number.isInteger(value) || value < 1 || value > READS_PER_FILE) {
      throw new RangeError("Synthetic read number must be between 1 and " + READS_PER_FILE + ".");
    }
    return value;
  }

  function resolveProfile(datasetId) {
    if (datasetId === undefined || datasetId === null || datasetId === "") {
      return profiles[DEFAULT_DATASET_ID];
    }

    const id = String(datasetId).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(profiles, id)) {
      throw new RangeError(
        "Unknown synthetic dataset '" + datasetId + "'. Choose " + DATASET_ORDER.join(", ") + "."
      );
    }
    return profiles[id];
  }

  function getDataset(datasetId) {
    const id = datasetId === undefined || datasetId === null || datasetId === ""
      ? DEFAULT_DATASET_ID
      : String(datasetId).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(datasets, id)) {
      throw new RangeError(
        "Unknown synthetic dataset '" + datasetId + "'. Choose " + DATASET_ORDER.join(", ") + "."
      );
    }
    return datasets[id];
  }

  function mix32(value) {
    let mixed = value >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return mixed >>> 0;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readSeed(profile, readNumber, mate, stream) {
    return mix32(
      profile.seed
      ^ Math.imul(readNumber, 0x9e3779b1)
      ^ Math.imul(mate, 0x85ebca6b)
      ^ Math.imul(stream, 0xc2b2ae35)
    );
  }

  function weightedBase(random, weights) {
    const target = random();
    let cumulative = 0;
    for (let index = 0; index < BASES.length; index += 1) {
      cumulative += weights[index];
      if (target < cumulative) return BASES[index];
    }
    return "T";
  }

  function alternativeBase(base, random, weights) {
    const alternatives = BASES.filter(function (candidate) {
      return candidate !== base;
    });
    const weightedAlternatives = alternatives.map(function (candidate) {
      return weights[BASES.indexOf(candidate)];
    });
    const total = weightedAlternatives.reduce(function (sum, weight) {
      return sum + weight;
    }, 0);
    let target = random() * total;
    for (let index = 0; index < alternatives.length; index += 1) {
      target -= weightedAlternatives[index];
      if (target <= 0) return alternatives[index];
    }
    return alternatives[alternatives.length - 1];
  }

  function buildBaselineSequence(readNumber, mate, profile) {
    const random = seededRandom(readSeed(profile, readNumber, mate, 1));
    const sequence = [];

    if (profile.id === "clean") {
      // Shuffled four-base blocks keep every local window diverse while the
      // order remains seed-driven and different for every read and mate.
      while (sequence.length < READ_LENGTH) {
        const block = BASES.slice();
        for (let index = block.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(random() * (index + 1));
          const swap = block[index];
          block[index] = block[swapIndex];
          block[swapIndex] = swap;
        }
        sequence.push.apply(sequence, block);
      }
      const cleanSequence = sequence.slice(0, READ_LENGTH);
      const tailBlock = BASES.slice();
      for (let index = tailBlock.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        const swap = tailBlock[index];
        tailBlock[index] = tailBlock[swapIndex];
        tailBlock[swapIndex] = swap;
      }
      for (let position = READ_LENGTH - 6; position < READ_LENGTH; position += 1) {
        cleanSequence[position] = tailBlock[(position - (READ_LENGTH - 6)) % tailBlock.length];
      }
      return cleanSequence;
    }

    let previous = "";
    let runLength = 0;

    for (let position = 0; position < READ_LENGTH; position += 1) {
      let base = weightedBase(random, profile.baseWeights);

      // Keep background reads varied. Deliberate runs are added afterwards.
      if (base === previous && runLength >= profile.maxBackgroundRun) {
        base = alternativeBase(base, random, profile.baseWeights);
      }

      if (base === previous) {
        runLength += 1;
      } else {
        previous = base;
        runLength = 1;
      }
      sequence.push(base);
    }

    return sequence;
  }

  function buildBaselineQualities(readNumber, mate, profile) {
    const random = seededRandom(readSeed(profile, readNumber, mate, 2));
    const qualities = [];

    for (let position = 0; position < READ_LENGTH; position += 1) {
      if (profile.id === "clean") {
        const positionalDecay = position > 124 ? 1 : 0;
        qualities.push(clampQuality(39 - positionalDecay + Math.floor(random() * 3) - 1));
      } else if (profile.id === "quality-crash") {
        qualities.push(clampQuality(37 + Math.floor(random() * 4) - 2));
      } else {
        qualities.push(clampQuality(39 + Math.floor(random() * 3) - 1));
      }
    }

    return qualities;
  }

  function patternStormProfile(readNumber) {
    switch ((readNumber - 1) % 4) {
      case 0:
        return "adapter-rich";
      case 1:
        return "homopolymer-rich";
      case 2:
        return "low-complexity-rich";
      default:
        return "combined-patterns";
    }
  }

  function replaceAt(target, start, replacement) {
    for (let offset = 0; offset < replacement.length; offset += 1) {
      target[start + offset] = replacement[offset];
    }
  }

  function applyQualityRamp(qualities, start, startQ, endQ) {
    const span = Math.max(1, qualities.length - start - 1);
    for (let position = start; position < qualities.length; position += 1) {
      const fraction = (position - start) / span;
      qualities[position] = clampQuality(Math.round(startQ + (endQ - startQ) * fraction));
    }
  }

  function applyQualityCrash(sequence, qualities, readNumber, mate) {
    const tailStart = 48 + ((readNumber * 7 + mate * 11) % 29);
    const tailStartQ = 31 + ((readNumber + mate) % 4);
    const tailEndQ = 2 + ((readNumber + mate * 2) % 5);
    applyQualityRamp(qualities, tailStart, tailStartQ, tailEndQ);

    const firstN = 15 + ((readNumber * 11 + mate * 7) % 32);
    const firstNLength = 3 + ((readNumber + mate) % 5);
    replaceAt(sequence, firstN, "N".repeat(firstNLength));
    for (let position = firstN - 1; position <= firstN + firstNLength; position += 1) {
      qualities[position] = clampQuality(5 + ((position + readNumber + mate) % 7));
    }

    if (readNumber % 3 === 0) {
      const windowStart = 30 + ((readNumber + mate * 5) % 17);
      for (let position = windowStart; position < windowStart + 21; position += 1) {
        qualities[position] = clampQuality(6 + ((position + mate) % 8));
      }
    }

    if (readNumber % 4 === 0) {
      const secondN = 96 + ((readNumber + mate * 3) % 21);
      replaceAt(sequence, secondN, "N".repeat(6 + (mate % 2)));
      for (let position = secondN; position < secondN + 7; position += 1) {
        qualities[position] = clampQuality(3 + ((position + readNumber) % 5));
      }
    }
  }

  function applyPatternStorm(sequence, qualities, diagnostic, readNumber, mate) {
    const forwardAdapter = "AGATCGGAAGAG";
    const reverseAdapter = "CTCTTCCGATCT";
    const adapter = mate === 1 ? forwardAdapter : reverseAdapter;
    const homopolymer = mate === 1 ? "G".repeat(15) : "C".repeat(15);
    const lowComplexity = mate === 1 ? "GC".repeat(24) : "CG".repeat(24);

    if (diagnostic === "adapter-rich") {
      replaceAt(sequence, 21, adapter);
      replaceAt(sequence, 105, adapter);
    } else if (diagnostic === "homopolymer-rich") {
      replaceAt(sequence, 36, homopolymer);
      replaceAt(sequence, 93, homopolymer);
    } else if (diagnostic === "low-complexity-rich") {
      replaceAt(sequence, 27, lowComplexity);
      replaceAt(sequence, 102, (mate === 1 ? "GGC" : "CCG").repeat(12));
    } else {
      replaceAt(sequence, 12, adapter);
      replaceAt(sequence, 51, lowComplexity.slice(0, 36));
      replaceAt(sequence, 99, homopolymer);
    }

    // Very occasional small Q dips prevent the run from looking mechanically
    // perfect without obscuring its sequence-driven event signature.
    if (readNumber % 20 === 0) {
      const dipStart = 78 + mate * 3;
      for (let position = dipStart; position < dipStart + 6; position += 1) {
        qualities[position] = 32 + ((position + mate) % 3);
      }
    }
  }

  function clampQuality(value) {
    return Math.max(2, Math.min(40, Math.round(value)));
  }

  function encodeQuality(qualities) {
    return qualities.map(function (quality) {
      return String.fromCharCode(clampQuality(quality) + 33);
    }).join("");
  }

  function buildHeader(readNumber, mate, profile) {
    return "@FASTQ_SONIFIER_"
      + profile.id.toUpperCase().replace(/-/g, "_")
      + "_"
      + String(readNumber).padStart(6, "0")
      + "/"
      + mate;
  }

  function buildRead(readNumber, mate, datasetId) {
    const safeReadNumber = assertReadNumber(readNumber);
    const safeMate = assertMate(mate);
    const profile = resolveProfile(datasetId);
    const sequence = buildBaselineSequence(safeReadNumber, safeMate, profile);
    const qualities = buildBaselineQualities(safeReadNumber, safeMate, profile);
    let diagnostic = "typical";

    if (profile.id === "quality-crash") {
      diagnostic = "quality-crash";
      applyQualityCrash(sequence, qualities, safeReadNumber, safeMate);
    } else if (profile.id === "pattern-storm") {
      diagnostic = patternStormProfile(safeReadNumber);
      applyPatternStorm(sequence, qualities, diagnostic, safeReadNumber, safeMate);
    }

    return Object.freeze({
      header: buildHeader(safeReadNumber, safeMate, profile),
      sequence: sequence.join(""),
      separator: "+",
      quality: encodeQuality(qualities),
      readNumber: safeReadNumber,
      mate: safeMate,
      datasetId: profile.id,
      profile: diagnostic,
    });
  }

  function buildFastqText(mate, datasetId) {
    const safeMate = assertMate(mate);
    // Resolve before looping so an invalid ID fails without doing any work.
    resolveProfile(datasetId);
    const records = [];

    for (let readNumber = 1; readNumber <= READS_PER_FILE; readNumber += 1) {
      const read = buildRead(readNumber, safeMate, datasetId);
      records.push(read.header, read.sequence, read.separator, read.quality);
    }

    return records.join("\n") + "\n";
  }

  function buildPairTexts(datasetId) {
    resolveProfile(datasetId);
    return Object.freeze({
      r1: buildFastqText(1, datasetId),
      r2: buildFastqText(2, datasetId),
    });
  }

  function createFiles(datasetId) {
    const FileConstructor = root && root.File;
    if (typeof FileConstructor !== "function") {
      throw new Error("This browser does not provide the File API required to load the synthetic example.");
    }

    const profile = resolveProfile(datasetId);
    const pair = buildPairTexts(datasetId);
    return [
      new FileConstructor([pair.r1], profile.fileNames[0], { type: "text/plain", lastModified: 0 }),
      new FileConstructor([pair.r2], profile.fileNames[1], { type: "text/plain", lastModified: 0 }),
    ];
  }

  root.fastqSonifierExample = Object.freeze({
    metadata: metadata,
    datasets: datasets,
    datasetOrder: DATASET_ORDER,
    defaultDataset: DEFAULT_DATASET_ID,
    getDataset: getDataset,
    buildRead: buildRead,
    buildFastqText: buildFastqText,
    buildPairTexts: buildPairTexts,
    buildPair: buildPairTexts,
    createFiles: createFiles,
  });
})(typeof window !== "undefined" ? window : globalThis);
