import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const apiKey = env['GROQ_API_KEY'];
console.log('Using Groq API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'none');

async function test() {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say hello' }],
        temperature: 0.1,
      }),
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Result:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
