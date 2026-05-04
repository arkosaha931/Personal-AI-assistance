// server/index.js - COMPLETELY FIXED VERSION
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import node-fetch correctly
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;
const LOCAL_MODEL = process.env.LOCAL_MODEL || 'shree:latest';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';

const SYSTEM = `You are Shree, a friendly Indian AI assistant. Always respond in this exact JSON format only:
{"intent":"chat","target":null,"reply":"Your response here"}

Examples:
User: hi
Assistant: {"intent":"chat","target":null,"reply":"Hello! Namaste! 🙏 How can I help you today?"}

User: what's your name?
Assistant: {"intent":"chat","target":null,"reply":"I'm Shree, your friendly AI assistant! 😊"}

Now respond to the user:`;

/* ---------------- Memory helpers ---------------- */
const MEMORY_STORE_PATH = path.join(__dirname, 'shree_memory.json');

function ensureMemoryFile() {
  if (!fs.existsSync(MEMORY_STORE_PATH)) {
    fs.writeFileSync(MEMORY_STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readMemoryStore() {
  ensureMemoryFile();
  try {
    return JSON.parse(fs.readFileSync(MEMORY_STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeMemoryStore(store) {
  try {
    fs.writeFileSync(MEMORY_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Ollama helper ---------------- */
async function askOllamaSimple(prompt) {
  console.log('🔄 Sending to Ollama...');
  
  const body = {
    model: LOCAL_MODEL,
    prompt: prompt,
    stream: false,
    options: { 
      temperature: 0.7, 
      num_predict: 500
    }
  };
  
  try {
    console.log(`🔗 Calling Ollama at: ${OLLAMA_URL}`);
    
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    console.log('📡 Ollama response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ollama HTTP error:', response.status, errorText);
      throw new Error(`Ollama HTTP error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Ollama response received successfully');
    
    // Extract the response text
    if (!data.response) {
      console.error('❌ No response field in Ollama response');
      throw new Error('No response field from Ollama');
    }
    
    const responseText = data.response.trim();
    console.log('✅ Extracted response:', responseText);
    
    return responseText;
    
  } catch (error) {
    console.error('❌ Ollama request failed:', error.message);
    
    // More detailed error logging
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Ollama connection refused. Make sure Ollama is running:');
      console.error('  1. Open a new terminal');
      console.error('  2. Run: ollama serve');
      console.error('  3. Wait for "Listening on 127.0.0.1:11434"');
    }
    
    throw error;
  }
}

/* ---------------- Memory routes ---------------- */
app.get('/', (_, res) => res.send('Shree brain OK'));

app.post('/memory/save', (req, res) => {
  const { key, value, type = 'short' } = req.body;
  if (!key) return res.status(400).json({ ok: false, error: 'key required' });
  const store = readMemoryStore();
  store[key] = { value, type, createdAt: new Date().toISOString() };
  const ok = writeMemoryStore(store);
  if (!ok) return res.status(500).json({ ok: false, error: 'failed to write store' });
  res.json({ ok: true, key });
});

app.get('/memory/get', (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ ok: false, error: 'key required' });
  const store = readMemoryStore();
  return res.json({ ok: true, key, item: store[key] ?? null });
});

app.get('/memory/all', (_, res) => {
  const store = readMemoryStore();
  const items = Object.entries(store).map(([k, v]) => ({ key: k, ...v }));
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ ok: true, items });
});

app.post('/memory/delete', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'key required' });
  const store = readMemoryStore();
  if (!(key in store)) return res.json({ ok: true, deleted: false, message: 'key not found' });
  delete store[key];
  const ok = writeMemoryStore(store);
  if (!ok) return res.status(500).json({ ok: false, error: 'failed to write store' });
  return res.json({ ok: true, deleted: true });
});

/* ---------------- FIXED Chat route - NO DOUBLE SENDING ---------------- */
app.post('/chat/stream', async (req, res) => {
  console.log('\n=== NEW CHAT REQUEST ===');
  
  try {
    const { text = '', context = [] } = req.body || {};
    console.log('📩 User message:', text);
    console.log('📚 Context length:', context.length);

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Build prompt - Filter out error messages from context
    let prompt = SYSTEM + '\n\n';
    
    // Add context if available (remove duplicates AND error messages)
    const uniqueContext = [];
    const seen = new Set();
    
    if (context.length > 0) {
      context.forEach(item => {
        const key = `${item.who}:${item.text}`;
        // Skip duplicates AND error messages
        if (!seen.has(key) && 
            !item.text.includes('trouble connecting') && 
            !item.text.includes('encountered an error') &&
            !item.text.includes('Sorry, I')) {
          seen.add(key);
          uniqueContext.push(item);
        }
      });
      
      console.log('📚 Filtered context:', uniqueContext.length);
      uniqueContext.forEach(item => {
        if (item.who === 'me') {
          prompt += `User: ${item.text}\n`;
        } else {
          prompt += `Assistant: ${item.text}\n`;
        }
      });
    }
    
    // Add current message
    prompt += `User: ${text}\nAssistant: `;
    console.log('🎯 Final prompt preview:', prompt.substring(0, 200) + '...');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
      // Get response from Ollama
      console.log('🚀 Calling Ollama...');
      const responseText = await askOllamaSimple(prompt);
      
      console.log('🔄 Processing Ollama response...');
      
      // Try to parse as JSON
      let finalResponse;
      try {
        finalResponse = JSON.parse(responseText);
        console.log('✅ Successfully parsed JSON response');
      } catch (parseError) {
        console.log('⚠️ Response is not JSON, wrapping as chat response');
        finalResponse = { 
          intent: 'chat', 
          target: null, 
          reply: responseText 
        };
      }

      // Validate response format
      if (!finalResponse.reply) {
        console.log('⚠️ No reply field, using raw response');
        finalResponse = { 
          intent: 'chat', 
          target: null, 
          reply: responseText 
        };
      }

      console.log('🎉 Final response ready for streaming');

      const replyText = finalResponse.reply;
      const words = replyText.split(' ');
      
      // 🚨 CRITICAL FIX: Only send empty message first - NO FULL RESPONSE!
      res.write(`data: ${JSON.stringify({ response: '' })}\n\n`);
      
      // Stream words with delay - THIS IS THE ONLY PLACE WE SEND RESPONSE TEXT
      for (let i = 0; i < words.length; i++) {
        const chunk = words.slice(0, i + 1).join(' ');
        res.write(`data: ${JSON.stringify({ response: chunk })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      
      // Send final done event (for intent handling)
      res.write('event: done\n');
      res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
      
      console.log('✅ Response streaming completed');
      res.end();
      
    } catch (error) {
      console.error('❌ Ollama processing error:', error.message);
      const errorResponse = { 
        intent: 'chat', 
        target: null, 
        reply: 'Sorry, I am having trouble connecting to my AI brain. Please try again.' 
      };
      
      // Stream error message too
      const errorWords = errorResponse.reply.split(' ');
      res.write(`data: ${JSON.stringify({ response: '' })}\n\n`);
      
      for (let i = 0; i < errorWords.length; i++) {
        const chunk = errorWords.slice(0, i + 1).join(' ');
        res.write(`data: ${JSON.stringify({ response: chunk })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      
      res.write('event: done\n');
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    }
    
  } catch (err) {
    console.error('❌ Chat endpoint error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error: ' + err.message });
    } else {
      const errorResponse = { 
        intent: 'chat', 
        target: null, 
        reply: 'Server error occurred. Please try again.' 
      };
      res.write('event: done\n');
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    }
  }
  
  console.log('=== CHAT REQUEST COMPLETED ===\n');
});

/* ---------------- Start server ---------------- */
app.listen(PORT, () => {
  console.log(`✅ Shree's brain running at http://localhost:${PORT}`);
  console.log(`🤖 Model: ${LOCAL_MODEL}`);
  console.log(`🔗 Ollama: ${OLLAMA_URL}`);
  console.log('💡 Make sure Ollama is running with: ollama serve');
});