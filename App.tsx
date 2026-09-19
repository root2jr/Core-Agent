import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Vibration,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const WAKE_WORD = 'jarvis'; // or 'core'

type AgentState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

export default function App() {
  const [state, setState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isArmed, setIsArmed] = useState(false);

  const log = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useSpeechRecognitionEvent('start', () => {
    setState('LISTENING');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const raw = event.results[0]?.transcript?.trim().toLowerCase();
    if (!raw) return;

    setTranscript(raw);

    if (event.isFinal) {
      log(`Heard: "${raw}"`);

      // Check for wake word prefix
      if (raw.startsWith(WAKE_WORD)) {
        Vibration.vibrate(60);
        const command = raw.replace(WAKE_WORD, '').trim();
        handleDetectedCommand(command || 'system status');
      } else {
        log(`Ignored (missing '${WAKE_WORD}' prefix)`);
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // If armed, automatically reopen the mic
    if (isArmed && state !== 'SPEAKING') {
      startListeningLoop();
    } else if (!isArmed) {
      setState('IDLE');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    log(`Recognition notice: ${event.message || event.error}`);
    if (isArmed && state !== 'SPEAKING') {
      setTimeout(() => startListeningLoop(), 500);
    }
  });

  const startListeningLoop = async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        log('Mic permission denied');
        setIsArmed(false);
        setState('IDLE');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: true,
        interimResults: true,
      });
    } catch (e: any) {
      log(`Loop restart error: ${e.message}`);
    }
  };

  const handleDetectedCommand = (command: string) => {
    setState('PROCESSING');
    log(`Executing Command: "${command}"`);

    // Temporarily halt mic while speaking feedback
    ExpoSpeechRecognitionModule.stop();

    setTimeout(() => {
      setState('SPEAKING');
      const response = `Acknowledged. Executing ${command}.`;
      log(`TTS: "${response}"`);

      Speech.speak(response, {
        language: 'en',
        rate: 1.1,
        onDone: () => {
          log('Ready for next command');
          if (isArmed) {
            startListeningLoop();
          } else {
            setState('IDLE');
          }
        },
      });
    }, 300);
  };

  const toggleArm = async () => {
    if (isArmed) {
      setIsArmed(false);
      ExpoSpeechRecognitionModule.stop();
      setState('IDLE');
      log('Daemon disarmed.');
    } else {
      setIsArmed(true);
      log(`Daemon armed. Listening continuously for "${WAKE_WORD} ..."`);
      startListeningLoop();
    }
  };

  const testDeepLink = async () => {
    const targetScheme = 'core://test?caller=agent';
    try {
      const canOpen = await Linking.canOpenURL(targetScheme);
      log(`Can open ${targetScheme}? ${canOpen}`);
      if (canOpen) await Linking.openURL(targetScheme);
    } catch (err: any) {
      log(`Link error: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CORE-AGENT</Text>
        <Text style={[styles.statePill, isArmed && styles.stateActive]}>
          {isArmed ? state : 'DISARMED'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>CONTINUOUS LISTENER</Text>
        <Text style={styles.cardContent}>
          {transcript ? `> ${transcript}` : `> Say "${WAKE_WORD} [command]"...`}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.btn, isArmed ? styles.btnStop : styles.btnPrimary]}
          onPress={toggleArm}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {isArmed ? 'DISARM DAEMON' : 'ARM CONTINUOUS MIC'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={testDeepLink} activeOpacity={0.8}>
          <Text style={styles.btnSecondaryText}>TEST LINK</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.logLabel}>SYSTEM LOGS</Text>
      <ScrollView style={styles.logBox} contentContainerStyle={{ paddingBottom: 20 }}>
        {logs.map((item, idx) => (
          <Text key={idx} style={styles.logItem}>
            {item}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statePill: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
  },
  stateActive: {
    color: '#00ff66',
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  cardContent: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  btn: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#ffffff',
  },
  btnStop: {
    backgroundColor: '#ff4444',
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  btnSecondaryText: {
    color: '#cccccc',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  logLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  logBox: {
    flex: 1,
    backgroundColor: '#050505',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
  },
  logItem: {
    color: '#888888',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 4,
  },
});