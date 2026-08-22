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
// ROOC STATS OCR
// ============================================================
//
// LABEL-DRIVEN OCR
//
// Screenshot
//     ↓
// Full-page OCR
//     ↓
// Locate stat labels
//     ↓
// Locate numeric value associated with label
//     ↓
// Validate candidate
//     ↓
// Multiple preprocessing passes
//     ↓
// Select strongest candidate
//     ↓
// Merge screenshots
//
// IMPORTANT:
//
// This does NOT use fixed screenshot dimensions,
// fixed ROIs, quartiles or screen coordinates.
//
// PDEF / MDEF:
//
//   PDEF = value from PDEF Notice
//   MDEF = value from MDEF Notice
//
// Base PDEF/MDEF values are NOT used.
//
// Cards are NOT OCR fields.
// sheets.js handles cards and defaults them to 2-star.
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
// WORKERS
// ============================================================

let textWorker =
  null;

let numericWorker =
  null;


// ============================================================
// TEXT OCR WORKER
// ============================================================

async function getTextWorker() {

  if (
    textWorker
  ) {

    return textWorker;

  }


  console.log(
    "[OCR] Starting text Tesseract worker..."
  );


  textWorker =
    await createWorker(
      "eng",
      1
    );


  await textWorker.setParameters({

    tessedit_pageseg_mode:
      "6",

    preserve_interword_spaces:
      "1",

    user_defined_dpi:
      "300"

  });


  return textWorker;

}


// ============================================================
// NUMERIC OCR WORKER
// ============================================================

async function getNumericWorker() {

  if (
    numericWorker
  ) {

    return numericWorker;

  }


  console.log(
    "[OCR] Starting numeric Tesseract worker..."
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
      "0123456789.,%-",

    preserve_interword_spaces:
      "0",

    user_defined_dpi:
      "300"

  });


  return numericWorker;

}


// ============================================================
// DOWNLOAD DISCORD IMAGE
// ============================================================
//
// Important:
//
// stats.js must NOT delete the Discord message until
// extractStats() has completed this download stage.
//
// We also retry transient failures.
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
// IMAGE METADATA
// ============================================================

async function getMetadata(
  imagePath
) {

  const metadata =
    await sharp(
      imagePath
    )
      .metadata();


  if (
    !metadata.width ||
    !metadata.height
  ) {

    throw new Error(
      "Unable to determine screenshot dimensions."
    );

  }


  return metadata;

}


// ============================================================
// IMAGE PREPROCESSING
// ============================================================
//
// Multiple passes improve OCR reliability across:
//
// - Different phones
// - Different resolutions
// - Compression
// - Dark/light UI
// - Text contrast
//
// ============================================================

async function createPreprocessedImage(
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
      image.normalize();

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
    .png()
    .toFile(
      outputPath
    );


  return outputPath;

}


// ============================================================
// NORMALIZE OCR TEXT
// ============================================================

function normalizeOCRText(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }


  return String(
    value
  )

    .replace(
      /\r/g,
      ""
    )

    .replace(
      /[“”‘’]/g,
      ""
    )

    .replace(
      /[|]/g,
      "I"
    )

    .replace(
      /_/g,
      ""
    );

}


// ============================================================
// NORMALIZE LABEL
// ============================================================

function normalizeLabel(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }


  return String(
    value
  )
    .toUpperCase()

    .replace(
      /[|]/g,
      "I"
    )

    .replace(
      /[^A-Z0-9]/g,
      ""
    );

}


// ============================================================
// NORMALIZE SEARCH TEXT
// ============================================================

function normalizeSearchText(
  value
) {

  return normalizeLabel(
    value
  );

}


// ============================================================
// COMPACT LABEL
// ============================================================

function compactLabel(
  value
) {

  return normalizeLabel(
    value
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
    normalizeLabel(
      actual
    );

  const e =
    normalizeLabel(
      expected
    );


  if (
    !a ||
    !e
  ) {

    return 0;

  }


  if (
    a === e
  ) {

    return 1;

  }


  if (
    a.includes(e) ||
    e.includes(a)
  ) {

    const shorter =
      Math.min(
        a.length,
        e.length
      );

    const longer =
      Math.max(
        a.length,
        e.length
      );


    return (
      shorter /
      longer
    );

  }


  const distance =
    levenshtein(
      a,
      e
    );


  const maxLength =
    Math.max(
      a.length,
      e.length
    );


  return (
    1 -
    distance /
    maxLength
  );

}


// ============================================================
// LABEL ALIASES
// ============================================================

const LABEL_ALIASES = {

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

    "PVP DMG BON",

    "P DMG BONUS"

  ],


  pvpReduction: [

    "PVP DMG REDUCTION",

    "PVP DMG RED",

    "P DMG REDUCTION"

  ],


  pdmg: [

    "PDMG",

    "PDMG %"

  ],


  mdmg: [

    "MDMG",

    "MDMG %"

  ],


  pdmgReduction: [

    "PDMG REDUCTION",

    "PDMG REDUCTION %",

    "PDMG-R",

    "PDMG-R %",

    "PDMG.R",

    "PDMG R"

  ],


  mdmgReduction: [

    "MDMG REDUCTION",

    "MDMG REDUCTION %",

    "MDMG-R",

    "MDMG-R %",

    "MDMG.R",

    "MDMG R"

  ],


  critRes: [

    "CRIT RES",

    "CRIT RESISTANCE"

  ],


  ignorePDEF: [

    "IGNORE PDEF"

  ],


  ignoreMDEF: [

    "IGNORE MDEF"

  ],


  equipmentPDEF: [

    "EQUIPMENT PDEF",

    "EQUIPMENT PDEF %"

  ],


  equipmentMDEF: [

    "EQUIPMENT MDEF",

    "EQUIPMENT MDEF %"

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
  ],

  pdefNotice: [
    0,
    1000000
  ],

  mdefNotice: [
    0,
    1000000
  ]

};


// ============================================================
// VALIDATE VALUE
// ============================================================

function validateValue(
  key,
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }


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
// REPAIR OCR NUMERIC TEXT
// ============================================================

function repairNumericText(
  value
) {

  return String(
    value ||
    ""
  )

    .replace(
      /O/g,
      "0"
    )

    .replace(
      /o/g,
      "0"
    )

    .replace(
      /I/g,
      "1"
    )

    .replace(
      /l/g,
      "1"
    )

    .replace(
      /S/g,
      "5"
    )

    .replace(
      /s/g,
      "5"
    )

    .replace(
      /B/g,
      "8"
    )

    .replace(
      /b/g,
      "8"
    )

    .replace(
      /\s/g,
      ""
    );

}


// ============================================================
// EXTRACT NUMBERS
// ============================================================

function extractNumbers(
  text
) {

  if (
    !text
  ) {

    return [];

  }


  const matches =
    String(
      text
    ).match(
      /-?\d[\d,]*(?:\.\d+)?\s*%?/g
    );


  if (
    !matches
  ) {

    return [];

  }


  return matches
    .map(
      function(raw) {

        const percent =
          raw
            .trim()
            .endsWith(
              "%"
            );


        let cleaned =
          raw
            .replace(
              /,/g,
              ""
            )
            .replace(
              /%/g,
              ""
            )
            .trim();


        cleaned =
          repairNumericText(
            cleaned
          );


        const value =
          Number(
            cleaned
          );


        if (
          !Number.isFinite(
            value
          )
        ) {

          return null;

        }


        return {

          value,

          percent,

          raw

        };

      }
    )
    .filter(
      Boolean
    );

}


// ============================================================
// EXTRACT LAST VALID NUMBER
// ============================================================

function extractLastNumber(
  line,
  key
) {

  const numbers =
    extractNumbers(
      line
    );


  for (
    let i =
      numbers.length - 1;
    i >= 0;
    i--
  ) {

    const valid =
      validateValue(
        key,
        numbers[i].value
      );


    if (
      valid !== null
    ) {

      return {

        value:
          valid,

        raw:
          numbers[i].raw,

        percent:
          numbers[i].percent

      };

    }

  }


  return null;

}


// ============================================================
// FIND BEST LABEL ALIAS
// ============================================================

function findBestAlias(
  line,
  aliases
) {

  let best = {

    similarity:
      0,

    alias:
      null

  };


  for (
    const alias of aliases
  ) {

    const similarity =
      labelSimilarity(
        line,
        alias
      );


    if (
      similarity >
      best.similarity
    ) {

      best = {

        similarity,

        alias

      };

    }

  }


  return best;

}


// ============================================================
// FIND VALUE AFTER LABEL
// ============================================================

function findValueAfterLabel(
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

      "(-?\\d[\\d,]*(?:\\.\\d+)?%?)",

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


  let cleaned =
    match[1]
      .replace(
        /,/g,
        ""
      )
      .replace(
        /%/g,
        ""
      );


  cleaned =
    repairNumericText(
      cleaned
    );


  const number =
    Number(
      cleaned
    );


  const valid =
    validateValue(
      key,
      number
    );


  if (
    valid === null
  ) {

    return null;

  }


  return {

    value:
      valid,

    raw:
      match[1],

    percent:
      match[1]
        .endsWith(
          "%"
        )

  };

}


// ============================================================
// READ LABEL / VALUE
// ============================================================

function readLabelValue(
  lines,
  key
) {

  const aliases =
    LABEL_ALIASES[key];


  if (
    !aliases
  ) {

    return {

      value:
        null,

      labelFound:
        false,

      raw:
        ""

    };

  }


  let bestMatch =
    null;


  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    const line =
      lines[i];


    const match =
      findBestAlias(
        line,
        aliases
      );


    if (
      match.similarity <
      0.65
    ) {

      continue;

    }


    let value =
      findValueAfterLabel(
        line,
        match.alias,
        key
      );


    /*
     * If the value is on the next line,
     * try that as a fallback.
     */

    if (
      !value &&
      lines[i + 1]
    ) {

      value =
        extractLastNumber(
          lines[i + 1],
          key
        );

    }


    if (
      value
    ) {

      const score =
        (
          match.similarity *
          100
        ) +
        (
          value.percent
            ? 5
            : 0
        );


      if (
        !bestMatch ||
        score >
          bestMatch.score
      ) {

        bestMatch = {

          value:
            value.value,

          raw:
            value.raw,

          percent:
            value.percent,

          alias:
            match.alias,

          similarity:
            match.similarity,

          score,

          line

        };

      }

    }

  }


  if (
    !bestMatch
  ) {

    return {

      value:
        null,

      labelFound:
        false,

      raw:
        ""

    };

  }


  console.log(
    "[OCR] Label:",
    key,
    "| matched:",
    bestMatch.alias,
    "| value:",
    bestMatch.value,
    "| line:",
    JSON.stringify(
      bestMatch.line
    )
  );


  return {

    value:
      bestMatch.value,

    percent:
      bestMatch.percent,

    labelFound:
      true,

    raw:
      bestMatch.raw,

    similarity:
      bestMatch.similarity,

    score:
      bestMatch.score,

    line:
      bestMatch.line

  };

}


// ============================================================
// PAGE CLASSIFICATION
// ============================================================
//
// Classification is ONLY used to determine which special
// PDEF/MDEF Notice parser to use.
//
// It is NOT used to determine screenshot coordinates.
//
// ============================================================

function classifyPage(
  text
) {

  const normalized =
    normalizeSearchText(
      text
    );


  const compact =
    compactLabel(
      normalized
    );


  return {

    hasPDEFNotice:
      compact.includes(
        "PDEFNOTICE"
      ),

    hasMDEFNotice:
      compact.includes(
        "MDEFNOTICE"
      ),

    hasEquipmentPDEF:
      compact.includes(
        "EQUIPMENTPDEF"
      ),

    hasEquipmentMDEF:
      compact.includes(
        "EQUIPMENTMDEF"
      ),

    hasIgnorePDEF:
      compact.includes(
        "IGNOREPDEF"
      ),

    hasIgnoreMDEF:
      compact.includes(
        "IGNOREMDEF"
      )

  };

}


// ============================================================
// EXTRACT LABEL CANDIDATES
// ============================================================

function extractFieldsFromText(
  text,
  screenshotIndex,
  mode,
  confidence
) {

  const candidates =
    {};


  Object.keys(
    LABEL_ALIASES
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


  const page =
    classifyPage(
      text
    );


  console.log(
    "[OCR] PAGE CLASS:",
    screenshotIndex + 1,
    mode,
    page
  );


  // ==========================================================
  // STANDARD LABEL FIELDS
  // ==========================================================

  const fields = [

    "hp",
    "patk",
    "matk",

    "pvpBonus",
    "pvpReduction",

    "pdmg",
    "mdmg",

    "pdmgReduction",
    "mdmgReduction",

    "critRes",

    "ignorePDEF",
    "ignoreMDEF",

    "equipmentPDEF",
    "equipmentMDEF",

    "smallDamage",
    "smallReduction",

    "mediumDamage",
    "mediumReduction",

    "largeDamage",
    "largeReduction",

    "bruteDamage",
    "bruteReduction",

    "demiDamage",
    "demiReduction"

  ];


  for (
    const line of lines
  ) {

    for (
      const key of fields
    ) {

      /*
       * PDEF/MDEF are deliberately NOT in this list.
       *
       * They can only come from their corresponding Notice.
       */

      const aliases =
        LABEL_ALIASES[key];


      const aliasMatch =
        findBestAlias(
          line,
          aliases
        );


      if (
        aliasMatch.similarity <
        0.65
      ) {

        continue;

      }


      /*
       * PvP Bonus special protection.
       *
       * We do not want:
       *
       * PDMG Bonus 360
       *
       * to become PvP Bonus.
       */

      if (
        key ===
        "pvpBonus"
      ) {

        const explicitPvP =
          /PVP\s+DMG\s+BON(?:US)?/i
            .test(
              line
            ) ||

          /P\s+DMG\s+BON(?:US)?/i
            .test(
              line
            );


        if (
          !explicitPvP
        ) {

          continue;

        }

      }


      const value =
        findValueAfterLabel(
          line,
          aliasMatch.alias,
          key
        );


      if (
        !value
      ) {

        continue;

      }


      let score =
        (
          aliasMatch.similarity *
          100
        ) +

        (
          confidence *
          0.30
        );


      /*
       * Exact label matches are preferred.
       */

      if (
        normalizeLabel(
          line
        ).includes(
          normalizeLabel(
            aliasMatch.alias
          )
        )
      ) {

        score +=
          20;

      }


      /*
       * Percentage fields should preferably
       * have an OCR-detected % sign.
       */

      const percentageField =
        [

          "pdmg",
          "mdmg",

          "pdmgReduction",
          "mdmgReduction",

          "equipmentPDEF",
          "equipmentMDEF",

          "smallDamage",
          "smallReduction",

          "mediumDamage",
          "mediumReduction",

          "largeDamage",
          "largeReduction",

          "bruteDamage",
          "bruteReduction",

          "demiDamage",
          "demiReduction"

        ].includes(
          key
        );


      if (
        percentageField &&
        value.percent
      ) {

        score +=
          10;

      }


      candidates[key].push({

        value:
          value.value,

        raw:
          value.raw,

        line,

        alias:
          aliasMatch.alias,

        similarity:
          aliasMatch.similarity,

        confidence,

        score,

        screenshotIndex,

        mode

      });

    }

  }


  // ==========================================================
  // PDEF NOTICE
  // ==========================================================

  if (
    page.hasPDEFNotice
  ) {

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      const line =
        lines[i];


      /*
       * Ignore Base PDEF.
       */

      if (
        /BASE\s+PDEF/i.test(
          line
        )
      ) {

        continue;

      }


      /*
       * Ignore Equipment PDEF itself.
       *
       * The Notice value is what we want.
       */

      if (
        /EQUIPMENT\s+PDEF/i.test(
          line
        )
      ) {

        continue;

      }


      if (
        /PDEF\s+NOTICE/i.test(
          line
        )
      ) {

        let value =
          extractLastNumber(
            line,
            "pdefNotice"
          );


        /*
         * Sometimes the number appears
         * on the next OCR line.
         */

        if (
          !value &&
          lines[i + 1]
        ) {

          value =
            extractLastNumber(
              lines[i + 1],
              "pdefNotice"
            );

        }


        if (
          value
        ) {

          candidates.pdefNotice.push({

            value:
              value.value,

            raw:
              value.raw,

            line:
              line,

            alias:
              "PDEF NOTICE",

            similarity:
              1,

            confidence,

            score:
              150 +
              confidence * 0.3,

            screenshotIndex,

            mode

          });

        }

      }

    }

  }


  // ==========================================================
  // MDEF NOTICE
  // ==========================================================

  if (
    page.hasMDEFNotice
  ) {

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      const line =
        lines[i];


      /*
       * Ignore Base MDEF.
       */

      if (
        /BASE\s+MDEF/i.test(
          line
        )
      ) {

        continue;

      }


      /*
       * Ignore Equipment MDEF itself.
       */

      if (
        /EQUIPMENT\s+MDEF/i.test(
          line
        )
      ) {

        continue;

      }


      if (
        /MDEF\s+NOTICE/i.test(
          line
        )
      ) {

        let value =
          extractLastNumber(
            line,
            "mdefNotice"
          );


        if (
          !value &&
          lines[i + 1]
        ) {

          value =
            extractLastNumber(
              lines[i + 1],
              "mdefNotice"
            );

        }


        if (
          value
        ) {

          candidates.mdefNotice.push({

            value:
              value.value,

            raw:
              value.raw,

            line:
              line,

            alias:
              "MDEF NOTICE",

            similarity:
              1,

            confidence,

            score:
              150 +
              confidence * 0.3,

            screenshotIndex,

            mode

          });

        }

      }

    }

  }


  return candidates;

}


// ============================================================
// RUN OCR
// ============================================================

async function runOCR(
  imagePath
) {

  const worker =
    await getTextWorker();


  const result =
    await worker.recognize(
      imagePath
    );


  return {

    text:
      result.data.text ||
      "",

    confidence:
      Number(
        result.data.confidence
      ) || 0,

    words:
      result.data.words ||
      []

  };

}


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
    LABEL_ALIASES
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

    let preprocessedPath =
      null;


    try {

      console.log(
        "[OCR] Pass:",
        mode,
        "| screenshot:",
        screenshotIndex + 1
      );


      preprocessedPath =
        await createPreprocessedImage(
          imagePath,
          mode
        );


      const result =
        await runOCR(
          preprocessedPath
        );


      console.log(
        "[OCR DEBUG] MODE:",
        mode,
        "| SCREENSHOT:",
        screenshotIndex + 1
      );


      console.log(
        "[OCR DEBUG] CONFIDENCE:",
        result.confidence
      );


      console.log(
        "[OCR DEBUG] TEXT LENGTH:",
        result.text.length
      );


      console.log(
        "[OCR DEBUG] WORD COUNT:",
        result.words.length
      );


      console.log(
        "[OCR DEBUG] RAW TEXT:"
      );


      console.log(
        result.text
      );


      const parsed =
        extractFieldsFromText(
          result.text,
          screenshotIndex,
          mode,
          result.confidence
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
        preprocessedPath
      ) {

        try {

          await fs.promises.unlink(
            preprocessedPath
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
// SELECT BEST CANDIDATE
// ============================================================

function selectBestCandidate(
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


  return [
    ...candidates
  ]
    .sort(
      function(a, b) {

        return (
          b.score -
          a.score
        );

      }
    )[0];

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
//
// Cards intentionally excluded.
//
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

  const standardFields = [

    "hp",
    "patk",
    "matk",

    "pvpBonus",
    "pvpReduction",

    "pdmg",
    "mdmg",

    "pdmgReduction",
    "mdmgReduction",

    "critRes",

    "ignorePDEF",
    "ignoreMDEF",

    "equipmentPDEF",
    "equipmentMDEF",

    "smallDamage",
    "smallReduction",

    "mediumDamage",
    "mediumReduction",

    "largeDamage",
    "largeReduction",

    "bruteDamage",
    "bruteReduction",

    "demiDamage",
    "demiReduction"

  ];


  for (
    const key of standardFields
  ) {

    const best =
      selectBestCandidate(
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
        "| screenshot:",
        best.screenshotIndex +
          1,
        "| pass:",
        best.mode,
        "| raw:",
        JSON.stringify(
          best.raw
        )
      );

    } else {

      console.log(
        "[OCR] NO CANDIDATE:",
        key
      );

    }

  }


  // ==========================================================
  // PDEF
  // ==========================================================
  //
  // ONLY from PDEF Notice.
  //
  // Never Equipment PDEF.
  //
  // ==========================================================

  const bestPDEF =
    selectBestCandidate(
      candidates.pdefNotice
    );


  if (
    bestPDEF
  ) {

    stats.pdef =
      bestPDEF.value;


    console.log(
      "[OCR] PDEF FROM NOTICE:",
      stats.pdef,
      "| screenshot:",
      bestPDEF.screenshotIndex +
        1,
      "| pass:",
      bestPDEF.mode,
      "| raw:",
      JSON.stringify(
        bestPDEF.raw
      )
    );

  } else {

    console.log(
      "[OCR] PDEF NOTICE NOT FOUND"
    );

  }


  // ==========================================================
  // MDEF
  // ==========================================================

  const bestMDEF =
    selectBestCandidate(
      candidates.mdefNotice
    );


  if (
    bestMDEF
  ) {

    stats.mdef =
      bestMDEF.value;


    console.log(
      "[OCR] MDEF FROM NOTICE:",
      stats.mdef,
      "| screenshot:",
      bestMDEF.screenshotIndex +
        1,
      "| pass:",
      bestMDEF.mode,
      "| raw:",
      JSON.stringify(
        bestMDEF.raw
      )
    );

  } else {

    console.log(
      "[OCR] MDEF NOTICE NOT FOUND"
    );

  }


  // ==========================================================
  // REQUIRED FIELD WARNINGS
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
// CANDIDATE DEBUG SUMMARY
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


  const keys = [

    ...Object.keys(
      LABEL_ALIASES
    ),

    "pdefNotice",
    "mdefNotice"

  ];


  keys.forEach(
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


      const sorted =
        [
          ...values
        ]
          .sort(
            function(a, b) {

              return (
                b.score -
                a.score
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
        ":"
      );


      sorted.forEach(
        function(candidate) {

          console.log(

            "  value=" +
            candidate.value +

            " score=" +
            Number(
              candidate.score
            ).toFixed(
              1
            ) +

            " screenshot=" +
            (
              candidate.screenshotIndex +
              1
            ) +

            " pass=" +
            candidate.mode +

            " raw=" +
            JSON.stringify(
              candidate.raw
            ) +

            " line=" +
            JSON.stringify(
              candidate.line
            )

          );

        }
      );

    }
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
    "[OCR] Starting local label-based OCR"
  );

  console.log(
    "[OCR] Image count:",
    imageUrls.length
  );

  console.log(
    "========================================"
  );


  const downloaded =
    [];


  try {

    // ========================================================
    // DOWNLOAD ALL DISCORD ATTACHMENTS FIRST
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
    // CANDIDATES
    // ========================================================

    const allCandidates =
      {};


    Object.keys(
      LABEL_ALIASES
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


    // ========================================================
    // PROCESS EVERY SCREENSHOT
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
    textWorker
  ) {

    try {

      await textWorker.terminate();

    } catch (
      error
    ) {

      console.log(
        "[OCR] Text worker shutdown error:",
        error.message
      );

    }


    textWorker =
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