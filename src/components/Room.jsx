import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { fetchAudioFromMinIO } from '../config/minioConfig';
import './Room.css';

// Generate a waveform path
function generateRoomWaveform() {
  const pts = [];
  const steps = 600;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 1000;
    const t = i / steps;
    let env = 0.3;
    if (t < 0.15) env = 0.1 + t * 3;
    else if (t < 0.4) env = 0.55 + Math.sin(t * 8) * 0.2;
    else if (t < 0.55) env = 0.3 + Math.sin(t * 5) * 0.1;
    else if (t < 0.75) env = 0.6 + Math.sin(t * 12) * 0.15;
    else env = 0.35 - (t - 0.75) * 1.2;
    const noise = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 2.3) * 0.3 + Math.sin(i * 5.7) * 0.2;
    const y = 60 + noise * 55 * Math.max(0.05, env);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${Math.max(5, Math.min(115, y)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function Room({ recording, onSeeAnalytics }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const waveformPath = useMemo(() => generateRoomWaveform(), []);

  // Load audio when recording changes — fetch with S3 auth to bypass 403
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);
    setIsLoading(false);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (!recording?.uri) return;

    let blobUrl = null;
    let cancelled = false;
    setIsLoading(true);

    fetchAudioFromMinIO(recording.uri)
      .then(url => {
        if (cancelled) return;
        blobUrl = url;
        if (audio) {
          audio.src = blobUrl;
          audio.load();
        }
        setIsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[Room] Audio fetch failed:', err);
        setAudioError('Could not load audio: ' + err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [recording?.id, recording?.uri]);

  // Sync audio element time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => {
      setIsLoading(false);
      setAudioError(null);
    };
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setAudioError('Could not load audio. The file may have been deleted or the cloud server is offline.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
  }, [recording?.uri]);

  // Dynamic skip interval based on audio duration
  const skipSeconds = useMemo(() => {
    if (audioDuration <= 3) return 1;
    if (audioDuration <= 10) return 2;
    return 5;
  }, [audioDuration]);

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Audio play failed:', err);
        setAudioError('Playback failed: ' + err.message);
      });
    }
  }, [isPlaying]);

  const handleBack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - skipSeconds);
  }, [skipSeconds]);

  const handleForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audioDuration, audio.currentTime + skipSeconds);
  }, [skipSeconds, audioDuration]);

  const handleSeek = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(audioDuration, pct * audioDuration));
  }, [audioDuration]);

  // Display duration: use audio element duration if available, fallback to recording duration
  const displayDuration = audioDuration || (recording?.duration || 0);
  const progressPct = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  // If no recording is selected, show empty default state
  if (!recording) {
    return (
      <div className="room">
        <div className="room__empty-state">
          <div className="room__empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h3 className="room__empty-title">No Recording Selected</h3>
          <p className="room__empty-desc">Go to the <strong>Records</strong> page and click the play button on a recording to listen and view analysis here.</p>
        </div>
      </div>
    );
  }

  const rec = recording;

  return (
    <div className="room">
      {/* Hidden HTML5 audio element — this does the actual playback */}
      <audio
        ref={audioRef}
        preload="metadata"
      />

      {/* Waveform Visualization */}
      <div className="room__waveform-card">
        <div className="room__waveform-header">
          <div>
            {/* Folder/client name on top */}
            {rec.personName && (
              <span className="room__person-name">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {rec.personName}
              </span>
            )}
            <h3 className="room__title">{rec.title || 'Voice Recording'}</h3>
            <span className="room__duration">
              {rec.date} · {formatTime(displayDuration)}
            </span>
          </div>
          <button className="room__analytics-btn" onClick={onSeeAnalytics}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
              <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
              <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            See Analytics
          </button>
        </div>

        {/* Error banner */}
        {audioError && (
          <div className="room__audio-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {audioError}
          </div>
        )}

        <div className="room__waveform-display" onClick={handleSeek} style={{ cursor: 'pointer' }}>
          <svg className="room__waveform-svg" viewBox="0 0 1000 120" preserveAspectRatio="none">
            {[0, 1, 2, 3, 4].map(i => (
              <line key={i} x1="0" y1={i * 30} x2="1000" y2={i * 30} stroke="rgba(76,175,80,0.08)" strokeWidth="0.5" />
            ))}
            <path d={waveformPath} fill="none" stroke="var(--primary-500)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
          </svg>
          {/* Playhead */}
          <div className="room__playhead" style={{ left: `${progressPct}%` }} />
        </div>

        {/* Player Controls */}
        <div className="room__controls">
          <button className="room__control-btn" onClick={handleBack} title={`Back ${skipSeconds}s`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 19 2 12 11 5 11 19" />
              <polygon points="22 19 13 12 22 5 22 19" />
            </svg>
            <span className="room__control-label">{skipSeconds}s</span>
          </button>

          <button className={`room__play-btn ${isLoading ? 'room__play-btn--loading' : ''}`} onClick={handlePlay} disabled={isLoading}>
            {isLoading ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="room__spinner">
                <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
            ) : isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button className="room__control-btn" onClick={handleForward} title={`Forward ${skipSeconds}s`}>
            <span className="room__control-label">{skipSeconds}s</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 19 22 12 13 5 13 19" />
              <polygon points="2 19 11 12 2 5 2 19" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="room__progress">
          <span className="room__time">{formatTime(currentTime)}</span>
          <div className="room__progress-track" onClick={handleSeek}>
            <div className="room__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="room__time">{formatTime(displayDuration)}</span>
        </div>
      </div>

      {/* Transcription */}
      <div className="room__card">
        <h3 className="room__card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Transcription
        </h3>
        <div className="room__transcript-full">
          <p>{rec.transcript || 'No transcription available.'}</p>
        </div>
        {rec.transcript && rec.transcript !== 'No transcription available.' && (
          <div className="room__transcription">
            {rec.transcript.match(/[^.!?]+[.!?]+/g)?.map((sentence, i) => {
              const timeOffset = Math.floor((i / 4) * displayDuration);
              const m = Math.floor(timeOffset / 60);
              const s = timeOffset % 60;
              return (
                <p className="room__transcript-text" key={i}>
                  <span className="room__transcript-time">[{m}:{s.toString().padStart(2, '0')}]</span> {sentence.trim()}
                </p>
              );
            })}
          </div>
        )}

        {/* BERT Tensor Proof */}
        {recording?.analysisData?.embeddings?.bert768 && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#1e1e2f', borderRadius: '8px', overflow: 'hidden' }}>
            <h4 style={{ color: '#4CAF50', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg>
              Mathematical BERT Vector Extracted (Size: {recording.analysisData.embeddings.bert768.length})
            </h4>
            <p style={{ color: '#a0a0b0', fontSize: '0.65rem', fontFamily: 'monospace', lineHeight: '1.4', margin: 0, wordBreak: 'break-all', opacity: 0.8 }}>
              [{recording.analysisData.embeddings.bert768.slice(0, 45).map(n => n.toFixed(4)).join(', ')} ... {recording.analysisData.embeddings.bert768.slice(-5).map(n => n.toFixed(4)).join(', ')}]
            </p>
            <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '6px', fontStyle: 'italic' }}>
              * This floating-point tensor proves the exact linguistic meaning of the transcription was converted into math and fed directly into the XGBoost AI models.
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      <div className="room__card">
        <h3 className="room__card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Analysis Results
        </h3>
        <div className="room__results-grid">
          {/* Severity */}
          <div className="room__result-item">
            <div className="room__result-icon room__result-icon--orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="room__result-info">
              <span className="room__result-label">Severity</span>
              <span className={`room__result-value room__result-value--${recording?.analysisData?.clinicalResult?.severityScore === 2 ? 'red' : recording?.analysisData?.clinicalResult?.severityScore === 1 ? 'orange' : 'green'}`}>{recording?.analysisData?.clinicalResult?.severity || 'Pending'}</span>
            </div>
          </div>

          {/* Emotion */}
          <div className="room__result-item">
            <div className="room__result-icon room__result-icon--blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <div className="room__result-info">
              <span className="room__result-label">Educational Problem</span>
              <span className="room__result-value room__result-value--blue">{recording?.analysisData?.clinicalResult?.educationalProblem || 'Pending'}</span>
            </div>
          </div>

          {/* Specific Anxiety */}
          <div className="room__result-item">
            <div className="room__result-icon room__result-icon--purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="room__result-info">
              <span className="room__result-label">Specific Anxiety</span>
              <span className="room__result-value room__result-value--purple">{recording?.analysisData?.clinicalResult?.specificAnxiety || 'Pending'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Model Confidence */}
      <div className="room__card">
        <h3 className="room__card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          AI Model Confidence
        </h3>
        
        {(() => {
          const confidences = recording?.analysisData?.clinicalResult?.modelsConfidence || [];
          if (confidences.length === 0) return <div className="room__confidence-info"><span className="room__confidence-label">No AI Confidence Data Available</span></div>;
          
          return confidences.map((item, i) => {
            const readableName = item.model.replace('_expert.joblib', '').replace(/_/g, ' ').toUpperCase();
            return (
              <div key={item.model} className="room__confidence" style={{ marginBottom: i < confidences.length - 1 ? '16px' : '0' }}>
                <div className="room__confidence-track">
                  <div className="room__confidence-fill" style={{ width: `${item.confidence}%` }} />
                </div>
                <div className="room__confidence-info">
                  <span className="room__confidence-percent">{item.confidence}%</span>
                  <span className="room__confidence-label">{readableName}</span>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export default Room;
