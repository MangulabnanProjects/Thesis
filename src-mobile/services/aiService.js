// ── Shared Hugging Face token (used for both summarization & BERT embeddings) ──
const HF_TOKEN = 'YOUR_HUGGINGFACE_TOKEN';

// ── Gemini (primary) ──
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

// ── The prompt used for both providers ──
function buildPrompt(intakeText) {
  return `You are a clinical speech-language pathology assistant. A clinician wrote intake notes about a patient. The notes may be in Tagalog, English, or Taglish.

Tasks:
1. Summarize the key symptoms, history, and concerns in 2-3 concise sentences in professional English.
2. Extract specific clinical focus areas (e.g., "Social Anxiety", "Selective Mutism", "Generalized Anxiety Disorder", "Speech Delay", "Voice Disorder", "Stuttering/Fluency", "Performance Anxiety")

Return ONLY this JSON, no markdown:
{"summary": "your summary", "focusAreas": ["Area 1", "Area 2"]}

Intake notes:
${intakeText}`;
}

// ── Parse AI response text into structured result ──
function parseAIResponse(rawText) {
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*?"summary"[\s\S]*?"focusAreas"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
      };
    } catch {}
  }
  return { summary: cleaned.substring(0, 500), focusAreas: [] };
}

// ── Provider 1: Gemini ──
async function tryGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Provider 2: HuggingFace (fallback) ──
async function tryHuggingFace(prompt) {
  const res = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        { role: 'system', content: 'You respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * Summarize intake notes. Tries Gemini first, falls back to HuggingFace.
 */
export async function summarizeIntake(intakeText) {
  if (!intakeText || intakeText.trim().length < 10) {
    return { summary: '', focusAreas: [] };
  }

  const prompt = buildPrompt(intakeText);

  // Try Gemini first
  try {
    console.log('[AI] Trying Gemini...');
    const text = await tryGemini(prompt);
    console.log('[AI] ✅ Gemini succeeded');
    return parseAIResponse(text);
  } catch (e) {
    console.warn('[AI] Gemini failed:', e.message);
  }

  // Fallback to HuggingFace
  try {
    console.log('[AI] Trying HuggingFace fallback...');
    const text = await tryHuggingFace(prompt);
    console.log('[AI] ✅ HuggingFace succeeded');
    return parseAIResponse(text);
  } catch (e) {
    console.warn('[AI] HuggingFace also failed:', e.message);
  }

  console.error('[AI] All providers failed');
  return { summary: '', focusAreas: [] };
}

/**
 * Extract 768-dimensional embeddings from Taglish transcriptions using BERT.
 * Uses the Hugging Face Inference API for `bert-base-multilingual-cased`.
 *
 * @param {string} text - The transcribed audio text.
 * @returns {Promise<number[]>} - Array of 768 floats, or empty array if failed.
 */
export async function getBertEmbeddings(text) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/bert-base-multilingual-cased';

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[BERT] API Error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();

    // HuggingFace feature-extraction typically returns:
    // 1D array (if pooling is enabled) OR 3D array [batch, tokens, features].
    // If it's 3D, we usually want the mean pooling of the tokens or the CLS token (index 0).

    if (Array.isArray(data) && data.length > 0) {
      if (typeof data[0] === 'number') {
        return data; // Already 1D array of floats
      } else if (Array.isArray(data[0]) && Array.isArray(data[0][0])) {
        // It's a 3D array [1, num_tokens, 768]. We'll take the CLS token (the first token).
        return data[0][0];
      } else if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
        // It's a 2D array [num_tokens, 768]. Take the CLS token.
        return data[0];
      }
    }

    return [];
  } catch (error) {
    console.error('[BERT] Failed to fetch embeddings:', error.message);
    return [];
  }
}
