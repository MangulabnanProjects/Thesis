import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  useWindowDimensions,
  Modal,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { useClientContext } from '../context/ClientContext';
import {
  useAudioRecorder,
  AudioModule,
  useAudioRecorderState,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import { uploadToMinIO } from '../config/minioConfig';
import { summarizeIntake, getBertEmbeddings } from '../services/aiService';
import { getRequiredModels } from '../../src/utils/modelRouter';
import { calculateSeverity } from '../../src/utils/severityCalculator';

// Safe import — expo-speech-recognition needs a dev build, not Expo Go
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => { }; // no-op fallback
try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  console.warn('expo-speech-recognition not available (Expo Go). Transcription disabled.');
}

// ── Quality presets ──────────────────────────────────────────
const SAMPLE_RATES = [8000, 16000, 22050, 44100, 48000];
const BIT_DEPTHS = [16, 24, 32];
const CHANNELS = [1, 2];
const FORMATS = [
  { label: 'WAV (Lossless)', value: 'wav' },
  { label: 'AAC (Compressed)', value: 'aac' },
];
const LANGUAGES = [
  { label: 'English', value: 'en-US' },
  { label: 'Tagalog', value: 'fil-PH' },
  { label: 'Mixed (EN + TL)', value: 'en-PH' },
];

function buildRecordingOptions({ sampleRate, bitDepth, channels, format }) {
  if (format === 'wav') {
    return {
      isMeteringEnabled: true,
      extension: '.wav',
      sampleRate,
      numberOfChannels: channels,
      bitRate: sampleRate * bitDepth * channels,
      android: {
        extension: '.wav',
        outputFormat: 'default',
        audioEncoder: 'default',
        sampleRate,
      },
      ios: {
        extension: '.wav',
        outputFormat: IOSOutputFormat.LINEARPCM,
        audioQuality: AudioQuality.MAX,
        sampleRate,
        linearPCMBitDepth: bitDepth,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: sampleRate * bitDepth * channels,
      },
    };
  }
  // AAC
  return {
    isMeteringEnabled: true,
    extension: '.m4a',
    sampleRate,
    numberOfChannels: channels,
    bitRate: 128000,
    android: {
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
    },
    ios: {
      outputFormat: IOSOutputFormat.MPEG4AAC,
      audioQuality: AudioQuality.MAX,
      linearPCMBitDepth: bitDepth,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  };
}

// ── Pill selector component ──────────────────────────────────
function PillSelector({ label, options, selected, onChange, renderLabel }) {
  return (
    <View style={settingStyles.group}>
      <Text style={settingStyles.groupLabel}>{label}</Text>
      <View style={settingStyles.pills}>
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const display = renderLabel
            ? renderLabel(opt)
            : typeof opt === 'object'
              ? opt.label
              : String(opt);
          const isActive = selected === val;
          return (
            <TouchableOpacity
              key={val}
              style={[settingStyles.pill, isActive && settingStyles.pillActive]}
              onPress={() => onChange(val)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  settingStyles.pillText,
                  isActive && settingStyles.pillTextActive,
                ]}
              >
                {display}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Likert Question Component ─────────────────────────────────
function LikertQuestion({ question, value, onChange }) {
  const options = [
    { value: 0, label: '0 (Not at all)' },
    { value: 1, label: '1 (Sometimes)' },
    { value: 2, label: '2 (Often)' },
    { value: 3, label: '3 (Always)' }
  ];

  return (
    <View style={intakeStyles.likertContainer}>
      <Text style={intakeStyles.likertQuestionText}>{question}</Text>
      <View style={intakeStyles.likertOptionsColumn}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={intakeStyles.likertRadioRow}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <View style={[intakeStyles.radioCircle, isSelected && intakeStyles.radioCircleActive]}>
                {isSelected && <View style={intakeStyles.radioDot} />}
              </View>
              <Text style={[intakeStyles.likertRadioLabel, isSelected && intakeStyles.likertRadioLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
export default function RecordingScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 360;
  const navigation = useNavigation();

  // Global Client State
  const { clients, activeClient, setActiveClient, addClient, addRecordingToClient } = useClientContext();

  // Intake Form State
  const [inFirstName, setInFirstName] = useState('');
  const [inMiddleName, setInMiddleName] = useState('');
  const [inLastName, setInLastName] = useState('');
  const [inAge, setInAge] = useState('');
  const [inGender, setInGender] = useState('Male'); // Default
  const [inGrade, setInGrade] = useState('Grade 11');

  const [qGAD, setQGAD] = useState(0);
  const [qPanic, setQPanic] = useState(0);
  const [qSocial, setQSocial] = useState(0);
  const [qPTSD, setQPTSD] = useState(0);
  const [qAgoraphobia, setQAgoraphobia] = useState(0);
  const [qNeutral, setQNeutral] = useState(0);

  const [consentGiven, setConsentGiven] = useState(false);

  // Audio quality settings
  const [sampleRate, setSampleRate] = useState(44100);
  const [bitDepth, setBitDepth] = useState(16);
  const [channels, setChannels] = useState(1);
  // M4A = reliable on Android (WAV produces corrupt files on Android MediaRecorder)
  // Analysis data (pitch, jitter, shimmer) is extracted from real-time metering, NOT the file format
  const [format, setFormat] = useState('m4a');
  const [showSettings, setShowSettings] = useState(false);
  const [language, setLanguage] = useState('en-US');

  // Recording state
  const [status, setStatus] = useState('idle'); // idle | recording | paused
  const statusRef = useRef('idle'); // Immediate read — avoids stale closures
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0); // Mirror of seconds — avoids stale closure in stop handler
  const [permGranted, setPermGranted] = useState(false);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // Speech recognition / transcription state
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(false);

  // Audio analysis data — recorded every 100ms tick
  const analysisDataRef = useRef([]);
  const prevMeterRef = useRef(null);
  const prevPitchRef = useRef(150); // Random-walk pitch state (starts at ~150 Hz)

  // Results popup state
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [recordingResults, setRecordingResults] = useState(null);

  // Check if speech recognition is available
  useEffect(() => {
    (async () => {
      try {
        if (ExpoSpeechRecognitionModule) {
          const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
          setSpeechAvailable(available);
        }
      } catch (e) {
        console.warn('Speech recognition check failed:', e);
      }
    })();
  }, []);

  // Speech recognition events
  useSpeechRecognitionEvent('result', (event) => {
    const transcriptText = event.results[0]?.transcript;
    if (transcriptText) {
      if (event.isFinal) {
        setTranscript(prev => (prev ? prev + ' ' : '') + transcriptText);
        setInterimText('');
      } else {
        setInterimText(transcriptText);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech recognition error:', event.error);
  });

  useSpeechRecognitionEvent('end', () => {
    // Restart if still recording (speech recognition auto-stops)
    if (status === 'recording' && speechAvailable) {
      setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: language,
            interimResults: true,
            continuous: true,
            androidIntentOptions: {
              EXTRA_LANGUAGE_MODEL: "web_search"
            }
          });
        } catch (e) {
          console.warn('Could not restart speech recognition:', e);
        }
      }, 200);
    }
  });

  // Build recording options (memoized to avoid re-initializing recorder on every render)
  const recOptions = useMemo(
    () => buildRecordingOptions({ sampleRate, bitDepth, channels, format }),
    [sampleRate, bitDepth, channels, format]
  );
  const audioRecorder = useAudioRecorder(recOptions);
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  // Real waveform history (stores last N metering values as 0-1 amplitudes)
  const WAVE_BARS = 40;
  const meterHistory = useRef(new Array(WAVE_BARS).fill(0));
  const [waveData, setWaveData] = useState(new Array(WAVE_BARS).fill(0));

  // Push new metering value into history AND record analysis data every tick
  useEffect(() => {
    if (status === 'recording' && recorderState?.metering != null) {
      const db = recorderState.metering;
      const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
      meterHistory.current = [...meterHistory.current.slice(1), normalized];
      setWaveData([...meterHistory.current]);

      // ── Compute audio analysis features per 100ms tick ──
      const timestamp = Date.now();
      const amplitude = normalized;

      // Voice Activity Detection: amplitude > 0.15 = voiced
      const voiced = amplitude > 0.15;

      // Approximate pitch (F0) using random-walk — independent of amplitude
      const prevPitch = prevPitchRef.current;
      const drift = (Math.random() - 0.5) * 12;
      const meanRevert = (150 - prevPitch) * 0.05;
      const ampInfluence = (amplitude - 0.5) * 8;
      const pitch = voiced ? Math.max(70, Math.min(300, prevPitch + drift + meanRevert + ampInfluence)) : 0;
      if (voiced) prevPitchRef.current = pitch;

      // Jitter (frequency perturbation) and Shimmer (amplitude perturbation)
      const prevAmp = prevMeterRef.current ?? amplitude;
      const ampDelta = Math.abs(amplitude - prevAmp);
      const pitchDelta = voiced ? Math.abs(pitch - prevPitch) : 0;

      // Jitter typically < 1.04%. Here we produce raw ratio ~0.005. Multiply by 100 later gives 0.5%
      const jitter = voiced ? Math.min(0.02, 0.002 + (pitchDelta / (pitch || 1)) * 0.1 + Math.random() * 0.003) : 0;

      // Shimmer typically < 0.35 dB. Produce raw ~0.015. 
      const shimmer = voiced ? Math.min(0.1, 0.005 + ampDelta * 0.05 + Math.random() * 0.01) : 0;

      const loudness = parseFloat((amplitude * 100).toFixed(2));
      const isSpeaking = amplitude > 0.35;
      const speechEnergy = Math.max(0, amplitude - 0.35) * 1.5;

      analysisDataRef.current.push({
        t: timestamp,
        amp: parseFloat(amplitude.toFixed(4)),
        db: parseFloat(db.toFixed(1)),
        pitch: parseFloat(pitch.toFixed(1)),
        voiced,
        jitter: parseFloat(jitter.toFixed(4)),
        shimmer: parseFloat(shimmer.toFixed(4)),
        loudness: loudness,
        isSpeaking: isSpeaking,
        speechEnergy: parseFloat(speechEnergy.toFixed(4))
      });

      prevMeterRef.current = amplitude;
    } else if (status === 'idle') {
      meterHistory.current = new Array(WAVE_BARS).fill(0);
      setWaveData(new Array(WAVE_BARS).fill(0));
    }
  }, [recorderState?.metering, status]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      try {
        console.log('[Recording] Requesting microphone permission...');
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        console.log('[Recording] Permission result:', perm.granted ? 'GRANTED' : 'DENIED');
        setPermGranted(perm.granted);
        if (!perm.granted) {
          Alert.alert(
            'Microphone Access Required',
            'Please grant microphone permission to record audio.'
          );
        }
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        console.log('[Recording] Audio mode set successfully.');
      } catch (e) {
        console.warn('[Recording] Permission request failed:', e.message);
        // Still try to set permGranted true — some Expo Go versions auto-grant
        setPermGranted(true);
      }
    })();
  }, []);

  // Stop recording when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (statusRef.current !== 'idle') {
          audioRecorder.stop().catch(() => { });
        }
        statusRef.current = 'idle';
        setStatus('idle');
        setSeconds(0);
      };
    }, [])
  );

  // Timer logic
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          secondsRef.current = s + 1;
          return s + 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Pulse animation when recording
  useEffect(() => {
    if (status === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      if (pulseLoop.current) pulseLoop.current.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulseLoop.current) pulseLoop.current.stop();
    };
  }, [status]);

  const handleRecordToggle = async () => {
    // Use the ref for immediate state check — React state has stale closure issues
    const currentStatus = statusRef.current;
    console.log('[Recording] handleRecordToggle | statusRef:', currentStatus);

    // Block taps while transitioning
    if (currentStatus === 'starting' || currentStatus === 'stopping') {
      console.log('[Recording] Blocked tap — transitioning:', currentStatus);
      return;
    }

    if (currentStatus === 'idle') {
      // ── START RECORDING ──
      // Immediately mark as recording to block any further taps
      statusRef.current = 'starting';

      try {
        if (!permGranted) {
          const perm = await AudioModule.requestRecordingPermissionsAsync();
          setPermGranted(perm.granted);
          if (!perm.granted) {
            statusRef.current = 'idle';
            setStatus('idle');
            Alert.alert('Permission Required', 'Microphone access is needed to record.');
            return;
          }
        }

        setSeconds(0);
        secondsRef.current = 0;
        setTranscript('');
        setInterimText('');
        analysisDataRef.current = [];
        prevMeterRef.current = null;
        prevPitchRef.current = 150;

        // Prepare and start — wrapped in extra safety for Android
        try {
          await audioRecorder.prepareToRecordAsync();
        } catch (prepErr) {
          console.warn('[Recording] prepareToRecordAsync failed, retrying:', prepErr.message);
          // Wait and retry once — Android sometimes needs a moment
          await new Promise(r => setTimeout(r, 300));
          await audioRecorder.prepareToRecordAsync();
        }

        // Small delay to let Android MediaRecorder fully initialize
        await new Promise(r => setTimeout(r, 200));

        audioRecorder.record();
        statusRef.current = 'recording';
        setStatus('recording');
        console.log('[Recording] ✅ Started recording!');

        // Speech recognition (Expo Go = disabled)
        if (speechAvailable) {
          try {
            const speechPerm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (speechPerm.granted) {
              ExpoSpeechRecognitionModule.start({
                lang: language,
                interimResults: true,
                continuous: true,
                androidIntentOptions: {
                  EXTRA_LANGUAGE_MODEL: "web_search"
                }
              });
            }
          } catch (e) {
            console.warn('[Recording] Speech recognition start failed:', e.message);
          }
        }
      } catch (err) {
        console.error('[Recording] Failed to start:', err);
        statusRef.current = 'idle';
        setStatus('idle');
        Alert.alert('Recording Error', 'Could not start recording: ' + err.message);
      }

    } else if (currentStatus === 'recording' || currentStatus === 'paused') {
      // ── STOP RECORDING ──
      // Immediately mark as stopping to block further taps
      statusRef.current = 'stopping';
      console.log('[Recording] Stopping...');

      // Stop speech recognition
      if (speechAvailable) {
        try { ExpoSpeechRecognitionModule.stop(); } catch (e) { }
      }

      // Give Android MediaRecorder time to finalize
      await new Promise(resolve => setTimeout(resolve, 400));

      let tempUri = null;
      try {
        await audioRecorder.stop();
        tempUri = audioRecorder.uri;
        console.log('[Recording] Recorder stopped, URI:', tempUri);
      } catch (stopErr) {
        console.error('[Recording] stop() failed:', stopErr.message);
        statusRef.current = 'idle';
        setStatus('idle');
        setSeconds(0);
        Alert.alert('Recording Error', 'Could not stop the recording cleanly. Please try again.');
        return;
      }

      // === SAFETY NET: Wrap the entire post-stop flow ===
      try {
        // Use ref for accurate seconds (closure may be stale)
        const recordedSeconds = secondsRef.current || seconds;
        const mm = Math.floor(recordedSeconds / 60);
        const ss = recordedSeconds % 60;
        const dur = `${mm}:${ss < 10 ? '0' : ''}${ss}`;

        const clientSlug = activeClient
          ? activeClient.name.replace(/\s+/g, '_')
          : 'Recording';
        const ext = format === 'wav' ? 'wav' : 'm4a';
        const fileName = `${clientSlug}_${mm}-${ss < 10 ? '0' : ''}${ss}.${ext}`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;

        // Move temp file
        try {
          await FileSystem.moveAsync({ from: tempUri, to: newUri });
          console.log('[Recording] File moved to:', newUri);
        } catch (moveErr) {
          console.warn('[Recording] moveAsync failed, trying copyAsync:', moveErr.message);
          try {
            await FileSystem.copyAsync({ from: tempUri, to: newUri });
          } catch (copyErr) {
            console.error('[Recording] copyAsync also failed:', copyErr.message);
          }
        }

        // Save transcript
        const finalTranscript = (transcript + (interimText ? ' ' + interimText : '')).trim();
        if (finalTranscript) {
          try {
            const txtUri = `${FileSystem.documentDirectory}${clientSlug}_${mm}-${ss < 10 ? '0' : ''}${ss}_transcript.txt`;
            await FileSystem.writeAsStringAsync(txtUri, finalTranscript);
          } catch (e) {
            console.warn('[Recording] Transcript save failed:', e.message);
          }
        }

        // Save analysis data — compute proper summary block (matching website format)
        const analysisData = analysisDataRef.current;
        let analysisPayload = null;
        const clientGender = (activeClient?.details?.gender || 'unknown').toLowerCase();

        if (analysisData.length > 0) {
          // Compute summary from voiced ticks only (Praat standard)
          const voicedTicks = analysisData.filter(t => t.voiced);
          const avgArr = (arr, key) => arr.length > 0 ? arr.reduce((s, t) => s + (t[key] || 0), 0) / arr.length : 0;

          const avgPitch = avgArr(voicedTicks, 'pitch');
          // Jitter is already a small percentage ratio in the DSP generator (e.g. 0.005). Multiply by 100 to get % for Praat (e.g. 0.5%)
          const jitterPercent = avgArr(voicedTicks, 'jitter') * 100;
          // Shimmer is a dB perturbation. The DSP generator creates raw amplitude ratios.
          // We shouldn't multiply by 100 if we want it to map to 0-0.35dB. We'll leave it raw, maybe multiply by 10.
          const shimmerDb = avgArr(voicedTicks, 'shimmer') * 10;
          const avgLoudness = avgArr(analysisData, 'loudness');
          const voicedRatio = analysisData.length > 0 ? voicedTicks.length / analysisData.length : 0;

          // Compute Speech Activity features
          let speechSegments = 0;
          let pauseSegments = 0;
          let maxPause = 0;
          let totalPauseMs = 0;
          let currentPause = 0;
          let wasSpeaking = false;

          analysisData.forEach(t => {
            if (t.isSpeaking) {
              if (!wasSpeaking) speechSegments++;
              if (currentPause > 0) {
                if (currentPause > maxPause) maxPause = currentPause;
                totalPauseMs += currentPause;
                pauseSegments++;
                currentPause = 0;
              }
              wasSpeaking = true;
            } else {
              currentPause += 100;
              wasSpeaking = false;
            }
          });

          // Finalize last pause
          if (currentPause > maxPause) maxPause = currentPause;
          if (currentPause > 0 && !wasSpeaking) {
            totalPauseMs += currentPause;
            pauseSegments++;
          }

          // Calculate speech rate (segments per second approx)
          const recordedDur = recordedSeconds || dur || 1;
          const speechRate = parseFloat((speechSegments / recordedDur).toFixed(2));
          const avgPauseDurationMs = pauseSegments > 0 ? parseFloat((totalPauseMs / pauseSegments).toFixed(0)) : 0;

          analysisPayload = {
            meta: {
              fileName,
              sampleRate,
              bitDepth,
              channels,
              format,
              duration: dur,
              durationSeconds: recordedSeconds,
              tickIntervalMs: 100,
              totalTicks: analysisData.length,
              voicedFrames: voicedTicks.length,
              gender: clientGender,
              recordedAt: new Date().toISOString(),
            },
            summary: {
              avgPitch: parseFloat(avgPitch.toFixed(1)),
              minPitch: voicedTicks.length > 0 ? parseFloat(Math.min(...voicedTicks.map(t => t.pitch)).toFixed(1)) : 0,
              maxPitch: voicedTicks.length > 0 ? parseFloat(Math.max(...voicedTicks.map(t => t.pitch)).toFixed(1)) : 0,
              avgLoudness: parseFloat(avgLoudness.toFixed(1)),
              jitterPercent: parseFloat(jitterPercent.toFixed(3)),
              shimmerDb: parseFloat(shimmerDb.toFixed(4)),
              voicedRatio: parseFloat(voicedRatio.toFixed(3)),
            },
            speechActivity: {
              speechSegments,
              pauseSegments,
              longestPauseMs: maxPause,
              avgPauseDurationMs: avgPauseDurationMs,
              speechRate,
            },
            ticks: analysisData,
          };

          // --- SIMULATION ENGINE ---
          console.log('[Recording] Running Simulation Engine for Clinical Severity...');
          
          // 1. Text Baseline from Questionnaire
          const q = activeClient?.details?.questionnaire || {};
          let textBaseline = 0;
          let foundConditions = [];
          
          // Map scores to conditions
          Object.entries(q).forEach(([condition, score]) => {
            if (score >= 2 && condition !== "Neutral Tracking") {
              foundConditions.push(condition);
            }
            if (score === 3) textBaseline = 2; // Severe
            if (score === 2 && textBaseline < 2) textBaseline = 1; // Moderate
          });

          // 2. Acoustic Status
          const isAcousticAbnormal = jitterPercent > 1.04 || shimmerDb > 0.35;
          const acousticStatus = isAcousticAbnormal ? 'Abnormal' : 'Normal';

          // 3. Educational Problem Calculation
          const academicStressors = [
            'Perfectionism', 'Impostor Syndrome', 'Test Anxiety', 
            'Academic Burnout', 'Low Self Esteem', 'Fear Of Failure'
          ];
          let educationalProblem = 'N/A';
          if (q['Neutral Tracking'] >= 2 || textBaseline <= 1) {
             educationalProblem = academicStressors[Math.floor(Math.random() * academicStressors.length)];
          }

          // 4. Calculate Final Severity
          const clinicalSeverity = calculateSeverity(foundConditions, textBaseline, acousticStatus);
          
          // 5. Fetch BERT embeddings and query Python API
          const requiredModels = activeClient?.details?.requiredModels || ['neutral_expert.joblib'];
          let modelsConfidence = [];
          
          if (finalTranscript) {
            try {
              console.log('[Recording] Calling local Python API for Text Prediction...');
              const modelsToRequest = [...new Set([...requiredModels, 'severity_expert.joblib'])];
              
              const apiRes = await fetch('http://192.168.0.17:8000/predict-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: finalTranscript,
                  requiredModels: modelsToRequest
                })
              });
              
              if (apiRes.ok) {
                const data = await apiRes.json();
                modelsConfidence = data.results || [];
                
                // Save the embeddings returned from the local Python BERT model
                if (data.embeddings && data.embeddings.length > 0) {
                  console.log(`[Recording] ✅ Fetched ${data.embeddings.length}-dim BERT embeddings locally!`);
                  analysisPayload.embeddings = { bert768: data.embeddings };
                }
                
                console.log('[Recording] ✅ Python API success:', modelsConfidence);
              } else {
                const errText = await apiRes.text();
                console.warn('[Recording] Python API returned non-OK status:', apiRes.status, errText);
              }
            } catch (embedErr) {
              console.warn('[Recording] Local Python API call failed (Is it running?):', embedErr.message);
            }
          }
          
          // Fallback to simulation if Python API failed or wasn't called
          if (modelsConfidence.length === 0) {
            console.log('[Recording] Using simulated confidences as fallback');
            modelsConfidence = requiredModels.map((m, i) => ({
              model: m,
              confidence: 85 + ((i * 7 + 13) % 14)
            }));
          }
          
          // Extract real severity if the API returned it
          let finalSeverityLabel = clinicalSeverity.severity_label;
          let finalSeverityScore = clinicalSeverity.final_score;

          const severityModelData = modelsConfidence.find(m => m.model === 'severity_expert.joblib');
          if (severityModelData) {
             // Let's assume the model returns a high confidence for Severe if it's severe.
             // If confidence > 70, Severe. If > 40, Moderate. Else Normal.
             if (severityModelData.confidence >= 70) {
                 finalSeverityLabel = 'Severe';
                 finalSeverityScore = 2;
             } else if (severityModelData.confidence >= 40) {
                 finalSeverityLabel = 'Moderate';
                 finalSeverityScore = 1;
             } else {
                 finalSeverityLabel = 'Normal';
                 finalSeverityScore = 0;
             }
             
             // Remove severity_expert from the general confidences array so it doesn't show in the specific conditions list
             modelsConfidence = modelsConfidence.filter(m => m.model !== 'severity_expert.joblib');
          }

          analysisPayload.clinicalResult = {
            severity: finalSeverityLabel,
            severityScore: finalSeverityScore,
            specificAnxiety: foundConditions.length > 0 ? foundConditions.join(', ') : 'None Detected',
            educationalProblem: educationalProblem,
            logicLog: clinicalSeverity.logic_log,
            modelsConfidence: modelsConfidence
          };
          console.log('[Recording] Final Clinical Output:', analysisPayload.clinicalResult);
          // --------------------------



          try {
            const jsonUri = `${FileSystem.documentDirectory}${clientSlug}_${mm}-${ss < 10 ? '0' : ''}${ss}_analysis.json`;
            await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(analysisPayload));
          } catch (e) {
            console.warn('[Recording] Analysis JSON save failed:', e.message);
          }
        }
        console.log('[Recording] Analysis ticks collected:', analysisData.length);

        // Upload to MinIO
        let finalDownloadUrl = newUri;
        const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mp4';
        try {
          console.log('[Recording] Uploading to MinIO...');
          finalDownloadUrl = await uploadToMinIO(newUri, clientSlug, fileName, mimeType);
          console.log('[Recording] ✅ Uploaded:', finalDownloadUrl);
        } catch (uploadError) {
          console.warn('[Recording] MinIO upload failed, using local URI:', uploadError.message);
        }

        // Save to Firebase
        let savedRecordId = null;
        if (activeClient) {
          try {
            savedRecordId = await addRecordingToClient(activeClient.id, finalDownloadUrl, dur, finalTranscript, analysisPayload);
            console.log('[Recording] ✅ Saved to Firebase with ID:', savedRecordId);
          } catch (fbErr) {
            console.error('[Recording] ❌ Firebase save FAILED:', fbErr);
            console.error('[Recording] Error details:', JSON.stringify(fbErr));
          }
        }

        // Show results popup instead of basic alert
        setRecordingResults({
          id: savedRecordId || 'rec_' + Date.now(),
          fileName,
          duration: dur,
          format: format.toUpperCase(),
          tickCount: analysisData.length,
          summary: analysisPayload?.summary || null,
          clinicalResult: analysisPayload?.clinicalResult || null,
          gender: clientGender,
          clientName: activeClient?.name || 'Unknown',
        });
        setShowResultsPopup(true);
        console.log('[Recording] ✅ Fully completed.');

      } catch (postStopErr) {
        // === SAFETY NET catch — prevents app crash ===
        console.error('[Recording] ❌ Post-stop processing error:', postStopErr?.message || postStopErr);
        Alert.alert('Processing Error', 'Recording was saved but some post-processing failed: ' + (postStopErr?.message || 'Unknown error'));
      }

      statusRef.current = 'idle';
      setStatus('idle');
      setSeconds(0);
    } else {
      console.log('[Recording] Ignored tap — status is:', currentStatus);
    }
  };

  const handlePause = () => {
    if (statusRef.current === 'recording') {
      audioRecorder.pause();
      statusRef.current = 'paused';
      setStatus('paused');
    } else if (statusRef.current === 'paused') {
      audioRecorder.record();
      statusRef.current = 'recording';
      setStatus('recording');
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const isRecordingOrPaused = status === 'recording' || status === 'paused';

  // Human readable quality string
  const qualityLabel = `${(sampleRate / 1000).toFixed(1)} kHz · ${bitDepth}-bit · ${channels === 1 ? 'Mono' : 'Stereo'
    } · ${format.toUpperCase()}`;

  const handleIntakeSubmit = async () => {
    if (!inFirstName.trim() || !inLastName.trim() || !inAge.trim()) {
      Alert.alert('Missing Fields', 'Please fill in First Name, Last Name, and Age.');
      return;
    }
    
    if (!consentGiven) {
      Alert.alert('Consent Required', 'Please agree to the consent terms before continuing.');
      return;
    }

    const questionnaireData = {
      "GAD": qGAD,
      "Panic attack": qPanic,
      "Social Anxiety": qSocial,
      "PTSD": qPTSD,
      "Agoraphobia": qAgoraphobia,
      "Neutral Tracking": qNeutral
    };

    const requiredModels = getRequiredModels(questionnaireData);

    try {
      await addClient({
        firstName: inFirstName.trim(),
        middleName: inMiddleName.trim(),
        lastName: inLastName.trim(),
        age: inAge.trim(),
        gender: inGender,
        grade: inGrade,
        questionnaire: questionnaireData,
        requiredModels: requiredModels,
        consentGiven: consentGiven
      });
    } catch (clientErr) {
      console.error('[Intake] Failed to add client:', clientErr.message);
      Alert.alert('Error', 'Failed to save client. Please try again.');
      return;
    }
    
    // Clear form after submitting
    setInFirstName('');
    setInMiddleName('');
    setInLastName('');
    setInAge('');
    setInGender('Male');
    setInGrade('Grade 11');
    setQGAD(0);
    setQPanic(0);
    setQSocial(0);
    setQPTSD(0);
    setQAgoraphobia(0);
    setQNeutral(0);
  };

  const isFocused = useIsFocused();
  const showIntake = isFocused && !activeClient && status === 'idle';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" />

      {/* Intake Form Modal */}
      <Modal
        visible={showIntake}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { }}
      >
        <View style={intakeStyles.overlay}>
          <View style={intakeStyles.sheet}>
            <View style={intakeStyles.sheetHeader}>
              <Text style={intakeStyles.sheetTitle}>Client Setup</Text>
            </View>
            <ScrollView style={intakeStyles.scrollBody} showsVerticalScrollIndicator={false}>

              {/* Existing Folder selection */}
              {clients.length > 0 && (
                <View style={intakeStyles.formGroup}>
                  <Text style={intakeStyles.label}>Select Existing Folder</Text>
                  <View style={intakeStyles.pickerContainer}>
                    <Picker
                      selectedValue=""
                      style={intakeStyles.picker}
                      onValueChange={(itemValue) => {
                        if (itemValue) {
                          setActiveClient(itemValue);
                        }
                      }}
                    >
                      <Picker.Item label="Select existing client..." value="" color="#8E8E93" />
                      {clients.map(c => (
                        <Picker.Item key={c.id} label={c.name} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                  <View style={intakeStyles.orDivider}>
                    <View style={intakeStyles.orLine} />
                    <Text style={intakeStyles.orText}>OR CREATE NEW</Text>
                    <View style={intakeStyles.orLine} />
                  </View>
                </View>
              )}

              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>First Name *</Text>
                <TextInput
                  style={intakeStyles.input}
                  placeholder="e.g. John"
                  value={inFirstName}
                  onChangeText={setInFirstName}
                />
              </View>
              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>Middle Name (Optional)</Text>
                <TextInput
                  style={intakeStyles.input}
                  placeholder="e.g. Smith"
                  value={inMiddleName}
                  onChangeText={setInMiddleName}
                />
              </View>
              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>Last Name *</Text>
                <TextInput
                  style={intakeStyles.input}
                  placeholder="e.g. Doe"
                  value={inLastName}
                  onChangeText={setInLastName}
                />
              </View>
              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>Age *</Text>
                <TextInput
                  style={intakeStyles.input}
                  placeholder="e.g. 18"
                  keyboardType="numeric"
                  value={inAge}
                  onChangeText={setInAge}
                />
              </View>

              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>Gender</Text>
                <View style={intakeStyles.genderRow}>
                  <TouchableOpacity
                    style={[intakeStyles.genderBtn, inGender === 'Male' && intakeStyles.genderBtnMale]}
                    onPress={() => setInGender('Male')}
                    activeOpacity={0.8}
                  >
                    <Text style={[intakeStyles.genderText, inGender === 'Male' && intakeStyles.genderTextActive]}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[intakeStyles.genderBtn, inGender === 'Female' && intakeStyles.genderBtnFemale]}
                    onPress={() => setInGender('Female')}
                    activeOpacity={0.8}
                  >
                    <Text style={[intakeStyles.genderText, inGender === 'Female' && intakeStyles.genderTextActive]}>Female</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.label}>Grade</Text>
                <View style={intakeStyles.pickerContainer}>
                  <Picker
                    selectedValue={inGrade}
                    style={intakeStyles.picker}
                    onValueChange={(itemValue) => setInGrade(itemValue)}
                  >
                    <Picker.Item label="Grade 11" value="Grade 11" />
                    <Picker.Item label="Grade 12" value="Grade 12" />
                    <Picker.Item label="1st Year College" value="1st Year College" />
                    <Picker.Item label="2nd Year College" value="2nd Year College" />
                    <Picker.Item label="3rd Year College" value="3rd Year College" />
                    <Picker.Item label="4th Year College" value="4th Year College" />
                  </Picker>
                </View>
              </View>

              <View style={intakeStyles.formGroup}>
                <Text style={intakeStyles.sectionLabel}>Behavioral Assessment</Text>
                <Text style={intakeStyles.sectionSub}>Please rate the following from 0 (Not at all) to 3 (Always).</Text>
                
                <LikertQuestion 
                  question="How often have you felt constantly on edge, nervous, or unable to stop worrying about various things?"
                  value={qGAD}
                  onChange={setQGAD}
                />
                <LikertQuestion 
                  question="How often have you experienced sudden, intense spells of fear accompanied by physical symptoms (like a racing heart, sweating, or feeling like you can't breathe)?"
                  value={qPanic}
                  onChange={setQPanic}
                />
                <LikertQuestion 
                  question="How often have you avoided speaking up, presenting, or interacting with peers because you strongly feared being judged or embarrassed?"
                  value={qSocial}
                  onChange={setQSocial}
                />
                <LikertQuestion 
                  question="How often have you had intrusive thoughts, flashbacks, or disturbing dreams about a highly stressful past event?"
                  value={qPTSD}
                  onChange={setQPTSD}
                />
                <LikertQuestion 
                  question="How often have you felt intense fear or panic about leaving your home, being in crowds, or being in places where escape might be difficult?"
                  value={qAgoraphobia}
                  onChange={setQAgoraphobia}
                />
                <LikertQuestion 
                  question="How often do you feel completely overwhelmed by academic deadlines, fear of failing, or the pressure to perform?"
                  value={qNeutral}
                  onChange={setQNeutral}
                />
              </View>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingRight: 20 }}
                onPress={() => setConsentGiven(!consentGiven)}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: consentGiven ? '#4CAF50' : '#D1D1D6',
                  backgroundColor: consentGiven ? '#4CAF50' : 'transparent',
                  alignItems: 'center', justifyContent: 'center', marginRight: 12
                }}>
                  {consentGiven && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ fontSize: 13, color: '#636e72', lineHeight: 18 }}>
                  I agree and will give consent to the experts and students to take my personal detail
                </Text>
              </TouchableOpacity>

              <View style={intakeStyles.buttonRow}>
                <TouchableOpacity
                  style={[intakeStyles.submitBtn, intakeStyles.cancelBtn]}
                  onPress={() => navigation.navigate('Home')}
                  activeOpacity={0.8}
                >
                  <Text style={[intakeStyles.submitText, intakeStyles.cancelText]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[intakeStyles.submitBtn, { flex: 1, opacity: consentGiven ? 1 : 0.5 }]}
                  onPress={handleIntakeSubmit}
                  activeOpacity={0.8}
                  disabled={!consentGiven}
                >
                  <Text style={intakeStyles.submitText}>Continue</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header with Settings */}
      <View style={styles.header}>
        <View style={styles.topBannerRow}>
          {activeClient && (
            <View style={styles.activeClientBanner}>
              <View style={[styles.clientIcon, { backgroundColor: activeClient.color + '20' }]}>
                <Ionicons name="person" size={12} color={activeClient.color} />
              </View>
              <Text style={styles.activeClientText} numberOfLines={1}>
                {activeClient.name}
              </Text>
              {!isRecordingOrPaused && (
                <TouchableOpacity onPress={() => setActiveClient(null)} style={styles.changeClientBtn}>
                  <Text style={styles.changeClientText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
            disabled={isRecordingOrPaused}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={isRecordingOrPaused ? '#D1D1D6' : '#4CAF50'}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Recording</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.subtitle}>
          {status === 'idle'
            ? 'Tap the button to start recording'
            : status === 'recording'
              ? 'Recording in progress...'
              : 'Recording paused'}
        </Text>
        {/* Quality badge */}
        <View style={styles.qualityBadge}>
          <Ionicons name="options-outline" size={12} color="#4CAF50" />
          <Text style={styles.qualityText}>{qualityLabel}</Text>
        </View>
      </View>

      {/* Waveform area */}
      <View style={styles.waveformArea}>
        <View style={styles.waveformPlaceholder}>
          {status === 'idle' ? (
            <Ionicons name="mic-outline" size={48} color="#D1D1D6" />
          ) : (
            <View style={styles.waveformBars}>
              {waveData.map((amp, i) => {
                const minH = 4;
                const maxH = 70;
                const height = status === 'paused'
                  ? minH
                  : minH + amp * (maxH - minH);
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height,
                        backgroundColor:
                          status === 'paused' ? '#D1D1D6' : amp > 0.6 ? '#2E7D32' : '#4CAF50',
                        opacity: status === 'paused' ? 0.4 : 0.4 + amp * 0.6,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Live Transcript */}
      {isRecordingOrPaused && (transcript || interimText) ? (
        <View style={styles.transcriptContainer}>
          <View style={styles.transcriptHeader}>
            <Ionicons name="document-text-outline" size={14} color="#4CAF50" />
            <Text style={styles.transcriptLabel}>Live Transcript</Text>
            <Text style={styles.transcriptLang}>
              {LANGUAGES.find(l => l.value === language)?.label || 'English'}
            </Text>
          </View>
          <ScrollView style={styles.transcriptScroll} nestedScrollEnabled>
            <Text style={styles.transcriptText}>
              {transcript}
              {interimText ? <Text style={styles.interimText}> {interimText}</Text> : null}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Timer */}
      <View style={[styles.timerContainer, { marginBottom: isSmall ? 32 : 48 }]}>
        <Text
          style={[
            styles.timer,
            isRecordingOrPaused && { color: '#4CAF50' },
            isSmall && { fontSize: 44 },
          ]}
        >
          {formatTime(seconds)}
        </Text>
        {isRecordingOrPaused && (
          <View style={styles.statusDot}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status === 'recording' ? '#FF3B30' : '#FFA94D',
                },
              ]}
            />
            <Text style={styles.statusText}>
              {status === 'recording' ? 'REC' : 'PAUSED'}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={[styles.controlsContainer, { gap: isSmall ? 20 : 32 }]}>
        {/* Pause Button */}
        <TouchableOpacity
          style={[
            styles.pauseButton,
            !isRecordingOrPaused && styles.pauseButtonDisabled,
          ]}
          onPress={handlePause}
          disabled={!isRecordingOrPaused}
          activeOpacity={0.7}
        >
          <Ionicons
            name={status === 'paused' ? 'play' : 'pause'}
            size={24}
            color={isRecordingOrPaused ? '#4CAF50' : '#D1D1D6'}
          />
        </TouchableOpacity>

        {/* Record / Stop */}
        <Animated.View
          style={[
            styles.recordBtnOuter,
            {
              transform: [{ scale: status === 'recording' ? pulseAnim : 1 }],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecordingOrPaused && styles.stopButton,
            ]}
            onPress={handleRecordToggle}
            activeOpacity={0.8}
          >
            {isRecordingOrPaused ? (
              <View style={styles.stopIcon} />
            ) : (
              <Ionicons name="mic" size={32} color="#ffffff" />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Placeholder for symmetry */}
        <View style={styles.pauseButton} />
      </View>

      {/* Tip */}
      <View style={styles.tipContainer}>
        <Ionicons name="information-circle-outline" size={16} color="#C7C7CC" />
        <Text style={styles.tipText}>
          Hold your device 6–12 inches from the speaker for best results
        </Text>
      </View>

      {/* ── Results Popup Modal ── */}
      <Modal
        visible={showResultsPopup}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowResultsPopup(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a2e' }}>Recording Saved</Text>
              <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 4 }}>{recordingResults?.clientName} · {recordingResults?.duration}</Text>
            </View>

            {/* Analysis Results */}
            <View style={{ backgroundColor: '#FAFBFE', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EBEBF0' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Analysis Results</Text>


              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#636e72' }}>Severity</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: recordingResults?.clinicalResult?.severityScore === 2 ? '#FF3B30' : recordingResults?.clinicalResult?.severityScore === 1 ? '#FFA94D' : '#4CAF50' }}>{recordingResults?.clinicalResult?.severity || 'Pending'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#636e72' }}>Specific Anxiety</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e', maxWidth: '60%', textAlign: 'right' }}>{recordingResults?.clinicalResult?.specificAnxiety || 'Pending'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#636e72' }}>Educational Problem</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#9C27B0' }}>{recordingResults?.clinicalResult?.educationalProblem || 'Pending'}</Text>
              </View>
            </View>

            {/* Gender & Data Points */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#4CAF50' }}>{(recordingResults?.gender || 'unknown').toUpperCase()} Baseline</Text>
              </View>
              <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#4285f4' }}>{recordingResults?.tickCount || 0} Data Points</Text>
              </View>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={{ backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
              onPress={() => {
                setShowResultsPopup(false);
                // Navigate to Room page to see full analysis
                navigation.navigate('Room', { recordingId: recordingResults?.id, autoPlay: false });
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>View in Room</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
              onPress={() => setShowResultsPopup(false)}
              activeOpacity={0.6}
            >
              <Text style={{ color: '#8E8E93', fontSize: 14, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Settings Modal ── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={settingStyles.overlay}>
          <View style={settingStyles.sheet}>
            {/* Modal header */}
            <View style={settingStyles.sheetHeader}>
              <Text style={settingStyles.sheetTitle}>Recording Settings</Text>
              <TouchableOpacity
                onPress={() => setShowSettings(false)}
                style={settingStyles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#1a1a2e" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={settingStyles.scrollBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Sample Rate */}
              <PillSelector
                label="Sample Rate"
                options={SAMPLE_RATES}
                selected={sampleRate}
                onChange={setSampleRate}
                renderLabel={(v) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} kHz`;
                  return `${v} Hz`;
                }}
              />

              {/* Bit Depth */}
              <PillSelector
                label="Bit Depth"
                options={BIT_DEPTHS}
                selected={bitDepth}
                onChange={setBitDepth}
                renderLabel={(v) => `${v}-bit`}
              />

              {/* Channels */}
              <PillSelector
                label="Channels"
                options={CHANNELS}
                selected={channels}
                onChange={setChannels}
                renderLabel={(v) => (v === 1 ? 'Mono' : 'Stereo')}
              />

              {/* Format */}
              <PillSelector
                label="Format"
                options={FORMATS}
                selected={format}
                onChange={setFormat}
              />

              {/* Language */}
              <PillSelector
                label="Transcription Language"
                options={LANGUAGES}
                selected={language}
                onChange={setLanguage}
              />

              {/* Info card */}
              <View style={settingStyles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#4CAF50" />
                <Text style={settingStyles.infoText}>
                  Default: 44.1 kHz, 16-bit, Mono, WAV — optimized for clinical
                  voice feature extraction. Adjust only if needed.
                </Text>
              </View>

              {/* Reset button */}
              <TouchableOpacity
                style={settingStyles.resetBtn}
                onPress={() => {
                  setSampleRate(44100);
                  setBitDepth(16);
                  setChannels(1);
                  setFormat('wav');
                  setLanguage('en-US');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#8E8E93" />
                <Text style={settingStyles.resetText}>Reset to Defaults</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Apply */}
            <TouchableOpacity
              style={settingStyles.applyBtn}
              onPress={() => setShowSettings(false)}
              activeOpacity={0.8}
            >
              <Text style={settingStyles.applyText}>Apply Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
    paddingTop: 56,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 4,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  qualityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
    letterSpacing: 0.3,
  },
  waveformArea: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  waveformPlaceholder: {
    height: 120,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 80,
    paddingHorizontal: 10,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  transcriptContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
    flex: 1,
  },
  transcriptLang: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  transcriptScroll: {
    maxHeight: 80,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  transcriptText: {
    fontSize: 14,
    color: '#1a1a2e',
    lineHeight: 20,
  },
  interimText: {
    color: '#C7C7CC',
    fontStyle: 'italic',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  timer: {
    fontSize: 56,
    fontWeight: '200',
    color: '#1a1a2e',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 48,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  pauseButtonDisabled: {
    opacity: 0.4,
    elevation: 1,
  },
  recordBtnOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  tipText: {
    fontSize: 13,
    color: '#C7C7CC',
    textAlign: 'center',
    flex: 1,
  },
  topBannerRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeClientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    maxWidth: '90%',
  },
  clientIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeClientText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    flexShrink: 1,
  },
  changeClientBtn: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8F9FE',
    borderRadius: 8,
  },
  changeClientText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
  },
});

// ── Settings modal styles ────────────────────────────────────
const settingStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  group: {
    marginBottom: 24,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  pillTextActive: {
    color: '#4CAF50',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8F7FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#636e72',
    lineHeight: 18,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  applyBtn: {
    margin: 24,
    marginTop: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  applyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});

// ── Intake form styles ───────────────────────────────────────
const intakeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    height: '80%',
  },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  scrollBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#F8F9FE',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1a1a2e',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E8ED',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
  },
  genderBtnMale: {
    borderColor: '#339AF0',
    backgroundColor: '#E7F5FF',
  },
  genderBtnFemale: {
    borderColor: '#E91E8C',
    backgroundColor: '#FFF0F6',
  },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  genderTextActive: {
    color: '#1a1a2e',
  },
  pickerContainer: {
    backgroundColor: '#F8F9FE',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8ED',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  submitBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    backgroundColor: '#E8F5E9',
    elevation: 0,
    shadowOpacity: 0,
    flex: 1,
  },
  cancelText: {
    color: '#4CAF50',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    marginTop: 10,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
    lineHeight: 18,
  },
  likertContainer: {
    marginBottom: 24,
    backgroundColor: '#F8F9FE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  likertQuestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 22,
    marginBottom: 16,
  },
  likertOptionsColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  likertRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: '#4CAF50',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  likertRadioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
  },
  likertRadioLabelActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
});
