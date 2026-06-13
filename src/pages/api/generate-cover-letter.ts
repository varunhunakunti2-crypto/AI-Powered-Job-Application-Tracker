import type { APIRoute } from 'astro';
import { generateCoverLetter } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { job, profile } = await request.json();

    if (!job || !profile) {
      return new Response(JSON.stringify({ error: 'Job and Profile data are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateCoverLetter(job, profile);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to generate cover letter.' }), {
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
