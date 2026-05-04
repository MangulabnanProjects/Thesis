/**
 * Model Router Utility
 * 
 * Filters and selects which AI models to load based on the client's Likert scale questionnaire.
 */

// Define the urgency hierarchy (higher number = higher priority)
const URGENCY_HIERARCHY = {
  "PTSD": 5,
  "Panic attack": 4,
  "Agoraphobia": 3,
  "Social Anxiety": 2,
  "GAD": 1
};

// Map questionnaire keys to actual model filenames
const MODEL_FILES = {
  "PTSD": "ptsd_expert.joblib",
  "Panic attack": "panic_attack_expert.joblib",
  "Agoraphobia": "agoraphobia_expert.joblib",
  "Social Anxiety": "social_anxiety_expert.joblib",
  "GAD": "gad_expert.joblib",
  "Neutral Tracking": "neutral_expert.joblib"
};

/**
 * Determines which ML models should be executed for a given client.
 * 
 * Rules:
 * 1. The Threshold Rule: Ignore scores of 0 or 1. Only flag conditions that scored 2 or 3.
 * 2. The Hierarchy Tie-Breaker: Sort flagged conditions by urgency.
 * 3. The Max Limit: Pick a maximum of TWO condition models to run.
 * 4. The Neutral Exception: 'neutral_expert.joblib' is ALWAYS appended.
 * 
 * @param {Object} questionnaire - The Likert scale scores from the database
 * @returns {Array<string>} List of model filenames to execute
 */
export function getRequiredModels(questionnaire) {
  if (!questionnaire) {
    // If no data exists, safely default to neutral only
    return [MODEL_FILES["Neutral Tracking"]];
  }

  // 1. Threshold Rule: Filter conditions that scored 2 or 3
  const flaggedConditions = [];
  
  for (const [condition, score] of Object.entries(questionnaire)) {
    // We ignore Neutral Tracking in this step because it's a guaranteed fallback later
    if (condition === "Neutral Tracking") continue;

    if (score === 2 || score === 3) {
      flaggedConditions.push(condition);
    }
  }

  // 2. Hierarchy Tie-Breaker: Sort by urgency (highest priority first)
  flaggedConditions.sort((a, b) => {
    const priorityA = URGENCY_HIERARCHY[a] || 0;
    const priorityB = URGENCY_HIERARCHY[b] || 0;
    return priorityB - priorityA; // descending order
  });

  // 3. The Max Limit: Take a maximum of 2 models
  const topConditions = flaggedConditions.slice(0, 2);

  // Map the top conditions to their actual model filenames
  const modelsToRun = topConditions.map(condition => MODEL_FILES[condition]);

  // 4. The Neutral Exception: ALWAYS run the neutral expert
  modelsToRun.push(MODEL_FILES["Neutral Tracking"]);

  return modelsToRun;
}
