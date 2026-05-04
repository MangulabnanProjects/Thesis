import './About.css';

function About() {
  return (
    <div className="about">
      <div className="about__hero">
        <h1 className="about__hero-title">About <span className="about__accent">Clinical Voice</span></h1>
        <p className="about__hero-subtitle">
          An advanced acoustic analysis system built to aid clinical diagnosis through voice biomarkers.
        </p>
      </div>

      <div className="about__content">
        <section className="about__section">
          <h2 className="about__section-title">
            <span className="about__section-icon">⚙️</span>
            How the System Works
          </h2>
          <p className="about__text">
            The Clinical Voice system captures audio recordings during client interviews and processes them using a 
            specialized Digital Signal Processing (DSP) engine. We extract key acoustic vitals—such as Pitch (F0), 
            Jitter, and Shimmer—to quantify the physical markers of stress in the vocal cords. 
            Combined with a psychometric Likert scale assessment, the system dynamically routes the data through 
            specifically trained machine learning models (e.g., PTSD, Social Anxiety, Panic Attack) to calculate a 
            final baseline severity score. This dual-track approach ensures highly accurate, objective clinical insights.
          </p>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">
            <span className="about__section-icon">🔒</span>
            Confidentiality & Data Consent
          </h2>
          <p className="about__text">
            Protecting patient privacy is our utmost priority. <strong>By using this system, the client provides informed consent 
            for their audio and psychometric data to be recorded and processed.</strong> All client data, including audio files, 
            intake details, and calculated severity scores, are strictly confidential. Data is transmitted securely and stored 
            in an isolated, encrypted database. Audio recordings are exclusively used for feature extraction and are never 
            shared, distributed, or utilized outside the bounds of this clinical study.
          </p>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">
            <span className="about__section-icon">👨‍⚕️</span>
            Purpose for the Clinical Expert
          </h2>
          <p className="about__text">
            For mental health professionals and speech-language pathologists, diagnosing anxiety or trauma disorders 
            relies heavily on subjective self-reporting. This system provides a <strong>physiological "lie detector"</strong> 
            by objectively measuring the physical stress present in the voice. By providing empirical data on emotional states 
            and stress severity, the platform empowers experts to make faster, safer, and more accurate diagnostic decisions.
          </p>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">
            <span className="about__section-icon">🎓</span>
            Purpose for the Thesis Study
          </h2>
          <p className="about__text">
            This system is the culmination of a rigorous academic thesis aimed at bridging the gap between artificial 
            intelligence and modern psychotherapy. As student researchers, our goal is to prove that 
            <strong> vocal biomarkers can reliably map to psychological conditions</strong>. By developing this architecture, 
            we demonstrate the viable integration of machine learning into real-world healthcare technology, paving the way 
            for accessible, non-invasive diagnostic tools in the future of mental health care.
          </p>
        </section>
      </div>
    </div>
  );
}

export default About;
