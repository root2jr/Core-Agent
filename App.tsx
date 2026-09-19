import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const BACKEND_URL = 'https://performances-jpeg-wheel-evanescence.trycloudflare.com';
const MASTER_KEY = 'your-master-key-here'; // Replace or load via environment

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('IDLE');
  const [transcript, setTranscript] = useState('');

  useSpeechRecognitionEvent('result', async (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      setTranscript(text);
      if (event.isFinal) {
        await dispatchToAgent(text);
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setStatus('IDLE');
  });

  const toggleListening = async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      setStatus('IDLE');
      return;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setStatus('PERMISSION_DENIED');
      return;
    }

    setTranscript('');
    setStatus('LISTENING');
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US' });
  };

  const dispatchToAgent = async (commandText: string) => {
    setStatus('PROCESSING');
    try {
      const response = await fetch(`${BACKEND_URL}/agent/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-passcode': MASTER_KEY,
        },
        body: JSON.stringify({ transcript: commandText }),
      });

      const data = await response.json();
      setStatus('RESPONDING');

      if (data.text_response) {
        Speech.speak(data.text_response, { language: 'en', rate: 1.0 });
      }

      // If the action returned a link to the main core app, launch it
      if (data.deep_link) {
        const canOpen = await Linking.canOpenURL(data.deep_link);
        if (canOpen) {
          await Linking.openURL(data.deep_link);
        }
      }
    } catch {
      Speech.speak('Failed to execute command on Core.');
      setStatus('ERROR');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>VANTA DAEMON</Text>
      <Text style={styles.status}>STATUS: {status}</Text>

      <View style={styles.console}>
        <Text style={styles.consoleText}>
          {transcript ? `> ${transcript}` : '> Awaiting voice input...'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.micButton, isListening && styles.micButtonActive]}
        onPress={toggleListening}
        activeOpacity={0.8}
      >
        <Text style={styles.micButtonText}>
          {isListening ? 'HALT' : 'ENGAGE'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  status: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 24,
  },
  console: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    marginBottom: 32,
  },
  consoleText: {
    color: '#cccccc',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  micButton: {
    width: 140,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#ff4444',
  },
  micButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
});