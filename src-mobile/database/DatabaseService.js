import { db } from '../../src/firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  updateDoc,
  query, 
  where 
} from 'firebase/firestore';

// Initialize DB (No longer needed for Firebase, but keeping empty to avoid changing context logic)
export const initDB = async () => {
  console.log('Firebase ready.');
};

// ── Client Operations ──

export const addClientToDB = async (client) => {
  try {
    const clientRef = doc(db, 'clients', client.id);
    await setDoc(clientRef, {
      id: client.id,
      name: client.name,
      firstName: client.details.firstName,
      middleName: client.details.middleName || '',
      lastName: client.details.lastName,
      age: client.details.age,
      gender: client.details.gender,
      grade: client.details.grade,
      questionnaire: client.details.questionnaire || null,
      requiredModels: client.details.requiredModels || [],
      consentGiven: client.details.consentGiven || false,
      color: client.color,
      archivedAt: client.archivedAt || null,
    });
  } catch (error) {
    console.error('Error adding client to Firebase:', error);
  }
};

export const getClientsFromDB = async () => {
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    const recordingsSnap = await getDocs(collection(db, 'recordings'));

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
          questionnaire: row.questionnaire || null,
          requiredModels: row.requiredModels || [],
          consentGiven: row.consentGiven || false,
        },
        recordings: recordingsByClient[row.id] || [],
      });
    });

    return mappedClients;
  } catch (error) {
    console.error('Error fetching clients from Firebase:', error);
    return [];
  }
};

// ── Recording Operations ──

export const addRecordingToDB = async (recording) => {
  try {
    const analysisJson = recording.analysisData ? JSON.stringify(recording.analysisData) : null;
    const recRef = doc(db, 'recordings', recording.id);

    console.log('[DB] Writing recording doc:', recording.id, 'to client:', recording.folderId);
    console.log('[DB] URI:', recording.uri?.substring(0, 60) + '...');
    console.log('[DB] Analysis size:', analysisJson ? analysisJson.length : 0, 'chars');

    await setDoc(recRef, {
      id: recording.id,
      clientId: recording.folderId,
      uri: recording.uri,
      duration: recording.duration,
      date: recording.date,
      transcription: recording.transcription || '',
      analysisData: analysisJson,
      archivedAt: recording.archivedAt || null,
    });

    console.log('[DB] ✅ Recording doc written successfully:', recording.id);
  } catch (error) {
    console.error('[DB] ❌ Error adding recording to Firebase:', error.message);
    console.error('[DB] Full error:', error);
    throw error; // Re-throw so caller can handle it
  }
};

// ── Delete Operations ──

export const deleteClientFromDB = async (clientId) => {
  try {
    await deleteDoc(doc(db, 'clients', clientId));
    console.log('[DB] Deleted client:', clientId);
  } catch (error) {
    console.error('Error deleting client from Firebase:', error);
  }
};

export const deleteRecordingFromDB = async (recordingId) => {
  try {
    await deleteDoc(doc(db, 'recordings', recordingId));
    console.log('[DB] Deleted recording:', recordingId);
  } catch (error) {
    console.error('Error deleting recording from Firebase:', error);
  }
};

// ── Archive / Restore Operations (Firebase-synced) ──

export const archiveClientInDB = async (clientId) => {
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      archivedAt: new Date().toISOString(),
    });
    console.log('[DB] Archived client:', clientId);
  } catch (error) {
    console.error('Error archiving client:', error);
  }
};

export const restoreClientInDB = async (clientId) => {
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      archivedAt: null,
    });
    console.log('[DB] Restored client:', clientId);
  } catch (error) {
    console.error('Error restoring client:', error);
  }
};

export const archiveRecordingInDB = async (recordingId) => {
  try {
    await updateDoc(doc(db, 'recordings', recordingId), {
      archivedAt: new Date().toISOString(),
    });
    console.log('[DB] Archived recording:', recordingId);
  } catch (error) {
    console.error('Error archiving recording:', error);
  }
};

export const restoreRecordingInDB = async (recordingId) => {
  try {
    await updateDoc(doc(db, 'recordings', recordingId), {
      archivedAt: null,
    });
    console.log('[DB] Restored recording:', recordingId);
  } catch (error) {
    console.error('Error restoring recording:', error);
  }
};
