import type { APIRoute } from 'astro';
import { conductMockInterview } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { role, jobDescription, chatHistory, userProfile } = await request.json();

    if (!role || !jobDescription || !chatHistory) {
      return new Response(JSON.stringify({ error: 'Role, job description, and chat history are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await conductMockInterview(role, jobDescription, chatHistory, userProfile);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to generate interview session.' }), {
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
