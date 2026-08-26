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
// GENERAL APPROACH:
//
// Screenshot
//     ↓
// Download
//     ↓
// Multiple preprocessing passes
//     ↓
// Full-page OCR
//     ↓
// Label-based extraction
//     ↓
// Positional PvP extraction
//     ↓
// Candidate merging
//     ↓
// Final stats
//
// IMPORTANT:
//
// PDEF/MDEF:
//
// Base PDEF/MDEF are ignored.
//
// Equipment PDEF from Notice:
//     -> pdef
//
// Equipment MDEF from Notice:
//     -> mdef
//
// Equipment PDEF %:
//     -> equipmentPDEF
//
// Equipment MDEF %:
//     -> equipmentMDEF
//
//
// IMPORTANT PvP CHANGE:
//
// PvP DMG Reduction and PvP DMG Bonus are NOT reliably
// identified by their labels because the game scrolls the
// label text.
//
// Their numbers are always located in fixed positions:
//
//     Bottom-left  = PvP DMG Reduction
//     Bottom-right = PvP DMG Bonus
//
// Therefore positional OCR is now the PRIMARY method.
//
// Label OCR remains as a fallback.
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
      recursive:
        true
    }
  );

}


// ============================================================
// OCR WORKERS
// ============================================================

let worker =
  null;

let numericWorker =
  null;


// ============================================================
// TEXT OCR WORKER
// ============================================================

async function getWorker() {

  if (
    worker
  ) {

    return worker;

  }


  console.log(
    "[OCR] Starting Tesseract text worker..."
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
// NUMERIC OCR WORKER
// ============================================================
//
// Used specifically for the fixed-position PvP numbers.
//
// The crop contains only the number, so:
//
//     PVP label OCR
//
// is completely avoided.
//
// ============================================================

async function getNumericWorker() {

  if (
    numericWorker
  ) {

    return numericWorker;

  }


  console.log(
    "[OCR] Starting Tesseract numeric worker..."
  );


  numericWorker =
    await createWorker(
      "eng",
      1
    );


  await numericWorker.setParameters({

    tessedit_pageseg_mode:
      "7",

    tessedit_char_whitelist:
      "0123456789",

    user_defined_dpi:
      "300"

  });


  return numericWorker;

}


// ============================================================
// ROI HELPER
// ============================================================
//
// Coordinates are normalized:
//
// x = 0.0 - 1.0
// y = 0.0 - 1.0
// width = 0.0 - 1.0
// height = 0.0 - 1.0
//
// ============================================================

function roi(
  x,
  y,
  width,
  height
) {

  return {

    x,
    y,
    width,
    height

  };

}


// ============================================================
// PVP POSITIONAL ROIS
// ============================================================
//
// Based on the supplied Quasi-Stats screenshot.
//
// Screenshot:
//
//     PDMG Reduction              PVP DMG Bonus
//          2423                       3093
//
// The labels themselves are NOT used.
//
// Only the numeric regions are OCR'd.
//
// ============================================================

const PVP_POSITIONAL_ROIS = {

  pvpReduction:
    roi(

      0.30,

      0.885,

      0.22,

      0.085

    ),


  pvpBonus:
    roi(

      0.79,

      0.885,

      0.20,

      0.085

    )

};


// ============================================================
// DOWNLOAD DISCORD IMAGE
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
// IMAGE METADATA
// ============================================================

async function getImageMetadata(
  imagePath
) {

  return await sharp(
    imagePath
  )
    .metadata();

}


// ============================================================
// PREPROCESS FULL IMAGE
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
// PREPROCESS PVP NUMBER ROI
// ============================================================
//
// The crop is taken from the ORIGINAL screenshot.
//
// We then enlarge the crop significantly before OCR.
//
// ============================================================

async function preprocessPvpNumber(
  imagePath,
  region,
  mode
) {

  const metadata =
    await getImageMetadata(
      imagePath
    );


  const sourceWidth =
    Number(
      metadata.width
    );


  const sourceHeight =
    Number(
      metadata.height
    );


  if (
    !sourceWidth ||
    !sourceHeight
  ) {

    throw new Error(
      "Unable to determine source image dimensions."
    );

  }


  let left =
    Math.round(
      sourceWidth *
      region.x
    );


  let top =
    Math.round(
      sourceHeight *
      region.y
    );


  let width =
    Math.round(
      sourceWidth *
      region.width
    );


  let height =
    Math.round(
      sourceHeight *
      region.height
    );


  // ----------------------------------------------------------
  // Safety bounds
  // ----------------------------------------------------------

  left =
    Math.max(
      0,
      Math.min(
        left,
        sourceWidth - 1
      )
    );


  top =
    Math.max(
      0,
      Math.min(
        top,
        sourceHeight - 1
      )
    );


  width =
    Math.max(
      1,
      Math.min(
        width,
        sourceWidth - left
      )
    );


  height =
    Math.max(
      1,
      Math.min(
        height,
        sourceHeight - top
      )
    );


  const outputPath =
    path.join(
      TEMP_DIR,
      crypto.randomUUID() +
      "-pvp-" +
      mode +
      ".png"
    );


  let image =
    sharp(
      imagePath
    )
      .extract({

        left,
        top,
        width,
        height

      })
      .resize({

        width:
          1000,

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
          1.5,
          -45
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
          1.8,
          -80
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
// RUN FULL OCR
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
// RUN NUMERIC OCR
// ============================================================

async function runNumericOCR(
  imagePath
) {

  const ocrWorker =
    await getNumericWorker();


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
// LABEL SIMILARITY
// ============================================================

function labelSimilarity(
  actual,
  expected
) {

  const a =
    compactLabel(
      actual
    );


  const b =
    compactLabel(
      expected
    );


  if (
    !a ||
    !b
  ) {

    return 0;

  }


  if (
    a === b
  ) {

    return 1;

  }


  if (
    a.includes(b) ||
    b.includes(a)
  ) {

    return (
      Math.min(
        a.length,
        b.length
      ) /
      Math.max(
        a.length,
        b.length
      )
    );

  }


  return (

    1 -

    levenshtein(
      a,
      b
    ) /

    Math.max(
      a.length,
      b.length
    )

  );

}


// ============================================================
// LABEL ALIASES
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

    "PVP BONUS",

    "VP DMG BONUS",

    "P DMG BONUS"

  ],


  pvpReduction: [

    "PVP DMG REDUCTION",

    "PVP DMG RED",

    "PVP REDUCTION",

    "VP DMG REDUCTION",

    "P DMG REDUCTION"

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
// LIMITS
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


  // ----------------------------------------------------------
  // PVP BONUS LABEL FALLBACK
  // ----------------------------------------------------------

  if (
    key ===
    "pvpBonus"
  ) {

    const match =
      String(
        line
      ).match(

        /(?:PVP\s+DMG\s+BONUS|PVP\s+DMG\s+BON|PVP\s+BONUS)\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?\s*%?)/i

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


  // ----------------------------------------------------------
  // PVP REDUCTION LABEL FALLBACK
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // EQUIPMENT PDEF/MDEF %
  //
  // MUST contain %
  // ----------------------------------------------------------

  if (
    key ===
      "equipmentPDEF" ||
    key ===
      "equipmentMDEF"
  ) {

    for (
      const alias of aliases
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

          "(-?\\d[\\d,]*(?:\\.\\d+)?\\s*%)",

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

        continue;

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

        continue;

      }


      return {

        value,

        raw:
          match[1].trim(),

        percent:
          true,

        alias

      };

    }


    return null;

  }


  // ----------------------------------------------------------
  // OTHER FIELDS
  // ----------------------------------------------------------

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
// PARSE FULL OCR TEXT
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
  // STANDARD FIELDS
  // ==========================================================

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex++
  ) {

    const line =
      lines[
        lineIndex
      ];


    for (
      const key of Object.keys(
        ALIASES
      )
    ) {

      // ------------------------------------------------------
      // Equipment PDEF/MDEF must explicitly contain Equipment.
      // ------------------------------------------------------

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
        field
      ) {

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
            "label"

        });

        continue;

      }


      // ------------------------------------------------------
      // Label/value may be split over two lines.
      //
      // This is mainly a fallback for unusual OCR formatting.
      // ------------------------------------------------------

      const next =
        lines[
          lineIndex + 1
        ];


      if (
        !next
      ) {

        continue;

      }


      for (
        const alias of
          ALIASES[key] ||
          []
      ) {

        const similarity =
          labelSimilarity(
            line,
            alias
          );


        if (
          similarity <
          0.70
        ) {

          continue;

        }


        const nextField =
          numberAfterLabel(
            next,
            "",
            key
          );


        if (
          !nextField
        ) {

          continue;

        }


        result[key].push({

          value:
            nextField.value,

          raw:
            nextField.raw,

          alias,

          screenshotIndex,

          mode,

          confidence,

          source:
            "label-next-line"

        });


        break;

      }

    }

  }


  // ==========================================================
  // PDEF NOTICE
  // ==========================================================
  //
  // We specifically look for:
  //
  // Equipment PDEF:5041
  //
  // BUT:
  //
  // Equipment PDEF:32.00%
  //
  // is rejected here.
  //
  // ==========================================================

  for (
    const line of lines
  ) {

    const match =
      line.match(

        /EQUIPMENT\s+PDEF\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?\s*%?)/i

      );


    if (
      !match
    ) {

      continue;

    }


    const rawValue =
      match[1]
        .trim();


    if (
      rawValue.endsWith(
        "%"
      )
    ) {

      console.log(
        "[OCR] Ignoring percentage Equipment PDEF in absolute PDEF parser:",
        rawValue
      );


      continue;

    }


    const value =
      validateValue(
        "pdef",
        Number(
          repairNumericText(
            rawValue
          )
        )
      );


    if (
      value === null
    ) {

      continue;

    }


    result.pdefNotice.push({

      value,

      raw:
        rawValue,

      screenshotIndex,

      mode,

      confidence,

      source:
        "equipment-pdef-notice"

    });

  }


  // ==========================================================
  // MDEF NOTICE
  // ==========================================================

  for (
    const line of lines
  ) {

    const match =
      line.match(

        /EQUIPMENT\s+MDEF\s*[:.]?\s*(-?\d[\d,]*(?:\.\d+)?\s*%?)/i

      );


    if (
      !match
    ) {

      continue;

    }


    const rawValue =
      match[1]
        .trim();


    if (
      rawValue.endsWith(
        "%"
      )
    ) {

      console.log(
        "[OCR] Ignoring percentage Equipment MDEF in absolute MDEF parser:",
        rawValue
      );


      continue;

    }


    const value =
      validateValue(
        "mdef",
        Number(
          repairNumericText(
            rawValue
          )
        )
      );


    if (
      value === null
    ) {

      continue;

    }


    result.mdefNotice.push({

      value,

      raw:
        rawValue,

      screenshotIndex,

      mode,

      confidence,

      source:
        "equipment-mdef-notice"

    });

  }


  return result;

}


// ============================================================
// DETECT QUASI-STATS SCREENSHOT
// ============================================================
//
// We use BOTH:
//
// 1. Text markers
// 2. Aspect ratio
//
// This prevents the bottom-row PvP ROI from being applied to
// General Stats or Equipment screenshots.
//
// ============================================================

function isQuasiStatsScreenshot(
  text,
  width,
  height
) {

  const normalized =
    compactLabel(
      text
    );


  const textLooksQuasi =
    (

      normalized.includes(
        "QUASISTATS"
      )

    ) ||

    (

      normalized.includes(
        "PDMG"
      ) &&

      normalized.includes(
        "MDMG"
      ) &&

      normalized.includes(
        "IGNOREPDEF"
      )

    );


  if (
    textLooksQuasi
  ) {

    return true;

  }


  if (
    width &&
    height
  ) {

    const ratio =
      width /
      height;


    /*
     * The supplied Quasi-Stats screenshot is approximately
     * square.
     *
     * General Stats is considerably wider.
     *
     * Equipment/Damage is also wider.
     */

    if (
      ratio >=
        0.85 &&
      ratio <=
        1.05
    ) {

      return true;

    }

  }


  return false;

}


// ============================================================
// EXTRACT NUMBER FROM NUMERIC OCR
// ============================================================

function extractNumericValue(
  text,
  key
) {

  if (
    !text
  ) {

    return null;

  }


  const matches =
    String(
      text
    ).match(
      /\d[\d,]*/g
    );


  if (
    !matches ||
    matches.length ===
      0
  ) {

    return null;

  }


  /*
   * Numeric ROI should contain ONE number.
   *
   * If OCR somehow produces multiple pieces, combine
   * the digit tokens where possible.
   */

  const repaired =
    matches
      .join(
        ""
      )
      .replace(
        /,/g,
        ""
      );


  if (
    !/^\d+$/.test(
      repaired
    )
  ) {

    return null;

  }


  const value =
    validateValue(
      key,
      Number(
        repaired
      )
    );


  if (
    value === null
  ) {

    return null;

  }


  return value;

}


// ============================================================
// POSITIONAL PVP OCR
// ============================================================
//
// This is the important new part.
//
// We DO NOT care what the labels say.
//
// We only read:
//
//     bottom-left number
//
// and:
//
//     bottom-right number
//
// ============================================================

async function extractPositionalPvp(
  imagePath,
  screenshotIndex,
  fullText,
  confidence
) {

  const metadata =
    await getImageMetadata(
      imagePath
    );


  const width =
    Number(
      metadata.width
    );


  const height =
    Number(
      metadata.height
    );


  const isQuasi =
    isQuasiStatsScreenshot(
      fullText,
      width,
      height
    );


  if (
    !isQuasi
  ) {

    console.log(
      "[OCR PVP POSITION] Screenshot",
      screenshotIndex + 1,
      "does not appear to be Quasi-Stats. Skipping."
    );


    return {

      pvpBonus:
        [],

      pvpReduction:
        []

    };

  }


  console.log(
    "[OCR PVP POSITION] Quasi-Stats detected."
  );


  console.log(
    "[OCR PVP POSITION] Image:",
    width +
      "x" +
      height
  );


  const candidates = {

    pvpBonus:
      [],

    pvpReduction:
      []

  };


  const modes = [

    "normal",

    "contrast",

    "highcontrast",

    "threshold170",

    "threshold200",

    "threshold220"

  ];


  const fields = [

    {

      key:
        "pvpReduction",

      region:
        PVP_POSITIONAL_ROIS
          .pvpReduction

    },

    {

      key:
        "pvpBonus",

      region:
        PVP_POSITIONAL_ROIS
          .pvpBonus

    }

  ];


  for (
    const mode of modes
  ) {

    for (
      const field of fields
    ) {

      let cropPath =
        null;


      try {

        cropPath =
          await preprocessPvpNumber(
            imagePath,
            field.region,
            mode
          );


        const ocr =
          await runNumericOCR(
            cropPath
          );


        const value =
          extractNumericValue(
            ocr.text,
            field.key
          );


        console.log(
          "[OCR PVP POSITION]",
          field.key,
          "| pass:",
          mode,
          "| raw:",
          JSON.stringify(
            ocr.text
          ),
          "| value:",
          value
        );


        if (
          value ===
          null
        ) {

          continue;

        }


        candidates[
          field.key
        ].push({

          value,

          raw:
            ocr.text
              .trim(),

          screenshotIndex,

          mode,

          confidence:
            ocr.confidence,

          source:
            "position",

          positionBased:
            true,

          score:
            10000 +
            Number(
              ocr.confidence ||
              0
            )

        });

      } catch (
        error
      ) {

        console.error(
          "[OCR PVP POSITION] Failed:",
          field.key,
          "| pass:",
          mode,
          "|",
          error.message
        );

      } finally {

        if (
          cropPath
        ) {

          try {

            await fs.promises.unlink(
              cropPath
            );

          } catch (
            error
          ) {

            // Ignore cleanup errors.

          }

        }

      }

    }

  }


  return candidates;

}


// ============================================================
// CHOOSE BEST CANDIDATE
// ============================================================
//
// Candidate priority:
//
// 1. Positional PvP OCR
// 2. Repeated OCR agreement
// 3. OCR confidence
//
// This means a label-based OCR mistake cannot override a
// correctly positioned PvP number.
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


        const positionalBonus =
          candidate.positionBased
            ? 100000
            : 0;


        const confidence =
          Number(
            candidate.confidence ||
            0
          );


        return {

          candidate,

          score:

            positionalBonus +

            count *
            1000 +

            confidence

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


  return scored[0]
    .candidate;

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
    "PvP DMG Bonus",
    "pvpBonus"
  ],

  [
    "PvP DMG Reduction",
    "pvpReduction"
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

  console.log(
    "========================================"
  );


  console.log(
    "[OCR] Processing screenshot:",
    screenshotIndex + 1
  );


  console.log(
    "========================================"
  );


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


  // ==========================================================
  // POSITIONAL PVP OCR
  // ==========================================================
  //
  // Run ONCE against the original screenshot.
  //
  // Internally it performs its own six preprocessing passes.
  //
  // ==========================================================

  try {

    const pvpCandidates =
      await extractPositionalPvp(
        imagePath,
        screenshotIndex,
        "",
        0
      );


    candidates.pvpBonus.push(
      ...pvpCandidates.pvpBonus
    );


    candidates.pvpReduction.push(
      ...pvpCandidates.pvpReduction
    );


  } catch (
    error
  ) {

    console.error(
      "[OCR PVP POSITION] Failed:",
      error
    );

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
          "| source:",
          best.source ||
            "label",
          "| raw:",
          best.raw
        );

      }

    }
  );


  // ==========================================================
  // PDEF
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
  // REQUIRED FIELD WARNINGS
  // ==========================================================

  for (
    const field of REQUIRED_FIELDS
  ) {

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
            5
          );


      console.log(
        "[OCR CANDIDATES]",
        key,
        ordered
          .map(
            function(value) {

              return (

                value +

                " (" +

                counts[value] +

                "x)"

              );

            }
          )
          .join(
            ", "
          )
      );


      // ------------------------------------------------------
      // Explicit positional candidates
      // ------------------------------------------------------

      const positional =
        values.filter(
          function(candidate) {

            return (
              candidate.positionBased ===
              true
            );

          }
        );


      if (
        positional.length >
        0
      ) {

        console.log(
          "[OCR POSITIONAL]",
          key,
          positional
            .map(
              function(candidate) {

                return (

                  candidate.value +

                  " [" +

                  candidate.mode +

                  "]"

                );

              }
            )
            .join(
              ", "
            )
        );

      }

    }
  );


  console.log(
    "[OCR CANDIDATES] pdefNotice:",
    (
      candidates.pdefNotice ||
      []
    )
      .map(
        function(candidate) {

          return (

            candidate.value +

            " (" +

            candidate.raw +

            ")"

          );

        }
      )
      .join(
        ", "
      ) ||
      "NONE"
  );


  console.log(
    "[OCR CANDIDATES] mdefNotice:",
    (
      candidates.mdefNotice ||
      []
    )
      .map(
        function(candidate) {

          return (

            candidate.value +

            " (" +

            candidate.raw +

            ")"

          );

        }
      )
      .join(
        ", "
      ) ||
      "NONE"
  );


  console.log(
    "========================================"
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
    "[OCR] Starting local OCR"
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
    // DOWNLOAD
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
    // PROCESS
    // ========================================================

    for (
      let i = 0;
      i < downloaded.length;
      i++
    ) {

      const screenshotCandidates =
        await processScreenshot(
          downloaded[i],
          i
        );


      Object.keys(
        screenshotCandidates
      ).forEach(
        function(key) {

          if (
            !allCandidates[key]
          ) {

            allCandidates[key] =
              [];

          }


          allCandidates[key].push(
            ...screenshotCandidates[key]
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
    // FINAL
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
    worker
  ) {

    try {

      await worker.terminate();

    } catch (
      error
    ) {

      console.log(
        "[OCR] Text worker shutdown error:",
        error.message
      );

    }


    worker =
      null;

  }


  if (
    numericWorker
  ) {

    try {

      await numericWorker.terminate();

    } catch (
      error
    ) {

      console.log(
        "[OCR] Numeric worker shutdown error:",
        error.message
      );

    }


    numericWorker =
      null;

  }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  extractStats,

  shutdownOCR

};