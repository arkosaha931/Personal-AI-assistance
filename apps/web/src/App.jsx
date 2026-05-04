// src/App.jsx - COMPLETELY FIXED VERSION
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import AIVoiceAssistant from "./components/AIVoiceAssistant";
import { PersonalityContext } from "./contexts/PersonalityContext";
import { MemoryContext } from "./contexts/MemoryContext";
import { useWakeWord } from "./hooks/useWakeWord";

/* ---------- Lang & TTS helpers ---------- */
const LANGS = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' }
];

function speak(text, voice, rate = 1) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

/* ---------- Tiny utils ---------- */
const CYAN = '#38E1FF';
const hexA = (hex, a=1) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/* ---------- Icons (inline SVGs) ---------- */
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const IconMic = ({filled}) => filled ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0" /></svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="2"/><path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2"/><path d="M12 19v3" stroke="currentColor" strokeWidth="2"/></svg>
);
const IconBars = ({active=false}) => (
  <div style={{display:'inline-flex', gap:2, alignItems:'end', height:16}}>
    {[6,10,14,10,6].map((h,i)=>(
      <span key={i} style={{
        width:2, height:h, background:'currentColor', borderRadius:2,
        opacity: active ? 1 : 0.5,
        animation: active ? `bar${i} 1s ease-in-out ${i*0.06}s infinite` : 'none'
      }}/>
    ))}
    <style>{`
      @keyframes bar0 { 0%,100%{height:6px} 50%{height:14px} }
      @keyframes bar1 { 0%,100%{height:10px} 50%{height:16px} }
      @keyframes bar2 { 0%,100%{height:14px} 50%{height:6px} }
      @keyframes bar3 { 0%,100%{height:10px} 50%{height:16px} }
      @keyframes bar4 { 0%,100%{height:6px} 50%{height:14px} }
    `}</style>
  </div>
);
const IconGlobe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="2"/></svg>
);
const IconVoice = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 10v4c0 3 2 5 5 5h6c3 0 5-2 5-5v-4" stroke="currentColor" strokeWidth="2"/><path d="M8 10c0-2 1-4 4-4s4 2 4 4v4c0 2-1 4-4 4s-4-2-4-4v-4z" stroke="currentColor" strokeWidth="2"/></svg>
);

function typoNormalize(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text.trim();
  const map = [
    [/whats/gi, "what is"],
    [/pls/gi, "please"],
    [/u\b/gi, "you"],
    [/r u/gi, "are you"],
    [/shreee+/gi, "shree"],
    [/shri\b/gi, "shree"],
    [/dont/gi, "don't"],
    [/cant/gi, "can't"]
  ];
  for (const [pat, rep] of map) s = s.replace(pat, rep);
  s = s.replace(/\s+/g, ' ');
  return s;
}

const createMemoryApi = (apiBase = '/api') => {
  async function _fetchJson(path, opts) {
    try {
      const res = await fetch(`${apiBase}${path}`, opts);
      if (!res.ok) throw new Error('network error');
      return await res.json();
    } catch (e) {
      throw e;
    }
  }

  async function save(key, value, type = 'short') {
    try {
      const payload = { key, value, type };
      const json = await _fetchJson(`/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: true, server: true, data: json };
    } catch (e) {
      try {
        const store = JSON.parse(localStorage.getItem('shree_memory') || '{}');
        store[key] = { value, type, createdAt: new Date().toISOString() };
        localStorage.setItem('shree_memory', JSON.stringify(store));
        return { ok: true, server: false };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }
  }

  async function get(key) {
    try {
      const json = await _fetchJson(`/memory/get?key=${encodeURIComponent(key)}`);
      return { ok: true, server: true, data: json };
    } catch (e) {
      try {
        const store = JSON.parse(localStorage.getItem('shree_memory') || '{}');
        return { ok: true, server: false, data: store[key] ?? null };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }
  }

  async function all() {
    try {
      const json = await _fetchJson(`/memory/all`);
      return { ok: true, server: true, data: json.items || [] };
    } catch (e) {
      try {
        const store = JSON.parse(localStorage.getItem('shree_memory') || '{}');
        const items = Object.entries(store).map(([k,v]) => ({ key: k, ...v }));
        items.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
        return { ok: true, server: false, data: items };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }
  }

  async function del(key) {
    try {
      const json = await _fetchJson(`/memory/delete`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ key })
      });
      return { ok: true, server: true, data: json };
    } catch (e) {
      try {
        const store = JSON.parse(localStorage.getItem('shree_memory') || '{}');
        delete store[key];
        localStorage.setItem('shree_memory', JSON.stringify(store));
        return { ok: true, server: false };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }
  }

  return { save, get, all, del };
};

async function fetchWithTimeout(resource, init = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;
  try {
    const resp = await fetch(resource, init);
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ---------- App ---------- */
export default function App() {
  // settings
  const [lang, setLang] = useState('en-IN');
  const [voices, setVoices] = useState([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const rate = 1;

  // conversation
  const [history, setHistory] = useState([]);
  const [typing, setTyping] = useState(false);

  // ui states
  const [uiState, setUiState] = useState('idle');
  const [toast, setToast] = useState(null);

  // dropdown states
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Manual speech recognition state
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  // ✅ FIXED: Wake Word Hook with all states
  const { 
    isWakeWordDetected, 
    isWaitingForCommand,
    lastCommand,
    voiceLevel, 
    startListening: startWakeWord, 
    stopListening: stopWakeWord,
    recognitionState
  } = useWakeWord();

  const chatRef = useRef(null);
  const firstTokenSeenRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const headerVisibleRef = useRef(true);
  const [headerVisible, setHeaderVisible] = useState(true);

  /* ---------- FIXED: Wake Word Detection Handler ---------- */
  useEffect(() => {
    console.log('=== WAKE WORD STATUS ===', {
      isWakeWordDetected,
      isWaitingForCommand, 
      lastCommand,
      recognitionState
    });

    // 🚀 Wake word detected
    if (isWakeWordDetected) {
      console.log('🚀 Wake word DETECTED! Waiting for command...');
      setToast('🎯 Wake word detected! Say your command...');
      setUiState('wake-word-detected');
    }

    // 🎯 Waiting for command
    if (isWaitingForCommand) {
      console.log('⏳ Waiting for command...');
      setToast('🎤 Listening for command...');
      setUiState('listening');
    }

    // ✅ Command received from wake word
    if (lastCommand && lastCommand.trim()) {
      console.log('🎯 Command received from wake word:', lastCommand);
      setToast(`✅ Command: ${lastCommand}`);
      handleCommand(lastCommand);
    }

  }, [isWakeWordDetected, isWaitingForCommand, lastCommand, recognitionState]);

  /* ---------- Personality config ---------- */
  const DEFAULT_PRESETS = useMemo(() => ([
    { id: 'friendly', name: 'Friendly', description: 'Warm, casual, uses emojis sparingly', config: { tone: 'warm', emoji: true } },
    { id: 'formal', name: 'Formal', description: 'Polite and precise', config: { tone: 'formal', emoji: false } },
    { id: 'witty', name: 'Witty', description: 'Playful and concise', config: { tone: 'witty', emoji: true } }
  ]), []);

  const [personality, setPersonality] = useState(DEFAULT_PRESETS[0]);
  const shortTermBufferRef = useRef([]);
  const SHORT_TERM_LIMIT = 6;

  const addToShortTerm = useCallback((who, text) => {
    const normalized = typoNormalize(String(text || ''));
    const item = { who, text: normalized, ts: new Date().toISOString() };
    
    shortTermBufferRef.current = shortTermBufferRef.current.filter(
      existing => !(existing.text === normalized && existing.who === who)
    );
    
    shortTermBufferRef.current.push(item);
    if (shortTermBufferRef.current.length > SHORT_TERM_LIMIT) shortTermBufferRef.current.shift();
    return item;
  }, []);

  const getShortTerm = useCallback(() => {
    return [...shortTermBufferRef.current];
  }, []);

  const memoryApi = useMemo(() => createMemoryApi('/api'), []);

  useEffect(() => {
    window.SHREE_API = {
      ...(window.SHREE_API || {}),
      setPersonality: (presetId) => {
        const p = DEFAULT_PRESETS.find(x => x.id === presetId);
        if (p) setPersonality(p);
        return p ?? null;
      },
      getPersonality: () => personality,
      getPersonalityPresets: () => DEFAULT_PRESETS,
      typoNormalize,
      addShortTerm: addToShortTerm,
      getShortTerm,
      memory: {
        save: memoryApi.save,
        get: memoryApi.get,
        all: memoryApi.all,
        del: memoryApi.del
      }
    };
    return () => { delete window.SHREE_API; };
  }, [DEFAULT_PRESETS, personality, addToShortTerm, getShortTerm, memoryApi]);

  /* voices load */
  useEffect(() => {
    const load = () => setVoices(typeof window !== 'undefined' ? window.speechSynthesis?.getVoices() || [] : []);
    load();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);
  
  useEffect(() => {
    if (!voices.length) return;
    const idx = voices.findIndex(v => /(female|zira|neerja|heera|asha|sara|india|google)/i.test(v.name));
    if (idx >= 0) setVoiceIndex(idx);
  }, [voices]);

  /* ---------- Enhanced Main Speech Recognition ---------- */
  const initEnhancedMainRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      showToast('Speech recognition not supported in your browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 3;
    recognition.continuous = true;

    if (typeof window.webkitSpeechRecognition !== 'undefined') {
      recognition.continuous = true;
      recognition.interimResults = true;
    }

    let silenceTimeout = null;
    const MAX_SILENCE = 5000;

    recognition.onstart = () => {
      console.log('🎤 Main recognition started');
      setListening(true);
      setUiState('listening');
      setTranscript('');
    };

    recognition.onresult = (event) => {
      if (silenceTimeout) clearTimeout(silenceTimeout);
      
      let finalTranscript = '';
      let interimTranscript = '';
      let highestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.5;
        highestConfidence = Math.max(highestConfidence, confidence);
        
        if (result.isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript.trim() || interimTranscript;
      
      console.log('💬 Main recognition:', currentTranscript, 
                  'Confidence:', highestConfidence.toFixed(2),
                  finalTranscript ? '(FINAL)' : '(INTERIM)');

      setTranscript(currentTranscript);

      if (highestConfidence > 0.3 || interimTranscript) {
        setHistory(h => {
          const arr = h.filter(msg => !msg.isPartial);
          return [...arr, { 
            who: 'me', 
            text: currentTranscript, 
            isPartial: true,
            confidence: highestConfidence 
          }];
        });
      }

      silenceTimeout = setTimeout(() => {
        console.log('⏰ Silence timeout - stopping recognition');
        if (currentTranscript.trim()) {
          handleCommand(currentTranscript.trim());
        }
        stopMainListening();
      }, MAX_SILENCE);
    };

    recognition.onend = () => {
      console.log('🔚 Main recognition ended');
      if (silenceTimeout) clearTimeout(silenceTimeout);
      setListening(false);
      setUiState('idle');
      
      if (transcript.trim()) {
        console.log('📝 Processing final transcript:', transcript);
        handleCommand(transcript.trim());
        setTranscript('');
      }
      
      console.log('🔄 Restarting wake word listening');
      startWakeWord();
    };

    recognition.onerror = (event) => {
      console.log('❌ Main recognition error:', event.error);
      if (silenceTimeout) clearTimeout(silenceTimeout);
      
      setListening(false);
      setUiState('idle');
      
      switch (event.error) {
        case 'no-speech':
          showToast('No speech detected');
          break;
        case 'audio-capture':
          showToast('No microphone found');
          break;
        case 'not-allowed':
          showToast('Microphone permission denied');
          break;
        default:
          showToast('Speech recognition error');
      }
      
      console.log('🔄 Restarting wake word after error');
      startWakeWord();
    };

    recognition.onnomatch = () => {
      console.log('🔍 No speech match found');
      showToast('Could not understand speech');
    };

    return recognition;
  }, [lang, transcript, startWakeWord]);

  const startMainListening = useCallback(() => {
    console.log('🎤 Starting enhanced main recognition...');
    
    if (listening) {
      console.log('⚠️ Main recognition already active');
      return;
    }
    
    try {
      stopWakeWord();
      
      recognitionRef.current = initEnhancedMainRecognition();
      if (recognitionRef.current) {
        setTimeout(() => {
          recognitionRef.current.start();
          console.log('✅ Enhanced main recognition started successfully');
          showToast('Listening... Speak now');
        }, 300);
      } else {
        console.error('❌ Failed to initialize main recognition');
        showToast('Failed to start voice recognition');
        startWakeWord();
      }
    } catch (error) {
      console.error('❌ Error starting enhanced main recognition:', error);
      showToast('Error starting microphone');
      startWakeWord();
    }
  }, [listening, initEnhancedMainRecognition, stopWakeWord, startWakeWord]);

  const stopMainListening = useCallback(() => {
    console.log('🛑 Stopping enhanced main recognition...');
    
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setListening(false);
      setUiState('idle');
      
      setTimeout(() => {
        startWakeWord();
        console.log('🔄 Wake word listening restarted');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error stopping main recognition:', error);
    }
  }, [startWakeWord]);

  /* smarter autoscroll */
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    const THRESHOLD = 160;
    if (!userScrolledUpRef.current && distanceFromBottom < THRESHOLD) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else if (!userScrolledUpRef.current && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [history]);

  // watch user scroll
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      userScrolledUpRef.current = distanceFromBottom > 200;

      if (el.scrollTop <= 8) {
        if (headerVisibleRef.current) {
          headerVisibleRef.current = false;
          setHeaderVisible(false);
        }
      } else {
        if (!headerVisibleRef.current) {
          headerVisibleRef.current = true;
          setHeaderVisible(true);
        }
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  /* Smart auto-hide scrollbar effect */
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;

    let hideTimer = null;
    let scrollEndTimer = null;
    let isScrolling = false;

    function showScrollbar() {
      el.classList.remove('smart-scrollbar-hide');
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function hideScrollbar() {
      el.classList.add('smart-scrollbar-hide');
    }

    function handleScroll() {
      showScrollbar();
      isScrolling = true;

      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
        scrollEndTimer = null;
      }

      scrollEndTimer = setTimeout(() => {
        isScrolling = false;
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        hideTimer = setTimeout(() => {
          hideScrollbar();
          hideTimer = null;
        }, 500);
        scrollEndTimer = null;
      }, 150);
    }

    function handleMouseEnter() {
      showScrollbar();
    }

    function handleMouseLeave() {
      if (isScrolling) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      hideTimer = setTimeout(() => {
        hideScrollbar();
        hideTimer = null;
      }, 500);
    }

    el.classList.add('smart-scrollbar-hide');
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 2200); };

  /* ---------- FIXED handleCommand ---------- */
  async function handleCommand(text) {
    console.log('🚀 Sending command:', text);
    
    setHistory(h => h.filter(msg => !msg.isPartial));
    setHistory(h => [...h, { who: 'me', text }]);
    addToShortTerm('me', text);

    setTyping(true);
    setUiState('thinking');
    firstTokenSeenRef.current = false;

    let botText = '';
    let finalObj = null;

    const context = getShortTerm().filter((item, index, self) => 
      index === self.findIndex(i => i.text === item.text && i.who === item.who)
    );

    const MAX_RETRIES = 1;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      attempt += 1;
      let resp = null;
      let reader = null;
      const TIMEOUT_MS = 120000;

      try {
        console.log('📡 Calling server... attempt', attempt);
        resp = await fetchWithTimeout('http://localhost:5050/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, context })
        }, TIMEOUT_MS);

        console.log('✅ Server response status:', resp.status);

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '<no body>');
          throw new Error(`Server error: ${resp.status} ${txt}`);
        }

        reader = resp.body.getReader();
        const decoder = new TextDecoder();

        setHistory(h => [...h, { who: 'bot', text: '' }]);

        let cancelled = false;

        while (true) {
          let readResult;
          try {
            readResult = await reader.read();
          } catch (readErr) {
            console.warn('Reader read error:', readErr);
            throw readErr;
          }

          const { done, value } = readResult;
          if (done) {
            console.log('reader done');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          const lines = chunk.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length === 0) continue;

          for (const rawLine of lines) {
            if (rawLine === ':' || rawLine === ':\r' || rawLine === '\r') continue;

            if (rawLine.startsWith('event:')) {
              if (rawLine.includes('done')) {
                console.log('🏁 event: done received');
              }
              continue;
            }

            if (rawLine.startsWith('data:')) {
              const payloadStr = rawLine.slice(5).trim();
              try {
                const parsed = JSON.parse(payloadStr);

                if (typeof parsed === 'string') {
                  botText += parsed;
                  setHistory(h => {
                    const arr = [...h];
                    if (arr.length && arr[arr.length - 1].who === 'bot') {
                      arr[arr.length - 1].text = botText;
                    }
                    return arr;
                  });
                  if (!firstTokenSeenRef.current) {
                    firstTokenSeenRef.current = true;
                    setUiState('speaking');
                  }
                } else if (parsed.reply) {
                  finalObj = parsed;
                  console.log('🎯 Final object received:', parsed);
                } else if (parsed.message && parsed.message.content) {
                  botText += parsed.message.content;
                  setHistory(h => {
                    const arr = [...h];
                    if (arr.length && arr[arr.length - 1].who === 'bot') {
                      arr[arr.length - 1].text = botText;
                    }
                    return arr;
                  });
                  if (!firstTokenSeenRef.current) {
                    firstTokenSeenRef.current = true;
                    setUiState('speaking');
                  }
                } else if (parsed.response) {
                  botText += parsed.response;
                  setHistory(h => {
                    const arr = [...h];
                    if (arr.length && arr[arr.length - 1].who === 'bot') {
                      arr[arr.length - 1].text = botText;
                    }
                    return arr;
                  });
                  if (!firstTokenSeenRef.current) {
                    firstTokenSeenRef.current = true;
                    setUiState('speaking');
                  }
                }
              } catch (parseErr) {
                const payload = payloadStr;
                botText += payload;
                setHistory(h => {
                  const arr = [...h];
                    if (arr.length && arr[arr.length - 1].who === 'bot') {
                      arr[arr.length - 1].text = botText;
                    }
                  return arr;
                });
                if (!firstTokenSeenRef.current) {
                  firstTokenSeenRef.current = true;
                  setUiState('speaking');
                }
              }
            } else {
              botText += rawLine;
              setHistory(h => {
                const arr = [...h];
                if (arr.length && arr[arr.length - 1].who === 'bot') {
                  arr[arr.length - 1].text = botText;
                }
                return arr;
              });
            }
          }
        }

        setTyping(false);
        const v = voices[voiceIndex];
        const finalText = finalObj?.reply || botText || "Hello! I'm Shree, your AI assistant.";

        addToShortTerm('bot', finalText);

        setHistory(h => {
          const arr = [...h];
          if (arr.length && arr[arr.length - 1].who === 'bot') {
            arr[arr.length - 1] = { ...arr[arr.length - 1], text: finalText, intent: finalObj?.intent || null };
          }
          return arr;
        });

        setTimeout(() => {
          const el = chatRef.current;
          if (!el) return;
          const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
          const THRESHOLD = 160;
          if (!userScrolledUpRef.current && distanceFromBottom < THRESHOLD) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }
        }, 100);

        speak(finalText, v, rate);

        if (finalObj) {
          const { intent, target } = finalObj;
          if (intent === 'open_url' && target) {
            const url = String(target).startsWith('http') ? target : `https://${target}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            showToast('Opening link…');
          }
          if (intent === 'timer' && target) {
            const ms = Number(target) * 1000;
            showToast('Timer set ⏱️');
            setTimeout(() => speak('Timer done!', voices[voiceIndex], rate), ms);
          }
          if (finalObj.intent === 'remember' && finalObj.memoryKey && finalObj.memoryValue) {
            memoryApi.save(finalObj.memoryKey, finalObj.memoryValue, finalObj.memoryType || 'short')
              .then(() => showToast('Saved to memory'))
              .catch(() => showToast('Memory save failed'));
          }
        }

        break;

      } catch (err) {
        console.error('❌ Stream attempt error:', err);

        const isAbort = err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('reset');

        try { if (reader) await reader.cancel(); } catch (e) {}
        try { if (resp && resp.body) resp.body.cancel && resp.body.cancel(); } catch (e) {}

        if (attempt <= MAX_RETRIES && isAbort) {
          console.log('Retrying stream (attempt)', attempt + 1);
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        setTyping(false);
        setUiState('idle');
        showToast('Connection error');

        setHistory(h => [...h, {
          who: 'bot',
          text: 'Sorry, I encountered an error. Please try again.'
        }]);
        break;
      } finally {
        try { if (reader) await reader.releaseLock?.(); } catch (e) {}
      }
    }

    if (!listening) setUiState('idle');
  }

  function onSend(e) {
    e.preventDefault();
    const form = e.target;
    const input = form.msg || form.querySelector && form.querySelector('input[name="msg"]');
    const text = (input && input.value || '').trim();
    if (!text) return;
    if (input) input.value = '';
    handleCommand(text);
  }

  const toggleVoiceDropdown = () => setShowVoiceDropdown(v => !v);
  const toggleLangDropdown = () => setShowLangDropdown(v => !v);
  const selectVoice = (idx) => { setVoiceIndex(idx); setShowVoiceDropdown(false); showToast(`Voice selected: ${voices[idx]?.name || 'Voice'}`); };
  const selectLang = (code) => { setLang(code); setShowLangDropdown(false); showToast(`Language: ${LANGS.find(l=>l.code===code)?.label}`); };

  /* ---------- Render ---------- */
  return (
    <PersonalityContext.Provider value={{ personality, setPersonality, presets: DEFAULT_PRESETS }}>
      <MemoryContext.Provider value={{ memoryApi, save: memoryApi.save, get: memoryApi.get, all: memoryApi.all, del: memoryApi.del }}>
        <div style={{
          minHeight:'100vh',
          background:'linear-gradient(180deg, #0A0F1A 0%, #0E1B2E 100%)',
          color:'#F5FAFF',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* FIXED Top bar */}
          <div style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(1280px, 96%)',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            transition: 'opacity 220ms ease, transform 220ms ease',
            opacity: headerVisible ? 1 : 0,
            pointerEvents: 'auto'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:CYAN, boxShadow:`0 0 12px ${CYAN}`}}/>
              <div style={{fontWeight:600, letterSpacing:.2}}>Shree — AI Assistant</div>
            </div>

            {/* Wake Word Status */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{
                padding: '6px 12px',
                borderRadius: 20,
                background: isWakeWordDetected ? hexA(CYAN, 0.2) : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isWakeWordDetected ? CYAN : 'rgba(255,255,255,0.06)'}`,
                fontSize: 12,
                color: isWakeWordDetected ? CYAN : '#F5FAFF',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isWakeWordDetected ? CYAN : '#666',
                  animation: isWakeWordDetected ? 'pulse 1.5s infinite' : 'none'
                }}></span>
                Wake Word: {isWakeWordDetected ? 'Detected!' : 'Listening...'}
              </div>

              {/* Icons: Lang + Voice */}
              <div style={{display:'flex',alignItems:'center',gap:12, position:'relative'}}>
                {/* Language selector */}
                <div style={{ position:'relative' }}>
                  <button onClick={toggleLangDropdown} aria-haspopup="true" aria-expanded={showLangDropdown} style={iconTopBtn()}>
                    <IconGlobe/>
                  </button>
                  {showLangDropdown && (
                    <div role="menu" tabIndex={-1} style={dropdownStyle}>
                      {LANGS.map(l=>(
                        <div key={l.code} role="menuitem" tabIndex={0}
                             onClick={()=>selectLang(l.code)}
                             onKeyDown={(e)=>{ if(e.key==='Enter') selectLang(l.code); }}
                             style={dropdownItemStyle}>
                          {l.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voice selector */}
                <div style={{ position:'relative' }}>
                  <button onClick={toggleVoiceDropdown} aria-haspopup="true" aria-expanded={showVoiceDropdown} style={iconTopBtn()}>
                    <IconVoice/>
                  </button>
                  {showVoiceDropdown && (
                    <div role="menu" tabIndex={-1} style={dropdownStyle}>
                      {voices.length ? voices.map((v,i)=>(
                        <div key={v.name+i} role="menuitem" tabIndex={0}
                             onClick={()=>selectVoice(i)}
                             onKeyDown={(e)=>{ if(e.key==='Enter') selectVoice(i); }}
                             style={dropdownItemStyle}>
                          {v.name}
                        </div>
                      )) : <div style={dropdownEmptyStyle}>No voices available</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AIVoiceAssistant with FIXED props */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none'
          }}>
            <AIVoiceAssistant
              uiState={uiState}
              listening={listening || isWaitingForCommand} // FIXED
              speaking={uiState === 'speaking'}
              thinking={uiState === 'thinking'}
              isListening={listening || isWaitingForCommand} // FIXED
              voiceLevel={voiceLevel}
              isWakeWordDetected={isWakeWordDetected}
              isWaitingForCommand={isWaitingForCommand} // NEW prop
            />
          </div>

          {/* Smart scrollbar styles */}
          <style>{`
            #chatTimeline::-webkit-scrollbar {
              width: 6px;
              transition: opacity 0.4s ease;
            }
            #chatTimeline::-webkit-scrollbar-track {
              background: transparent;
            }
            #chatTimeline::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.12);
              border-radius: 999px;
              border: 1px solid rgba(255,255,255,0.02);
              transition: background 0.3s ease;
            }
            #chatTimeline.smart-scrollbar-hide::-webkit-scrollbar-thumb {
              background: transparent;
            }
            #chatTimeline {
              scrollbar-width: thin;
              scrollbar-color: rgba(255,255,255,0.12) transparent;
            }
            #chatTimeline.smart-scrollbar-hide {
              scrollbar-color: transparent transparent;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>

          {/* Chat timeline */}
          <div
            id="chatTimeline"
            ref={chatRef}
            style={{
              position: 'absolute',
              top: '76px',
              bottom: '120px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              width: 'min(1400px, 96%)',
              margin: '0 auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarGutter: 'stable both-edges',
              transition: 'scrollbar-color 0.3s ease'
            }}
          >
            {history.map((m, i) => (
              <div key={i} style={m.who === 'me' ? msgRight() : msgLeft()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}>{m.text}</span>
                  {m.who !== 'me' && m.intent && (
                    <span
                      style={{
                        border: `1px solid ${hexA(CYAN, 0.5)}`,
                        background: hexA(CYAN, 0.10),
                        color: '#A7B7CC',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        marginTop: '4px'
                      }}
                    >
                      {String(m.intent).replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div style={msgLeft()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: CYAN,
                    animation: 'pulse 1.5s infinite'
                  }}></div>
                  <span style={{ opacity: 0.8 }}>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Pill input bar */}
          <form onSubmit={onSend} style={{
            position:'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 18,
            zIndex: 50,
            width: 'min(800px, 94%)',
            padding: 12,
            pointerEvents: 'auto'
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap:12,
              borderRadius:999, padding:'10px 14px',
              background:'rgba(255,255,255,0.04)',
              border:`1px solid ${hexA('#ffffff',0.08)}`
            }}>
              {/* + icon */}
              <button type="button" title="More" style={iconInsideBtn()}>
                <IconPlus/>
              </button>

              {/* Text input */}
              <input name="msg" placeholder="Ask anything or say 'Shree'" autoComplete="off"
                     style={{
                       flex:1, background:'transparent', border:'none',
                       color:'#F5FAFF', outline:'none', fontSize:15,
                       pointerEvents: 'auto'
                     }}/>

              {/* Mic toggle */}
              {!listening ? (
                <button type="button" onClick={startMainListening} title="Start voice" style={iconInsideBtn()}>
                  <IconMic filled={false}/>
                </button>
              ) : (
                <button type="button" onClick={stopMainListening} title="Stop" style={iconInsideBtn()}>
                  <IconMic filled={true}/>
                </button>
              )}

              {/* Levels with Wake Word Integration */}
              <span title={listening ? 'Listening…' : 'Idle'} style={{color:'#F5FAFF', opacity: listening?1:0.6}}>
                <IconBars active={listening || isWakeWordDetected || isWaitingForCommand}/>
              </span>
            </div>
          </form>

          {/* Toast */}
          {toast && (
            <div style={{
              position:'fixed',
              right:16,
              bottom:110,
              background:'rgba(0,0,0,0.55)',
              border:`1px solid ${hexA(CYAN,0.45)}`,
              color:'#F5FAFF',
              padding:'10px 12px',
              borderRadius:12,
              zIndex: 60
            }}>
              {toast}
            </div>
          )}

          {/* DEBUG OVERLAY - Remove this after testing */}
          <div style={{
            position: 'fixed',
            top: '60px',
            left: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            zIndex: 10000,
            fontSize: '12px',
            borderRadius: '8px',
            border: '1px solid #38E1FF'
          }}>
            <div><strong>DEBUG INFO:</strong></div>
            <div>Wake Detected: {isWakeWordDetected ? '✅' : '❌'}</div>
            <div>Waiting Command: {isWaitingForCommand ? '✅' : '❌'}</div>
            <div>Last Command: {lastCommand || 'None'}</div>
            <div>UI State: {uiState}</div>
            <div>Voice Level: {voiceLevel.toFixed(2)}</div>
          </div>
        </div>
      </MemoryContext.Provider>
    </PersonalityContext.Provider>
  );
}

/* ---------- inline styles ---------- */
function iconTopBtn(){ return {
  width:36, height:36, display:'grid', placeItems:'center',
  borderRadius:10, cursor:'pointer',
  color:'#F5FAFF', background:'rgba(255,255,255,0.04)',
  border:'1px solid rgba(255,255,255,0.06)',
  pointerEvents: 'auto'
};}
function iconInsideBtn(){ return {
  width:34, height:34, display:'grid', placeItems:'center',
  borderRadius:999, cursor:'pointer',
  color:'#F5FAFF', background:'rgba(255,255,255,0.06)',
  border:`1px solid ${hexA(CYAN,0.20)}`,
  pointerEvents: 'auto'
};}
function msgLeft(){
  return {
    alignSelf: 'flex-start',
    textAlign: 'left',
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '18px 18px 18px 4px',
    background: 'rgba(232,247,255,0.04)',
    border: '1px solid rgba(232,247,255,0.08)',
    wordWrap: 'break-word'
  };
}
function msgRight(){
  return {
    alignSelf: 'flex-end',
    textAlign: 'left',
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '18px 18px 4px 18px',
    background: 'rgba(56,225,255,0.04)',
    border: '1px solid rgba(56,225,255,0.12)',
    wordWrap: 'break-word'
  };
}

/* ---------- dropdown styles ---------- */
const dropdownStyle = {
  position: 'absolute',
  right: 0,
  marginTop: 8,
  background: 'rgba(3,7,15,0.95)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 6,
  minWidth: 180,
  zIndex: 60,
  boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
};
const dropdownItemStyle = {
  padding: '8px 10px',
  cursor: 'pointer',
  color: '#E6F7FF',
  borderRadius: 6,
  fontSize: 14
};
const dropdownEmptyStyle = { padding: '8px 10px', color: '#97B7D0' };