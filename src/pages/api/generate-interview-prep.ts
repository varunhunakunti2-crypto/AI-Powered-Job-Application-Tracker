import type { APIRoute } from 'astro';
import { generateInterviewPrep } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { jobDescription, role } = await request.json();

    if (!jobDescription || !role) {
      return new Response(JSON.stringify({ error: 'Job description and role are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateInterviewPrep(jobDescription, role);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to generate interview preparation materials.' }), {
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
