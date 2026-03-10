async function testZAI(apiKey) {
  const response = await fetch(
    "https://api.z.ai/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "glm-5",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant"
          },
          {
            role: "user",
            content: "Say hello in JSON format"
          }
        ],
        temperature: 0.7
      })
    }
  );

  const data = await response.json();

  console.log("Z.AI FULL:", data);

  const text = data.choices?.[0]?.message?.content;

  console.log("Z.AI TEXT:", text);

  return text;
}

testZAI("609cd0e918254f71a8723c52b06e6ae3.zW4apvI5fY5rlIVZ")
