// ── MinIO Cloud Storage Configuration (Web) ──────────────────
// Audio is streamed through the Vite server middleware at /api/audio
// which connects directly to MinIO on localhost:9000.
// No ngrok, no CORS, no presigned URLs needed.

const MINIO_CONFIG = {
  NGROK_URL: 'https://greasily-stoneware-coherence.ngrok-free.dev',
  BUCKET: 'audio-recordings',
};

/**
 * Extract the object path from a full MinIO URL.
 * e.g. "https://xxx.ngrok.dev/audio-recordings/Jasper_Mangulabnan/file.wav"
 *   → "Jasper_Mangulabnan/file.wav"
 */
function extractObjectPath(fullUrl) {
  try {
    const urlObj = new URL(fullUrl);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    // parts: ["audio-recordings", "Jasper_Mangulabnan", "file.wav"]
    if (parts.length >= 3 && parts[0] === MINIO_CONFIG.BUCKET) {
      return parts.slice(1).join('/');
    }
    // Fallback: try after bucket name anywhere in path
    const bucketIdx = parts.indexOf(MINIO_CONFIG.BUCKET);
    if (bucketIdx !== -1 && bucketIdx < parts.length - 1) {
      return parts.slice(bucketIdx + 1).join('/');
    }
  } catch (e) {
    console.error('[MinIO] Could not parse URL:', fullUrl);
  }
  return null;
}

/**
 * Get a playable audio URL that streams from MinIO through the Vite server.
 * This returns a local URL — no CORS issues.
 *
 * @param {string} fullUrl - The full MinIO URL stored in Firebase
 * @returns {string} A local /api/audio URL
 */
export function getStreamUrl(fullUrl) {
  const objectPath = extractObjectPath(fullUrl);
  if (!objectPath) return fullUrl; // fallback
  return `/api/audio?path=${encodeURIComponent(objectPath)}`;
}

/**
 * Fetch audio from MinIO through the local streaming proxy.
 * Returns a blob URL for use in <audio> elements.
 *
 * @param {string} fullUrl - The full MinIO URL stored in Firebase
 * @returns {Promise<string>} A blob: URL for the audio element
 */
export async function fetchAudioFromMinIO(fullUrl) {
  const streamUrl = getStreamUrl(fullUrl);
  console.log('[MinIO Web] Streaming from:', streamUrl);

  const response = await fetch(streamUrl);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`MinIO fetch failed (${response.status}): ${errText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export default MINIO_CONFIG;
