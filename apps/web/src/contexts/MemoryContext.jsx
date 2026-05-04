// src/contexts/MemoryContext.jsx
import React, { createContext, useContext } from "react";

const MemoryContext = createContext();

export const MemoryProvider = ({ children }) => {
  const API_BASE = "http://localhost:5050/memory";

  async function safeFetch(url, opts = {}, fallback) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch {
      return fallback;
    }
  }

  const save = async (key, value, type = "short") => {
    const body = JSON.stringify({ key, value, type });
    const res = await safeFetch(`${API_BASE}/save`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body 
    }, null);
    
    if (!res) {
      localStorage.setItem(`shree_mem_${key}`, JSON.stringify({ 
        value, 
        type, 
        createdAt: new Date().toISOString() 
      }));
    }
    return true;
  };

  const get = async (key) => {
    const res = await safeFetch(`${API_BASE}/get?key=${key}`, {}, null);
    if (!res) {
      const local = localStorage.getItem(`shree_mem_${key}`);
      return local ? JSON.parse(local) : null;
    }
    return res.item || null;
  };

  const all = async () => {
    const res = await safeFetch(`${API_BASE}/all`, {}, null);
    if (!res) {
      return Object.keys(localStorage)
        .filter(k => k.startsWith("shree_mem_"))
        .map(k => ({ 
          key: k.replace("shree_mem_", ""), 
          ...JSON.parse(localStorage.getItem(k)) 
        }));
    }
    return res.items || [];
  };

  const del = async (key) => {
    const res = await safeFetch(`${API_BASE}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    }, null);
    
    if (!res) {
      localStorage.removeItem(`shree_mem_${key}`);
    }
    return true;
  };

  // Expose to global scope for external access
  React.useEffect(() => {
    window.SHREE_API = {
      ...(window.SHREE_API || {}),
      memory: { save, get, all, del }
    };
  }, []);

  return (
    <MemoryContext.Provider value={{ save, get, all, del }}>
      {children}
    </MemoryContext.Provider>
  );
};

export const useMemory = () => {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error("useMemory must be used within a MemoryProvider");
  }
  return context;
};

// Named export for the context itself
export { MemoryContext };
export default MemoryContext;