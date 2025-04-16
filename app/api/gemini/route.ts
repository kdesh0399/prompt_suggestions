import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = "https://litellm.ml.scaleinternal.com";

// Add interfaces for type safety
interface ConversationTurn {
  user_prompt: string;
  finalResponse?: {
    response: string;
  };
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

        const response = await fetch(url, {
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
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({
            modelId: 'gemini/gemini-2.5-pro-preview-03-25',
            response: data.choices?.[0]?.message?.content || '',
            raw: data
        });
    } catch (error: unknown) {
        // Use type assertion after checking the error type
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
        } else {
            return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 });
        }
    }
} 