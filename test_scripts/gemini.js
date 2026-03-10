async function testGemini(apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Say hello in JSON format like {\"message\":\"hello\"}"
              }
            ]
          }
        ]
      })
    }
  );

  const data = await response.json();

  console.log("Gemini FULL response:", data);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log("Gemini TEXT:", text);

  return text;
}

testGemini("AIzaSyCIFqwmrc33XR5xEWPOzrQKUGlj25LRVLs")
