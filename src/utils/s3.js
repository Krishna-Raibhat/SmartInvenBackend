// src/utils/s3.js
import Minio from "minio";

const client = new Minio.Client({
  endPoint: "s3-np1.datahub.com.np",
  port: 443,
  useSSL: true,
  accessKey: process.env.AWS_ACCESS_KEY_ID,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Upload a buffer to S3 and return the public URL.
 * @param {Buffer} buffer
 * @param {string} key  - e.g. "barcodes/lot_abc.png"
 * @param {string} contentType
 * @returns {Promise<string>} public URL
 */
async function uploadToS3(buffer, key, contentType = "image/png") {
  console.log(`[S3] Uploading to bucket: ${BUCKET}, key: ${key}`);
  try {
    await client.putObject(BUCKET, key, buffer, buffer.length, { "Content-Type": contentType });
    console.log(`[S3] Upload successful: ${key}`);
    return key; // store only the key, build full URL at read time
  } catch (err) {
    console.error(`[S3] Upload failed:`, err.message);
    throw err;
  }
}

/**
 * Build full public URL from a stored S3 key.
 * @param {string} key - e.g. "barcodes/lot_abc.png"
 * @returns {string}
 */
function getS3Url(key) {
  return `https://s3-np1.datahub.com.np/${BUCKET}/${key}`;
}

/**
 * Stream an object from S3 by key.
 * @param {string} key
 * @returns {Promise<stream.Readable>}
 */
async function getObject(key) {
  return client.getObject(BUCKET, key);
}

export { uploadToS3, getS3Url, getObject };
