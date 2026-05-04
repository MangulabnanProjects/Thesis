import { useState, useEffect, useMemo } from 'react';
import './Dashboard.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CLINICAL_THRESHOLDS } from '../utils/audioAnalysis';

// ── Dashboard: reads saved analysis from Firestore ───────────
// Analysis is computed once at recording time on mobile.
// No re-analysis needed — just fetch and display.

function Dashboard({ recording }) {
  const [totalRecordings, setTotalRecordings] = useState(0);

  // Listen for total recordings count — only count those with a valid client
  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (clientsSnap) => {
      const validClientIds = new Set();
      clientsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.archivedAt) validClientIds.add(data.id);
      });

      const unsubRecs = onSnapshot(collection(db, 'recordings'), (recsSnap) => {
        let count = 0;
        recsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.archivedAt && validClientIds.has(data.clientId)) {
            count++;
          }
        });
        setTotalRecordings(count);
      });

      return () => unsubRecs();
    });
    return () => unsubClients();
  }, []);

  // Parse analysis from Firestore
  const analysis = useMemo(() => {
    if (!recording?.analysisData) return null;
    if (typeof recording.analysisData === 'string') {
      try { return JSON.parse(recording.analysisData); } catch { return null; }
    }
    return recording.analysisData;
  }, [recording?.analysisData]);


  // If no recording is selected, show empty default state
  if (!recording) {
    return (
      <div className="dashboard">
        <div className="dashboard__welcome">
          <h2 className="dashboard__greeting">Good morning, Dr. Doe 👋</h2>
          <p className="dashboard__subtitle">
            Here's an overview of your clinical activity today.
          </p>
        </div>
        <div className="dashboard__stats">
          <div className="dashboard__stat-card">
            <div className="dashboard__stat-header">
              <div className="dashboard__stat-icon dashboard__stat-icon--green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
            <div className="dashboard__stat-value">{totalRecordings}</div>
            <div className="dashboard__stat-label">Total Recordings</div>
          </div>
        </div>
        <div className="dashboard__empty-state">
          <div className="dashboard__empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h3 className="dashboard__empty-title">No Recording Selected</h3>
          <p className="dashboard__empty-desc">Select a recording from the <strong>Records</strong> page to view detailed audio analysis, visualizations, and clinical insights here.</p>
        </div>
      </div>
    );
  }

  // ── Loading state (only if Firestore fetch is slow) ────────
  const personName = recording.personName || 'Unknown';

  if (!analysis) {
    return (
      <div className="dashboard">
        <div className="dashboard__welcome">
          <h2 className="dashboard__greeting">Loading Analysis...</h2>
          <p className="dashboard__subtitle">
            Fetching saved analysis data for <strong>{personName}</strong>'s recording.
          </p>
        </div>
        <div className="dashboard__empty-state">
          <div className="dashboard__analyzing-spinner" />
          <h3 className="dashboard__empty-title">Retrieving Data</h3>
          <p className="dashboard__empty-desc">Analysis data is stored in Firestore and should load momentarily.</p>
        </div>
      </div>
    );
  }

  // ── Saved analysis data from Firestore ─────────────────────
  const ticks = analysis.ticks || [];
  const meta = analysis.meta || {};
  
  // Build summary from ticks if not present (for old recordings)
  const summary = analysis.summary || (() => {
    if (ticks.length === 0) return { avgPitch: 0, minPitch: 0, maxPitch: 0, avgLoudness: 0, jitterPercent: 0, shimmerDb: 0, voicedRatio: 0 };
    const voiced = ticks.filter(t => t.voiced || t.pitch > 0);
    const avg = (arr, key) => arr.length > 0 ? arr.reduce((s, t) => s + (t[key] || 0), 0) / arr.length : 0;
    return {
      avgPitch: parseFloat(avg(voiced, 'pitch').toFixed(1)),
      minPitch: voiced.length > 0 ? parseFloat(Math.min(...voiced.map(t => t.pitch)).toFixed(1)) : 0,
      maxPitch: voiced.length > 0 ? parseFloat(Math.max(...voiced.map(t => t.pitch)).toFixed(1)) : 0,
      avgLoudness: parseFloat(avg(ticks, 'loudness').toFixed(1)),
      jitterPercent: parseFloat((avg(voiced, 'jitter') * 100).toFixed(3)),
      shimmerDb: parseFloat((avg(voiced, 'shimmer') * 100).toFixed(4)),
      voicedRatio: ticks.length > 0 ? parseFloat((voiced.length / ticks.length).toFixed(3)) : 0,
    };
  })();

  const voicedTicks = ticks.filter(t => t.voiced || t.pitch > 0);

  // Build SVG paths from saved data (guard against empty arrays)
  const waveformPath = ticks.length > 0 ? buildPath(ticks, t => t.amp, 800, 120, 0, 1) : '';
  const pitchPath = voicedTicks.length > 0 ? buildPath(voicedTicks, t => t.pitch, 800, 80, summary.minPitch || 0, summary.maxPitch || 300) : '';
  const jitterMax = ticks.length > 0 ? Math.max(0.05, ...ticks.map(t => t.jitter || 0)) : 0.05;
  const jitterPath = ticks.length > 0 ? buildPath(ticks, t => t.jitter || 0, 800, 60, 0, jitterMax) : '';
  const shimmerMax = ticks.length > 0 ? Math.max(0.001, ...ticks.map(t => t.shimmer || 0)) : 0.001;
  const shimmerPath = ticks.length > 0 ? buildPath(ticks, t => t.shimmer || 0, 800, 60, 0, shimmerMax) : '';

  // Time axis labels
  const timeLabels = ticks.length > 0 ? getTimeLabels(ticks, 5) : [];

  // Gender from recording metadata (fixed at recording time, not editable)
  const genderKey = meta?.gender || recording?.gender?.toLowerCase() || 'unknown';
  const thresholds = CLINICAL_THRESHOLDS[genderKey] || CLINICAL_THRESHOLDS.unknown;

  // Severity based on clinical thresholds
  // Score = (Jitter Weight × 40%) + (Shimmer Weight × 35%) + (Pitch Weight × 25%)
  
  // Jitter Weight
  let jWeight = 0;
  if ((summary?.jitterPercent || 0) > thresholds.jitter.normalHigh) jWeight = 33;
  if ((summary?.jitterPercent || 0) > thresholds.jitter.normalHigh * 1.5) jWeight = 66;
  if ((summary?.jitterPercent || 0) > thresholds.jitter.normalHigh * 2.5) jWeight = 100;

  // Shimmer Weight
  let sWeight = 0;
  if ((summary?.shimmerDb || 0) > thresholds.shimmer.normalHigh) sWeight = 33;
  if ((summary?.shimmerDb || 0) > thresholds.shimmer.normalHigh * 1.5) sWeight = 66;
  if ((summary?.shimmerDb || 0) > thresholds.shimmer.normalHigh * 2.5) sWeight = 100;

  // Pitch Weight
  let pWeight = 0;
  if ((summary?.avgPitch || 0) > thresholds.pitch.normalHigh || (summary?.avgPitch || 0) < thresholds.pitch.normalLow) pWeight = 33;
  if ((summary?.avgPitch || 0) > thresholds.pitch.normalHigh * 1.2 || (summary?.avgPitch || 0) < thresholds.pitch.normalLow * 0.8) pWeight = 66;
  if ((summary?.avgPitch || 0) > thresholds.pitch.normalHigh * 1.5 || (summary?.avgPitch || 0) < thresholds.pitch.normalLow * 0.6) pWeight = 100;

  const severityScore = Math.round((jWeight * 0.40) + (sWeight * 0.35) + (pWeight * 0.25));
  
  let sevLabel = 'NORMAL';
  if (severityScore >= 70) sevLabel = 'SEVERE';
  else if (severityScore >= 45) sevLabel = 'MODERATE';
  else if (severityScore >= 20) sevLabel = 'MILD';

  const angle = Math.PI - (severityScore / 100) * Math.PI;
  const needleX = 100 + 75 * Math.cos(angle);
  const needleY = 110 - 75 * Math.sin(angle);

  // Radar chart from saved analysis
  const radarData = [
    Math.min(4, ((summary?.avgPitch || 0) / 75)),
    Math.min(4, (summary?.jitterPercent || 0) * 4),
    Math.min(4, (summary?.shimmerDb || 0) * 8),
    Math.min(4, (summary?.avgLoudness || 0) / 25),
    Math.min(4, (summary?.voicedRatio || 0) * 4),
    Math.min(4, (meta?.durationSeconds || 0)),
    Math.min(4, (summary?.avgLoudness || 0) / 20),
  ];

  return (
    <div className="dashboard">
      {/* Welcome Banner */}
      <div className="dashboard__welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="dashboard__greeting">Audio Analysis — {personName} 👋</h2>
          <p className="dashboard__subtitle">
            Saved analysis of <strong>{recording.title}</strong> · {(meta?.totalFrames || ticks?.length || 0)} frames analyzed
          </p>
        </div>
        
        {/* Gender Badge (read-only — fixed from client setup) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.8)', padding: '6px 16px', borderRadius: '20px', border: '1px solid #ddd' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>Clinical Baseline:</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase' }}>{genderKey}</span>
        </div>
      </div>

      {/* Stat Cards — Real data */}
      <div className="dashboard__stats">
        <div className="dashboard__stat-card">
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </div>
          <div className="dashboard__stat-value">{totalRecordings}</div>
          <div className="dashboard__stat-label">Total Recordings</div>
        </div>

        <div className="dashboard__stat-card">
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            </div>
            <span className="dashboard__stat-badge">Hz</span>
          </div>
          <div className="dashboard__stat-value">{summary?.avgPitch || 0}</div>
          <div className="dashboard__stat-label">Avg. Pitch (F0)</div>
        </div>

        <div className="dashboard__stat-card">
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
          </div>
          <div className="dashboard__stat-value">{summary?.jitterPercent || 0}%</div>
          <div className="dashboard__stat-label">Jitter (local)</div>
        </div>

        <div className="dashboard__stat-card">
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="4" height="12" rx="1" /><rect x="7" y="4" width="4" height="16" rx="1" /><rect x="12" y="8" width="4" height="8" rx="1" /><rect x="17" y="2" width="4" height="20" rx="1" /></svg>
            </div>
          </div>
          <div className="dashboard__stat-value">{summary?.shimmerDb || 0} dB</div>
          <div className="dashboard__stat-label">Shimmer (dB)</div>
        </div>
      </div>

      {/* AI Intake Summary (if available) */}
      {recording.intakeSummary && (
        <div style={{ background: 'linear-gradient(135deg, #f8f9fe, #eef7ee)', borderRadius: '16px', padding: '18px 22px', marginBottom: '20px', border: '1px solid #e0e8e0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" /><path d="M12 8v4l3 3" /></svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Intake Summary</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#333', lineHeight: 1.6, margin: '0 0 10px 0' }}>{recording.intakeSummary}</p>
          {recording.focusAreas?.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {recording.focusAreas.map((area, i) => (
                <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#4CAF50', background: '#e8f5e9', padding: '3px 10px', borderRadius: '12px', border: '1px solid #c8e6c9' }}>{area}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Transcription */}
      {recording.transcript && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 22px', marginBottom: '20px', border: '1px solid #EBEBF0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2196F3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Transcription</span>
          </div>
          <p style={{ fontSize: '0.95rem', color: '#1a1a2e', lineHeight: 1.6, margin: '0' }}>{recording.transcript}</p>
        </div>
      )}

      {/* Bottom Section: Gauge + Clinical Thresholds */}
      <div className="dashboard__bottom">
        <div className="dashboard__gauge-card">
          <h3 className="dashboard__section-title">VOICE QUALITY INDEX: {severityScore}% ({sevLabel})</h3>
          <div className="dashboard__gauge-content">
            <svg className="dashboard__gauge-svg" viewBox="0 0 200 130">
              <path d="M 20 110 A 80 80 0 0 1 55 38" fill="none" stroke="#4caf50" strokeWidth="18" strokeLinecap="round" />
              <path d="M 58 35 A 80 80 0 0 1 100 30" fill="none" stroke="#fbbc04" strokeWidth="18" />
              <path d="M 103 30 A 80 80 0 0 1 145 38" fill="none" stroke="#ff9800" strokeWidth="18" />
              <path d="M 148 41 A 80 80 0 0 1 180 110" fill="none" stroke="#ea4335" strokeWidth="18" strokeLinecap="round" />
              <text x="38" y="75" className="dashboard__gauge-zone" fill="#4caf50">Normal</text>
              <text x="68" y="32" className="dashboard__gauge-zone" fill="#fbbc04">Mild</text>
              <text x="128" y="32" className="dashboard__gauge-zone" fill="#ff9800">Moderate</text>
              <text x="165" y="75" className="dashboard__gauge-zone" fill="#ea4335">Severe</text>
              <line x1="100" y1="110" x2={needleX} y2={needleY} stroke="#e0e0e0" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="100" cy="110" r="5" fill="#555" />
              <text x="100" y="125" textAnchor="middle" className="dashboard__gauge-value">{severityScore}%</text>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: '#888', marginTop: 8 }}>
            <span>Jitter: {summary?.jitterPercent || 0}%</span>
            <span>Shimmer: {summary?.shimmerDb || 0} dB</span>
            <span>Voiced: {((summary?.voicedRatio || 0) * 100).toFixed(0)}%</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 6, textAlign: 'center' }}>
            Clinical thresholds — Jitter: &lt;1.04% normal · Shimmer: &lt;0.35 dB normal (Praat)
          </div>
        </div>

        {/* Clinical Voice Parameters vs Normal */}
        <div className="dashboard__shap-card">
          <div className="dashboard__shap-header">
            <h3 className="dashboard__section-title" style={{ marginBottom: 0 }}>CLINICAL VOICE PARAMETERS vs NORMAL ({genderKey.toUpperCase()} BASELINE)</h3>
          </div>
          <div className="dashboard__clinical-table">
            <div className="dashboard__clinical-header-row">
              <span className="dashboard__clinical-col dashboard__clinical-col--param">Parameter</span>
              <span className="dashboard__clinical-col dashboard__clinical-col--value">Patient</span>
              <span className="dashboard__clinical-col dashboard__clinical-col--normal">Normal Range</span>
              <span className="dashboard__clinical-col dashboard__clinical-col--bar">Comparison</span>
              <span className="dashboard__clinical-col dashboard__clinical-col--status">Status</span>
            </div>
            {[
              {
                label: 'Avg. Pitch (F0)',
                value: summary?.avgPitch || 0, unit: 'Hz',
                ...thresholds.pitch
              },
              {
                label: 'Pitch Range',
                value: (summary?.maxPitch || 0) - (summary?.minPitch || 0), unit: 'Hz',
                ...thresholds.pitchRange
              },
              {
                label: 'Jitter (local)',
                value: summary?.jitterPercent || 0, unit: '%',
                ...thresholds.jitter
              },
              {
                label: 'Shimmer (dB)',
                value: summary?.shimmerDb || 0, unit: 'dB',
                ...thresholds.shimmer
              },
              {
                label: 'Avg. Loudness',
                value: summary?.avgLoudness || 0, unit: '%',
                ...thresholds.loudness
              },
              {
                label: 'Voiced Ratio',
                value: (summary?.voicedRatio || 0) * 100, unit: '%',
                ...thresholds.voicedRatio
              },
              {
                label: 'Speech Rate',
                value: analysis?.speechActivity?.speechRate || 0, unit: 'seg/s',
                ...thresholds.speechRate
              },
              {
                label: 'Avg. Pause',
                value: analysis?.speechActivity?.avgPauseDurationMs || 0, unit: 'ms',
                ...thresholds.avgPause
              },
            ].map((d, i) => {
              const val = d.value;
              const isNormal = val >= d.normalLow && val <= d.normalHigh;
              const isBorderline = !isNormal && (
                (val >= d.normalLow * 0.7 && val < d.normalLow) ||
                (val > d.normalHigh && val <= d.normalHigh * 1.5)
              );
              const status = isNormal ? 'normal' : isBorderline ? 'borderline' : 'abnormal';
              const statusEmoji = isNormal ? '✅' : isBorderline ? '⚠️' : '🔴';
              const statusText = isNormal ? 'Normal' : isBorderline ? 'Borderline' : 'Abnormal';

              return (
                <div className={`dashboard__clinical-row dashboard__clinical-row--${status}`} key={i} title={d.info}>
                  <span className="dashboard__clinical-col dashboard__clinical-col--param">{d.label}</span>
                  <span className="dashboard__clinical-col dashboard__clinical-col--value">
                    <strong>{typeof val === 'number' ? val.toFixed(2) : val}</strong> {d.unit}
                  </span>
                  <span className="dashboard__clinical-col dashboard__clinical-col--normal">
                    {d.normalLow}–{d.normalHigh} {d.unit}
                  </span>
                  <span className="dashboard__clinical-col dashboard__clinical-col--bar">
                    <div className="dashboard__clinical-bar-track">
                      <div
                        className="dashboard__clinical-bar-normal"
                        style={{
                          left: `${(d.normalLow / d.max) * 100}%`,
                          width: `${((d.normalHigh - d.normalLow) / d.max) * 100}%`,
                        }}
                      />
                      <div
                        className={`dashboard__clinical-bar-marker dashboard__clinical-bar-marker--${status}`}
                        style={{ left: `${Math.min(100, (val / d.max) * 100)}%` }}
                      />
                    </div>
                  </span>
                  <span className={`dashboard__clinical-col dashboard__clinical-col--status dashboard__clinical-status--${status}`}>
                    {statusEmoji} {statusText}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 8, padding: '0 16px' }}>
            Reference: Praat voice analysis standards · Hover each row for clinical details
          </div>
        </div>
      </div>

      {/* Audio Signal Analysis — REAL DSP DATA */}
      <div className="dashboard__audio-card">
        <div className="dashboard__audio-header">
          <h3 className="dashboard__section-title" style={{ marginBottom: 0 }}>AUDIO SIGNAL ANALYSIS (Real DSP)</h3>
          <div className="dashboard__audio-meta">
            <span className="dashboard__audio-recording">{personName} — {recording.title}</span>
            <span className="dashboard__audio-timeline">
              <span className="dashboard__audio-indicator" />
              {meta.duration} · {meta.sampleRate}Hz · {meta.totalFrames} frames
            </span>
          </div>
        </div>

        {/* Waveform — from real RMS amplitude */}
        <div className="dashboard__waveform-section">
          <div className="dashboard__waveform-ylabel">Amplitude</div>
          <div className="dashboard__waveform-area">
            <div className="dashboard__waveform-yaxis">
              <span>1.0</span><span>0.5</span><span>0</span>
            </div>
            <div className="dashboard__waveform-canvas">
              <svg className="dashboard__waveform-svg" viewBox="0 0 800 120" preserveAspectRatio="none">
                <path className="dashboard__waveform-path" d={waveformPath} fill="none" stroke="#29b6f6" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="dashboard__waveform-xaxis">
              {timeLabels.map((label, i) => <span key={i}>{label}</span>)}
            </div>
          </div>
        </div>

        {/* Pitch (F0) — from real autocorrelation detection */}
        <div className="dashboard__waveform-section">
          <div className="dashboard__waveform-ylabel">Pitch (F0)</div>
          <div className="dashboard__waveform-area">
            <div className="dashboard__waveform-yaxis">
              <span>{summary.maxPitch}Hz</span><span>{summary.avgPitch}</span><span>{summary.minPitch}</span>
            </div>
            <div className="dashboard__subchart-canvas">
              <svg className="dashboard__waveform-svg" viewBox="0 0 800 80" preserveAspectRatio="none">
                <path d={pitchPath} fill="none" stroke="#29b6f6" strokeWidth="1.5" className="dashboard__waveform-path" />
              </svg>
            </div>
          </div>
        </div>

        {/* Jitter & Shimmer — from real period/amplitude perturbation */}
        <div className="dashboard__waveform-section">
          <div className="dashboard__waveform-ylabel">Jitter &amp; Shimmer</div>
          <div className="dashboard__waveform-area">
            <div className="dashboard__waveform-yaxis">
              <span>High</span><span>Low</span>
            </div>
            <div className="dashboard__subchart-canvas">
              <svg className="dashboard__waveform-svg" viewBox="0 0 800 60" preserveAspectRatio="none">
                <path d={jitterPath} fill="none" stroke="#4285f4" strokeWidth="1.2" className="dashboard__waveform-path" />
                <path d={shimmerPath} fill="none" stroke="#f4a235" strokeWidth="1.2" className="dashboard__waveform-path" />
              </svg>
            </div>
            <div className="dashboard__waveform-xaxis" style={{ justifyContent: 'flex-end', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: '#4285f4', display: 'inline-block' }} /> Jitter ({summary.jitterPercent}%)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: '#f4a235', display: 'inline-block' }} /> Shimmer ({summary.shimmerDb} dB)
              </span>
            </div>
          </div>
        </div>

        {/* Speech Activity — bar chart: bars = speech, flat = silence */}
        <div className="dashboard__waveform-section">
          <div className="dashboard__waveform-ylabel">Speech Activity</div>
          <div className="dashboard__waveform-area">
            <div className="dashboard__waveform-yaxis">
              <span>Speech</span><span>Silence</span>
            </div>
            <div className="dashboard__subchart-canvas" style={{ position: 'relative' }}>
              <svg className="dashboard__waveform-svg" viewBox={`0 0 ${ticks.length} 50`} preserveAspectRatio="none">
                {ticks.map((tick, i) => (
                  <rect
                    key={i}
                    x={i}
                    y={tick.isSpeaking ? 50 - tick.speechEnergy * 45 : 48}
                    width={1}
                    height={tick.isSpeaking ? tick.speechEnergy * 45 : 2}
                    fill={tick.isSpeaking ? '#4caf50' : '#e0e0e0'}
                    opacity={tick.isSpeaking ? 0.8 : 0.3}
                  />
                ))}
              </svg>
            </div>
            <div className="dashboard__waveform-xaxis" style={{ justifyContent: 'space-between', fontSize: '0.7rem' }}>
              <span>{analysis?.speechActivity?.speechSegments || 0} speech segments</span>
              <span>{analysis?.speechActivity?.pauseSegments || 0} pauses</span>
              <span>Rate: {analysis?.speechActivity?.speechRate || 0} seg/s</span>
              <span>Longest pause: {analysis?.speechActivity?.longestPauseMs || 0}ms</span>
            </div>
          </div>
        </div>

        <div className="dashboard__spectrogram-timelabel">Time</div>
      </div>

      {/* Vocal Biomarker Radar Chart */}
      <div className="dashboard__radar-card">
        <h3 className="dashboard__section-title">VOCAL BIOMARKER RADAR — {personName}</h3>
        <div className="dashboard__radar-content">
          <div className="dashboard__radar-wrapper">
            <svg className="dashboard__radar-svg" viewBox="0 0 300 280">
              {[1, 2, 3, 4].map((level) => {
                const r = level * 25;
                const points = Array.from({ length: 7 }, (_, i) => {
                  const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                  return `${150 + r * Math.cos(a)},${140 + r * Math.sin(a)}`;
                }).join(' ');
                return <polygon key={level} className="dashboard__radar-grid" points={points} />;
              })}
              {Array.from({ length: 7 }, (_, i) => {
                const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                return <line key={i} className="dashboard__radar-axis" x1="150" y1="140" x2={150 + 100 * Math.cos(a)} y2={140 + 100 * Math.sin(a)} />;
              })}
              {[1, 2, 3, 4].map((level) => (
                <text key={level} className="dashboard__radar-scale" x="153" y={140 - level * 25 + 3}>{level}</text>
              ))}
              {(() => {
                const pts = radarData.map((v, i) => {
                  const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                  const r = v * 25;
                  return `${150 + r * Math.cos(a)},${140 + r * Math.sin(a)}`;
                }).join(' ');
                return (
                  <>
                    <polygon className="dashboard__radar-area--current" points={pts} />
                    {radarData.map((v, i) => {
                      const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                      const r = v * 25;
                      return <circle key={i} className="dashboard__radar-dot" cx={150 + r * Math.cos(a)} cy={140 + r * Math.sin(a)} r="3.5" />;
                    })}
                  </>
                );
              })()}
              {['Pitch (F0)', 'Jitter', 'Shimmer', 'Loudness', 'Voiced%', 'Duration', 'Energy'].map((label, i) => {
                const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                return <text key={i} className="dashboard__radar-label" x={150 + 118 * Math.cos(a)} y={140 + 118 * Math.sin(a) + 3}>{label}</text>;
              })}
            </svg>
          </div>
          <div className="dashboard__radar-legend">
            <div className="dashboard__radar-legend-item">
              <span className="dashboard__radar-legend-swatch dashboard__radar-legend-swatch--current" />
              {personName}'s Recording
            </div>
          </div>
        </div>
      </div>

      {/* Recording Metadata */}
      <div className="dashboard__confidence-card">
        <h3 className="dashboard__section-title">Recording Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem', color: '#555' }}>
          <div><strong>Sample Rate:</strong> {meta.sampleRate} Hz</div>
          <div><strong>Duration:</strong> {meta.duration} ({meta.durationSeconds}s)</div>
          <div><strong>Total Frames:</strong> {meta.totalFrames}</div>
          <div><strong>Voiced Frames:</strong> {meta.voicedFrames}</div>
          <div><strong>Frame Size:</strong> {meta.frameSizeMs}ms</div>
          <div><strong>Hop Size:</strong> {meta.hopSizeMs}ms</div>
          <div><strong>Analyzed:</strong> {new Date(meta.analyzedAt).toLocaleString()}</div>
          <div><strong>Method:</strong> Autocorrelation (ACF)</div>
        </div>
      </div>
      
      {/* AI Model Confidence */}
      <div className="dashboard__confidence-card" style={{ marginTop: '20px' }}>
        <h3 className="dashboard__section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          AI MODEL CONFIDENCE
        </h3>
        
        {(() => {
          const confidences = recording?.analysisData?.clinicalResult?.modelsConfidence || [];
          if (confidences.length === 0) return <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '12px' }}>No AI Confidence Data Available</div>;
          
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
              {confidences.map((item, i) => {
                const readableName = item.model.replace('_expert.joblib', '').replace(/_/g, ' ').toUpperCase();
                return (
                  <div key={item.model} style={{ background: '#f8f9fe', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4a5568' }}>{readableName}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2196F3' }}>{item.confidence}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.confidence}%`, background: '#2196F3', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}


// ── Helper: Build SVG path from tick data ────────────────────
function buildPath(ticks, getter, width, height, min, max) {
  if (!ticks?.length) return '';
  const range = max - min || 1;
  return ticks.map((tick, i) => {
    const x = (i / (ticks.length - 1)) * width;
    const val = getter(tick);
    const y = height - 5 - ((val - min) / range) * (height - 10);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${Math.max(2, Math.min(height - 2, y)).toFixed(1)}`;
  }).join(' ');
}

// ── Helper: Get time labels at even intervals ────────────────
function getTimeLabels(ticks, count) {
  if (!ticks?.length) return [];
  const startT = ticks[0]?.t || 0;
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.floor(i / (count - 1) * (ticks.length - 1));
    let ms = ticks[idx]?.t || 0;
    // If it's a UNIX epoch timestamp, make it relative to the start
    if (ms > 1000000000) {
      ms = ms - startT;
    }
    const sec = ms / 1000;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  });
}

export default Dashboard;
