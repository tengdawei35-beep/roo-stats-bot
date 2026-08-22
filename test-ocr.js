const {
  createWorker
} = require("tesseract.js");

const imagePath =
  process.argv[2];

if (!imagePath) {

  console.error(
    "Usage: node test-ocr.js <image-path>"
  );

  process.exit(1);

}


(async function() {

  console.log(
    "Starting OCR..."
  );


  const worker =
    await createWorker(
      "eng"
    );


  await worker.setParameters({

    tessedit_pageseg_mode:
      "6",

    preserve_interword_spaces:
      "1"

  });


  const result =
    await worker.recognize(
      imagePath
    );


  console.log(
    "\n========== OCR TEXT ==========\n"
  );

  console.log(
    result.data.text
  );

  console.log(
    "\n==============================\n"
  );


  await worker.terminate();

})();