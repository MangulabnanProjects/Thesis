/**
 * Calculates a final, clinically safe Severity Score by blending text baseline,
 * detected conditions, and acoustic vital signs.
 * 
 * @param {Array<string>} found_conditions - The psychological conditions found (e.g. ["PTSD"])
 * @param {number} text_baseline_score - The severity predicted purely from text (0, 1, or 2)
 * @param {string} acoustic_status - The physical stress level in the voice ("Normal" or "Abnormal")
 * @returns {Object} { final_score, severity_label, logic_log }
 */
export function calculateSeverity(found_conditions, text_baseline_score, acoustic_status) {
  const SEVERITY_LABELS = {
    0: "Normal",
    1: "Moderate",
    2: "Severe"
  };

  // Initialize final_score = text_baseline_score
  let final_score = text_baseline_score;
  let logic_log = "";
  let rule_applied = false;

  // ⚙️ THE CORE LOGIC RULES (Must be executed in this exact order)

  // Rule 1: The Safety Net (Minimum Floor)
  if (found_conditions && found_conditions.length > 0 && final_score === 0) {
    final_score = 1;
    logic_log = "Adjusted to MODERATE. Clinical conditions detected; baseline cannot be 'Normal'.";
    rule_applied = true;
  }

  // Rule 2: The Body Doesn't Lie (Acoustic Elevation)
  // This executes after Rule 1 and can override it
  if (acoustic_status === "Abnormal") {
    final_score = 2;
    logic_log = "Elevated to SEVERE due to abnormal acoustic stress markers in the voice.";
    rule_applied = true;
  }

  // Rule 3: Baseline Preservation
  if (!rule_applied) {
    logic_log = "Severity maintained from text baseline.";
  }

  return {
    final_score: final_score,
    severity_label: SEVERITY_LABELS[final_score] || "Unknown",
    logic_log: logic_log
  };
}

// =====================================================================
// TEST CASES
// =====================================================================
// Uncomment the following lines to test the function manually
/*
console.log("--- Running Test Cases ---\n");

console.log("Test 1: Rule 1 (Safety Net)");
console.log(calculateSeverity(["Social Anxiety"], 0, "Normal"), "\n");

console.log("Test 2: Rule 2 (Acoustic Elevation)");
console.log(calculateSeverity(["PTSD"], 1, "Abnormal"), "\n");

console.log("Test 3: Rule 3 (Baseline Preservation)");
console.log(calculateSeverity(["Panic attack", "GAD"], 1, "Normal"), "\n");

console.log("Test 4: Pure Normal");
console.log(calculateSeverity([], 0, "Normal"), "\n");
*/
