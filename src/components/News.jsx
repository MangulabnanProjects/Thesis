import './News.css';

const severityLevels = [
  { name: 'Mild', color: '#4caf50', icon: '🟢', description: 'Occasional worry or nervousness that does not significantly interfere with daily activities. Individuals may experience slight unease in certain situations but can manage and recover quickly.' },
  { name: 'Moderate', color: '#ff9800', icon: '🟡', description: 'Persistent anxiety that begins to affect daily functioning, including work performance, social interactions, and sleep quality. Physical symptoms like increased heart rate or muscle tension may be noticeable.' },
  { name: 'Significant', color: '#f44336', icon: '🟠', description: 'Intense and frequent anxiety that substantially disrupts everyday life. Activities that were once manageable become difficult, and avoidance behaviors may develop. Professional support is strongly recommended.' },
  { name: 'Panic', color: '#b71c1c', icon: '🔴', description: 'Severe, overwhelming episodes of intense fear or dread that may include difficulty breathing, chest pain, dizziness, and a sense of losing control. Immediate professional intervention is critical.' },
];

const emotions = [
  { name: 'Anxious / Tense', icon: '😰', description: 'Characterized by persistent worry, restlessness, and a heightened state of alertness. Voice patterns typically show increased pitch variability and faster speech rate.' },
  { name: 'Stressed', icon: '😫', description: 'A state of mental or emotional strain from adverse circumstances. Vocal markers include breathiness, vocal fatigue, and irregular pauses during speech.' },
  { name: 'Calm / Neutral', icon: '😌', description: 'A relaxed and balanced emotional state. Speech patterns are steady with consistent pitch, rhythm, and clear articulation throughout.' },
  { name: 'Fearful', icon: '😨', description: 'An intense emotional response to perceived danger or threat. The voice may tremble, pitch rises sharply, and breathing becomes shallow and rapid.' },
  { name: 'Sad / Fatigued', icon: '😢', description: 'A low-energy state marked by feelings of sadness, fatigue, or hopelessness. Voice tends to be monotone with lower pitch, slower speech rate, and longer pauses.' },
  { name: 'Frustrated / Irritable', icon: '😤', description: 'Elevated agitation and reduced patience. Vocal indicators include increased volume, sharper tone, and abrupt speech patterns with shorter sentences.' },
];

const anxietyTypes = [
  { name: 'Social Anxiety', icon: '👥', description: 'Intense fear of being judged, negatively evaluated, or rejected in social situations. Individuals may avoid public speaking, meeting new people, or eating in front of others.' },
  { name: 'Generalized Anxiety', icon: '🌀', description: 'Excessive, uncontrollable worry about various aspects of daily life including health, finances, work, and relationships, often without a specific trigger.' },
  { name: 'Performance Anxiety', icon: '🎤', description: 'Fear related to performing tasks in front of others, such as presentations, exams, or artistic performances. It can cause vocal tremors and cognitive blanking.' },
  { name: 'Health Anxiety', icon: '🏥', description: 'Excessive worry about having or developing a serious medical condition. Normal bodily sensations are often misinterpreted as signs of illness.' },
  { name: 'Panic Disorder', icon: '⚡', description: 'Recurrent, unexpected panic attacks — sudden surges of intense fear that peak within minutes, accompanied by physical symptoms like pounding heart and shortness of breath.' },
];

function News() {
  return (
    <div className="news">
      <div className="news__hero">
        <h1 className="news__hero-title">Understanding Voice-Based <span className="news__accent">Anxiety Analysis</span></h1>
        <p className="news__hero-subtitle">Clinical Voice uses advanced AI to detect emotional patterns and anxiety indicators through vocal biomarkers. Learn about the different classifications our system identifies.</p>
      </div>

      {/* Severity Levels */}
      <section className="news__section">
        <h2 className="news__section-title">
          <span className="news__section-icon">📊</span>
          Severity Levels
        </h2>
        <p className="news__section-desc">Our system classifies anxiety severity into four distinct levels based on vocal pattern intensity and consistency.</p>
        <div className="news__grid">
          {severityLevels.map(item => (
            <div className="news__card" key={item.name} style={{ borderTopColor: item.color }}>
              <div className="news__card-header">
                <span className="news__card-icon">{item.icon}</span>
                <h3 className="news__card-name" style={{ color: item.color }}>{item.name}</h3>
              </div>
              <p className="news__card-desc">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Emotions */}
      <section className="news__section">
        <h2 className="news__section-title">
          <span className="news__section-icon">🎭</span>
          Detected Emotions
        </h2>
        <p className="news__section-desc">Voice analysis can detect subtle emotional states through changes in pitch, tempo, jitter, shimmer, and MFCCs.</p>
        <div className="news__grid news__grid--3col">
          {emotions.map(item => (
            <div className="news__card" key={item.name}>
              <div className="news__card-header">
                <span className="news__card-icon">{item.icon}</span>
                <h3 className="news__card-name">{item.name}</h3>
              </div>
              <p className="news__card-desc">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Anxiety Types */}
      <section className="news__section">
        <h2 className="news__section-title">
          <span className="news__section-icon">🧠</span>
          Anxiety Types
        </h2>
        <p className="news__section-desc">Different forms of anxiety present unique vocal signatures that our model is trained to identify and classify.</p>
        <div className="news__grid news__grid--list">
          {anxietyTypes.map(item => (
            <div className="news__card news__card--horizontal" key={item.name}>
              <span className="news__card-icon news__card-icon--large">{item.icon}</span>
              <div className="news__card-body">
                <h3 className="news__card-name">{item.name}</h3>
                <p className="news__card-desc">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default News;
