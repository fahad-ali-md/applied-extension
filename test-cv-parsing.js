#!/usr/bin/env node

/**
 * Test CV Parsing with OpenRouter API
 * This simulates exactly what the extension does
 */

const API_KEY = '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'
const MODEL = 'openrouter/free'

// This is the EXACT prompt the extension uses
const CV_TEXT = `MD. FAHAD ALI
Full Stack Developer
+8801867758990 | fahad288ali@gmail.com | GitHub | LinkedIn

Summary
Full Stack Developer specializing in the JavaScript/TypeScript ecosystem, particularly Next.js, Node.js, Fastify, and Express.js. Experienced in architecting and deploying scalable SaaS applications, as well as building AI-powered platforms integrated with RAG pipelines, PostgreSQL, and PGVector. Strong background in designing robust backend systems, automating CRM and presentation workflows, and developing interactive, canvas-based frontend visualizations. Focused on delivering reliable, containerized solutions using Docker that efficiently handle high concurrent user traffic.

Skills
Technical: JavaScript, TypeScript, React, Next.js, TailwindCSS, WebGL, Three.js, Node.js, Express.js, REST API, GraphQL, Socket.IO, LangChain, RAG, PGVector, PostgreSQL, MongoDB, SQL, Docker, AWS, Vercel, Git
Soft: Communication, Team Collaboration, Problem-solving
Tools: VS Code, Postman, Chrome DevTools, Git, GitHub

Experience
Full Stack Developer | TechStartup | Jan 2022 - Present
• Developed and deployed scalable SaaS applications using Next.js and Node.js
• Built AI-powered platforms with RAG pipelines and PGVector integration
• Designed robust backend systems using Express.js and PostgreSQL
• Implemented interactive frontend visualizations using Three.js and WebGL

Software Engineer | WebAgency | Jun 2020 - Dec 2021
• Created responsive web applications using React and TypeScript
• Developed RESTful APIs using Node.js and Express.js
• Collaborated with cross-functional teams on project delivery

Projects
AI Chat Application | 2024
• Built real-time chat application using Socket.IO and Node.js
• Integrated OpenAI API for intelligent responses
• Deployed on AWS with Docker containers

E-commerce Platform | 2023
• Developed full-stack e-commerce platform using Next.js
• Implemented payment gateway integration
• Designed and optimized PostgreSQL database schema

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

async function testCVParsing() {
  console.log('🧪 Testing CV Parsing with OpenRouter\n')
  console.log('Model:', MODEL)
  console.log('CV Text Length:', CV_TEXT.length, 'chars')
  console.log(''.repeat(80))

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://applied-ai-test.com',
        'X-OpenRouter-Title': 'Applied AI Assistant',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that returns only valid JSON.'
          },
          {
            role: 'user',
            content: PROMPT
          }
        ],
        temperature: 0.1,
        max_tokens: 16384,
        max_completion_tokens: 16384,
      }),
    })

    console.log('Response Status:', response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ API Error:', JSON.stringify(error, null, 2))
      return
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    console.log('\n' + '='.repeat(80))
    console.log('AI Response Details:')
    console.log('='.repeat(80))
    console.log('Model used:', data.model || 'unknown')
    console.log('Provider:', data.provider || 'unknown')
    console.log('Finish reason:', data.choices?.[0]?.finish_reason || 'unknown')
    console.log('\nToken Usage:')
    console.log('  - Prompt tokens:', data.usage?.prompt_tokens || 0)
    console.log('  - Completion tokens:', data.usage?.completion_tokens || 0)
    console.log('  - Total tokens:', data.usage?.total_tokens || 0)
    if (data.usage?.reasoning_tokens) {
      console.log('  - Reasoning tokens:', data.usage.reasoning_tokens)
    }

    if (!content) {
      console.error('\n❌ EMPTY RESPONSE!')
      console.log('Full response:', JSON.stringify(data, null, 2))
      return
    }

    console.log('\n' + '='.repeat(80))
    console.log('Raw AI Response (' + content.length + ' chars):')
    console.log('='.repeat(80))
    console.log(content)

    // Try to extract JSON from response
    console.log('\n' + '='.repeat(80))
    console.log('Attempting to extract and parse JSON...')
    console.log('='.repeat(80))

    // Pattern 1: Look for JSON between ```json and ```
    const jsonCodeBlock = content.match(/```json\s*([\s\S]*?)\s*```/)?.[1]

    // Pattern 2: Look for content between first { and last }
    const jsonBraces = content.match(/\{[\s\S]*\}/)?.[0]

    const jsonString = jsonCodeBlock || jsonBraces || content

    console.log('Extracted JSON (' + jsonString.length + ' chars)')

    // Try to parse
    try {
      const parsed = JSON.parse(jsonString)
      console.log('\n✅ JSON PARSED SUCCESSFULLY!')
      console.log('\nParsed Structure:')
      console.log('- personal:', parsed.personal ? '✅' : '❌')
      console.log('- pro (professional):', parsed.pro ? '✅' : '❌')
      console.log('- skills:', parsed.skills ? '✅' : '❌')
      console.log('- exp (experience):', parsed.exp ? '✅' + ' (' + parsed.exp.length + ' items)' : '❌')
      console.log('- proj (projects):', parsed.proj ? '✅' + ' (' + parsed.proj.length + ' items)' : '❌')
      console.log('- edu (education):', parsed.edu ? '✅' + ' (' + parsed.edu.length + ' items)' : '❌')

      console.log('\n' + '='.repeat(80))
      console.log('Full Parsed JSON:')
      console.log('='.repeat(80))
      console.log(JSON.stringify(parsed, null, 2))

      // Check for data quality
      console.log('\n' + '='.repeat(80))
      console.log('Data Quality Check:')
      console.log('='.repeat(80))

      if (parsed.personal) {
        console.log('✅ Personal Info:')
        console.log('  - First name:', parsed.personal.f || parsed.personal.firstName || 'MISSING')
        console.log('  - Last name:', parsed.personal.l || parsed.personal.lastName || 'MISSING')
        console.log('  - Email:', parsed.personal.e || parsed.personal.email || 'MISSING')
        console.log('  - Phone:', parsed.personal.p || parsed.personal.phone || 'MISSING')
      }

      if (parsed.pro) {
        console.log('\n✅ Professional:')
        console.log('  - Title:', parsed.pro.title || 'MISSING')
        console.log('  - Summary length:', parsed.pro.sum?.length || 0, 'chars')
        console.log('  - YOE:', parsed.pro.yoe || 0)
      }

      if (parsed.exp && parsed.exp.length > 0) {
        console.log('\n✅ Experience (' + parsed.exp.length + ' items):')
        parsed.exp.forEach((exp, i) => {
          console.log(`  ${i + 1}. ${exp.r || exp.role || 'No role'} at ${exp.c || exp.company || 'No company'}`)
        })
      }

      if (parsed.proj && parsed.proj.length > 0) {
        console.log('\n✅ Projects (' + parsed.proj.length + ' items):')
        parsed.proj.forEach((proj, i) => {
          console.log(`  ${i + 1}. ${proj.n || proj.name || 'No name'}`)
        })
      }

    } catch (parseError) {
      console.error('\n❌ JSON PARSE FAILED!')
      console.error('Error:', parseError.message)
      console.error('\nProblematic JSON (showing area around error):')

      const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0')
      const start = Math.max(0, errorPos - 200)
      const end = Math.min(jsonString.length, errorPos + 200)

      console.log('...'.repeat(40))
      console.log(jsonString.substring(start, end))
      console.log('...'.repeat(40))
      console.log('                     ^--- Error around here (position ' + errorPos + ')')
    }

  } catch (error) {
    console.error('\n❌ REQUEST FAILED:', error.message)
  }
}

// Run the test
testCVParsing()
