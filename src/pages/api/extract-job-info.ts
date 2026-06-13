import type { APIRoute } from 'astro';
import { extractJobInfo } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { rawText } = await request.json();

    if (!rawText) {
      return new Response(JSON.stringify({ error: 'Raw job description text is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await extractJobInfo(rawText);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to extract job information.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
