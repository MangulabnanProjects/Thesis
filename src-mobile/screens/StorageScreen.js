import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useClientContext } from '../context/ClientContext';

function ClientFolder({ client, isOpen, onToggle, onPlayRecording, onArchiveClient, onArchiveRecording }) {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Only show active recordings, sorted latest first
  const activeRecordings = client.recordings
    ? client.recordings
        .filter(r => !r.archivedAt)
        .sort((a, b) => (b.id || '').localeCompare(a.id || ''))
    : [];

  // Total count for numbering (oldest = 1, newest = highest)
  const totalActive = activeRecordings.length;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedHeight, {
        toValue: isOpen ? 1 : 0,
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }),
      Animated.spring(rotateAnim, {
        toValue: isOpen ? 1 : 0,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
    ]).start();
  }, [isOpen]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, activeRecordings.length * 76 + 60],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const opacity = animatedHeight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.4, 1],
  });

  return (
    <View style={styles.folderContainer}>
      <TouchableOpacity
        style={[
          styles.folderHeader,
          isOpen && { backgroundColor: client.color + '12' },
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.folderLeft}>
          <View style={[styles.folderIcon, { backgroundColor: client.color + '20' }]}>
            <Ionicons
              name={isOpen ? 'folder-open' : 'folder'}
              size={22}
              color={client.color}
            />
          </View>
          <View>
            <Text style={styles.folderName}>{client.name}</Text>
            <Text style={styles.folderCount}>
              {activeRecordings.length} recording
              {activeRecordings.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={(e) => { e.stopPropagation(); onArchiveClient(client.id); }}
            style={{ padding: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.recordingsList,
          { maxHeight, opacity, overflow: 'hidden' },
        ]}
      >
        {activeRecordings.map((rec, idx) => {
          // Number: oldest = 1, newest = highest (reverse of display order)
          const recNumber = totalActive - idx;
          return (
            <View key={rec.id} style={styles.recordingItem}>
              <View style={styles.recordingLeft}>
                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: client.color + '15' }]}
                  onPress={() => onPlayRecording(rec)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="play" size={14} color={client.color} />
                </TouchableOpacity>
                <View style={styles.recordingInfo}>
                  <Text style={styles.recordingTitle} numberOfLines={1}>
                    Audio Recording {recNumber}
                  </Text>
                  <Text style={styles.recordingMeta}>
                    {rec.date} • {rec.duration}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => onArchiveRecording(client.id, rec.id)}>
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity 
          style={styles.newRecordingBtn} 
          onPress={() => onPlayRecording({ isNew: true, clientId: client.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="mic" size={16} color="#4CAF50" />
          <Text style={styles.newRecordingText}>New Recording</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

export default function StorageScreen() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const [openFolderId, setOpenFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const { clients, setActiveClient, archiveClient, archiveRecording } = useClientContext();

  const handleToggle = useCallback((clientId) => {
    setOpenFolderId((prev) => {
      const isOpening = prev !== clientId;
      if (isOpening) {
        setActiveClient(clientId);
        return clientId;
      }
      return null;
    });
  }, [setActiveClient]);

  const handlePlayRecording = useCallback(
    (recording) => {
      if (recording.isNew) {
        setActiveClient(recording.clientId);
        navigation.navigate('Recording');
      } else {
        // Pass the recording ID so RoomScreen can find it in ClientContext
        // The audio URI stored in the recording points to MinIO cloud
        navigation.navigate('Room', { recordingId: recording.id, autoPlay: true });
      }
    },
    [navigation, setActiveClient]
  );

  // Filter clients by search query and remove archived
  const filteredClients = useMemo(() => {
    const list = clients.filter(c => !c.archivedAt);
    if (!searchQuery.trim()) return list;
    
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (client) => {
        const activeRecs = client.recordings ? client.recordings.filter(r => !r.archivedAt) : [];
        return client.name.toLowerCase().includes(q) ||
          activeRecs.some((r) => r.title && r.title.toLowerCase().includes(q));
      }
    );
  }, [clients, searchQuery]);

  const totalRecordings = filteredClients.reduce(
    (sum, c) => sum + (c.recordings ? c.recordings.filter(r => !r.archivedAt).length : 0),
    0
  );

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Storage</Text>
          <Text style={styles.subtitle}>
            {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} •{' '}
            {totalRecordings} recording{totalRecordings !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#C7C7CC" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients or recordings..."
            placeholderTextColor="#C7C7CC"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          )}
        </View>

        {/* Client Folders */}
        {filteredClients.length > 0 ? (
          filteredClients.map((client) => (
            <ClientFolder
              key={client.id}
              client={client}
              isOpen={openFolderId === client.id}
              onToggle={() => handleToggle(client.id)}
              onPlayRecording={handlePlayRecording}
              onArchiveClient={archiveClient}
              onArchiveRecording={archiveRecording}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#D1D1D6" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try searching with a different name
            </Text>
          </View>
        )}

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
    marginBottom: 20,
  },
  title: {
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 0,
    gap: 10,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
    paddingVertical: 0,
  },
  folderContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  folderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  folderCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  recordingsList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  recordingMeta: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  moreBtn: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#8E8E93',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
  },
  newRecordingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF5030',
  },
  newRecordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
});
