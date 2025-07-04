// Import necessary libraries
const verifier = require('alexa-verifier-middleware');
const axios = require('axios');

// --- Main Handler Function ---
// This is the function Vercel will run when Alexa calls our URL.
export default function handler(req, res) {
  // IMPORTANT: Run the security check first.
  // If the request isn't a valid, signed request from Amazon, stop immediately.
  verifier(req.headers, req.rawBody, (err) => {
    if (err) {
      console.error(err);
      return res.status(400).send('Verification Failure');
    }

    // If verification is successful, handle the request.
    try {
      const alexaRequest = req.body;

      // Route the request based on its type (LaunchRequest, IntentRequest, etc.)
      switch (alexaRequest.request.type) {
        case 'LaunchRequest':
          // User said: "Alexa, hallo Jarvis"
          res.status(200).json(buildResponse("Yes?"));
          break;

        case 'IntentRequest':
          // User said something after the invocation name
          handleIntentRequest(alexaRequest, res);
          break;

        case 'SessionEndedRequest':
          // User ended the session
          console.log('Session ended.');
          res.status(200).json(buildResponse("Goodbye.", true));
          break;

        default:
          res.status(400).json({ error: 'Unknown request type' });
          break;
      }
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}

// --- Intent Handling Logic ---
async function handleIntentRequest(alexaRequest, res) {
  const intentName = alexaRequest.request.intent.name;

  if (intentName === 'FreeformQuery') {
    // This is our main "catch-all" intent.
    const userQuery = alexaRequest.request.intent.slots.query.value;

    try {
      // Call our AI function to get a response from Gemini
      const aiResponse = await getGeminiResponse(userQuery);
      // Send the AI's response back to Alexa
      res.status(200).json(buildResponse(aiResponse));
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      const errorMessage = "I'm sorry, I encountered an error trying to process that.";
      res.status(200).json(buildResponse(errorMessage));
    }
  } else {
    // Handle other intents if we add them later
    const unknownIntentMessage = "I'm not sure how to handle that request.";
    res.status(200).json(buildResponse(unknownIntentMessage));
  }
}

// --- AI Logic (Gemini API Call) ---
async function getGeminiResponse(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  // For this MVP, we'll keep the calendar context simple.
  // In the future, you could fetch this from a real calendar API.
  const calendarContext = `
    Current Date: July 4th, 2025.
    Your Calendar:
    - Today at 6 PM: Dinner with Sarah.
    - Tomorrow at 10 AM: Project deadline.
  `;

  const requestBody = {
    contents: [{
      parts: [{
        text: `Context: You are a personal home AI assistant named Jarvis. ${calendarContext}

User's Question: "${prompt}"

Answer concisely as a helpful assistant.`
      }]
    }]
  };

  const response = await axios.post(apiUrl, requestBody, {
    headers: { 'Content-Type': 'application/json' }
  });

  // Extract the text from the Gemini response
  return response.data.candidates[0].content.parts[0].text;
}


// --- Alexa Response Builder ---
// A helper function to create the JSON object Alexa expects.
function buildResponse(speechText, shouldEndSession = false) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText,
      },
      shouldEndSession: shouldEndSession,
    },
  };
}