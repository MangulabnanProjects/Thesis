// Shared dummy data for all recordings across the app
// Each recording has unique transcription, analysis results, and confidence

export const CLIENTS = [
  {
    id: '1',
    name: 'Gene',
    color: '#4CAF50',
    recordings: [
      {
        id: 'r1',
        title: 'Session 1 — Initial Assessment',
        date: 'Mar 28, 2026',
        duration: '3:42',
        durationSeconds: 222,
        fullTranscription:
          "The upcoming review at work has me on edge. I keep rehearsing what I'm going to say to my manager but every scenario I imagine ends badly. I know it's irrational but I can't stop the what-if thoughts from spiraling. My appetite has been down too.",
        segments: [
          { time: '0:00', text: 'The upcoming review at work has me on edge.' },
          { time: '0:14', text: "I keep rehearsing what I'm going to say to my manager but every scenario I imagine ends badly." },
          { time: '0:38', text: "I know it's irrational but I can't stop the what-if thoughts from spiraling." },
          { time: '1:02', text: 'My appetite has been down too.' },
        ],
        analysis: {
          severity: { label: 'Moderate', color: '#FFA94D' },
          emotion: { label: 'Anxious / Restless', color: '#4CAF50' },
          anxiety: { label: 'Performance', color: '#E91E8C' },
        },
        confidence: 97,
      },
      {
        id: 'r2',
        title: 'Session 2 — Follow Up',
        date: 'Mar 30, 2026',
        duration: '5:18',
        durationSeconds: 318,
        fullTranscription:
          "I've been trying the breathing exercises you suggested. They help a little but I still feel this tightness in my chest most mornings. The weekend was okay. I went for a walk which helped clear my head. But Sunday night the dread came back.",
        segments: [
          { time: '0:00', text: "I've been trying the breathing exercises you suggested." },
          { time: '0:12', text: 'They help a little but I still feel this tightness in my chest most mornings.' },
          { time: '0:30', text: 'The weekend was okay. I went for a walk which helped clear my head.' },
          { time: '0:55', text: 'But Sunday night the dread came back.' },
        ],
        analysis: {
          severity: { label: 'Mild', color: '#51CF66' },
          emotion: { label: 'Hopeful / Cautious', color: '#4CAF50' },
          anxiety: { label: 'Generalized', color: '#E91E8C' },
        },
        confidence: 92,
      },
      {
        id: 'r3',
        title: 'Session 3 — Progress Check',
        date: 'Apr 01, 2026',
        duration: '2:55',
        durationSeconds: 175,
        fullTranscription:
          "I actually felt good this week for the first time in a while. I spoke up in a meeting and it went fine. I'm starting to realize that most of my fears don't actually come true. Sleep is still a problem though.",
        segments: [
          { time: '0:00', text: 'I actually felt good this week for the first time in a while.' },
          { time: '0:18', text: 'I spoke up in a meeting and it went fine.' },
          { time: '0:32', text: "I'm starting to realize that most of my fears don't actually come true." },
          { time: '0:50', text: 'Sleep is still a problem though.' },
        ],
        analysis: {
          severity: { label: 'Low', color: '#51CF66' },
          emotion: { label: 'Calm / Reflective', color: '#339AF0' },
          anxiety: { label: 'Performance', color: '#E91E8C' },
        },
        confidence: 95,
      },
    ],
  },
  {
    id: '2',
    name: 'Maria',
    color: '#FF6B6B',
    recordings: [
      {
        id: 'r4',
        title: 'Session 1 — Intake',
        date: 'Mar 25, 2026',
        duration: '4:10',
        durationSeconds: 250,
        fullTranscription:
          "I've been having trouble sleeping for the past three months. Every night I lie awake thinking about everything that could go wrong. My heart races and I feel like I can't breathe sometimes. I had to leave work early twice last week.",
        segments: [
          { time: '0:00', text: "I've been having trouble sleeping for the past three months." },
          { time: '0:15', text: 'Every night I lie awake thinking about everything that could go wrong.' },
          { time: '0:35', text: "My heart races and I feel like I can't breathe sometimes." },
          { time: '0:58', text: 'I had to leave work early twice last week.' },
        ],
        analysis: {
          severity: { label: 'High', color: '#FF6B6B' },
          emotion: { label: 'Distressed / Fearful', color: '#FF6B6B' },
          anxiety: { label: 'Panic Disorder', color: '#E91E8C' },
        },
        confidence: 89,
      },
      {
        id: 'r5',
        title: 'Session 2 — Evaluation',
        date: 'Mar 29, 2026',
        duration: '6:02',
        durationSeconds: 362,
        fullTranscription:
          "The medication is helping a bit with the physical symptoms but I still feel on edge. I noticed I've been avoiding social situations more. Even going to the grocery store feels overwhelming. I miss how I used to be.",
        segments: [
          { time: '0:00', text: 'The medication is helping a bit with the physical symptoms but I still feel on edge.' },
          { time: '0:22', text: "I noticed I've been avoiding social situations more." },
          { time: '0:40', text: 'Even going to the grocery store feels overwhelming.' },
          { time: '1:05', text: 'I miss how I used to be.' },
        ],
        analysis: {
          severity: { label: 'Moderate', color: '#FFA94D' },
          emotion: { label: 'Sad / Withdrawn', color: '#4CAF50' },
          anxiety: { label: 'Social Anxiety', color: '#E91E8C' },
        },
        confidence: 94,
      },
    ],
  },
  {
    id: '3',
    name: 'Carlos',
    color: '#FFA94D',
    recordings: [
      {
        id: 'r6',
        title: 'Session 1 — Screening',
        date: 'Mar 27, 2026',
        duration: '3:05',
        durationSeconds: 185,
        fullTranscription:
          "My wife says I've been irritable lately and she's right. Little things set me off. I snapped at my kids yesterday over nothing and felt terrible afterward. I think the stress from the new project is getting to me.",
        segments: [
          { time: '0:00', text: "My wife says I've been irritable lately and she's right." },
          { time: '0:14', text: 'Little things set me off.' },
          { time: '0:22', text: 'I snapped at my kids yesterday over nothing and felt terrible afterward.' },
          { time: '0:45', text: 'I think the stress from the new project is getting to me.' },
        ],
        analysis: {
          severity: { label: 'Moderate', color: '#FFA94D' },
          emotion: { label: 'Frustrated / Guilty', color: '#FFA94D' },
          anxiety: { label: 'Work Stress', color: '#E91E8C' },
        },
        confidence: 91,
      },
      {
        id: 'r7',
        title: 'Session 2 — Voice Sample',
        date: 'Mar 31, 2026',
        duration: '1:48',
        durationSeconds: 108,
        fullTranscription:
          "I tried journaling like you suggested. It actually helped me identify some patterns. I realize I get most anxious on Sunday nights. The anticipation of the work week is worse than the actual week.",
        segments: [
          { time: '0:00', text: 'I tried journaling like you suggested.' },
          { time: '0:10', text: 'It actually helped me identify some patterns.' },
          { time: '0:24', text: 'I realize I get most anxious on Sunday nights.' },
          { time: '0:38', text: 'The anticipation of the work week is worse than the actual week.' },
        ],
        analysis: {
          severity: { label: 'Mild', color: '#51CF66' },
          emotion: { label: 'Insightful / Aware', color: '#339AF0' },
          anxiety: { label: 'Anticipatory', color: '#E91E8C' },
        },
        confidence: 88,
      },
      {
        id: 'r8',
        title: 'Session 3 — Analysis Review',
        date: 'Apr 01, 2026',
        duration: '4:33',
        durationSeconds: 273,
        fullTranscription:
          "I'm doing better overall. The journaling and exercise routine have made a real difference. I still have bad days but they're less frequent. My wife noticed the change too which feels validating.",
        segments: [
          { time: '0:00', text: "I'm doing better overall." },
          { time: '0:08', text: 'The journaling and exercise routine have made a real difference.' },
          { time: '0:25', text: "I still have bad days but they're less frequent." },
          { time: '0:42', text: 'My wife noticed the change too which feels validating.' },
        ],
        analysis: {
          severity: { label: 'Low', color: '#51CF66' },
          emotion: { label: 'Positive / Motivated', color: '#51CF66' },
          anxiety: { label: 'Residual Stress', color: '#E91E8C' },
        },
        confidence: 96,
      },
      {
        id: 'r9',
        title: 'Session 4 — Final Report',
        date: 'Apr 01, 2026',
        duration: '7:12',
        durationSeconds: 432,
        fullTranscription:
          "Looking back at where I started, I can see real progress. The tools I've learned are helping me manage my reactions. I want to continue working on my sleep patterns. I feel more equipped to handle setbacks now.",
        segments: [
          { time: '0:00', text: 'Looking back at where I started, I can see real progress.' },
          { time: '0:16', text: "The tools I've learned are helping me manage my reactions." },
          { time: '0:35', text: 'I want to continue working on my sleep patterns.' },
          { time: '0:52', text: 'I feel more equipped to handle setbacks now.' },
        ],
        analysis: {
          severity: { label: 'Low', color: '#51CF66' },
          emotion: { label: 'Confident / Hopeful', color: '#51CF66' },
          anxiety: { label: 'Minimal', color: '#51CF66' },
        },
        confidence: 98,
      },
    ],
  },
  {
    id: '4',
    name: 'Sarah',
    color: '#51CF66',
    recordings: [
      {
        id: 'r10',
        title: 'Session 1 — Baseline Recording',
        date: 'Apr 01, 2026',
        duration: '2:20',
        durationSeconds: 140,
        fullTranscription:
          "This is my first session and I'm not sure what to expect. I've been feeling overwhelmed with school and family obligations. I sometimes feel like I'm drowning and nobody notices. I just want to feel normal again.",
        segments: [
          { time: '0:00', text: "This is my first session and I'm not sure what to expect." },
          { time: '0:15', text: "I've been feeling overwhelmed with school and family obligations." },
          { time: '0:30', text: "I sometimes feel like I'm drowning and nobody notices." },
          { time: '0:48', text: 'I just want to feel normal again.' },
        ],
        analysis: {
          severity: { label: 'High', color: '#FF6B6B' },
          emotion: { label: 'Overwhelmed / Isolated', color: '#FF6B6B' },
          anxiety: { label: 'Academic / Family', color: '#E91E8C' },
        },
        confidence: 86,
      },
    ],
  },
];

// Helper to find a recording by ID
export function getRecordingById(recordingId) {
  for (const client of CLIENTS) {
    const recording = client.recordings.find((r) => r.id === recordingId);
    if (recording) {
      return { ...recording, clientName: client.name, clientColor: client.color };
    }
  }
  return null;
}
