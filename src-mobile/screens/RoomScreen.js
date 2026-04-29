import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
function WaveformVisualizer({ width, isPlaying, analysisData }) {
  const barCount = Math.floor((width - 32) / 5);

  // If we have real analysis data, use it for bars
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
          return (
            <View
              key={i}
              style={[
                waveStyles.bar,
                {
                  height: Math.max(3, h),
                  backgroundColor: '#51CF66',
                  opacity: isPlaying ? 0.6 + amp * 0.4 : 0.3,
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
export default function RoomScreen({ route }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;

  const { clients } = useClientContext();

  // Get params from navigation (when coming from Storage play button)
  const recordingId = route?.params?.recordingId;
  const autoPlay = route?.params?.autoPlay || false;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
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

  // Duration in seconds
  const durationSeconds = useMemo(() => {
    if (analysisData?.meta?.durationSeconds) return analysisData.meta.durationSeconds;
    if (recording?.duration) {
      const parts = recording.duration.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  }, [recording, analysisData]);

  // Set up audio player — always call the hook (can't conditionally call hooks)
  // Pass a valid source or undefined when no recording
  const audioSource = recording?.uri ? { uri: recording.uri } : undefined;
  const audioPlayer = useAudioPlayer(audioSource);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  // Stop playback when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        try { audioPlayer.pause(); } catch {}
        setIsPlaying(false);
      };
    }, [audioPlayer])
  );

  // Update progress from player status
  useEffect(() => {
    if (playerStatus && durationSeconds > 0) {
      const currentSec = (playerStatus.currentTime || 0) / 1000;
      setElapsed(Math.floor(currentSec));
      setProgress((currentSec / durationSeconds) * 100);

      if (playerStatus.playing !== isPlaying) {
        setIsPlaying(playerStatus.playing);
      }
    }
  }, [playerStatus?.currentTime, playerStatus?.playing]);

  // Autoplay when coming from Storage
  useEffect(() => {
    if (autoPlay && recording?.uri) {
      setTimeout(() => {
        try {
          audioPlayer.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('Autoplay failed:', e);
        }
      }, 500);
    }
  }, [autoPlay, recordingId]);

  // Track if audio finished playing
  const finishedRef = useRef(false);

  // Detect playback completion — mark as finished
  useEffect(() => {
    if (!playerStatus) return;

    // When the player stops playing and we thought it was playing → it finished
    if (!playerStatus.playing && isPlaying) {
      setIsPlaying(false);
      finishedRef.current = true;
    }
  }, [playerStatus?.playing]);

  const handlePlayPause = async () => {
    if (!recording?.uri) return;
    try {
      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        // If audio finished, reload the source to reset player completely
        if (finishedRef.current) {
          finishedRef.current = false;
          setProgress(0);
          setElapsed(0);
          audioPlayer.replace({ uri: recording.uri });
          // Small delay to let the player reload before playing
          await new Promise(r => setTimeout(r, 300));
        }
        audioPlayer.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn('Playback error:', e);
    }
  };

  const handleSeek = (deltaSeconds) => {
    if (!recording?.uri || durationSeconds === 0) return;
    try {
      const currentMs = (playerStatus?.currentTime || 0);
      const newMs = Math.max(0, Math.min(durationSeconds * 1000, currentMs + deltaSeconds * 1000));
      audioPlayer.seekTo(newMs);
    } catch (e) {
      console.warn('Seek error:', e);
    }
  };

  const formatTime = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Split transcription into words for highlight effect
  const transcription = recording?.transcription || '';
  const words = useMemo(() => {
    if (!transcription) return [];
    return transcription.split(/\s+/);
  }, [transcription]);

  // Approximate word timing for highlight
  const activeWordIndex = useMemo(() => {
    if (!isPlaying || words.length === 0 || durationSeconds === 0) return -1;
    const wordIdx = Math.floor((elapsed / durationSeconds) * words.length);
    return Math.min(wordIdx, words.length - 1);
  }, [elapsed, durationSeconds, words, isPlaying]);

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

  // ── Build summary data for analysis display ──
  const summaryData = useMemo(() => {
    if (!analysisData?.ticks?.length) return null;
    const ticks = analysisData.ticks;
    const avg = (arr, key) => arr.reduce((s, t) => s + (t[key] || 0), 0) / arr.length;
    return {
      avgPitch: avg(ticks, 'pitch').toFixed(1),
      avgJitter: (avg(ticks, 'jitter') * 100).toFixed(2),
      avgShimmer: (avg(ticks, 'shimmer') * 100).toFixed(2),
      avgLoudness: avg(ticks, 'loudness').toFixed(1),
      totalTicks: ticks.length,
    };
  }, [analysisData]);

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

          {/* Waveform */}
          <View style={styles.waveformWrap}>
            <WaveformVisualizer width={cardWidth - 40} isPlaying={isPlaying} analysisData={analysisData} />
          </View>

          {/* Play Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.seekBtn} onPress={() => handleSeek(-10)} activeOpacity={0.6}>
              <Ionicons name="play-back" size={18} color="#8E8E93" />
              <Text style={styles.seekLabel}>10s</Text>
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

            <TouchableOpacity style={styles.seekBtn} onPress={() => handleSeek(10)} activeOpacity={0.6}>
              <Text style={styles.seekLabel}>10s</Text>
              <Ionicons name="play-forward" size={18} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressTime}>{formatTime(elapsed)}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
              <View style={[styles.progressDot, { left: `${Math.min(progress, 100)}%` }]} />
            </View>
            <Text style={styles.progressTime}>{formatTime(durationSeconds)}</Text>
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

        {/* Audio Analysis Data Card */}
        {summaryData ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart" size={18} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Audio Analysis</Text>
              <Text style={styles.tickCount}>{summaryData.totalTicks} data points</Text>
            </View>
            <View style={styles.analysisGrid}>
              <View style={[styles.analysisItem, { backgroundColor: '#E3F2FD' }]}>
                <View style={[styles.analysisIcon, { backgroundColor: '#4285f420' }]}>
                  <Ionicons name="musical-note" size={20} color="#4285f4" />
                </View>
                <View>
                  <Text style={styles.analysisLabel}>Avg. Pitch (F0)</Text>
                  <Text style={[styles.analysisValue, { color: '#4285f4' }]}>{summaryData.avgPitch} Hz</Text>
                </View>
              </View>

              <View style={[styles.analysisItem, { backgroundColor: '#FFF8F0' }]}>
                <View style={[styles.analysisIcon, { backgroundColor: '#FFA94D20' }]}>
                  <Ionicons name="pulse" size={20} color="#FFA94D" />
                </View>
                <View>
                  <Text style={styles.analysisLabel}>Avg. Jitter</Text>
                  <Text style={[styles.analysisValue, { color: '#FFA94D' }]}>{summaryData.avgJitter}%</Text>
                </View>
              </View>

              <View style={[styles.analysisItem, { backgroundColor: '#FFF0F8' }]}>
                <View style={[styles.analysisIcon, { backgroundColor: '#E91E8C20' }]}>
                  <Ionicons name="trending-up" size={20} color="#E91E8C" />
                </View>
                <View>
                  <Text style={styles.analysisLabel}>Avg. Shimmer</Text>
                  <Text style={[styles.analysisValue, { color: '#E91E8C' }]}>{summaryData.avgShimmer}%</Text>
                </View>
              </View>

              <View style={[styles.analysisItem, { backgroundColor: '#E8F5E9' }]}>
                <View style={[styles.analysisIcon, { backgroundColor: '#4CAF5020' }]}>
                  <Ionicons name="volume-high" size={20} color="#4CAF50" />
                </View>
                <View>
                  <Text style={styles.analysisLabel}>Avg. Loudness</Text>
                  <Text style={[styles.analysisValue, { color: '#4CAF50' }]}>{summaryData.avgLoudness}%</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

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
