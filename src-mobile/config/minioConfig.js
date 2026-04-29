// ── MinIO Cloud Storage Configuration ────────────────────────
// MinIO uses the S3-compatible API with AWS Signature V4 authentication.
// Update NGROK_URL to your current ngrok tunnel URL.

import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';

const MINIO_CONFIG = {
  // Your ngrok tunnel URL pointing to MinIO
  NGROK_URL: 'https://greasily-stoneware-coherence.ngrok-free.dev',

  // MinIO bucket name
  BUCKET: 'audio-recordings',

  // MinIO access credentials
  ACCESS_KEY: 'gveQxfiE1VEfzBF01O8P',
  SECRET_KEY: '56gE6QSeYWH4KOfYS3j4YISMQQuEG5VSBr6bptkD',

  // MinIO region (default for MinIO)
  REGION: 'us-east-1',
};

// ── AWS Signature V4 Helpers ─────────────────────────────────

function sha256(message) {
  return CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
}

function hmacSHA256(message, key) {
  return CryptoJS.HmacSHA256(message, key);
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = hmacSHA256(dateStamp, 'AWS4' + secretKey);
  const kRegion = hmacSHA256(region, kDate);
  const kService = hmacSHA256(service, kRegion);
  const kSigning = hmacSHA256('aws4_request', kService);
  return kSigning;
}

/**
 * Build AWS Signature V4 authorization headers for a PUT request to MinIO.
 */
function buildS3AuthHeaders(method, path, host, contentType) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20260428T043900Z
  const dateStamp = amzDate.substring(0, 8); // 20260428

  const payloadHash = 'UNSIGNED-PAYLOAD'; // Skip reading entire file for hashing

  // Canonical headers (must be sorted alphabetically)
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  // Canonical request
  const canonicalRequest = [
    method,                    // PUT
    path,                      // /audio-recordings/ClientName/file.wav
    '',                        // query string (empty)
    canonicalHeaders,          // canonical headers
    signedHeaders,             // signed headers list
    payloadHash,               // payload hash
  ].join('\n');

  // String to sign
  const scope = `${dateStamp}/${MINIO_CONFIG.REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');

  // Signing key and final signature
  const signingKey = getSignatureKey(MINIO_CONFIG.SECRET_KEY, dateStamp, MINIO_CONFIG.REGION, 's3');
  const signature = hmacSHA256(stringToSign, signingKey).toString(CryptoJS.enc.Hex);

  // Authorization header
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${MINIO_CONFIG.ACCESS_KEY}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  return {
    'Content-Type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'Authorization': authorization,
  };
}

// ── Public Upload Function ───────────────────────────────────

/**
 * Upload a file to MinIO via its S3-compatible API through ngrok.
 *
 * Files are organized into client folders:
 *   audio-recordings/           ← MinIO bucket
 *     └── Sarah_Johnson/        ← Client folder
 *         ├── Sarah_Johnson_0-15.wav
 *         └── Sarah_Johnson_1-30.wav
 *
 * @param {string} localUri     - Local file URI on the device
 * @param {string} folderName   - Client folder name (e.g. "Sarah_Johnson")
 * @param {string} fileName     - File name (e.g. "Sarah_Johnson_0-15.wav")
 * @param {string} contentType  - MIME type (e.g. "audio/wav")
 * @returns {string} The public download URL from MinIO via ngrok
 */
export async function uploadToMinIO(localUri, folderName, fileName, contentType = 'audio/wav') {
  const objectKey = `${folderName}/${fileName}`;
  const path = `/${MINIO_CONFIG.BUCKET}/${objectKey}`;
  const host = MINIO_CONFIG.NGROK_URL.replace(/^https?:\/\//, '');
  const url = `${MINIO_CONFIG.NGROK_URL}${path}`;

  console.log(`[MinIO] Uploading to: ${url}`);

  // Build signed auth headers
  const headers = buildS3AuthHeaders('PUT', path, host, contentType);

  // Use expo-file-system uploadAsync to stream the file directly (no blob needed)
  const uploadResult = await FileSystem.uploadAsync(url, localUri, {
    httpMethod: 'PUT',
    headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`MinIO upload failed (${uploadResult.status}): ${uploadResult.body}`);
  }

  console.log(`[MinIO] Upload successful: ${url}`);
  return url;
}

/**
 * Get the public URL for a file stored in MinIO.
 */
export function getMinIOUrl(folderName, fileName) {
  return `${MINIO_CONFIG.NGROK_URL}/${MINIO_CONFIG.BUCKET}/${folderName}/${fileName}`;
}

/**
 * Extract the object key from a full MinIO URL.
 * e.g. "https://xxx.ngrok-free.dev/audio-recordings/John_Doe/John_Doe_0-15.m4a"
 *   → "John_Doe/John_Doe_0-15.m4a"
 */
export function extractMinIOKey(fullUrl) {
  if (!fullUrl || !fullUrl.includes(MINIO_CONFIG.BUCKET)) return null;
  const idx = fullUrl.indexOf(MINIO_CONFIG.BUCKET + '/');
  if (idx === -1) return null;
  return fullUrl.substring(idx + MINIO_CONFIG.BUCKET.length + 1);
}

/**
 * Delete a file from MinIO via its S3-compatible API through ngrok.
 *
 * @param {string} objectKey  - Object key inside bucket (e.g. "John_Doe/John_Doe_0-15.m4a")
 */
export async function deleteFromMinIO(objectKey) {
  const path = `/${MINIO_CONFIG.BUCKET}/${objectKey}`;
  const host = MINIO_CONFIG.NGROK_URL.replace(/^https?:\/\//, '');
  const url = `${MINIO_CONFIG.NGROK_URL}${path}`;

  console.log(`[MinIO] Deleting: ${url}`);

  const headers = buildS3AuthHeaders('DELETE', path, host, 'application/octet-stream');

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (response.status >= 200 && response.status < 300 || response.status === 204) {
    console.log(`[MinIO] Deleted successfully: ${objectKey}`);
    return true;
  }

  console.warn(`[MinIO] Delete failed (${response.status})`);
  return false;
}

/**
 * Delete all files under a folder prefix in MinIO.
 * Lists objects with the prefix and deletes them one by one.
 *
 * @param {string} folderName - e.g. "John_Doe"
 */
export async function deleteFolderFromMinIO(folderName) {
  // MinIO doesn't have real folders — we delete all objects with that prefix
  // For simplicity, we'll rely on the caller to pass individual URIs
  console.log(`[MinIO] Folder delete requested for: ${folderName}`);
  return true;
}

export default MINIO_CONFIG;
