---
layout: page
title: Playground
---

<script setup>
import { ref, computed } from 'vue'

const apiKey = ref('')
const prompt = ref('Extract info from: "Alice Smith, 32, alice@example.com, San Francisco. Senior software engineer."')
const fieldsText = ref(`{
  "name": "string",
  "email": "email",
  "age": "integer",
  "city": "string",
  "title": "string"
}`)
const mode = ref('extract')
const classifyOptions = ref('positive\nnegative\nneutral')
const result = ref(null)
const error = ref(null)
const loading = ref(false)

async function run() {
  if (!apiKey.value) { error.value = 'Enter your OpenAI API key above.'; return }
  loading.value = true
  error.value = null
  result.value = null

  try {
    let fields
    try { fields = JSON.parse(fieldsText.value) } catch(e) { error.value = 'Invalid JSON in fields.'; loading.value = false; return }

    const options = classifyOptions.value.split('\n').map(s => s.trim()).filter(Boolean)

    const body = mode.value === 'extract'
      ? { mode: 'extract', prompt: prompt.value, fields, apiKey: apiKey.value }
      : { mode: 'classify', prompt: prompt.value, options, apiKey: apiKey.value }

    const res = await fetch('/api/playground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Unknown error')
    result.value = json
  } catch(e) {
    error.value = e.message
  }
  loading.value = false
}
</script>

# Playground

Try structured-llm live. Bring your own OpenAI API key — it's only sent to OpenAI directly, never stored.

::: tip
The playground uses the `extract()` and `classify()` helpers. For the full API including streaming, batch processing, and Anthropic/Gemini support, see the [examples on GitHub](https://github.com/piyushgupta344/structured-llm/tree/main/examples).
:::

<div style="margin: 2rem 0; padding: 1.5rem; border: 1px solid var(--vp-c-border); border-radius: 8px;">

**OpenAI API Key**
<input v-model="apiKey" type="password" placeholder="sk-..." style="width:100%; padding:8px; margin:8px 0; font-family:monospace; border:1px solid var(--vp-c-border); border-radius:4px; background:var(--vp-c-bg);" />

**Mode**
<div style="margin: 8px 0;">
  <label style="margin-right:16px"><input type="radio" v-model="mode" value="extract" /> extract()</label>
  <label><input type="radio" v-model="mode" value="classify" /> classify()</label>
</div>

**Prompt**
<textarea v-model="prompt" rows="3" style="width:100%; padding:8px; margin:8px 0; font-family:monospace; border:1px solid var(--vp-c-border); border-radius:4px; background:var(--vp-c-bg);"></textarea>

<div v-if="mode === 'extract'">
<b>Fields (JSON)</b>
<textarea v-model="fieldsText" rows="7" style="width:100%; padding:8px; margin:8px 0; font-family:monospace; border:1px solid var(--vp-c-border); border-radius:4px; background:var(--vp-c-bg);"></textarea>
</div>

<div v-if="mode === 'classify'">
<b>Options (one per line)</b>
<textarea v-model="classifyOptions" rows="4" style="width:100%; padding:8px; margin:8px 0; font-family:monospace; border:1px solid var(--vp-c-border); border-radius:4px; background:var(--vp-c-bg);"></textarea>
</div>

<button @click="run" :disabled="loading" style="padding:10px 24px; background:#7c3aed; color:white; border:none; border-radius:6px; cursor:pointer; font-size:1rem;">
  {{ loading ? 'Running...' : 'Run ▶' }}
</button>

<div v-if="error" style="margin-top:1rem; padding:12px; background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; color:#991b1b;">
  {{ error }}
</div>

<div v-if="result" style="margin-top:1rem;">
<b>Result:</b>
<pre style="padding:12px; background:var(--vp-c-bg-soft); border-radius:6px; overflow:auto;">{{ JSON.stringify(result, null, 2) }}</pre>
</div>

</div>

## StackBlitz examples

Run these in your browser — no install needed:

- [Basic extraction (OpenAI)](https://stackblitz.com/github/piyushgupta344/structured-llm/tree/main/examples/stackblitz/01-extract)
- [Classify support tickets](https://stackblitz.com/github/piyushgupta344/structured-llm/tree/main/examples/stackblitz/02-classify)
- [Batch processing](https://stackblitz.com/github/piyushgupta344/structured-llm/tree/main/examples/stackblitz/03-batch)
