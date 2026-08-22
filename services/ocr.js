const { createWorker } = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


// ============================================================
// ROO LOCAL OCR
// Resolution-independent ROI OCR
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
// ROI HELPER
// ============================================================

function roi(
  x,
  y,
  width,
  height
) {

  return {

    x:
      x,

    y:
      y,

    width:
      width,

    height:
      height

  };

}


// ============================================================
// GENERAL STATS
// Reference: 680 x 407
// ============================================================

const GENERAL_ROIS = {

  hp:
    roi(
      0.285,
      0.175,
      0.145,
      0.085
    ),

  patk:
    roi(
      0.285,
      0.295,
      0.145,
      0.085
    ),

  matk:
    roi(
      0.285,
      0.415,
      0.145,
      0.085
    ),

  pdef:
    roi(
      0.865,
      0.295,
      0.115,
      0.085
    ),

  mdef:
    roi(
      0.865,
      0.415,
      0.115,
      0.085
    )

};


// ============================================================
// QUASI STATS
// Reference: 700 x 710
// ============================================================

const QUASI_ROIS = {

  critRes:
    roi(
      0.820,
      0.385,
      0.145,
      0.070
    ),

  pdmg:
    roi(
      0.260,
      0.525,
      0.180,
      0.075
    ),

  mdmg:
    roi(
      0.260,
      0.595,
      0.180,
      0.075
    ),

  pdmgReduction:
    roi(
      0.825,
      0.525,
      0.160,
      0.075
    ),

  mdmgReduction:
    roi(
      0.825,
      0.595,
      0.160,
      0.075
    ),

  ignorePDEF:
    roi(
      0.300,
      0.665,
      0.175,
      0.075
    ),

  ignoreMDEF:
    roi(
      0.300,
      0.735,
      0.175,
      0.075
    ),

  pvpReduction:
    roi(
      0.335,
      0.935,
      0.175,
      0.065
    ),

  pvpBonus:
    roi(
      0.835,
      0.935,
      0.160,
      0.065
    )

};


// ============================================================
// DAMAGE / EQUIPMENT
// Reference: 665 x 591
// ============================================================

const DAMAGE_ROIS = {

  equipmentPDEF:
    roi(
      0.745,
      0.000,
      0.220,
      0.065
    ),

  smallDamage:
    roi(
      0.745,
      0.155,
      0.220,
      0.065
    ),

  smallReduction:
    roi(
      0.745,
      0.240,
      0.220,
      0.065
    ),

  mediumDamage:
    roi(
      0.745,
      0.325,
      0.220,
      0.065
    ),

  mediumReduction:
    roi(
      0.745,
      0.410,
      0.220,
      0.065
    ),

  largeDamage:
    roi(
      0.745,
      0.495,
      0.220,
      0.065
    ),

  largeReduction:
    roi(
      0.745,
      0.580,
      0.220,
      0.065
    ),

  bruteDamage:
    roi(
      0.745,
      0.665,
      0.220,
      0.065
    ),

  bruteReduction:
    roi(
      0.745,
      0.750,
      0.220,
      0.065
    ),

  demiDamage:
    roi(
      0.745,
      0.835,
      0.220,
      0.065
    ),

  demiReduction:
    roi(
      0.745,
      0.920,
      0.220,
      0.065
    )

};


// ============================================================
// DOWNLOAD IMAGE
// ============================================================

async function downloadImage(
  url
) {

  console.log(
    "[OCR] Downloading:",
    url
  );


  const response =
    await fetch(
      url
    );


  if (
    !response.ok
  ) {

    throw new Error(
      "Failed to download Discord image: " +
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
    buffer.length < 1000
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

}


// ============================================================
// IMAGE METADATA
// ============================================================

async function getImageMetadata(
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
// CLASSIFY SCREENSHOT
// ============================================================

async function classifyPage(
  imagePath
) {

  const metadata =
    await getImageMetadata(
      imagePath
    );


  const width =
    metadata.width;


  const height =
    metadata.height;


  if (
    !width ||
    !height
  ) {

    throw new Error(
      "Unable to determine image dimensions."
    );

  }


  const ratio =
    width /
    height;


  /*
   * General Stats
   *
   * Reference:
   * 680 / 407 = 1.67
   */

  if (
    ratio >
    1.40
  ) {

    return "general";

  }


  /*
   * Damage / Equipment
   *
   * Reference:
   * 665 / 591 = 1.125
   */

  if (
    ratio >
    1.06
  ) {

    return "damage";

  }


  /*
   * Quasi Stats
   *
   * Reference:
   * 700 / 710 = 0.986
   */

  return "quasi";

}


// ============================================================
// CROP ROI
// ============================================================

async function cropROI(
  imagePath,
  region
) {

  const metadata =
    await getImageMetadata(
      imagePath
    );


  const imageWidth =
    metadata.width;


  const imageHeight =
    metadata.height;


  let x =
    Math.round(
      imageWidth *
      region.x
    );


  let y =
    Math.round(
      imageHeight *
      region.y
    );


  let width =
    Math.round(
      imageWidth *
      region.width
    );


  let height =
    Math.round(
      imageHeight *
      region.height
    );


  x =
    Math.max(
      0,
      x
    );


  y =
    Math.max(
      0,
      y
    );


  width =
    Math.min(
      width,
      imageWidth - x
    );


  height =
    Math.min(
      height,
      imageHeight - y
    );


  if (
    width <= 0 ||
    height <= 0
  ) {

    throw new Error(
      "Invalid OCR crop region."
    );

  }


  const outputPath =
    path.join(
      TEMP_DIR,
      crypto.randomUUID() +
      "-roi.png"
    );


  await sharp(
    imagePath
  )

    .extract({

      left:
        x,

      top:
        y,

      width:
        width,

      height:
        height

    })

    .resize({

      width:
        1000,

      withoutEnlargement:
        false

    })

    .grayscale()

    .normalize()

    .threshold(
      180
    )

    .sharpen()

    .png()

    .toFile(
      outputPath
    );


  return outputPath;

}


// ============================================================
// TESSERACT WORKER
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
    "[OCR] Starting numeric Tesseract worker..."
  );


  worker =
    await createWorker(
      "eng",
      1
    );


  await worker.setParameters({

    tessedit_pageseg_mode:
      "7",

    tessedit_char_whitelist:
      "0123456789.,%-",

    preserve_interword_spaces:
      "0",

    user_defined_dpi:
      "300"

  });


  return worker;

}


// ============================================================
// READ ROI
// ============================================================

async function readROI(
  imagePath,
  region
) {

  const croppedPath =
    await cropROI(
      imagePath,
      region
    );


  try {

    const ocrWorker =
      await getWorker();


    const result =
      await ocrWorker.recognize(
        croppedPath
      );


    return (
      result.data.text ||
      ""
    )
      .trim();

  } finally {

    try {

      await fs.promises.unlink(
        croppedPath
      );

    } catch (error) {

      // Ignore cleanup errors.

    }

  }

}


// ============================================================
// NORMALIZE NUMBER
// ============================================================

function normalizeNumber(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return 0;

  }


  let text =
    String(
      value
    )
      .trim();


  text =
    text

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
      );


  text =
    text.replace(
      /[^0-9.-]/g,
      ""
    );


  const number =
    Number(
      text
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return 0;

  }


  return number;

}


// ============================================================
// READ ALL ROIS
// ============================================================

async function readPageROIs(
  imagePath,
  pageType,
  roiMap
) {

  const result = {};


  const keys =
    Object.keys(
      roiMap
    );


  for (
    let i = 0;
    i < keys.length;
    i++
  ) {

    const key =
      keys[i];


    console.log(
      "[OCR] Reading " +
      pageType +
      "." +
      key
    );


    const raw =
      await readROI(
        imagePath,
        roiMap[key]
      );


    const value =
      normalizeNumber(
        raw
      );


    console.log(
      "[OCR] " +
      pageType +
      "." +
      key +
      " = " +
      value +
      " (raw: " +
      JSON.stringify(
        raw
      ) +
      ")"
    );


    result[key] =
      value;

  }


  return result;

}


// ============================================================
// PARSE SCREENSHOT
// ============================================================

async function parseScreenshot(
  imagePath
) {

  const pageType =
    await classifyPage(
      imagePath
    );


  console.log(
    "[OCR] Page classified as:",
    pageType
  );


  if (
    pageType ===
    "general"
  ) {

    return {

      type:
        "general",

      values:
        await readPageROIs(
          imagePath,
          "general",
          GENERAL_ROIS
        )

    };

  }


  if (
    pageType ===
    "damage"
  ) {

    return {

      type:
        "damage",

      values:
        await readPageROIs(
          imagePath,
          "damage",
          DAMAGE_ROIS
        )

    };

  }


  return {

    type:
      "quasi",

    values:
      await readPageROIs(
        imagePath,
        "quasi",
        QUASI_ROIS
      )

  };

}


// ============================================================
// MERGE RESULTS
// ============================================================

function mergeResults(
  pages
) {

  const stats = {

    name:
      "",

    patk:
      0,

    matk:
      0,

    hp:
      0,

    pdef:
      0,

    mdef:
      0,

    pvpBonus:
      0,

    pvpReduction:
      0,

    pdmg:
      0,

    mdmg:
      0,

    pdmgReduction:
      0,

    mdmgReduction:
      0,

    critRes:
      0,

    ignorePDEF:
      0,

    ignoreMDEF:
      0,

    equipmentPDEF:
      0,

    equipmentMDEF:
      0,

    smallDamage:
      0,

    smallReduction:
      0,

    mediumDamage:
      0,

    mediumReduction:
      0,

    largeDamage:
      0,

    largeReduction:
      0,

    bruteDamage:
      0,

    bruteReduction:
      0,

    demiDamage:
      0,

    demiReduction:
      0,

    warnings:
      []

  };


  pages.forEach(
    function(page) {

      if (
        page &&
        page.values
      ) {

        Object.assign(
          stats,
          page.values
        );

      }

    }
  );


  const required = [

    [
      "HP",
      stats.hp
    ],

    [
      "PATK",
      stats.patk
    ],

    [
      "MATK",
      stats.matk
    ],

    [
      "PDEF",
      stats.pdef
    ],

    [
      "MDEF",
      stats.mdef
    ],

    [
      "PDMG",
      stats.pdmg
    ],

    [
      "MDMG",
      stats.mdmg
    ],

    [
      "PDMG Reduction",
      stats.pdmgReduction
    ],

    [
      "MDMG Reduction",
      stats.mdmgReduction
    ],

    [
      "Ignore PDEF",
      stats.ignorePDEF
    ],

    [
      "Ignore MDEF",
      stats.ignoreMDEF
    ],

    [
      "Equipment PDEF",
      stats.equipmentPDEF
    ],

    [
      "Equipment MDEF",
      stats.equipmentMDEF
    ],

    [
      "Medium Damage",
      stats.mediumDamage
    ],

    [
      "Medium Reduction",
      stats.mediumReduction
    ],

    [
      "Demi-Human Damage",
      stats.demiDamage
    ],

    [
      "Demi-Human Reduction",
      stats.demiReduction
    ]

  ];


  required.forEach(
    function(item) {

      const name =
        item[0];

      const value =
        item[1];


      /*
       * 0 is a legitimate OCR value.
       *
       * Do not treat it as missing.
       */

      if (
        value === undefined ||
        value === null
      ) {

        stats.warnings.push(
          name +
          " was not detected."
        );

      }

    }
  );


  return stats;

}


// ============================================================
// EXTRACT STATS
// ============================================================

async function extractStats(
  imageUrls
) {

  if (
    !Array.isArray(
      imageUrls
    ) ||
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
    "[OCR] Starting local ROI OCR"
  );

  console.log(
    "[OCR] Images:",
    imageUrls.length
  );

  console.log(
    "========================================"
  );


  const downloaded = [];


  try {

    // --------------------------------------------------------
    // DOWNLOAD ALL DISCORD ATTACHMENTS FIRST
    // --------------------------------------------------------

    for (
      let i = 0;
      i < imageUrls.length;
      i++
    ) {

      console.log(
        "[OCR] Downloading image " +
        (
          i + 1
        ) +
        "/" +
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


    // --------------------------------------------------------
    // PARSE
    // --------------------------------------------------------

    const pages = [];


    for (
      let i = 0;
      i < downloaded.length;
      i++
    ) {

      console.log(
        "================================"
      );

      console.log(
        "[OCR] Processing screenshot " +
        (
          i + 1
        )
      );


      const page =
        await parseScreenshot(
          downloaded[i]
        );


      pages.push(
        page
      );

    }


    // --------------------------------------------------------
    // MERGE
    // --------------------------------------------------------

    const stats =
      mergeResults(
        pages
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

    // --------------------------------------------------------
    // CLEANUP LOCAL FILES
    // --------------------------------------------------------

    for (
      let i = 0;
      i < downloaded.length;
      i++
    ) {

      try {

        await fs.promises.unlink(
          downloaded[i]
        );

      } catch (error) {

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

    } catch (error) {

      console.log(
        "[OCR] Worker shutdown error:",
        error.message
      );

    }


    worker =
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