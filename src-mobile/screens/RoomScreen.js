import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useClientContext } from '../context/ClientContext';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

// ── Waveform Visualizer ──────────────────────────────────────
// Mirrors the website's playhead approach: bars change color as audio progresses
function WaveformVisualizer({ width, progress, analysisData }) {
  const barCount = Math.floor((width - 32) / 5);

  const bars = useMemo(() => {
    if (analysisData?.ticks?.length > 0) {
      const ticks = analysisData.ticks;
      const step = Math.max(1, Math.floor(ticks.length / barCount));
      return Array.from({ length: barCount }, (_, i) => {
        const tick = ticks[Math.min(i * step, ticks.length - 1)];
        return tick?.amp ?? 0;
      });
    }
    // Fallback: generate static waveform
    return Array.from({ length: barCount }, (_, i) => {
      const h = (Math.sin(i * 0.3) * 0.4 + Math.cos(i * 0.7) * 0.3 + Math.sin(i * 1.2) * 0.2 + 0.5);
      return Math.max(0.05, Math.min(1, h));
    });
  }, [analysisData, barCount]);

  return (
    <View style={[waveStyles.container, { width }]}>
      <View style={waveStyles.barsContainer}>
        {bars.map((amp, i) => {
          const h = 4 + amp * 50;
          const barPct = (i / barCount) * 100;
          const isPassed = barPct <= progress;
          return (
            <View
              key={i}
              style={[
                waveStyles.bar,
                {
                  height: Math.max(3, h),
                  backgroundColor: isPassed ? '#51CF66' : '#D8D8DD',
                  opacity: isPassed ? 0.7 + amp * 0.3 : 0.5,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: { overflow: 'hidden' },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});

// ══════════════════════════════════════════════════════════════
// PLAYER LOGIC — modeled after the website's Room.jsx
// Website uses HTML <audio> element + direct .currentTime manipulation.
// Mobile uses expo-audio's useAudioPlayer + polling interval.
// KEY: expo-audio uses SECONDS (not ms) for currentTime and seekTo.
// ══════════════════════════════════════════════════════════════
export default function RoomScreen({ route }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;

  const { clients } = useClientContext();

  // Get params from navigation (when coming from Storage play button)
  const recordingId = route?.params?.recordingId;
  const autoPlay = route?.params?.autoPlay || false;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);   // in seconds (like website)
  const [isLoading, setIsLoading] = useState(false);

  // Find the recording across all clients
  const { recording, client } = useMemo(() => {
    if (!recordingId) return { recording: null, client: null };
    for (const c of clients) {
      const recs = c.recordings || [];
      const rec = recs.find(r => r.id === recordingId);
      if (rec) return { recording: rec, client: c };
    }
    return { recording: null, client: null };
  }, [clients, recordingId]);

  // Parse analysis data if it's a string
  const analysisData = useMemo(() => {
    if (!recording?.analysisData) return null;
    if (typeof recording.analysisData === 'string') {
      try { return JSON.parse(recording.analysisData); } catch { return null; }
    }
    return recording.analysisData;
  }, [recording]);

  // Duration in seconds — use recording metadata as fallback
  const durationFromMeta = useMemo(() => {
    if (analysisData?.meta?.durationSeconds) return analysisData.meta.durationSeconds;
    if (recording?.duration) {
      const parts = recording.duration.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  }, [recording, analysisData]);

  // Set up audio player — expo-audio expects a raw URI string
  const audioSource = recording?.uri ? recording.uri : null;
  const audioPlayer = useAudioPlayer(audioSource);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  // Use the player's reported duration when available, else fallback to metadata
  const audioDuration = useMemo(() => {
    if (playerStatus?.duration && isFinite(playerStatus.duration) && playerStatus.duration > 0) {
      return playerStatus.duration; // expo-audio: already in seconds
    }
    return durationFromMeta;
  }, [playerStatus?.duration, durationFromMeta]);

  // Dynamic seek step based on audio duration (user's exact spec)
  const seekStep = useMemo(() => {
    if (audioDuration <= 6) return 2;
    if (audioDuration <= 15) return 5;
    return 10;
  }, [audioDuration]);

  // Progress percentage for waveform and progress bar
  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // ── Polling interval: smooth playback tracking at ~10fps ──
  // Same concept as website's 'timeupdate' event listener
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      try {
        // expo-audio currentTime is in SECONDS
        const t = audioPlayer.currentTime || 0;
        setCurrentTime(t);
      } catch { }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, audioPlayer]);

  // ── Sync isPlaying state with actual player status ──
  // Same concept as website's 'ended' event handler
  useEffect(() => {
    if (!playerStatus) return;
    if (playerStatus.playing && !isPlaying) {
      setIsPlaying(true);
    }
    if (!playerStatus.playing && isPlaying) {
      // Audio stopped (either paused or ended)
      setIsPlaying(false);
    }
  }, [playerStatus?.playing]);

  // Stop playback when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        try { audioPlayer.pause(); } catch { }
        setIsPlaying(false);
      };
    }, [audioPlayer])
  );

  // Autoplay when coming from Storage
  useEffect(() => {
    if (autoPlay && recording?.uri) {
      const timer = setTimeout(() => {
        try {
          audioPlayer.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('Autoplay failed:', e);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, recordingId]);

  // ── Play / Pause — same as website's handlePlay ──
  const handlePlayPause = useCallback(async () => {
    if (!recording?.uri) return;
    try {
      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        audioPlayer.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn('Playback error:', e);
    }
  }, [isPlaying, recording?.uri, audioPlayer]);

  // ── Seek backward — same as website's handleBack ──
  // Does NOT pause audio, just jumps the position
  const handleBack = useCallback(() => {
    if (!recording?.uri) return;
    try {
      const newTime = Math.max(0, (audioPlayer.currentTime || 0) - seekStep);
      audioPlayer.seekTo(newTime);
      setCurrentTime(newTime);
    } catch (e) {
      console.warn('Seek error:', e);
    }
  }, [seekStep, audioPlayer, recording?.uri]);

  // ── Seek forward — same as website's handleForward ──
  const handleForward = useCallback(() => {
    if (!recording?.uri) return;
    try {
      const newTime = Math.min(audioDuration, (audioPlayer.currentTime || 0) + seekStep);
      audioPlayer.seekTo(newTime);
      setCurrentTime(newTime);
    } catch (e) {
      console.warn('Seek error:', e);
    }
  }, [seekStep, audioDuration, audioPlayer, recording?.uri]);

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Split transcription into words for highlight effect
  const transcription = recording?.transcription || '';
  const words = useMemo(() => {
    if (!transcription) return [];
    return transcription.split(/\s+/);
  }, [transcription]);

  // Approximate word timing for highlight
  const activeWordIndex = useMemo(() => {
    if (!isPlaying || words.length === 0 || audioDuration === 0) return -1;
    const wordIdx = Math.floor((currentTime / audioDuration) * words.length);
    return Math.min(wordIdx, words.length - 1);
  }, [currentTime, audioDuration, words, isPlaying]);

  // ── No recording selected ──
  if (!recordingId || !recording) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="musical-notes-outline" size={48} color="#D1D1D6" />
        <Text style={{ color: '#8E8E93', fontSize: 16, marginTop: 12, fontWeight: '600' }}>
          No Recording Selected
        </Text>
        <Text style={{ color: '#C7C7CC', fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
          Go to Storage and tap play on a recording to listen here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Room</Text>
          {client && (
            <View style={styles.clientBadge}>
              <View style={[styles.clientDot, { backgroundColor: client.color || '#4CAF50' }]} />
              <Text style={styles.clientName}>{client.name}</Text>
            </View>
          )}
        </View>

        {/* Player Card */}
        <View style={styles.card}>
          <View style={styles.playerHeader}>
            <Text style={styles.recordingTitle}>
              Recording — {recording.date}
            </Text>
            <Text style={styles.durationBadge}>{recording.duration}</Text>
          </View>

          {/* Waveform — tracks progress just like website's playhead */}
          <View style={styles.waveformWrap}>
            <WaveformVisualizer width={cardWidth - 40} progress={progressPct} analysisData={analysisData} />
          </View>

          {/* Play Controls — matches website layout exactly */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.seekBtn} onPress={handleBack} activeOpacity={0.6}>
              <Ionicons name="play-back" size={18} color="#8E8E93" />
              <Text style={styles.seekLabel}>{seekStep}s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playMainBtn, isPlaying && styles.playMainBtnActive]}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#ffffff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.seekBtn} onPress={handleForward} activeOpacity={0.6}>
              <Text style={styles.seekLabel}>{seekStep}s</Text>
              <Ionicons name="play-forward" size={18} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressTime}>{formatTime(currentTime)}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(progressPct, 100)}%` }]} />
              <View style={[styles.progressDot, { left: `${Math.min(progressPct, 100)}%` }]} />
            </View>
            <Text style={styles.progressTime}>{formatTime(audioDuration)}</Text>
          </View>
        </View>

        {/* Transcription Card */}
        {transcription ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={18} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Transcription</Text>
            </View>
            <View style={styles.transcriptionFull}>
              <View style={styles.transcriptionBar} />
              <Text style={styles.transcriptionFullText}>
                {words.map((word, i) => (
                  <Text
                    key={i}
                    style={[
                      i < activeWordIndex && styles.wordPast,
                      i === activeWordIndex && styles.wordActive,
                    ]}
                  >
                    {word}{' '}
                  </Text>
                ))}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Clinical Parameters — matches website Dashboard */}
        {(() => {
          if (!analysisData?.ticks?.length) return null;
          const ticks = analysisData.ticks;
          const avg = (arr, key) => arr.reduce((s, t) => s + (t[key] || 0), 0) / arr.length;
          
          let avgPitch = analysisData.summary?.avgPitch ?? avg(ticks, 'pitch');
          let avgJitter = analysisData.summary?.jitterPercent ?? avg(ticks, 'jitter') * 100;
          let avgShimmer = analysisData.summary?.shimmerDb ?? avg(ticks, 'shimmer') * 100;
          let avgLoudness = analysisData.summary?.avgLoudness ?? avg(ticks, 'loudness');

          const genderKey = client?.gender?.toLowerCase() || 'unknown';
          const THRESHOLDS = {
            male:    { pitch: [85, 180], jitter: [0, 1.04], shimmer: [0, 0.35], loudness: [30, 70] },
            female:  { pitch: [165, 255], jitter: [0, 1.04], shimmer: [0, 0.35], loudness: [30, 70] },
            unknown: { pitch: [85, 255], jitter: [0, 1.04], shimmer: [0, 0.35], loudness: [30, 70] },
          };
          const th = THRESHOLDS[genderKey] || THRESHOLDS.unknown;

          const getStatus = (val, range) => {
            if (val >= range[0] && val <= range[1]) return { text: 'Normal', color: '#4CAF50', icon: 'checkmark-circle' };
            if (val >= range[0] * 0.7 && val <= range[1] * 1.5) return { text: 'Borderline', color: '#ff9800', icon: 'warning' };
            return { text: 'Abnormal', color: '#ea4335', icon: 'alert-circle' };
          };

          // Severity Score (same formula as website)
          let jW = 0;
          if (avgJitter > th.jitter[1]) jW = 33;
          if (avgJitter > th.jitter[1] * 1.5) jW = 66;
          if (avgJitter > th.jitter[1] * 2.5) jW = 100;
          let sW = 0;
          if (avgShimmer > th.shimmer[1]) sW = 33;
          if (avgShimmer > th.shimmer[1] * 1.5) sW = 66;
          if (avgShimmer > th.shimmer[1] * 2.5) sW = 100;
          let pW = 0;
          if (avgPitch > th.pitch[1] || avgPitch < th.pitch[0]) pW = 33;
          if (avgPitch > th.pitch[1] * 1.2 || avgPitch < th.pitch[0] * 0.8) pW = 66;
          if (avgPitch > th.pitch[1] * 1.5 || avgPitch < th.pitch[0] * 0.6) pW = 100;
          const sevScore = Math.round((jW * 0.40) + (sW * 0.35) + (pW * 0.25));
          let sevLabel = 'NORMAL', sevColor = '#4CAF50';
          if (sevScore >= 70) { sevLabel = 'SEVERE'; sevColor = '#ea4335'; }
          else if (sevScore >= 45) { sevLabel = 'MODERATE'; sevColor = '#ff9800'; }
          else if (sevScore >= 20) { sevLabel = 'MILD'; sevColor = '#fbc02d'; }

          const rows = [
            { name: 'Pitch (F0)', val: avgPitch.toFixed(1), unit: 'Hz', range: th.pitch, status: getStatus(avgPitch, th.pitch) },
            { name: 'Jitter', val: avgJitter.toFixed(2), unit: '%', range: th.jitter, status: getStatus(avgJitter, th.jitter) },
            { name: 'Shimmer', val: avgShimmer.toFixed(2), unit: 'dB', range: th.shimmer, status: getStatus(avgShimmer, th.shimmer) },
            { name: 'Loudness', val: avgLoudness.toFixed(1), unit: '%', range: th.loudness, status: getStatus(avgLoudness, th.loudness) },
          ];

          return (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bar-chart" size={18} color="#4CAF50" />
                <Text style={styles.sectionTitle}>Clinical Parameters</Text>
                <Text style={styles.tickCount}>{genderKey.toUpperCase()}</Text>
              </View>

              {/* Severity Gauge */}
              <View style={{ alignItems: 'center', marginBottom: 16, backgroundColor: '#FAFBFE', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#EBEBF0' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Voice Quality Index</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 2, borderColor: sevColor, backgroundColor: sevColor + '12' }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: sevColor }}>{sevScore}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: sevColor, letterSpacing: 1 }}>{sevLabel}</Text>
                </View>
              </View>

              {/* Clinical Table */}
              <View style={{ borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 12, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F0F1F5', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderColor: '#EBEBF0' }}>
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase' }}>Parameter</Text>
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase' }}>Patient</Text>
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase' }}>Normal</Text>
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', textAlign: 'right' }}>Status</Text>
                </View>
                {rows.map((r, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: idx < rows.length - 1 ? 1 : 0, borderColor: '#F0F1F5' }}>
                    <Text style={{ flex: 2, fontSize: 12, fontWeight: '700', color: '#1a1a2e' }}>{r.name}</Text>
                    <Text style={{ flex: 2, fontSize: 12, color: '#636e72' }}>{r.val} {r.unit}</Text>
                    <Text style={{ flex: 2, fontSize: 12, color: '#4CAF50' }}>{r.range[0]}–{r.range[1]} {r.unit}</Text>
                    <View style={{ flex: 2, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Ionicons name={r.status.icon} size={13} color={r.status.color} style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: r.status.color }}>{r.status.text}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* AI Clinical Outputs */}
              {analysisData?.clinicalResult && (
                <View style={{ marginTop: 16, backgroundColor: '#FFF0F0', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FFCDD2' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF5252', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>AI Clinical Outputs</Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#636e72', fontWeight: '600' }}>Final Severity</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF5252' }}>{analysisData.clinicalResult.severity}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#636e72', fontWeight: '600' }}>Specific Anxiety</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', maxWidth: '60%', textAlign: 'right' }}>{analysisData.clinicalResult.specificAnxiety}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#636e72', fontWeight: '600' }}>Educational Problem</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#9C27B0', maxWidth: '60%', textAlign: 'right' }}>{analysisData.clinicalResult.educationalProblem}</Text>
                  </View>
                </View>
              )}

              <Text style={{ fontSize: 10, color: '#A0A0A0', textAlign: 'center', marginTop: 10 }}>Reference: Praat clinical voice analysis standards</Text>
            </View>
          );
        })()}

        {/* Cloud Source Indicator */}
        <View style={styles.cloudNote}>
          <Ionicons name="cloud-done-outline" size={18} color="#4CAF50" style={{ marginTop: 2 }} />
          <Text style={styles.cloudNoteText}>
            Audio is streaming from your cloud storage. All analysis data is synced via Firebase.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  clientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  clientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clientName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636e72',
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  // Player
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
    marginRight: 12,
  },
  durationBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#51CF66',
    backgroundColor: '#F0FFF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  waveformWrap: {
    backgroundColor: '#FAFBFE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F1F5',
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  seekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seekLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  playMainBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#51CF66',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#51CF66',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playMainBtnActive: {
    backgroundColor: '#40C057',
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTime: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#F0F1F5',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#51CF66',
    borderRadius: 2,
  },
  progressDot: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#51CF66',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginLeft: -6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
  },
  tickCount: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    backgroundColor: '#F0F1F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  // Transcription
  transcriptionFull: {
    flexDirection: 'row',
    gap: 12,
  },
  transcriptionBar: {
    width: 3,
    backgroundColor: '#51CF66',
    borderRadius: 2,
  },
  transcriptionFullText: {
    flex: 1,
    fontSize: 14,
    color: '#636e72',
    lineHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordPast: {
    color: '#1a1a2e',
  },
  wordActive: {
    backgroundColor: '#51CF66',
    color: '#ffffff',
    fontWeight: '700',
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Analysis
  analysisGrid: {
    gap: 10,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
  },
  analysisIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
  },
  analysisValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Cloud note
  cloudNote: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    backgroundColor: '#F0FFF4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4CAF5020',
  },
  cloudNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#636e72',
    lineHeight: 18,
  },
});
