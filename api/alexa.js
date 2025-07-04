// Import necessary libraries
const verifier = require('alexa-verifier-middleware');
const axios = require('axios');

// Configuration to disable Vercel's default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Promisified version of the verifier
const verify = (headers, rawBody) => new Promise((resolve, reject) => {
  verifier(headers, rawBody, (err) => {
    if (err) {
      return reject(err);
    }
    resolve();
  });
});

// Helper function to get the raw request body from the stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

// --- Main Handler Function ---
export default async function handler(req, res) {
  try {
    const rawBody = await getRawBody(req);
    await verify(req.headers, rawBody);

    const alexaRequest = JSON.parse(rawBody.toString());

    switch (alexaRequest.request.type) {
      case 'LaunchRequest':
        res.status(200).json(buildResponse("Yes? How can I help?", false, "You can ask me anything."));
        break;
      case 'IntentRequest':
        await handleIntentRequest(alexaRequest, res);
        break;
      case 'SessionEndedRequest':
        console.log('Session ended.');
        res.status(200).send();
        break;
      default:
        res.status(400).json({ error: 'Unknown request type' });
        break;
    }
  } catch (error) {
    console.error('Error in handler:', error);
    if (error.message === 'Verification Failure') {
        return res.status(400).send('Verification Failure');
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// --- Intent Handling Logic ---
async function handleIntentRequest(alexaRequest, res) {
  const intentName = alexaRequest.request.intent.name;

  // Handle standard stop/cancel intents to end the conversation
  if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    res.status(200).json(buildResponse("Goodbye.", true));
    return;
  }

  if (intentName === 'FreeformQuery') {
    // This is our main "catch-all" intent.
    const userQuery = alexaRequest.request.intent.slots.query.value;

    try {
      // Call our AI function to get a response from Gemini
      const aiResponse = await getGeminiResponse(userQuery);
      
      // Make the response conversational by asking a follow-up question
      const conversationalText = `${aiResponse} What else would you like to know?`;
      const repromptText = "You can ask me another question or say stop.";

      // Send the AI's response back to Alexa, keeping the session open
      res.status(200).json(buildResponse(conversationalText, false, repromptText));

    } catch (error) {
      console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
      const errorMessage = "I'm sorry, I had trouble connecting to the AI. Please try again.";
      res.status(200).json(buildResponse(errorMessage, false, "You can ask me another question."));
    }
  } else {
    // Handle other intents if we add them later
    const unknownIntentMessage = "I'm not sure how to handle that request. What would you like to do?";
    res.status(200).json(buildResponse(unknownIntentMessage, false, "You can ask me a question."));
  }
}

// --- AI Logic (Gemini API Call) ---
async function getGeminiResponse(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Using the fast Flash model for quick conversational responses.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  // A simpler, direct prompt for the MVP.
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const response = await axios.post(apiUrl, requestBody, {
    headers: { 'Content-Type': 'application/json' }
  });

  // Extract the text from the Gemini response, with a fallback.
  return response.data.candidates[0].content.parts[0].text || "I don't have a response for that.";
}


// --- Alexa Response Builder ---
// A helper function to create the JSON object Alexa expects.
function buildResponse(speechText, shouldEndSession = false, repromptText = null) {
  const responsePayload = {
    outputSpeech: {
      type: 'PlainText',
      text: speechText,
    },
    shouldEndSession: shouldEndSession,
  };

  // Add a reprompt only if the session is staying open
  if (!shouldEndSession) {
    responsePayload.reprompt = {
      outputSpeech: {
        type: 'PlainText',
        // If no specific reprompt is provided, we can just use the main speech text.
        text: repromptText || speechText,
      },
    };
  }

  return {
    version: '1.0',
    response: responsePayload,
  };
}