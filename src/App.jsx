import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Room from './components/Room';
import Records from './components/Records';
import News from './components/News';
import About from './components/About';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [activeRecording, setActiveRecording] = useState(null);

  const handlePlayRecording = (recording) => {
    setActiveRecording(recording);
    setActivePage('room');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard recording={activeRecording} />;
      case 'room':
        return <Room recording={activeRecording} onSeeAnalytics={() => setActivePage('dashboard')} />;
      case 'records':
        return <Records onPlayRecording={handlePlayRecording} />;
      case 'news':
        return <News />;
      case 'about':
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

function PlaceholderPage({ title, description, icon }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__icon">{icon}</div>
      <h2 className="placeholder-page__title">{title}</h2>
      <p className="placeholder-page__desc">{description}</p>
      <p className="placeholder-page__coming">Coming soon</p>
    </div>
  );
}

export default App;
