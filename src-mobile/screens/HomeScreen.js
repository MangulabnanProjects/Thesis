import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientContext } from '../context/ClientContext';

const INFO_SECTIONS = [
  {
    title: 'Severity Classification',
    icon: 'shield-checkmark',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    description: 'Our system classifies psychological stress severity into three distinct levels based on text and acoustic biomarkers.',
    items: [
      'Normal: A stable state with baseline stress that does not interfere with daily functioning.',
      'Moderate: Noticeable stress symptoms that begin to affect daily focus and mood.',
      'Severe: Intense symptoms that significantly impair daily life and cognitive function.'
    ],
  },
  {
    title: 'Psychological Problems',
    icon: 'brain',
    color: '#FF6B6B',
    bgColor: '#FFF0F0',
    description: 'We detect patterns indicative of core clinical anxiety disorders and traumatic stress indicators.',
    items: [
      'Social Anxiety: Intense fear of being judged, leading to avoidance of social situations.',
      'PTSD: Triggered by terrifying events, characterized by flashbacks and severe anxiety.',
      'Panic Attack: Sudden episodes of intense fear accompanied by physical symptoms.',
      'GAD: Excessive, uncontrollable worry about everyday issues.',
      'Agoraphobia: Fear of being in situations where escape might be difficult.'
    ],
  },
  {
    title: 'Educational Problems',
    icon: 'school',
    color: '#FFA94D',
    bgColor: '#FFF8F0',
    description: 'Academic environments introduce unique stressors. Our neutral baseline tracking looks for signs of these educational challenges.',
    items: [
      'Perfectionism & Impostor Syndrome',
      'Test Anxiety & Academic Burnout',
      'Low Self Esteem & Lack Of Academic Support',
      'Fear Of Failure & Poor Time Management',
      'Pressure Of Surroundings',
      'Performance anxiety & Specific phobia'
    ],
  },
];

const TERMS = [
  {
    term: 'Acoustic Vitals (Biomarkers)',
    definition: 'Measurable vocal characteristics, such as Pitch, Jitter, and Shimmer, that act as physiological lie detectors revealing physical stress.',
  },
  {
    term: 'Likert Scale Intake',
    definition: 'A psychometric assessment used during client setup to quantify the frequency of specific anxiety or trauma symptoms (0-3 scale).',
  },
  {
    term: 'Severity Router',
    definition: 'An intelligent filtration system that determines which specific AI models to load based on clinical urgency and client history.',
  },
  {
    term: 'Baseline Severity',
    definition: 'The initial psychological risk level calculated purely from textual symptom tracking before acoustic parameters are applied.',
  },
];

export default function HomeScreen() {
  const { width, fontScale } = useWindowDimensions();
  const isSmall = width < 360;
  const pad = isSmall ? 14 : 20;

  const { clients } = useClientContext();

  // Compute real stats from database
  const stats = useMemo(() => {
    const activeClients = clients.filter(c => !c.archivedAt);
    const allRecordings = activeClients.flatMap(c => (c.recordings || []).filter(r => !r.archivedAt));
    const analyzedRecordings = allRecordings.filter(r => r.analysisData != null);

    return {
      recordings: allRecordings.length,
      clients: activeClients.length,
      analyzed: analyzedRecordings.length,
    };
  }, [clients]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Clinical Voice</Text>
          <Text style={styles.subtitle}>
            Voice-based emotional & anxiety analysis
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="mic" size={20} color="#4CAF50" />
            <Text style={styles.statNumber}>{stats.recordings}</Text>
            <Text style={styles.statLabel}>Recordings</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFF0F0' }]}>
            <Ionicons name="people" size={20} color="#FF6B6B" />
            <Text style={styles.statNumber}>{stats.clients}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FFF4' }]}>
            <Ionicons name="analytics" size={20} color="#51CF66" />
            <Text style={styles.statNumber}>{stats.analyzed}</Text>
            <Text style={styles.statLabel}>Analyzed</Text>
          </View>
        </View>

        {/* Info Sections */}
        {INFO_SECTIONS.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIconWrap,
                  { backgroundColor: section.bgColor },
                ]}
              >
                <Ionicons name={section.icon} size={22} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionDescription}>{section.description}</Text>
            <View style={styles.tagsRow}>
              {section.items.map((item, i) => (
                <View
                  key={i}
                  style={[styles.tag, { backgroundColor: section.bgColor }]}
                >
                  <Text style={[styles.tagText, { color: section.color }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Terms & Definitions */}
        <View style={styles.termsCard}>
          <Text style={styles.termsTitle}>Key Terms</Text>
          {TERMS.map((item, index) => (
            <View key={index} style={styles.termItem}>
              <View style={styles.termDot} />
              <View style={styles.termContent}>
                <Text style={styles.termWord}>{item.term}</Text>
                <Text style={styles.termDef}>{item.definition}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Ionicons
            name="information-circle"
            size={18}
            color="#8E8E93"
            style={{ marginTop: 2 }}
          />
          <Text style={styles.disclaimerText}>
            This application is intended as a supplementary tool for clinical
            assessment. It should not be used as a sole diagnostic instrument.
            Always consult with a qualified professional.
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
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#636e72',
    lineHeight: 20,
    marginBottom: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  termsCard: {
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
  termsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  termItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  termDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginTop: 6,
  },
  termContent: {
    flex: 1,
  },
  termWord: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  termDef: {
    fontSize: 13,
    color: '#636e72',
    lineHeight: 18,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0F1F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
