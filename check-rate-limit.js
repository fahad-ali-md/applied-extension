// Check which models work without rate limiting
const API_KEY = 'YOUR_OPENROUTER_API_KEY_HERE'

async function checkModels() {
  const models = [
    'openrouter/free',
    'arcee-ai/trinity-large-preview:free',
    'google/gemma-3-12b-it:free',
    'liquid/lfm-2.5-1.2b-instruct:free',
    'z-ai/glm-4.5-air:free',
  ]

  console.log('🧪 Checking models for rate limiting...\n')

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://applied-ai-test.com',
          'X-OpenRouter-Title': 'Applied AI Test',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      })

      if (response.ok) {
        console.log(`✅ ${model}`)
      } else {
        const error = await response.json()
        const isRateLimit = error.error?.code === 429 || error.error?.metadata?.raw?.includes('rate-limited')
        console.log(`${isRateLimit ? '🔴' : '⚠️'} ${model}: ${error.error?.message || response.statusText}`)
      }
    } catch (error) {
      console.log(`❌ ${model}: ${error.message}`)
    }

    await new Promise(r => setTimeout(r, 500))
  }
}

checkModels()
