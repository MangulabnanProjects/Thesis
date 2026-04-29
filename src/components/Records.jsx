import { useState, useEffect } from 'react';
import './Records.css';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function Records({ onPlayRecording }) {
  const [people, setPeople] = useState([]);
  const [openFolders, setOpenFolders] = useState({});

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (clientsSnap) => {
      const unsubRecs = onSnapshot(collection(db, 'recordings'), (recsSnap) => {
        const recordingsByClient = {};
        
        recsSnap.forEach((docSnap) => {
          const rec = docSnap.data();
          if (!recordingsByClient[rec.clientId]) {
            recordingsByClient[rec.clientId] = [];
          }
          recordingsByClient[rec.clientId].push({
            id: rec.id,
            title: `Recording ${rec.date}`,
            date: rec.date,
            duration: rec.duration ? parseFloat(rec.duration.split(':')[0]) * 60 + parseFloat(rec.duration.split(':')[1]) : 0,
            emotion: 'Pending Analysis',
            anxiety: 'Pending Analysis',
            severity: 'Moderate',
            confidence: 90,
            transcript: rec.transcription,
            analysisData: rec.analysisData,
            uri: rec.uri,
            archivedAt: rec.archivedAt || null,
          });
        });

        const mappedClients = [];
        clientsSnap.forEach((docSnap) => {
          const clientData = docSnap.data();
          const clientGender = clientData.gender || 'Unknown';
          // Attach gender to each recording so Dashboard can use gender-specific thresholds
          const recs = (recordingsByClient[clientData.id] || []).map(r => ({
            ...r,
            gender: clientGender,
          }));
          mappedClients.push({
            id: clientData.id,
            name: clientData.name,
            gender: clientGender,
            archivedAt: clientData.archivedAt || null,
            recordings: recs.sort((a, b) => (b.id || '').localeCompare(a.id || '')),
          });
        });
        
        setPeople(mappedClients);
      });
      return () => unsubRecs();
    });
    return () => unsubClients();
  }, []);

  const toggleFolder = (id) => {
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'Mild': return 'green';
      case 'Moderate': return 'orange';
      case 'Significant': return 'red';
      default: return 'gray';
    }
  };

  // ── Archive / Delete Handlers ──

  const handleArchiveClient = async (clientId) => {
    if (!window.confirm('Move this folder to archive? You can restore it later.')) return;
    try {
      await updateDoc(doc(db, 'clients', clientId), { archivedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Error archiving client:', e);
    }
  };

  const handleArchiveRecording = async (recordingId) => {
    if (!window.confirm('Move this recording to archive?')) return;
    try {
      await updateDoc(doc(db, 'recordings', recordingId), { archivedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Error archiving recording:', e);
    }
  };

  const handleDeleteClient = async (client) => {
    const recCount = client.recordings?.length || 0;
    if (!window.confirm(
      `PERMANENTLY DELETE "${client.name}" and all ${recCount} recordings?\n\nThis also removes audio files from cloud storage.\nThis CANNOT be undone.`
    )) return;

    try {
      // Delete all recordings for this client
      for (const rec of client.recordings || []) {
        // Delete audio from MinIO (via fetch DELETE)
        if (rec.uri && rec.uri.includes('ngrok')) {
          try { await fetch(rec.uri, { method: 'DELETE' }); } catch (e) {}
        }
        await deleteDoc(doc(db, 'recordings', rec.id));
      }
      // Delete the client document
      await deleteDoc(doc(db, 'clients', client.id));
    } catch (e) {
      console.error('Error deleting client:', e);
    }
  };

  const handleDeleteRecording = async (rec) => {
    if (!window.confirm('PERMANENTLY DELETE this recording?\n\nThis CANNOT be undone.')) return;
    try {
      // Delete from MinIO
      if (rec.uri && rec.uri.includes('ngrok')) {
        try { await fetch(rec.uri, { method: 'DELETE' }); } catch (e) {}
      }
      await deleteDoc(doc(db, 'recordings', rec.id));
    } catch (e) {
      console.error('Error deleting recording:', e);
    }
  };

  const handleRestoreClient = async (clientId) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { archivedAt: null });
    } catch (e) {
      console.error('Error restoring client:', e);
    }
  };

  const handleRestoreRecording = async (recordingId) => {
    try {
      await updateDoc(doc(db, 'recordings', recordingId), { archivedAt: null });
    } catch (e) {
      console.error('Error restoring recording:', e);
    }
  };

  // Split into active and archived
  const activeClients = people.filter(p => !p.archivedAt);
  const archivedClients = people.filter(p => p.archivedAt);
  // Archived recordings from active clients
  const archivedRecordings = [];
  activeClients.forEach(p => {
    (p.recordings || []).forEach(r => {
      if (r.archivedAt) archivedRecordings.push({ ...r, personName: p.name, personId: p.id });
    });
  });

  return (
    <div className="records">
      <div className="records__header">
        <h2 className="records__page-title">Voice Records</h2>
        <p className="records__subtitle">Browse patient recordings and analysis results</p>
      </div>

      {/* Active Clients */}
      {activeClients.map(person => {
        const activeRecs = (person.recordings || []).filter(r => !r.archivedAt);
        return (
          <div className="records__folder" key={person.id}>
            <button className="records__folder-header" onClick={() => toggleFolder(person.id)}>
              <div className="records__folder-left">
                <svg className={`records__folder-chevron ${openFolders[person.id] ? 'records__folder-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div className="records__folder-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="records__folder-info">
                  <span className="records__folder-name">{person.name}</span>
                  <span className="records__folder-count">{activeRecs.length} recordings</span>
                </div>
              </div>
              <div className="records__folder-actions" onClick={e => e.stopPropagation()}>
                <button className="records__action-btn records__action-btn--archive" onClick={() => handleArchiveClient(person.id)} title="Archive folder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </button>
                <button className="records__action-btn records__action-btn--delete" onClick={() => handleDeleteClient(person)} title="Delete permanently">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </button>

            {openFolders[person.id] && (
              <div className="records__recordings">
                {activeRecs.map(rec => (
                  <div className="records__recording-card" key={rec.id}>
                    <button className="records__play-btn" onClick={() => onPlayRecording({ ...rec, personName: person.name })} title="Play in Room">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </button>

                    <div className="records__rec-info">
                      <span className="records__rec-title">{rec.title}</span>
                      <span className="records__rec-date">{rec.date} · {Math.floor(rec.duration / 60)}:{(rec.duration % 60).toString().padStart(2, '0')}s</span>
                    </div>

                    <div className="records__rec-results">
                      <div className="records__rec-tag records__rec-tag--blue">
                        <span className="records__rec-tag-label">Emotion</span>
                        <span className="records__rec-tag-value">{rec.emotion}</span>
                      </div>
                      <div className="records__rec-tag records__rec-tag--purple">
                        <span className="records__rec-tag-label">Anxiety</span>
                        <span className="records__rec-tag-value">{rec.anxiety}</span>
                      </div>
                      <div className={`records__rec-tag records__rec-tag--${getSeverityClass(rec.severity)}`}>
                        <span className="records__rec-tag-label">Severity</span>
                        <span className="records__rec-tag-value">{rec.severity}</span>
                      </div>
                    </div>

                    <div className="records__rec-actions">
                      <button className="records__action-btn records__action-btn--archive" onClick={() => handleArchiveRecording(rec.id)} title="Archive">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                      </button>
                      <button className="records__action-btn records__action-btn--delete" onClick={() => handleDeleteRecording(rec)} title="Delete permanently">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Archived Section */}
      {(archivedClients.length > 0 || archivedRecordings.length > 0) && (
        <div className="records__archive-section">
          <h3 className="records__archive-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            Archive ({archivedClients.length + archivedRecordings.length})
          </h3>

          {archivedClients.map(client => (
            <div className="records__archive-card" key={client.id}>
              <div className="records__archive-info">
                <span className="records__archive-name">{client.name}</span>
                <span className="records__archive-meta">{client.recordings?.length || 0} recordings</span>
              </div>
              <div className="records__archive-actions">
                <button className="records__action-btn records__action-btn--restore" onClick={() => handleRestoreClient(client.id)} title="Restore">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Restore
                </button>
                <button className="records__action-btn records__action-btn--delete" onClick={() => handleDeleteClient(client)} title="Delete permanently">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}

          {archivedRecordings.map(rec => (
            <div className="records__archive-card" key={rec.id}>
              <div className="records__archive-info">
                <span className="records__archive-name">{rec.title}</span>
                <span className="records__archive-meta">From: {rec.personName} · {rec.date}</span>
              </div>
              <div className="records__archive-actions">
                <button className="records__action-btn records__action-btn--restore" onClick={() => handleRestoreRecording(rec.id)} title="Restore">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Restore
                </button>
                <button className="records__action-btn records__action-btn--delete" onClick={() => handleDeleteRecording(rec)} title="Delete permanently">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Records;
