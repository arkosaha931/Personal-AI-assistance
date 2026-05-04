// src/hooks/useWakeWord.js - CONTINUOUS LISTENING VERSION
import { useState, useEffect, useRef } from 'react';

export const useWakeWord = () => {
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  const [isWaitingForCommand, setIsWaitingForCommand] = useState(false);
  const [recognitionState, setRecognitionState] = useState('idle');
  const [lastCommand, setLastCommand] = useState('');
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const retryCountRef = useRef(0);
  const commandTimeoutRef = useRef(null);
  const maxRetries = 3;

  const stopListening = () => {
    try {
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setIsWakeWordDetected(false);
      setIsWaitingForCommand(false);
      setRecognitionState('stopped');
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        mediaStreamRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      
      analyserRef.current = null;
      setVoiceLevel(0);
      console.log('🔇 Wake word listening stopped');
    } catch (error) {
      console.error('❌ Error stopping wake word listening:', error);
    }
  };

  const startVoiceLevelMonitoring = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const history = new Array(5).fill(0);
    
    const updateVoiceLevel = () => {
      if (!analyserRef.current || !isListening) {
        setVoiceLevel(0);
        return;
      }
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      let count = 0;
      const startFreq = 3;
      const endFreq = 30;
      
      for (let i = startFreq; i < endFreq && i < dataArray.length; i++) {
        if (dataArray[i] > 20) {
          sum += dataArray[i];
          count++;
        }
      }
      
      const average = count > 0 ? sum / count : 0;
      
      history.push(average);
      history.shift();
      const smoothed = history.reduce((a, b) => a + b, 0) / history.length;
      
      const normalizedLevel = Math.min(smoothed / 80, 1.2);
      setVoiceLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateVoiceLevel);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateVoiceLevel);
  };

  const setupAudioVisualization = async () => {
    try {
      if (audioContextRef.current) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      analyserRef.current.minDecibels = -60;
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);
      
      startVoiceLevelMonitoring();
      console.log('🎵 Audio visualization started');
    } catch (error) {
      console.log('🔇 Audio visualization not supported:', error);
    }
  };

  const initEnhancedRecognition = () => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;  // ✅ IMPORTANT: Continuous listening
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('🎯 Wake word recognition started - CONTINUOUS MODE');
      setIsListening(true);
      setRecognitionState('listening');
      retryCountRef.current = 0;
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        confidence = Math.max(confidence, result[0].confidence || 0.5);
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      transcriptRef.current = currentTranscript;

      console.log('🎯 Speech detected:', currentTranscript, 'Confidence:', confidence);

      if (currentTranscript.trim()) {
        const lowerTranscript = currentTranscript.toLowerCase().trim();
        
        const wakeWordPatterns = [
          { pattern: /\bshree\b/, score: 1.0 },
          { pattern: /\bshri\b/, score: 0.9 },
          { pattern: /\bsree\b/, score: 0.8 },
          { pattern: /\bshrey\b/, score: 0.7 },
          { pattern: /\bhey shree\b/, score: 1.0 },
          { pattern: /\bokay shree\b/, score: 1.0 },
          { pattern: /\bhello shree\b/, score: 1.0 },
          { pattern: /\bhi shree\b/, score: 1.0 }
        ];
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const { pattern, score } of wakeWordPatterns) {
          if (pattern.test(lowerTranscript)) {
            const matchScore = score * confidence;
            if (matchScore > bestScore) {
              bestScore = matchScore;
              bestMatch = pattern;
            }
          }
        }
        
        const detectionThreshold = 0.6;
        
        // 🚀 WAKE WORD DETECTED - BUT DON'T STOP LISTENING
        if (bestMatch && bestScore >= detectionThreshold && !isWaitingForCommand) {
          console.log('🚀 Wake word DETECTED! But continuing to listen...');
          
          setIsWakeWordDetected(true);
          setIsWaitingForCommand(true);
          
          // Set command timeout - but DON'T stop recognition
          commandTimeoutRef.current = setTimeout(() => {
            console.log('⏰ No command received, but continuing to listen for wake word...');
            setIsWaitingForCommand(false);
            setIsWakeWordDetected(false);
            setLastCommand('');
            
            if (commandTimeoutRef.current) {
              clearTimeout(commandTimeoutRef.current);
              commandTimeoutRef.current = null;
            }
            // 🛑 NO RESTART - CONTINUE LISTENING
          }, 5000); // Wait 5 seconds for command
          
          return;
        }
        
        // 🎯 COMMAND RECEIVED (after wake word)
        if (isWaitingForCommand && currentTranscript.trim()) {
          console.log('🎯 Command received:', currentTranscript);
          
          // Clear command timeout
          if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current);
            commandTimeoutRef.current = null;
          }
          
          // Store the command
          setLastCommand(currentTranscript.trim());
          
          // Reset states but KEEP LISTENING
          setIsWaitingForCommand(false);
          setIsWakeWordDetected(false);
          
          console.log('✅ Command captured, but continuing to listen for next wake word...');
          // 🛑 NO STOP LISTENING - CONTINUE FOR NEXT WAKE WORD
          
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      console.log('❌ Wake word recognition error:', event.error);
      
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
      
      switch (event.error) {
        case 'no-speech':
          console.log('🔇 No speech detected - but continuing to listen');
          break;
        case 'audio-capture':
          console.error('🎤 No microphone found');
          break;
        case 'not-allowed':
          console.error('🔒 Microphone permission denied');
          break;
        case 'network':
          console.error('🌐 Network error in speech recognition');
          break;
        default:
          console.error('💥 Unknown recognition error:', event.error);
      }

      // Auto-retry for certain errors
      if (['audio-capture', 'not-allowed', 'network'].includes(event.error) && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 Retrying wake word recognition (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => {
          if (!isWakeWordDetected) {
            stopListening();
            setTimeout(() => {
              startListening();
            }, 1000);
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      console.log('🔚 Wake word recognition ended - AUTO RESTARTING');
      setIsListening(false);
      setRecognitionState('ended');
      
      // Auto-restart if ended unexpectedly
      setTimeout(() => {
        if (!isWakeWordDetected && retryCountRef.current < maxRetries) {
          console.log('🔄 Auto-restarting wake word recognition');
          startListening();
        }
      }, 1000);
    };

    return recognition;
  };

  const startListening = () => {
    if (isListening) {
      console.log('⚠️ Wake word already listening');
      return;
    }
    
    try {
      recognitionRef.current = initEnhancedRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setupAudioVisualization();
        console.log('🔊 Wake word listening started - CONTINUOUS MODE');
      }
    } catch (error) {
      console.error('❌ Error starting wake word listening:', error);
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 Retrying start (${retryCountRef.current}/${maxRetries})`);
        setTimeout(startListening, 1000);
      }
    }
  };

  const restartListening = () => {
    console.log('🔄 Manual restart requested');
    stopListening();
    setTimeout(startListening, 500);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Initialize on mount
  useEffect(() => {
    const initializeWakeWord = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          console.log('🎯 Starting CONTINUOUS wake word detection...');
          startListening();
        } else {
          console.warn('❌ Speech Recognition not supported in this browser');
        }
      } catch (error) {
        console.error('🔒 Microphone permission denied or not available:', error);
      }
    };

    initializeWakeWord();

    return () => {
      console.log('🧹 Cleaning up wake word detection');
      stopListening();
    };
  }, []);

  return {
    // State
    isListening,
    isWakeWordDetected,
    isWaitingForCommand,
    voiceLevel,
    recognitionState,
    lastCommand,
    
    // Controls
    startListening,
    stopListening,
    restartListening,
    toggleListening,
    
    // Capabilities
    browserSupportsSpeechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    isAudioSupported: !!audioContextRef.current,
    
    // Wake word info
    wakeWord: 'Shree',
    retryCount: retryCountRef.current,
    maxRetries
  };
};

export default useWakeWord;