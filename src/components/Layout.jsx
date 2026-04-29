import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ activePage, onNavigate, children }) {
  const mobileNavItems = [
    { id: 'news', label: 'News', icon: '📰' },
    { id: 'room', label: 'Recording', icon: '🎙️' },
    { id: 'records', label: 'Records', icon: '📋' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  return (
    <div className="layout">
      <Header />
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="layout__content">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="layout__bottomnav">
        <div className="layout__bottomnav-bar">
          {mobileNavItems.map(item => (
            <button
              key={item.id}
              className={`layout__bottomnav-item ${activePage === item.id ? 'layout__bottomnav-item--active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="layout__bottomnav-icon">{item.icon}</span>
              <span className="layout__bottomnav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default Layout;
