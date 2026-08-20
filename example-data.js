(function (root) {
  "use strict";

  // This example is generated from a fixed pseudo-random seed. It is not
  // derived from a person, organism, sequencing run, or supplied FASTQ file.
  const READS_PER_FILE = 600;
  const READ_LENGTH = 150;
  const DATASET_SEED = 0x46515332;
  const BASES = ["A", "C", "G", "T"];
  const FILE_NAMES = Object.freeze([
    "fastq-sonifier-synthetic_R1.fastq",
    "fastq-sonifier-synthetic_R2.fastq",
  ]);

  const metadata = Object.freeze({
    name: "FASTQ Sonifier synthetic paired example",
    description: "Wholly synthetic, deterministic FASTQ reads generated locally in the browser.",
    provenance: "Generated algorithmically; not derived from real biological or sequencing data.",
    readsPerFile: READS_PER_FILE,
    totalReads: READS_PER_FILE * 2,
    readLength: READ_LENGTH,
    paired: true,
    phredEncoding: "Phred+33",
    fileNames: FILE_NAMES,
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

  function readSeed(readNumber, mate, stream) {
    return mix32(
      DATASET_SEED
      ^ Math.imul(readNumber, 0x9e3779b1)
      ^ Math.imul(mate, 0x85ebca6b)
      ^ Math.imul(stream, 0xc2b2ae35)
    );
  }

  function buildBaselineSequence(readNumber, mate) {
    const random = seededRandom(readSeed(readNumber, mate, 1));
    const sequence = [];
    let previous = "";
    let runLength = 0;

    for (let position = 0; position < READ_LENGTH; position += 1) {
      let base = BASES[Math.floor(random() * BASES.length)];

      // Keep the background stream varied so deliberate homopolymers are
      // clearly visible to the quality-control display.
      if (base === previous && runLength >= 3) {
        base = BASES[(BASES.indexOf(base) + 1 + Math.floor(random() * 3)) % BASES.length];
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

  function buildBaselineQualities(readNumber, mate) {
    const random = seededRandom(readSeed(readNumber, mate, 2));
    const qualities = [];

    for (let position = 0; position < READ_LENGTH; position += 1) {
      const positionalDecay = Math.floor((position / (READ_LENGTH - 1)) * 7);
      const jitter = Math.floor(random() * 5) - 2;
      qualities.push(clampQuality(38 - positionalDecay + jitter));
    }

    return qualities;
  }

  function diagnosticProfile(readNumber) {
    switch ((readNumber - 1) % 50) {
      case 0:
        return "adapter";
      case 1:
        return "ambiguous";
      case 2:
        return "homopolymer";
      case 3:
        return "low-complexity";
      case 4:
        return "low-quality-tail";
      case 5:
        return "low-quality-window";
      default:
        return "typical";
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

  function applyDiagnostics(sequence, qualities, profile, mate) {
    if (profile === "adapter") {
      const adapter = mate === 1 ? "AGATCGGAAGAG" : "CTCTTCCGATCT";
      replaceAt(sequence, 120, adapter);
      applyQualityRamp(qualities, 120, 24, 11);
      return;
    }

    if (profile === "ambiguous") {
      replaceAt(sequence, 66, mate === 1 ? "NNN" : "NNNN");
      for (let position = 64; position <= 71; position += 1) {
        qualities[position] = 7 + ((position + mate) % 5);
      }
      return;
    }

    if (profile === "homopolymer") {
      replaceAt(sequence, 72, mate === 1 ? "AAAAAAAAA" : "GGGGGGGGG");
      for (let position = 72; position < 81; position += 1) {
        qualities[position] = 36 + ((position + mate) % 3);
      }
      return;
    }

    if (profile === "low-complexity") {
      replaceAt(sequence, 54, mate === 1 ? "AT".repeat(15) : "CG".repeat(15));
      return;
    }

    if (profile === "low-quality-tail") {
      applyQualityRamp(qualities, 108, 25, 5);
      return;
    }

    if (profile === "low-quality-window") {
      for (let position = 48; position < 75; position += 1) {
        qualities[position] = 8 + ((position + mate) % 8);
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

  function buildHeader(readNumber, mate) {
    return "@FASTQ_SONIFIER_SYNTHETIC_"
      + String(readNumber).padStart(6, "0")
      + "/"
      + mate;
  }

  function buildRead(readNumber, mate) {
    const safeReadNumber = assertReadNumber(readNumber);
    const safeMate = assertMate(mate);
    const sequence = buildBaselineSequence(safeReadNumber, safeMate);
    const qualities = buildBaselineQualities(safeReadNumber, safeMate);
    const profile = diagnosticProfile(safeReadNumber);
    applyDiagnostics(sequence, qualities, profile, safeMate);

    return Object.freeze({
      header: buildHeader(safeReadNumber, safeMate),
      sequence: sequence.join(""),
      separator: "+",
      quality: encodeQuality(qualities),
      readNumber: safeReadNumber,
      mate: safeMate,
      profile: profile,
    });
  }

  function buildFastqText(mate) {
    const safeMate = assertMate(mate);
    const records = [];

    for (let readNumber = 1; readNumber <= READS_PER_FILE; readNumber += 1) {
      const read = buildRead(readNumber, safeMate);
      records.push(read.header, read.sequence, read.separator, read.quality);
    }

    return records.join("\n") + "\n";
  }

  function buildPairTexts() {
    return Object.freeze({
      r1: buildFastqText(1),
      r2: buildFastqText(2),
    });
  }

  function createFiles() {
    const FileConstructor = root && root.File;
    if (typeof FileConstructor !== "function") {
      throw new Error("This browser does not provide the File API required to load the synthetic example.");
    }

    const pair = buildPairTexts();
    return [
      new FileConstructor([pair.r1], FILE_NAMES[0], { type: "text/plain", lastModified: 0 }),
      new FileConstructor([pair.r2], FILE_NAMES[1], { type: "text/plain", lastModified: 0 }),
    ];
  }

  root.fastqSonifierExample = Object.freeze({
    metadata: metadata,
    buildRead: buildRead,
    buildFastqText: buildFastqText,
    buildPairTexts: buildPairTexts,
    buildPair: buildPairTexts,
    createFiles: createFiles,
  });
})(typeof window !== "undefined" ? window : globalThis);
