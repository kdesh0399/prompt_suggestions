import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = "https://litellm.ml.scaleinternal.com";
// Set a reasonable timeout - 30 seconds
const FETCH_TIMEOUT = 30000;

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

        console.log(`Calling Gemini API with prompt: ${prompt.substring(0, 100)}...`);
        
        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gemini/gemini-2.5-pro-preview-03-25',
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 8000
                })
            }, FETCH_TIMEOUT);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Gemini API error: ${response.status} - ${errorText}`);
                return NextResponse.json({ 
                    error: `Gemini API error: ${response.status} - ${errorText.substring(0, 200)}...` 
                }, { status: response.status });
            }

            const data = await response.json();
            return NextResponse.json({
                modelId: 'gemini/gemini-2.5-pro-preview-03-25',
                response: data.choices?.[0]?.message?.content || '',
                raw: data
            });
        } catch (fetchError) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error('Fetch request timed out after 30 seconds');
                return NextResponse.json({ 
                    error: 'Request to Gemini API timed out after 30 seconds. Please try again later.' 
                }, { status: 504 });
            }
            throw fetchError;
        }
    } catch (error: unknown) {
        console.error('Error in Gemini API route:', error);
        // Use type assertion after checking the error type
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
        } else {
            return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 });
        }
    }
} 