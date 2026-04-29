import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  addClientToDB,
  addRecordingToDB,
  deleteClientFromDB,
  deleteRecordingFromDB,
  archiveClientInDB,
  restoreClientInDB,
  archiveRecordingInDB,
  restoreRecordingInDB,
  initDB,
} from '../database/DatabaseService';
import { deleteFromMinIO, extractMinIOKey } from '../config/minioConfig';
import { db } from '../../src/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';

const ClientContext = createContext(null);

// Pre-defined colors for new clients
const COLORS = ['#4CAF50', '#FF6B6B', '#FFA94D', '#51CF66', '#339AF0', '#E91E8C'];

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Initialize DB and listen to Firebase realtime changes
  useEffect(() => {
    (async () => {
      await initDB();
    })();

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (clientsSnap) => {
      const unsubscribeRecordings = onSnapshot(collection(db, 'recordings'), (recordingsSnap) => {
        const recordingsByClient = {};
        
        recordingsSnap.forEach((docSnap) => {
          const rec = docSnap.data();
          if (!recordingsByClient[rec.clientId]) {
            recordingsByClient[rec.clientId] = [];
          }
          
          recordingsByClient[rec.clientId].push({
            id: rec.id,
            folderId: rec.clientId,
            uri: rec.uri,
            duration: rec.duration,
            date: rec.date,
            transcription: rec.transcription,
            analysisData: rec.analysisData ? JSON.parse(rec.analysisData) : null,
            archivedAt: rec.archivedAt,
          });
        });

        const mappedClients = [];
        clientsSnap.forEach((docSnap) => {
          const row = docSnap.data();
          mappedClients.push({
            id: row.id,
            name: row.name,
            color: row.color,
            archivedAt: row.archivedAt,
            details: {
              firstName: row.firstName,
              middleName: row.middleName,
              lastName: row.lastName,
              age: parseInt(row.age, 10) || 0,
              gender: row.gender,
              grade: row.grade,
              intake: row.intake || '',
            },
            recordings: recordingsByClient[row.id] || [],
          });
        });
        
        setClients(mappedClients);
        setDbLoaded(true);
      });
      
      return () => unsubscribeRecordings();
    });

    return () => unsubscribeClients();
  }, []);

  const activeClient = clients.find(c => c.id === activeClientId) || null;

  // ── Add ──

  const addClient = async (details) => {
    const id = Date.now().toString();
    const nameStr = `${details.firstName} ${details.lastName}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const newClient = {
      id,
      name: nameStr,
      details,
      color,
      recordings: [],
    };

    await addClientToDB(newClient);
    setActiveClientId(id);
    return newClient;
  };

  const addRecordingToClient = async (clientId, fileUri, durationFormatted, transcription, analysisData) => {
    const newRecord = {
      id: 'rec_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      folderId: clientId,
      duration: durationFormatted || '0:05',
      uri: fileUri,
      transcription: transcription || 'No transcription available.',
      analysisData: analysisData || null,
      archivedAt: null,
    };

    await addRecordingToDB(newRecord);
  };

  // ── Archive (soft delete — synced to Firebase) ──

  const archiveClient = async (clientId) => {
    await archiveClientInDB(clientId);
    // Snapshot listener will update state automatically
  };

  const restoreClient = async (clientId) => {
    await restoreClientInDB(clientId);
  };

  const archiveRecording = async (clientId, recordingId) => {
    await archiveRecordingInDB(recordingId);
  };

  const restoreRecording = async (clientId, recordingId) => {
    await restoreRecordingInDB(recordingId);
  };

  // ── Permanent Delete (removes from Firebase + MinIO cloud) ──

  const permanentDeleteRecording = async (recordingId) => {
    // Find the recording to get its URI
    let targetRec = null;
    for (const client of clients) {
      const found = client.recordings.find(r => r.id === recordingId);
      if (found) {
        targetRec = found;
        break;
      }
    }

    // Delete from MinIO cloud storage
    if (targetRec?.uri) {
      const objectKey = extractMinIOKey(targetRec.uri);
      if (objectKey) {
        try {
          await deleteFromMinIO(objectKey);
        } catch (e) {
          console.warn('[Delete] MinIO delete failed:', e.message);
        }
      }
    }

    // Delete from Firebase
    await deleteRecordingFromDB(recordingId);
    console.log('[Delete] Permanently deleted recording:', recordingId);
  };

  const permanentDeleteClient = async (clientId) => {
    // Find the client and all its recordings
    const client = clients.find(c => c.id === clientId);

    if (client?.recordings) {
      // Delete each recording's audio from MinIO and Firebase
      for (const rec of client.recordings) {
        if (rec.uri) {
          const objectKey = extractMinIOKey(rec.uri);
          if (objectKey) {
            try {
              await deleteFromMinIO(objectKey);
            } catch (e) {
              console.warn('[Delete] MinIO delete failed for', rec.id, e.message);
            }
          }
        }
        await deleteRecordingFromDB(rec.id);
      }
    }

    // Delete the client document from Firebase
    await deleteClientFromDB(clientId);
    console.log('[Delete] Permanently deleted client and all recordings:', clientId);
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        activeClient,
        activeClientId,
        setActiveClient: setActiveClientId,
        addClient,
        addRecordingToClient,
        archiveClient,
        restoreClient,
        archiveRecording,
        restoreRecording,
        permanentDeleteRecording,
        permanentDeleteClient,
        dbLoaded,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  return useContext(ClientContext);
}
