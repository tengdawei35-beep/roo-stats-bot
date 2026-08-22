const { createWorker } = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// ROOC STATS OCR
// ============================================================
//
// LOCAL OCR ONLY
//
// IMPORTANT SOURCES:
//
// General Stats:
//   HP
//   PATK
//   MATK
//
// Quasi Stats:
//   PvP DMG Bonus
//   PvP DMG Reduction
//   PDMG
//   MDMG
//   PDMG Reduction
//   MDMG Reduction
//   Crit RES
//   Ignore PDEF
//   Ignore MDEF
//
// PDEF Notice:
//   PDEF = Equipment PDEF from Notice
//   Base PDEF is ignored
//
// MDEF Notice:
//   MDEF = Equipment MDEF from Notice
//   Base MDEF is ignored
//
// Equipment/Damage:
//   Equipment PDEF %
//   Equipment MDEF %
//   Small
//   Medium
//   Large
//   Brute
//   Demi-Human
//
// Cards are NOT OCR fields.
// They are automatically defaulted to "2-star"
// by sheets.js.
//
// ============================================================

const TEMP_DIR = path.join(
  __dirname,
  "..",
  "temp"
);

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, {
    recursive: true
  });
}

// ============================================================
// WORKER
// ============================================================

let worker = null;

async function getWorker() {

  if (worker) {
    return worker;
  }

  console.log(
    "[OCR] Starting Tesseract worker..."
  );

  worker = await createWorker(
    "eng",
    1
  );

  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  });

  return worker;
}

// ============================================================
// DOWNLOAD
// ============================================================

async function downloadImage(url) {

  console.log(
    "[OCR] Downloading:",
    url
  );

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Failed to download image: " +
      response.status +
      " " +
      response.statusText
    );
  }

  const buffer =
    Buffer.from(
      await response.arrayBuffer()
    );

  if (buffer.length < 1000) {
    throw new Error(
      "Downloaded image is unexpectedly small."
    );
  }

  const filePath =
    path.join(
      TEMP_DIR,
      crypto.randomUUID() +
      ".png"
    );

  await fs.promises.writeFile(
    filePath,
    buffer
  );

  return filePath;
}

// ============================================================
// PREPROCESS
// ============================================================

async function preprocessImage(
  imagePath,
  mode
) {

  const outputPath =
    path.join(
      TEMP_DIR,
      crypto.randomUUID() +
      "-" +
      mode +
      ".png"
    );

  let image =
    sharp(imagePath)
      .rotate()
      .resize({
        width: 2200,
        withoutEnlargement: false
      })
      .grayscale();

  if (mode === "normal") {
    image = image.normalize();
  }

  if (mode === "contrast") {
    image =
      image
        .normalize()
        .linear(1.35, -35);
  }

  if (mode === "highcontrast") {
    image =
      image
        .normalize()
        .linear(1.7, -70);
  }

  if (mode === "threshold170") {
    image =
      image
        .normalize()
        .threshold(170);
  }

  if (mode === "threshold200") {
    image =
      image
        .normalize()
        .threshold(200);
  }

  if (mode === "threshold220") {
    image =
      image
        .normalize()
        .threshold(220);
  }

  await image
    .sharpen()
    .png()
    .toFile(outputPath);

  return outputPath;
}

// ============================================================
// OCR
// ============================================================

async function runOCR(
  imagePath
) {

  const ocrWorker =
    await getWorker();

  const result =
    await ocrWorker.recognize(
      imagePath
    );

  return {
    text: normalizeText(
      result.data.text
    ),
    confidence:
      Number(
        result.data.confidence || 0
      ),
    words:
      Array.isArray(
        result.data.words
      )
        ? result.data.words
        : []
  };
}

// ============================================================
// TEXT
// ============================================================

function normalizeText(text) {

  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function linesFromText(text) {

  return normalizeText(text)
    .split("\n")
    .map(
      line =>
        line.trim()
    )
    .filter(Boolean);
}

// ============================================================
// NUMBER PARSING
// ============================================================

function extractNumbers(text) {

  if (!text) {
    return [];
  }

  const matches =
    String(text).match(
      /-?\d[\d,]*(?:\.\d+)?%?/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(raw => {

      const percent =
        raw.trim().endsWith("%");

      const value =
        Number(
          raw
            .replace(/%/g, "")
            .replace(/,/g, "")
        );

      if (
        !Number.isFinite(value)
      ) {
        return null;
      }

      return {
        value,
        percent,
        raw
      };
    })
    .filter(Boolean);
}

// ============================================================
// LIMITS
// ============================================================

const LIMITS = {

  hp: [1, 10000000],

  patk: [1, 1000000],

  matk: [1, 1000000],

  pdef: [0, 1000000],

  mdef: [0, 1000000],

  pvpBonus: [0, 1000000],

  pvpReduction: [0, 1000000],

  pdmg: [0, 1000],

  mdmg: [0, 1000],

  pdmgReduction: [0, 1000],

  mdmgReduction: [0, 1000],

  critRes: [0, 1000],

  ignorePDEF: [0, 1000000],

  ignoreMDEF: [0, 1000000],

  equipmentPDEF: [0, 100],

  equipmentMDEF: [0, 100],

  smallDamage: [0, 1000],

  smallReduction: [0, 1000],

  mediumDamage: [0, 1000],

  mediumReduction: [0, 1000],

  largeDamage: [0, 1000],

  largeReduction: [0, 1000],

  bruteDamage: [0, 1000],

  bruteReduction: [0, 1000],

  demiDamage: [0, 1000],

  demiReduction: [0, 1000]

};

function validValue(
  key,
  value
) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return null;
  }

  const number =
    Number(value);

  const limits =
    LIMITS[key];

  if (!limits) {
    return number;
  }

  if (
    number < limits[0] ||
    number > limits[1]
  ) {
    return null;
  }

  return number;
}

// ============================================================
// ALIASES
// ============================================================

const ALIASES = {

  hp: [
    "HP"
  ],

  patk: [
    "PATK",
    "P ATK"
  ],

  matk: [
    "MATK",
    "M ATK"
  ],

  pvpBonus: [
    "PVP DMG BONUS",
    "P DMG BONUS"
  ],

  pvpReduction: [
    "PVP DMG REDUCTION",
    "PVP DMG RED",
    "VP DMG REDUCTION",
    "VP DMG RED",
    "P DMG RED",
    "DMG REDUCTION"
  ],

  pdmg: [
    "PDMG",
    "P DMG"
  ],

  mdmg: [
    "MDMG",
    "M DMG"
  ],

  pdmgReduction: [
    "PDMG.R",
    "PDMG R",
    "P DMG REDUCTION",
    "P DMG R"
  ],

  mdmgReduction: [
    "MDMG REDUCTION",
    "MDMG.R",
    "MDMG R",
    "M DMG R"
  ],

  critRes: [
    "CRIT RES"
  ],

  ignorePDEF: [
    "IGNORE PDEF",
    "IGNORE P DEF"
  ],

  ignoreMDEF: [
    "IGNORE MDEF",
    "IGNORE M DEF"
  ],

  equipmentPDEF: [
    "EQUIPMENT PDEF",
    "EQUIP PDEF"
  ],

  equipmentMDEF: [
    "EQUIPMENT MDEF",
    "EQUIP MDEF"
  ],

  smallDamage: [
    "DMG VS SMALL ENEMIES",
    "DMG VS SMALL"
  ],

  smallReduction: [
    "DMG REDUCTION VS SMALL ENEMIES",
    "DMG REDUCTION VS SMALL"
  ],

  mediumDamage: [
    "DMG VS MEDIUM ENEMIES",
    "DMG VS MEDIUM"
  ],

  mediumReduction: [
    "DMG REDUCTION VS MEDIUM ENEMIES",
    "DMG REDUCTION VS MEDIUM"
  ],

  largeDamage: [
    "DMG VS LARGE ENEMIES",
    "DMG VS LARGE MONSTERS",
    "DMG VS LARGE"
  ],

  largeReduction: [
    "DMG REDUCTION VS LARGE ENEMIES",
    "DMG REDUCTION VS LARGE MONSTERS",
    "DMG REDUCTION VS LARGE"
  ],

  bruteDamage: [
    "DMG VS BRUTE"
  ],

  bruteReduction: [
    "DMG REDUCTION VS BRUTE"
  ],

  demiDamage: [
    "DMG VS DEMI-HUMAN",
    "DMG VS DEMIHUMAN"
  ],

  demiReduction: [
    "DMG REDUCTION VS DEMI-HUMAN",
    "DMG REDUCTION VS DEMIHUMAN"
  ]

};

// ============================================================
// LABEL NORMALIZATION
// ============================================================

function normalizeLabel(
  value
) {

  return String(value || "")
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}

// ============================================================
// VALUE AFTER LABEL
// ============================================================

function numberAfterLabel(
  line,
  alias
) {

  const normalizedLine =
    normalizeLabel(line);

  const normalizedAlias =
    normalizeLabel(alias);

  if (
    !normalizedAlias ||
    !normalizedLine.includes(
      normalizedAlias
    )
  ) {
    return null;
  }

  const escaped =
    alias
      .trim()
      .split(/\s+/)
      .map(
        part =>
          part.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )
      )
      .join("\\s*");

  const regex =
    new RegExp(
      escaped +
      "[\\s:._-]*" +
      "(-?\\d[\\d,]*(?:\\.\\d+)?%?)",
      "i"
    );

  const match =
    line.match(regex);

  if (!match) {
    return null;
  }

  const value =
    Number(
      match[1]
        .replace(/%/g, "")
        .replace(/,/g, "")
    );

  if (
    !Number.isFinite(value)
  ) {
    return null;
  }

  return {
    value,
    raw: match[1],
    percent:
      match[1].endsWith("%")
  };
}

// ============================================================
// FIELD PARSER
// ============================================================

function findFieldInLine(
  line,
  key
) {

  const aliases =
    ALIASES[key] || [];

  /*
   * PvP Bonus needs special handling because:
   *
   * PDMG Bonus 360
   *
   * must NOT be interpreted as:
   *
   * PvP Bonus 360
   *
   * We only accept:
   *
   * PVP DMG BONUS
   * P DMG BONUS
   */

  if (
    key === "pvpBonus"
  ) {

    const regex =
      /(?:PVP\s+DMG\s+BONUS|P\s+DMG\s+BONUS)\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?%?)/i;

    const match =
      line.match(regex);

    if (!match) {
      return null;
    }

    const value =
      validValue(
        key,
        Number(
          match[1]
            .replace(/%/g, "")
            .replace(/,/g, "")
        )
      );

    if (value === null) {
      return null;
    }

    return {
      value,
      raw: match[1],
      alias: "P DMG Bonus"
    };
  }

  let best = null;

  for (
    const alias of aliases
  ) {

    const result =
      numberAfterLabel(
        line,
        alias
      );

    if (!result) {
      continue;
    }

    const value =
      validValue(
        key,
        result.value
      );

    if (value === null) {
      continue;
    }

    const score =
      normalizeLabel(alias).length;

    if (
      !best ||
      score > best.score
    ) {

      best = {
        value,
        raw: result.raw,
        alias,
        score
      };
    }
  }

  return best;
}

// ============================================================
// IGNORE PDEF / MDEF
// ============================================================
//
// Example:
//
// Ignore PDEF 3537     Ignore PDEF 0%
//
// We want:
//
// 3537
//
// NOT:
//
// 0
//
// ============================================================

function findIgnoreValue(
  line,
  key
) {

  const aliases =
    ALIASES[key] || [];

  for (
    const alias of aliases
  ) {

    const escaped =
      alias
        .trim()
        .split(/\s+/)
        .map(
          part =>
            part.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )
        )
        .join("\\s+");

    const regex =
      new RegExp(
        escaped +
        "\\s*[:.]?\\s*" +
        "(-?\\d[\\d,]*(?:\\.\\d+)?)(%?)",
        "i"
      );

    const match =
      line.match(regex);

    if (!match) {
      continue;
    }

    /*
     * Ignore the percentage occurrence.
     */

    if (
      match[2] === "%"
    ) {
      continue;
    }

    const value =
      Number(
        match[1]
          .replace(/,/g, "")
      );

    if (
      !Number.isFinite(value)
    ) {
      continue;
    }

    const validated =
      validValue(
        key,
        value
      );

    if (
      validated === null
    ) {
      continue;
    }

    return {
      value: validated,
      raw: match[1],
      alias,
      source:
        "ignore-non-percent"
    };
  }

  return null;
}

// ============================================================
// NOTICE PARSER
// ============================================================
//
// PDEF:
//
// Base PDEF:109
// Equipment PDEF:3333
//
// MDEF:
//
// Base MDEF:71
// Equipment MDEF:1017
//
// Only Equipment values are used.
//
// ============================================================

function parseNoticeLine(
  line
) {

  const result = {
    pdef: null,
    mdef: null
  };

  if (
    /EQUIPMENT\s+PDEF\s*:/i.test(
      line
    )
  ) {

    const numbers =
      extractNumbers(line);

    if (
      numbers.length > 0
    ) {

      const value =
        validValue(
          "pdef",
          numbers[
            numbers.length - 1
          ].value
        );

      if (
        value !== null
      ) {

        result.pdef = {
          value,
          raw:
            numbers[
              numbers.length - 1
            ].raw
        };
      }
    }
  }

  if (
    /EQUIPMENT\s+MDEF\s*:/i.test(
      line
    )
  ) {

    const numbers =
      extractNumbers(line);

    if (
      numbers.length > 0
    ) {

      const value =
        validValue(
          "mdef",
          numbers[
            numbers.length - 1
          ].value
        );

      if (
        value !== null
      ) {

        result.mdef = {
          value,
          raw:
            numbers[
              numbers.length - 1
            ].raw
        };
      }
    }
  }

  return result;
}

// ============================================================
// PARSE TEXT
// ============================================================

function parseText(
  text,
  screenshotIndex,
  mode,
  confidence
) {

  const result = {};

  Object.keys(ALIASES)
    .forEach(
      key => {
        result[key] = [];
      }
    );

  result.pdefNotice = [];
  result.mdefNotice = [];

  const lines =
    linesFromText(text);

  for (
    const line of lines
  ) {

    // --------------------------------------------------------
    // Notice
    // --------------------------------------------------------

    const notice =
      parseNoticeLine(line);

    if (notice.pdef) {

      result.pdefNotice.push({
        value:
          notice.pdef.value,
        raw:
          notice.pdef.raw,
        screenshotIndex,
        mode,
        confidence,
        source:
          "notice-equipment-pdef"
      });
    }

    if (notice.mdef) {

      result.mdefNotice.push({
        value:
          notice.mdef.value,
        raw:
          notice.mdef.raw,
        screenshotIndex,
        mode,
        confidence,
        source:
          "notice-equipment-mdef"
      });
    }

    // --------------------------------------------------------
    // Standard fields
    // --------------------------------------------------------

    for (
      const key of Object.keys(ALIASES)
    ) {

      /*
       * Equipment fields must explicitly contain EQUIPMENT.
       */

      if (
        key === "equipmentPDEF" &&
        !/EQUIPMENT\s+PDEF/i.test(line)
      ) {
        continue;
      }

      if (
        key === "equipmentMDEF" &&
        !/EQUIPMENT\s+MDEF/i.test(line)
      ) {
        continue;
      }

      let field = null;

      if (
        key === "ignorePDEF" ||
        key === "ignoreMDEF"
      ) {

        field =
          findIgnoreValue(
            line,
            key
          );

      } else {

        field =
          findFieldInLine(
            line,
            key
          );
      }

      if (!field) {
        continue;
      }

      result[key].push({
        value:
          field.value,
        raw:
          field.raw,
        alias:
          field.alias,
        screenshotIndex,
        mode,
        confidence,
        source:
          field.source ||
          "line"
      });
    }
  }

  return result;
}

// ============================================================
// CHOOSE BEST
// ============================================================

function chooseBest(
  candidates
) {

  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return null;
  }

  const counts = {};

  for (
    const candidate of candidates
  ) {

    const key =
      String(
        candidate.value
      );

    counts[key] =
      (counts[key] || 0) + 1;
  }

  const scored =
    candidates.map(
      candidate => {

        const count =
          counts[
            String(
              candidate.value
            )
          ] || 1;

        return {
          candidate,
          score:
            count * 100 +
            Number(
              candidate.confidence || 0
            )
        };
      }
    );

  scored.sort(
    (a, b) =>
      b.score - a.score
  );

  return scored[0].candidate;
}

// ============================================================
// EMPTY RESULT
// ============================================================

function emptyResult() {

  return {

    name: "",

    hp: null,
    patk: null,
    matk: null,

    pdef: null,
    mdef: null,

    pvpBonus: null,
    pvpReduction: null,

    pdmg: null,
    mdmg: null,

    pdmgReduction: null,
    mdmgReduction: null,

    critRes: null,

    ignorePDEF: null,
    ignoreMDEF: null,

    equipmentPDEF: null,
    equipmentMDEF: null,

    smallDamage: null,
    smallReduction: null,

    mediumDamage: null,
    mediumReduction: null,

    largeDamage: null,
    largeReduction: null,

    bruteDamage: null,
    bruteReduction: null,

    demiDamage: null,
    demiReduction: null,

    warnings: []
  };
}

// ============================================================
// REQUIRED STAT FIELDS
// ============================================================

const REQUIRED_FIELDS = [

  ["HP", "hp"],
  ["PATK", "patk"],
  ["MATK", "matk"],

  ["PDEF", "pdef"],
  ["MDEF", "mdef"],

  ["PvP DMG Bonus", "pvpBonus"],
  ["PvP DMG Reduction", "pvpReduction"],

  ["PDMG", "pdmg"],
  ["MDMG", "mdmg"],

  ["PDMG Reduction", "pdmgReduction"],
  ["MDMG Reduction", "mdmgReduction"],

  ["Crit RES", "critRes"],

  ["Ignore PDEF", "ignorePDEF"],
  ["Ignore MDEF", "ignoreMDEF"],

  ["Equipment PDEF %", "equipmentPDEF"],
  ["Equipment MDEF %", "equipmentMDEF"],

  ["Medium Damage", "mediumDamage"],
  ["Medium Reduction", "mediumReduction"],

  ["Demi-Human Damage", "demiDamage"],
  ["Demi-Human Reduction", "demiReduction"]

];

// ============================================================
// PROCESS SCREENSHOT
// ============================================================

async function processScreenshot(
  imagePath,
  screenshotIndex
) {

  const candidates = {};

  Object.keys(ALIASES)
    .forEach(
      key => {
        candidates[key] = [];
      }
    );

  candidates.pdefNotice = [];
  candidates.mdefNotice = [];

  const modes = [
    "normal",
    "contrast",
    "highcontrast",
    "threshold170",
    "threshold200",
    "threshold220"
  ];

  for (
    const mode of modes
  ) {

    let processedPath = null;

    try {

      console.log(
        "[OCR] Pass:",
        mode,
        "| screenshot:",
        screenshotIndex + 1
      );

      processedPath =
        await preprocessImage(
          imagePath,
          mode
        );

      const ocr =
        await runOCR(
          processedPath
        );

      console.log(
        "========================================"
      );

      console.log(
        "[OCR DEBUG] MODE:",
        mode,
        "| SCREENSHOT:",
        screenshotIndex + 1
      );

      console.log(
        "[OCR DEBUG] RAW TEXT:"
      );

      console.log(
        ocr.text
      );

      console.log(
        "========================================"
      );

      const parsed =
        parseText(
          ocr.text,
          screenshotIndex,
          mode,
          ocr.confidence
        );

      Object.keys(parsed)
        .forEach(
          key => {

            if (!candidates[key]) {
              candidates[key] = [];
            }

            candidates[key].push(
              ...parsed[key]
            );
          }
        );

    } catch (error) {

      console.error(
        "[OCR] Pass failed:",
        mode,
        error.message
      );

    } finally {

      if (processedPath) {

        try {
          await fs.promises.unlink(
            processedPath
          );
        } catch (_) {
          // Ignore.
        }
      }
    }
  }

  return candidates;
}

// ============================================================
// MERGE
// ============================================================

function mergeResults(
  candidates
) {

  const stats =
    emptyResult();

  const standardFields =
    Object.keys(ALIASES);

  for (
    const key of standardFields
  ) {

    const best =
      chooseBest(
        candidates[key]
      );

    if (best) {

      stats[key] =
        best.value;

      console.log(
        "[OCR] SELECTED:",
        key,
        "=",
        best.value,
        "| raw:",
        best.raw
      );
    }
  }

  /*
   * PDEF:
   *
   * ONLY Equipment PDEF from Notice.
   */

  const bestPDEF =
    chooseBest(
      candidates.pdefNotice
    );

  if (bestPDEF) {

    stats.pdef =
      bestPDEF.value;

    console.log(
      "[OCR] PDEF FROM NOTICE:",
      stats.pdef
    );
  }

  /*
   * MDEF:
   *
   * ONLY Equipment MDEF from Notice.
   */

  const bestMDEF =
    chooseBest(
      candidates.mdefNotice
    );

  if (bestMDEF) {

    stats.mdef =
      bestMDEF.value;

    console.log(
      "[OCR] MDEF FROM NOTICE:",
      stats.mdef
    );
  }

  /*
   * Required stat validation.
   *
   * Cards are intentionally NOT included.
   */

  REQUIRED_FIELDS.forEach(
    ([label, key]) => {

      if (
        stats[key] === null ||
        stats[key] === undefined
      ) {

        stats.warnings.push(
          `${label} was not detected.`
        );
      }
    }
  );

  return stats;
}

// ============================================================
// MAIN
// ============================================================

async function extractStats(
  imageUrls
) {

  if (
    !Array.isArray(imageUrls) ||
    imageUrls.length === 0
  ) {

    throw new Error(
      "No images supplied to OCR."
    );
  }

  console.log(
    "========================================"
  );

  console.log(
    "[OCR] Starting local OCR"
  );

  console.log(
    "[OCR] Images:",
    imageUrls.length
  );

  console.log(
    "========================================"
  );

  const downloaded = [];

  const allCandidates = {};

  Object.keys(ALIASES)
    .forEach(
      key => {
        allCandidates[key] = [];
      }
    );

  allCandidates.pdefNotice = [];
  allCandidates.mdefNotice = [];

  try {

    // --------------------------------------------------------
    // Download
    // --------------------------------------------------------

    for (
      let i = 0;
      i < imageUrls.length;
      i++
    ) {

      downloaded.push(
        await downloadImage(
          imageUrls[i]
        )
      );
    }

    // --------------------------------------------------------
    // OCR
    // --------------------------------------------------------

    for (
      let i = 0;
      i < downloaded.length;
      i++
    ) {

      const parsed =
        await processScreenshot(
          downloaded[i],
          i
        );

      Object.keys(parsed)
        .forEach(
          key => {

            if (!allCandidates[key]) {
              allCandidates[key] = [];
            }

            allCandidates[key].push(
              ...parsed[key]
            );
          }
        );
    }

    // --------------------------------------------------------
    // Merge
    // --------------------------------------------------------

    const stats =
      mergeResults(
        allCandidates
      );

    console.log(
      "========================================"
    );

    console.log(
      "[OCR] FINAL RESULT"
    );

    console.log(
      JSON.stringify(
        stats,
        null,
        2
      )
    );

    console.log(
      "========================================"
    );

    return stats;

  } finally {

    for (
      const filePath of downloaded
    ) {

      try {
        await fs.promises.unlink(
          filePath
        );
      } catch (_) {
        // Ignore.
      }
    }
  }
}

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdownOCR() {

  if (!worker) {
    return;
  }

  try {
    await worker.terminate();
  } catch (error) {

    console.log(
      "[OCR] Worker shutdown error:",
      error.message
    );
  }

  worker = null;
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  extractStats,
  shutdownOCR
};