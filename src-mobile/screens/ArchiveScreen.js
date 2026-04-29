import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientContext } from '../context/ClientContext';

export default function ArchiveScreen() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const {
    clients,
    restoreClient,
    restoreRecording,
    permanentDeleteClient,
    permanentDeleteRecording,
  } = useClientContext();

  const { archivedClients, archivedRecordings } = useMemo(() => {
    const aClients = [];
    const aRecords = [];

    clients.forEach(client => {
      if (client.archivedAt) {
        aClients.push(client);
      } else if (client.recordings) {
        client.recordings.forEach(rec => {
          if (rec.archivedAt) {
            aRecords.push({ ...rec, clientName: client.name, clientId: client.id });
          }
        });
      }
    });

    return { archivedClients: aClients, archivedRecordings: aRecords };
  }, [clients]);

  const confirmDeleteClient = (client) => {
    Alert.alert(
      'Permanently Delete Folder?',
      `This will permanently delete "${client.name}" and all ${client.recordings?.length || 0} recordings inside it.\n\nThis also removes all audio files from cloud storage.\n\nThis action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => permanentDeleteClient(client.id),
        },
      ]
    );
  };

  const confirmDeleteRecording = (rec) => {
    Alert.alert(
      'Permanently Delete Recording?',
      `This will permanently delete this recording and remove the audio file from cloud storage.\n\nThis action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => permanentDeleteRecording(rec.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: isSmall ? 14 : 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Archive</Text>
          <Text style={styles.subtitle}>
            Archived items are disabled. You can restore or permanently delete them.
          </Text>
        </View>

        {archivedClients.length === 0 && archivedRecordings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trash-bin-outline" size={64} color="#E8E8ED" />
            <Text style={styles.emptyTitle}>Archive is empty</Text>
            <Text style={styles.emptySubtext}>Items you delete will show up here</Text>
          </View>
        ) : (
          <View>
            {/* Archived Folders */}
            {archivedClients.length > 0 && (
              <View style={styles.sectionMargin}>
                <Text style={styles.sectionHeader}>Archived Folders ({archivedClients.length})</Text>
                {archivedClients.map((client) => (
                  <View key={client.id} style={styles.card}>
                    <View style={styles.recordingLeft}>
                      <View style={[styles.folderIcon, { backgroundColor: client.color + '20' }]}>
                        <Ionicons name="folder" size={20} color={client.color} />
                      </View>
                      <View style={styles.recordingInfo}>
                        <Text style={styles.recordingTitle}>{client.name}</Text>
                        <Text style={styles.recordingMeta}>
                          {client.recordings ? client.recordings.length : 0} items inside
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={styles.restoreBtn} 
                        onPress={() => restoreClient(client.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh-circle" size={20} color="#4CAF50" />
                        <Text style={styles.restoreText}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => confirmDeleteClient(client)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Archived Recordings */}
            {archivedRecordings.length > 0 && (
              <View style={styles.sectionMargin}>
                <Text style={styles.sectionHeader}>Archived Audio ({archivedRecordings.length})</Text>
                {archivedRecordings.map((rec) => (
                  <View key={rec.id} style={styles.card}>
                    <View style={styles.recordingLeft}>
                      <View style={[styles.folderIcon, { backgroundColor: '#F8F9FE' }]}>
                        <Ionicons name="musical-notes" size={20} color="#8E8E93" />
                      </View>
                      <View style={styles.recordingInfo}>
                        <Text style={styles.recordingTitle} numberOfLines={1}>
                          {rec.title || 'Audio Recording'}
                        </Text>
                        <Text style={styles.recordingMeta}>
                          From: {rec.clientName} • {rec.duration}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={styles.restoreBtn} 
                        onPress={() => restoreRecording(rec.clientId, rec.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh-circle" size={20} color="#4CAF50" />
                        <Text style={styles.restoreText}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => confirmDeleteRecording(rec)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sectionMargin: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recordingInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  recordingMeta: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  restoreText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  deleteText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
  },
});
