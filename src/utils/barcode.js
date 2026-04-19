// src/utils/barcode.js
import bwipjs from "bwip-js";
import { uploadToS3 } from "./s3.js";

/**
 * Generate a unique barcode string for a stock lot.
 * Format: LOT-<timestamp>-<random4>
 */
function generateBarcodeValue() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOT-${ts}-${rand}`;
}

/**
 * Render a Code128 barcode PNG buffer from a barcode string.
 * @param {string} barcodeValue
 * @returns {Promise<Buffer>}
 */
async function renderBarcodeImage(barcodeValue) {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: barcodeValue,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: "center",
  });
}

/**
 * Generate barcode value + upload image to S3.
 * @param {string} lotId
 * @returns {Promise<{ barcode: string, barcode_image_url: string }>}
 */
async function generateAndUploadBarcode(lotId) {
  console.log(`[BARCODE] Generating for lot: ${lotId}`);
  const barcode = generateBarcodeValue();
  console.log(`[BARCODE] Generated value: ${barcode}`);
  
  const imageBuffer = await renderBarcodeImage(barcode);
  console.log(`[BARCODE] Rendered image buffer size: ${imageBuffer.length} bytes`);
  
  const key = `barcodes/${lotId}.png`;
  const storedKey = await uploadToS3(imageBuffer, key, "image/png");
  console.log(`[BARCODE] Stored S3 key: ${storedKey}`);
  
  return { barcode, barcode_image_url: storedKey };
}

export { generateAndUploadBarcode };
