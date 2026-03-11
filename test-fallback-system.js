#!/usr/bin/env node

/**
 * Test the OpenRouter fallback system with NVIDIA model
 */

const API_KEY = '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'

// Test CV
const CV_TEXT = `MD. FAHAD ALI
Full Stack Developer
+8801867758990 | fahad288ali@gmail.com

Summary
Full Stack Developer specializing in JavaScript/TypeScript ecosystem, particularly Next.js, Node.js, Fastify, and Express.js.

Skills
Technical: JavaScript, TypeScript, React, Next.js, Node.js, Express.js, REST API
Tools: VS Code, Postman, Git, GitHub

Experience
Full Stack Developer | TechStartup | Jan 2022 - Present
• Developed and deployed scalable SaaS applications using Next.js
• Built AI-powered platforms with RAG pipelines

Education
BSc in Computer Science | University of Dhaka | 2019 - 2022`

const PROMPT = `Extract to JSON.

CV:
${CV_TEXT}

{
  "personal": {"f":"","l":"","e":"","p":"","city":"","c":""},
  "pro": {"title":"","sum":"","yoe":0},
  "skills": {"tech":[],"soft":[],"tools":[]},
  "exp": [{"id":"","r":"","c":"","s":"","e":"","current":false,"high":[],"sk":[]}],
  "proj": [{"id":"","n":"","d":"","tech":[],"url":"","high":[]}],
  "edu": [{"id":"","deg":"","sch":"","f":"","y":""}]
}

Dates: "Jan 2020". YOE: number. JSON only.`

// Fallback models in priority order (matching the extension)
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',      // 🚀 FASTEST (584ms)
  'arcee-ai/trinity-large-preview:free',     // Reliable (1515ms)
  'openrouter/free',                          // Working but slower (2822ms)
  'google/gemma-3-4b-it:free',               // Rate limited currently
  'z-ai/glm-4.5-air:free',                   // Rate limited currently
]

async function testModelWithFallback() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗')
  console.log('║     Testing OpenRouter Fallback System                           ║')
  console.log('╚═══════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`🎯 Priority Order (${FALLBACK_MODELS.length} models):`)
  FALLBACK_MODELS.forEach((m, i) => console.log(`   ${i + 1}. ${m}`))
  console.log()

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i]
    const startTime = Date.now()

    try {
      console.log(`🔄 [Attempt ${i + 1}/${FALLBACK_MODELS.length}] Trying: ${model}`)

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://applied.ai',
          'X-OpenRouter-Title': 'Applied AI Test',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
            { role: 'user', content: PROMPT }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      })

      const responseTime = Date.now() - startTime

      if (response.status === 429) {
        console.log(`   🔴 RATE LIMITED (429) - Trying next model...`)
        console.log()
        continue
      }

      if (!response.ok) {
        const error = await response.json()
        console.log(`   ❌ ERROR ${response.status}: ${error.error?.message || 'Unknown error'}`)
        console.log(`   ⏭️  Skipping to next model...`)
        console.log()
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.log(`   ⚠️ EMPTY RESPONSE - Trying next model...`)
        console.log()
        continue
      }

      // Try to parse JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0] || content
        const parsed = JSON.parse(jsonMatch)

        const hasName = parsed.personal && (parsed.personal.f || parsed.personal.firstName)
        const hasExp = parsed.exp && parsed.exp.length > 0

        if (hasName || hasExp) {
          console.log(`   ✅ SUCCESS!`)
          console.log(`   ⏱️  Response Time: ${responseTime}ms`)
          console.log(`   📄 Name: ${parsed.personal?.f || 'N/A'} ${parsed.personal?.l || 'N/A'}`)
          console.log(`   📧 Email: ${parsed.personal?.e || 'N/A'}`)
          console.log(`   💼 Experience: ${parsed.exp?.length || 0} position(s)`)
          console.log()

          if (i > 0) {
            console.log(`   🔄 FALLBACK USED: Primary model(s) failed, fell back to model #${i + 1}`)
          } else {
            console.log(`   🎯 PRIMARY MODEL: First model worked!`)
          }

          console.log()
          console.log('╔═══════════════════════════════════════════════════════════════════╗')
          console.log('║                    ✅ FALLBACK SYSTEM WORKING!                    ║')
          console.log('╚═══════════════════════════════════════════════════════════════════╝')

          return { success: true, model, responseTime, parsed }
        } else {
          console.log(`   ⚠️ POOR QUALITY - Trying next model...`)
          console.log()
        }
      } catch (parseError) {
        console.log(`   ⚠️ INVALID JSON - Trying next model...`)
        console.log()
      }

    } catch (error) {
      console.log(`   ❌ NETWORK ERROR: ${error.message}`)
      console.log(`   ⏭️  Trying next model...`)
      console.log()
    }
  }

  console.log()
  console.log('╔═══════════════════════════════════════════════════════════════════╗')
  console.log('║                 ❌ ALL MODELS FAILED OR RATE LIMITED                 ║')
  console.log('╚═══════════════════════════════════════════════════════════════════╝')
  return { success: false }
}

testModelWithFallback()
  .then(result => {
    if (result.success) {
      console.log()
      console.log(`✅ Test PASSED! Fallback system is working correctly.`)
      console.log(`📊 Working model: ${result.model} (${result.responseTime}ms)`)
      process.exit(0)
    } else {
      console.log()
      console.log(`❌ Test FAILED! All models are rate limited or erroring.`)
      console.log(`💡 Tip: Add credits to OpenRouter account or try again later.`)
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ Test error:', error)
    process.exit(1)
  })
