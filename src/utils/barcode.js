// src/utils/barcode.js
import bwipjs from "bwip-js";
import { uploadToS3 } from "./s3.js";

export function generateBarcodeValue() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOT-${ts}-${rand}`;
}

export async function renderBarcodeImage(barcodeValue) {
  return bwipjs.toBuffer({ bcid: "code128", text: barcodeValue, scale: 3, height: 10, includetext: true, textxalign: "center" });
}

export async function generateAndUploadBarcode(lotId) {
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
