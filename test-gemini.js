require("dotenv").config();

async function test() {
  const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Halo Gemini" }],
          },
        ],
      }),
    }
  );

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();