import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = "https://litellm.ml.scaleinternal.com";
// Increase timeout to 90 seconds to match vercel.json's 120s maxDuration
const FETCH_TIMEOUT = 90000;

// Add interfaces for type safety
interface ConversationTurn {
  user_prompt: string;
  finalResponse?: {
    response: string;
  };
}

// Helper function to add timeout to fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Retry logic for external API calls
async function fetchWithRetry(url: string, options: RequestInit, timeout: number, maxRetries = 2): Promise<Response> {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not the first attempt, wait before retrying
      if (attempt > 0) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000); // Exponential backoff up to 8 seconds
        console.log(`Retry attempt ${attempt} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      // Don't retry if this was a 4xx error or other non-retryable error
      if (error instanceof Error) {
        if (error.name !== 'AbortError' && error.toString().includes('4')) {
          throw error; // Don't retry client errors
        }
      }
    }
  }
  
  // If we got here, all attempts failed
  throw lastError;
}

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.NEXT_PUBLIC_LITELLM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API key is missing' }, { status: 500 });
        }

        const body = await req.json();
        const { prompt, conversationHistory = [] } = body;

        const url = `${BASE_URL}/v1/chat/completions`;

        // Build conversation history messages
        const messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...conversationHistory.flatMap((turn: ConversationTurn) => [
                { role: 'user', content: turn.user_prompt },
                { role: 'assistant', content: turn.finalResponse?.response || '' }
            ]),
            { role: 'user', content: prompt }
        ];

        console.log(`Calling Gemini API at ${new Date().toISOString()} with prompt length: ${prompt.length}`);
        
        // Record start time to track API response time
        const startTime = Date.now();
        
        try {
            const response = await fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3-7-sonnet-latest',
                    messages: messages,
                    temperature: 0.5,
                    max_tokens: 8000
                })
            }, FETCH_TIMEOUT);

            // Calculate and log the response time
            const responseTime = Date.now() - startTime;
            console.log(`Gemini API responded in ${responseTime}ms`);

            if (!response.ok) {
                let errorText = "Unknown error";
                try {
                    errorText = await response.text();
                } catch (textError) {
                    console.error("Failed to read error response text:", textError);
                }
                console.error(`Gemini API error: ${response.status} - ${errorText}`);
                return NextResponse.json({ 
                    error: `Gemini API error: ${response.status} - ${errorText.substring(0, 200)}...` 
                }, { status: response.status });
            }

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                return NextResponse.json({ 
                    error: "Failed to parse response from Gemini API. The service may be experiencing issues." 
                }, { status: 500 });
            }
            
            // Validate response format
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error("Invalid response format from Gemini API:", data);
                return NextResponse.json({ 
                    error: "Received an invalid response format from Gemini API." 
                }, { status: 500 });
            }
            
            return NextResponse.json({
                modelId: 'anthropic/claude-3-7-sonnet-latest',
                response: data.choices?.[0]?.message?.content || '',
                raw: data
            });
        } catch (fetchError) {
            const responseTime = Date.now() - startTime;
            
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error(`Fetch request timed out after ${responseTime}ms`);
                return NextResponse.json({ 
                    error: `Request to Gemini API timed out after ${Math.round(responseTime/1000)} seconds. The service may be experiencing high load. Please try again later or try a simpler prompt.` 
                }, { status: 504 });
            }
            
            // Handle other network errors
            console.error(`Fetch error after ${responseTime}ms:`, fetchError);
            const errorMessage = fetchError instanceof Error 
                ? `Network error communicating with Gemini API: ${fetchError.message}` 
                : "Network error communicating with Gemini API";
            
            return NextResponse.json({ error: errorMessage }, { status: 503 });
        }
    } catch (error: unknown) {
        console.error('Error in Gemini API route:', error);
        // Use type assertion after checking the error type
        if (error instanceof Error) {
            return NextResponse.json({ 
                error: `Error communicating with Gemini API: ${error.message}. Please try again later.` 
            }, { status: 500 });
        } else {
            return NextResponse.json({ 
                error: 'Unknown error occurred while communicating with the Gemini API. Please try again later.' 
            }, { status: 500 });
        }
    }
} 