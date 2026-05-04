// src/contexts/PersonalityContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const PersonalityContext = createContext();

const PERSONALITIES = {
  friendly: {
    id: "friendly",
    name: "Friendly",
    tone: "warm, helpful, and cheerful",
    style: "😊 Casual and positive tone",
    description: "Warm, casual, uses emojis sparingly",
    config: { tone: "warm", emoji: true }
  },
  formal: {
    id: "formal", 
    name: "Formal",
    tone: "professional, precise, and respectful",
    style: "🧑‍💼 Polite and structured",
    description: "Polite and precise",
    config: { tone: "formal", emoji: false }
  },
  witty: {
    id: "witty",
    name: "Witty", 
    tone: "clever, slightly playful, humorous",
    style: "😏 Short and witty replies",
    description: "Playful and concise",
    config: { tone: "witty", emoji: true }
  },
};

// Typo normalization function
const typoNormalize = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\bteh\b/gi, "the")
    .replace(/\bu\b/gi, "you")
    .replace(/\bthx\b/gi, "thanks")
    .replace(/\bokay+\b/gi, "ok")
    .replace(/\bpls\b/gi, "please")
    .replace(/\bya\b/gi, "yeah")
    .replace(/whats/gi, "what is")
    .replace(/dont/gi, "don't")
    .replace(/cant/gi, "can't")
    .replace(/\s+/g, ' ')
    .trim();
};

export const PersonalityProvider = ({ children }) => {
  const [current, setCurrent] = useState("friendly");
  const [shortTermContext, setShortTermContext] = useState([]);

  // limit short-term context (like mini memory window)
  const SHORT_TERM_LIMIT = 6;

  const addShortTerm = useCallback((who, text) => {
    setShortTermContext(prev => {
      const cleanText = typoNormalize(text);
      const newList = [...prev, { who, text: cleanText, ts: new Date().toISOString() }];
      if (newList.length > SHORT_TERM_LIMIT) newList.shift();
      return newList;
    });
  }, []);

  const getShortTerm = useCallback(() => shortTermContext, [shortTermContext]);

  const setPersonality = useCallback((personalityId) => {
    if (PERSONALITIES[personalityId]) {
      setCurrent(personalityId);
      return PERSONALITIES[personalityId];
    }
    return null;
  }, []);

  // Get all presets in array format for compatibility
  const getPresets = useCallback(() => {
    return Object.values(PERSONALITIES);
  }, []);

  useEffect(() => {
    // expose helpers for quick debugging or global use
    window.SHREE_API = {
      ...(window.SHREE_API || {}),
      getPersonality: () => PERSONALITIES[current],
      setPersonality: (p) => setPersonality(p),
      getPersonalityPresets: () => getPresets(),
      addShortTerm,
      getShortTerm,
      typoNormalize,
    };
  }, [current, setPersonality, addShortTerm, getShortTerm, getPresets]);

  return (
    <PersonalityContext.Provider
      value={{
        personality: PERSONALITIES[current],
        setPersonality: setPersonality,
        presets: getPresets(),
        addShortTerm,
        getShortTerm,
        typoNormalize,
      }}
    >
      {children}
    </PersonalityContext.Provider>
  );
};

export const usePersonality = () => {
  const context = useContext(PersonalityContext);
  if (!context) {
    throw new Error("usePersonality must be used within a PersonalityProvider");
  }
  return context;
};

// Named export for the context itself
export { PersonalityContext };
export default PersonalityContext;