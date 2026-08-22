const {
  createWorker
} = require("tesseract.js");

const sharp =
  require("sharp");

const fs =
  require("fs");

const path =
  require("path");

const crypto =
  require("crypto");


// ============================================================
// ROO STATS OCR
// ============================================================
//
// LABEL-DRIVEN OCR
//
// Screenshot
//     ↓
// Full-page OCR
//     ↓
// Identify labels
//     ↓
// Extract value associated with label
//     ↓
// Validate
//     ↓
// Multiple OCR passes
//     ↓
// Merge candidates
//
// NO fixed screen coordinates.
// NO quartile detection.
// NO ROI parsing.
//
// IMPORTANT PDEF / MDEF RULE:
//
// Base PDEF is ignored.
// Base MDEF is ignored.
//
// Equipment PDEF from the PDEF Notice is used as PDEF.
// Equipment MDEF from the MDEF Notice is used as MDEF.
//
// Example:
//
// Base PDEF:105
// Equipment PDEF:5514
//
// Result:
// PDEF = 5514
//
// Base MDEF:304
// Equipment MDEF:1485
//
// Result:
// MDEF = 1485
//
// General Stats total PDEF/MDEF are NOT used.
//
// ============================================================


// ============================================================
// TEMP DIRECTORY
// ============================================================

const TEMP_DIR =
  path.join(
    __dirname,
    "..",
    "temp"
  );


if (
  !fs.existsSync(
    TEMP_DIR
  )
) {

  fs.mkdirSync(
    TEMP_DIR,
    {
      recursive: true
    }
  );

}


// ============================================================
// OCR WORKER
// ============================================================

let worker =
  null;


async function getWorker() {

  if (
    worker
  ) {

    return worker;

  }


  console.log(
    "[OCR] Starting Tesseract worker..."
  );


  worker =
    await createWorker(
      "eng",
      1
    );


  await worker.setParameters({

    tessedit_pageseg_mode:
      "6",

    preserve_interword_spaces:
      "1",

    user_defined_dpi:
      "300"

  });


  return worker;

}


// ============================================================
// DOWNLOAD DISCORD IMAGE
// ============================================================
//
// IMPORTANT:
//
// stats.js must call extractStats()
// BEFORE deleting the Discord upload message.
//
// ============================================================

async function downloadImage(
  url
) {

  console.log(
    "[OCR] Downloading:",
    url
  );


  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {

    try {

      console.log(
        "[OCR] Download attempt",
        attempt +
          "/3"
      );


      const response =
        await fetch(
          url
        );


      if (
        !response.ok
      ) {

        throw new Error(
          "HTTP " +
          response.status +
          " " +
          response.statusText
        );

      }


      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );


      console.log(
        "[OCR] Downloaded bytes:",
        buffer.length
      );


      if (
        buffer.length <
        1000
      ) {

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

    } catch (
      error
    ) {

      lastError =
        error;


      console.error(
        "[OCR] Download attempt " +
        attempt +
        " failed:",
        error.message
      );


      if (
        attempt <
        3
      ) {

        await new Promise(
          function(resolve) {

            setTimeout(
              resolve,
              attempt *
              1000
            );

          }
        );

      }

    }

  }


  throw new Error(
    "Failed to download Discord image after 3 attempts: " +
    (
      lastError
        ? lastError.message
        : "Unknown error"
    )
  );

}


// ============================================================
// PREPROCESS IMAGE
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
    sharp(
      imagePath
    )
      .rotate()
      .resize({

        width:
          2200,

        withoutEnlargement:
          false

      })
      .grayscale();


  if (
    mode ===
    "normal"
  ) {

    image =
      image
        .normalize();

  }


  if (
    mode ===
    "contrast"
  ) {

    image =
      image
        .normalize()
        .linear(
          1.35,
          -35
        );

  }


  if (
    mode ===
    "highcontrast"
  ) {

    image =
      image
        .normalize()
        .linear(
          1.65,
          -70
        );

  }


  if (
    mode ===
    "threshold170"
  ) {

    image =
      image
        .normalize()
        .threshold(
          170
        );

  }


  if (
    mode ===
    "threshold200"
  ) {

    image =
      image
        .normalize()
        .threshold(
          200
        );

  }


  if (
    mode ===
    "threshold220"
  ) {

    image =
      image
        .normalize()
        .threshold(
          220
        );

  }


  await image
    .sharpen()
    .png()
    .toFile(
      outputPath
    );


  return outputPath;

}


// ============================================================
// RUN OCR
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

    text:
      String(
        result.data.text ||
        ""
      ),

    confidence:
      Number(
        result.data.confidence ||
        0
      )

  };

}


// ============================================================
// NORMALIZE OCR TEXT
// ============================================================

function normalizeOCRText(
  text
) {

  if (
    text === null ||
    text === undefined
  ) {

    return "";

  }


  return String(
    text
  )

    .replace(
      /\r/g,
      ""
    )

    .replace(
      /\t/g,
      " "
    )

    .replace(
      /\u00A0/g,
      " "
    )

    .replace(
      /[“”]/g,
      "\""
    )

    .replace(
      /[‘’]/g,
      "'"
    );

}


// ============================================================
// NORMALIZE SEARCH TEXT
// ============================================================

function normalizeSearchText(
  text
) {

  return String(
    text ||
    ""
  )

    .toUpperCase()

    .replace(
      /[|]/g,
      "I"
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}


// ============================================================
// COMPACT LABEL
// ============================================================

function compactLabel(
  text
) {

  return normalizeSearchText(
    text
  )
    .replace(
      /[^A-Z0-9]/g,
      ""
    );

}


// ============================================================
// LEVENSHTEIN
// ============================================================

function levenshtein(
  a,
  b
) {

  if (
    a === b
  ) {

    return 0;

  }


  if (
    !a.length
  ) {

    return b.length;

  }


  if (
    !b.length
  ) {

    return a.length;

  }


  const matrix =
    [];


  for (
    let i = 0;
    i <= b.length;
    i++
  ) {

    matrix[i] =
      [i];

  }


  for (
    let j = 0;
    j <= a.length;
    j++
  ) {

    matrix[0][j] =
      j;

  }


  for (
    let i = 1;
    i <= b.length;
    i++
  ) {

    for (
      let j = 1;
      j <= a.length;
      j++
    ) {

      if (
        b.charAt(
          i - 1
        ) ===
        a.charAt(
          j - 1
        )
      ) {

        matrix[i][j] =
          matrix[i - 1][j - 1];

      } else {

        matrix[i][j] =
          Math.min(

            matrix[i - 1][j] +
              1,

            matrix[i][j - 1] +
              1,

            matrix[i - 1][j - 1] +
              1

          );

      }

    }

  }


  return matrix[
    b.length
  ][
    a.length
  ];

}


// ============================================================
// FIELD ALIASES
// ============================================================

const ALIASES = {

  hp: [

    "HP"

  ],


  patk: [

    "PATK",

    "P ATK",

    "P-ATK"

  ],


  matk: [

    "MATK",

    "M ATK",

    "M-ATK"

  ],


  pvpBonus: [

    "PVP DMG BONUS",

    "PVP DMG BON",

    "PVP BONUS"

  ],


  pvpReduction: [

    "PVP DMG REDUCTION",

    "PVP DMG RED",

    "PVP REDUCTION"

  ],


  pdmg: [

    "PDMG %",

    "PDMG"

  ],


  mdmg: [

    "MDMG %",

    "MDMG"

  ],


  pdmgReduction: [

    "PDMG REDUCTION %",

    "PDMG REDUCTION",

    "PDMG-R %",

    "PDMG-R",

    "PDMG.R",

    "PDMG R"

  ],


  mdmgReduction: [

    "MDMG REDUCTION %",

    "MDMG REDUCTION",

    "MDMG-R %",

    "MDMG-R",

    "MDMG.R",

    "MDMG R"

  ],


  critRes: [

    "CRIT RES",

    "CRIT RES."

  ],


  ignorePDEF: [

    "IGNORE PDEF",

    "IGNORE P DEF",

    "IGNORE P-DEF"

  ],


  ignoreMDEF: [

    "IGNORE MDEF",

    "IGNORE M DEF",

    "IGNORE M-DEF"

  ],


  equipmentPDEF: [

    "EQUIPMENT PDEF",

    "EQUIPMENT PDEF %",

    "EQUIP PDEF"

  ],


  equipmentMDEF: [

    "EQUIPMENT MDEF",

    "EQUIPMENT MDEF %",

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

    "DMG VS BRUTE",

    "BRUTE DAMAGE"

  ],


  bruteReduction: [

    "DMG REDUCTION VS BRUTE",

    "BRUTE REDUCTION"

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
// FIELD LIMITS
// ============================================================

const LIMITS = {

  hp: [
    1,
    10000000
  ],

  patk: [
    1,
    1000000
  ],

  matk: [
    1,
    1000000
  ],

  pdef: [
    0,
    1000000
  ],

  mdef: [
    0,
    1000000
  ],

  pvpBonus: [
    0,
    1000000
  ],

  pvpReduction: [
    0,
    1000000
  ],

  pdmg: [
    0,
    1000
  ],

  mdmg: [
    0,
    1000
  ],

  pdmgReduction: [
    0,
    1000
  ],

  mdmgReduction: [
    0,
    1000
  ],

  critRes: [
    0,
    1000
  ],

  ignorePDEF: [
    0,
    1000000
  ],

  ignoreMDEF: [
    0,
    1000000
  ],

  equipmentPDEF: [
    0,
    100
  ],

  equipmentMDEF: [
    0,
    100
  ],

  smallDamage: [
    0,
    1000
  ],

  smallReduction: [
    0,
    1000
  ],

  mediumDamage: [
    0,
    1000
  ],

  mediumReduction: [
    0,
    1000
  ],

  largeDamage: [
    0,
    1000
  ],

  largeReduction: [
    0,
    1000
  ],

  bruteDamage: [
    0,
    1000
  ],

  bruteReduction: [
    0,
    1000
  ],

  demiDamage: [
    0,
    1000
  ],

  demiReduction: [
    0,
    1000
  ]

};


// ============================================================
// VALIDATE VALUE
// ============================================================

function validateValue(
  key,
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return null;

  }


  const limits =
    LIMITS[key];


  if (
    !limits
  ) {

    return number;

  }


  if (
    number <
      limits[0] ||
    number >
      limits[1]
  ) {

    return null;

  }


  return number;

}


// ============================================================
// REPAIR OCR NUMBER
// ============================================================

function repairNumericText(
  text
) {

  return String(
    text ||
    ""
  )

    .replace(
      /[Oo]/g,
      "0"
    )

    .replace(
      /[Il|]/g,
      "1"
    )

    .replace(
      /[Ss]/g,
      "5"
    )

    .replace(
      /[Bb]/g,
      "8"
    )

    .replace(
      /,/g,
      ""
    )

    .replace(
      /%/g,
      ""
    )

    .trim();

}


// ============================================================
// NUMBER AFTER LABEL
// ============================================================
//
// IMPORTANT:
//
// Only takes the number immediately following the label.
//
// Example:
//
// PDMG 68.01% PDMG.R 143.51%
//
// PDMG → 68.01
// PDMG.R → 143.51
//
// ============================================================

function numberAfterLabel(
  line,
  alias,
  key
) {

  const escaped =
    alias
      .trim()
      .split(
        /\s+/
      )
      .map(
        function(part) {

          return part.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

        }
      )
      .join(
        "\\s*"
      );


  const regex =
    new RegExp(

      escaped +

      "[\\s:._-]*" +

      "(-?\\d[\\d,]*(?:\\.\\d+)?\\s*%?)",

      "i"

    );


  const match =
    String(
      line
    ).match(
      regex
    );


  if (
    !match
  ) {

    return null;

  }


  const cleaned =
    repairNumericText(
      match[1]
    );


  const value =
    validateValue(
      key,
      Number(
        cleaned
      )
    );


  if (
    value === null
  ) {

    return null;

  }


  return {

    value,

    raw:
      match[1].trim(),

    percent:
      match[1]
        .trim()
        .endsWith(
          "%"
        ),

    alias

  };

}


// ============================================================
// FIND FIELD IN LINE
// ============================================================

function findFieldInLine(
  line,
  key
) {

  const aliases =
    ALIASES[key] ||
    [];


  /*
   * PvP fields require explicit PVP.
   *
   * This prevents:
   *
   * PDMG Bonus 405
   *
   * from being treated as PvP DMG Bonus.
   */

  if (
    key ===
    "pvpBonus"
  ) {

    const match =
      String(
        line
      ).match(

        /(?:PVP\s+DMG\s+BONUS|PVP\s+BONUS)\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?\s*%?)/i

      );


    if (
      !match
    ) {

      return null;

    }


    const value =
      validateValue(
        key,
        Number(
          repairNumericText(
            match[1]
          )
        )
      );


    if (
      value === null
    ) {

      return null;

    }


    return {

      value,

      raw:
        match[1].trim(),

      alias:
        "PVP DMG BONUS"

    };

  }


  if (
    key ===
    "pvpReduction"
  ) {

    const match =
      String(
        line
      ).match(

        /(?:PVP\s+DMG\s+REDUCTION|PVP\s+DMG\s+RED|PVP\s+REDUCTION)\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?\s*%?)/i

      );


    if (
      !match
    ) {

      return null;

    }


    const value =
      validateValue(
        key,
        Number(
          repairNumericText(
            match[1]
          )
        )
      );


    if (
      value === null
    ) {

      return null;

    }


    return {

      value,

      raw:
        match[1].trim(),

      alias:
        "PVP DMG REDUCTION"

    };

  }


  for (
    const alias of aliases
  ) {

    const result =
      numberAfterLabel(
        line,
        alias,
        key
      );


    if (
      result
    ) {

      return result;

    }

  }


  return null;

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

  const result =
    {};


  Object.keys(
    ALIASES
  ).forEach(
    function(key) {

      result[key] =
        [];

    }
  );


  result.pdefNotice =
    [];

  result.mdefNotice =
    [];


  const lines =
    normalizeOCRText(
      text
    )
      .split(
        "\n"
      )
      .map(
        function(line) {

          return line.trim();

        }
      )
      .filter(
        function(line) {

          return (
            line.length >
            0
          );

        }
      );


  // ==========================================================
  // STANDARD LABEL FIELDS
  // ==========================================================

  for (
    const line of lines
  ) {

    for (
      const key of Object.keys(
        ALIASES
      )
    ) {

      /*
       * Equipment PDEF/MDEF percentage fields:
       *
       * These must explicitly be Equipment fields.
       *
       * This prevents:
       *
       * Equipment PDEF:5514
       *
       * from being interpreted as 5514%.
       *
       * The Notice parser handles the absolute values.
       */

      if (
        key ===
        "equipmentPDEF" &&
        !/EQUIPMENT\s+PDEF/i.test(
          line
        )
      ) {

        continue;

      }


      if (
        key ===
        "equipmentMDEF" &&
        !/EQUIPMENT\s+MDEF/i.test(
          line
        )
      ) {

        continue;

      }


      const field =
        findFieldInLine(
          line,
          key
        );


      if (
        !field
      ) {

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

        confidence

      });

    }

  }


  // ==========================================================
  // PDEF NOTICE
  // ==========================================================
  //
  // Actual screenshot:
  //
  // Base PDEF:105
  // Equipment PDEF:5514
  //
  // IMPORTANT:
  //
  // Base PDEF is ignored.
  //
  // PDEF = Equipment PDEF
  //
  // ==========================================================

  let equipmentPDEF =
    null;


  for (
    const line of lines
  ) {

    const match =
      line.match(
        /EQUIPMENT\s+PDEF\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?)/i
      );


    if (
      !match
    ) {

      continue;

    }


    const value =
      validateValue(
        "pdef",
        Number(
          repairNumericText(
            match[1]
          )
        )
      );


    if (
      value === null
    ) {

      continue;

    }


    /*
     * Only absolute Notice PDEF values belong here.
     *
     * Percentage Equipment PDEF from Quasi-Stats
     * is a separate field and is handled separately.
     */

    equipmentPDEF =
      value;


    result.pdefNotice.push({

      value,

      raw:
        "Equipment PDEF:" +
        value,

      screenshotIndex,

      mode,

      confidence

    });

  }


  // ==========================================================
  // MDEF NOTICE
  // ==========================================================
  //
  // Actual screenshot:
  //
  // Base MDEF:304
  // Equipment MDEF:1485
  //
  // IMPORTANT:
  //
  // Base MDEF is ignored.
  //
  // MDEF = Equipment MDEF
  //
  // ==========================================================

  let equipmentMDEF =
    null;


  for (
    const line of lines
  ) {

    const match =
      line.match(
        /EQUIPMENT\s+MDEF\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?)/i
      );


    if (
      !match
    ) {

      continue;

    }


    const value =
      validateValue(
        "mdef",
        Number(
          repairNumericText(
            match[1]
          )
        )
      );


    if (
      value === null
    ) {

      continue;

    }


    equipmentMDEF =
      value;


    result.mdefNotice.push({

      value,

      raw:
        "Equipment MDEF:" +
        value,

      screenshotIndex,

      mode,

      confidence

    });

  }


  /*
   * Deliberately DO NOT parse General Stats PDEF/MDEF.
   *
   * Example:
   *
   * PDEF 5619
   * MDEF 1789
   *
   * Those are total values and must not override
   * the Notice-derived Equipment values.
   */


  return result;

}


// ============================================================
// CHOOSE BEST CANDIDATE
// ============================================================
//
// Repeated OCR agreement is heavily weighted.
//
// ============================================================

function chooseBest(
  candidates
) {

  if (
    !Array.isArray(
      candidates
    ) ||
    candidates.length ===
      0
  ) {

    return null;

  }


  const counts =
    {};


  candidates.forEach(
    function(candidate) {

      const key =
        String(
          candidate.value
        );


      counts[key] =
        (
          counts[key] ||
          0
        ) +
        1;

    }
  );


  const scored =
    candidates.map(
      function(candidate) {

        const count =
          counts[
            String(
              candidate.value
            )
          ] ||
          1;


        return {

          candidate,

          score:

            count *
            1000 +

            Number(
              candidate.confidence ||
              0
            )

        };

      }
    );


  scored.sort(
    function(a, b) {

      return (
        b.score -
        a.score
      );

    }
  );


  return scored[0].candidate;

}


// ============================================================
// EMPTY RESULT
// ============================================================

function emptyResult() {

  return {

    name:
      "",

    hp:
      null,

    patk:
      null,

    matk:
      null,

    pdef:
      null,

    mdef:
      null,

    pvpBonus:
      null,

    pvpReduction:
      null,

    pdmg:
      null,

    mdmg:
      null,

    pdmgReduction:
      null,

    mdmgReduction:
      null,

    critRes:
      null,

    ignorePDEF:
      null,

    ignoreMDEF:
      null,

    equipmentPDEF:
      null,

    equipmentMDEF:
      null,

    smallDamage:
      null,

    smallReduction:
      null,

    mediumDamage:
      null,

    mediumReduction:
      null,

    largeDamage:
      null,

    largeReduction:
      null,

    bruteDamage:
      null,

    bruteReduction:
      null,

    demiDamage:
      null,

    demiReduction:
      null,

    warnings:
      []

  };

}


// ============================================================
// REQUIRED FIELDS
// ============================================================

const REQUIRED_FIELDS = [

  [
    "HP",
    "hp"
  ],

  [
    "PATK",
    "patk"
  ],

  [
    "MATK",
    "matk"
  ],

  [
    "PDEF",
    "pdef"
  ],

  [
    "MDEF",
    "mdef"
  ],

  [
    "PDMG",
    "pdmg"
  ],

  [
    "MDMG",
    "mdmg"
  ],

  [
    "PDMG Reduction",
    "pdmgReduction"
  ],

  [
    "MDMG Reduction",
    "mdmgReduction"
  ],

  [
    "Crit RES",
    "critRes"
  ],

  [
    "Ignore PDEF",
    "ignorePDEF"
  ],

  [
    "Ignore MDEF",
    "ignoreMDEF"
  ],

  [
    "Equipment PDEF %",
    "equipmentPDEF"
  ],

  [
    "Equipment MDEF %",
    "equipmentMDEF"
  ],

  [
    "Medium Damage",
    "mediumDamage"
  ],

  [
    "Medium Reduction",
    "mediumReduction"
  ],

  [
    "Demi-Human Damage",
    "demiDamage"
  ],

  [
    "Demi-Human Reduction",
    "demiReduction"
  ]

];


// ============================================================
// PROCESS SCREENSHOT
// ============================================================

async function processScreenshot(
  imagePath,
  screenshotIndex
) {

  const candidates =
    {};


  Object.keys(
    ALIASES
  ).forEach(
    function(key) {

      candidates[key] =
        [];

    }
  );


  candidates.pdefNotice =
    [];

  candidates.mdefNotice =
    [];


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

    let processedPath =
      null;


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
        "[OCR DEBUG] CONFIDENCE:",
        ocr.confidence
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


      Object.keys(
        parsed
      ).forEach(
        function(key) {

          if (
            !candidates[key]
          ) {

            candidates[key] =
              [];

          }


          candidates[key].push(
            ...parsed[key]
          );

        }
      );


    } catch (
      error
    ) {

      console.error(
        "[OCR] Pass failed:",
        mode,
        "| screenshot:",
        screenshotIndex + 1,
        "|",
        error.message
      );

    } finally {

      if (
        processedPath
      ) {

        try {

          await fs.promises.unlink(
            processedPath
          );

        } catch (
          error
        ) {

          // Ignore cleanup errors.

        }

      }

    }

  }


  return candidates;

}


// ============================================================
// MERGE RESULTS
// ============================================================

function mergeResults(
  candidates
) {

  const stats =
    emptyResult();


  // ==========================================================
  // STANDARD FIELDS
  // ==========================================================

  Object.keys(
    ALIASES
  ).forEach(
    function(key) {

      const best =
        chooseBest(
          candidates[key]
        );


      if (
        best
      ) {

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
  );


  // ==========================================================
  // PDEF
  // ==========================================================
  //
  // ONLY Equipment PDEF from Notice.
  //
  // Base PDEF is ignored.
  // General Stats PDEF is ignored.
  //
  // ==========================================================

  const bestPDEF =
    chooseBest(
      candidates.pdefNotice
    );


  if (
    bestPDEF
  ) {

    stats.pdef =
      bestPDEF.value;


    console.log(
      "[OCR] PDEF FROM EQUIPMENT NOTICE:",
      stats.pdef,
      "| raw:",
      bestPDEF.raw
    );

  }


  // ==========================================================
  // MDEF
  // ==========================================================
  //
  // ONLY Equipment MDEF from Notice.
  //
  // Base MDEF is ignored.
  // General Stats MDEF is ignored.
  //
  // ==========================================================

  const bestMDEF =
    chooseBest(
      candidates.mdefNotice
    );


  if (
    bestMDEF
  ) {

    stats.mdef =
      bestMDEF.value;


    console.log(
      "[OCR] MDEF FROM EQUIPMENT NOTICE:",
      stats.mdef,
      "| raw:",
      bestMDEF.raw
    );

  }


  // ==========================================================
  // WARNINGS
  // ==========================================================

  REQUIRED_FIELDS.forEach(
    function(field) {

      const label =
        field[0];

      const key =
        field[1];


      if (
        stats[key] ===
          null ||
        stats[key] ===
          undefined
      ) {

        stats.warnings.push(
          label +
          " was not detected."
        );

      }

    }
  );


  return stats;

}


// ============================================================
// DEBUG CANDIDATE SUMMARY
// ============================================================

function printCandidateSummary(
  candidates
) {

  console.log(
    "========================================"
  );

  console.log(
    "[OCR] CANDIDATE SUMMARY"
  );

  console.log(
    "========================================"
  );


  Object.keys(
    ALIASES
  ).forEach(
    function(key) {

      const values =
        candidates[key] ||
        [];


      if (
        values.length ===
          0
      ) {

        console.log(
          "[OCR CANDIDATES]",
          key,
          ": NONE"
        );

        return;

      }


      const counts =
        {};


      values.forEach(
        function(candidate) {

          const value =
            String(
              candidate.value
            );


          counts[value] =
            (
              counts[value] ||
              0
            ) +
            1;

        }
      );


      const ordered =
        Object.keys(
          counts
        )
          .sort(
            function(a, b) {

              return (
                counts[b] -
                counts[a]
              );

            }
          )
          .slice(
            0,
            3
          );


      console.log(
        "[OCR CANDIDATES]",
        key,
        ordered.map(
          function(value) {

            return (
              value +
              " (" +
              counts[value] +
              "x)"
            );

          }
        ).join(
          ", "
        )
      );

    }
  );


  console.log(
    "[OCR CANDIDATES] pdefNotice:",
    (
      candidates.pdefNotice ||
      []
    ).map(
      function(candidate) {

        return (
          candidate.value +
          " (" +
          candidate.raw +
          ")"
        );

      }
    ).join(
      ", "
    ) ||
    "NONE"
  );


  console.log(
    "[OCR CANDIDATES] mdefNotice:",
    (
      candidates.mdefNotice ||
      []
    ).map(
      function(candidate) {

        return (
          candidate.value +
          " (" +
          candidate.raw +
          ")"
        );

      }
    ).join(
      ", "
    ) ||
    "NONE"
  );

}


// ============================================================
// MAIN
// ============================================================

async function extractStats(
  imageUrls
) {

  if (
    !Array.isArray(
      imageUrls
    ) ||
    imageUrls.length ===
      0
  ) {

    throw new Error(
      "No images supplied to OCR."
    );

  }


  console.log(
    "========================================"
  );

  console.log(
    "[OCR] Starting local label-driven OCR"
  );

  console.log(
    "[OCR] Images:",
    imageUrls.length
  );

  console.log(
    "========================================"
  );


  const downloaded =
    [];


  const allCandidates =
    {};


  Object.keys(
    ALIASES
  ).forEach(
    function(key) {

      allCandidates[key] =
        [];

    }
  );


  allCandidates.pdefNotice =
    [];

  allCandidates.mdefNotice =
    [];


  try {

    // ========================================================
    // DOWNLOAD ALL IMAGES FIRST
    // ========================================================

    for (
      let i = 0;
      i < imageUrls.length;
      i++
    ) {

      console.log(
        "[OCR] Downloading image",
        i + 1,
        "of",
        imageUrls.length
      );


      const filePath =
        await downloadImage(
          imageUrls[i]
        );


      downloaded.push(
        filePath
      );

    }


    console.log(
      "[OCR] All images downloaded successfully."
    );


    // ========================================================
    // PROCESS EVERY SCREENSHOT
    // ========================================================

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


      Object.keys(
        parsed
      ).forEach(
        function(key) {

          if (
            !allCandidates[key]
          ) {

            allCandidates[key] =
              [];

          }


          allCandidates[key].push(
            ...parsed[key]
          );

        }
      );

    }


    // ========================================================
    // DEBUG
    // ========================================================

    printCandidateSummary(
      allCandidates
    );


    // ========================================================
    // FINAL RESULT
    // ========================================================

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

    // ========================================================
    // CLEANUP
    // ========================================================

    for (
      const filePath of downloaded
    ) {

      try {

        await fs.promises.unlink(
          filePath
        );

      } catch (
        error
      ) {

        // Ignore cleanup errors.

      }

    }

  }

}


// ============================================================
// SHUTDOWN
// ============================================================

async function shutdownOCR() {

  if (
    !worker
  ) {

    return;

  }


  try {

    await worker.terminate();

  } catch (
    error
  ) {

    console.log(
      "[OCR] Worker shutdown error:",
      error.message
    );

  }


  worker =
    null;

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  extractStats,

  shutdownOCR

};