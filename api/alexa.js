// --- FOCUSED TEST CODE ---

// A simple response builder
function buildResponse(speechText) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText,
      },
      shouldEndSession: true,
    },
  };
}

// --- Main Handler Function ---
export default async function handler(req, res) {
  // We MUST see this first log line.
  console.log(`[Step 1] Function started for a ${req.method} request.`);

  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);
      console.log('[Step 2] Successfully read the raw POST body.');

      const alexaRequest = JSON.parse(bodyBuffer.toString());
      console.log(`[Step 3] Successfully parsed JSON. Request type is: ${alexaRequest.request.type}`);
      
      // If we get this far, the body handling is OK.
      // We are NOT running the verifier in this test.
      res.status(200).json(buildResponse('Test successful. The body parser and verifier are the problem.'));

    } catch (error) {
      console.error('[CRITICAL FAIL] Error during POST handling:', error);
      res.status(500).send('Server Error during POST');
    }
  } else {
    // Handle GET for browser test
    res.status(200).send('GET request successful. Endpoint is online.');
  }
}