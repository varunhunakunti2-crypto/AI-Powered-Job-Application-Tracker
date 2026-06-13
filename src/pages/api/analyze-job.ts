import type { APIRoute } from 'astro';
import { analyzeJobDescription } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { jobDescription, userSkills } = await request.json();
    
    if (!jobDescription) {
      return new Response(JSON.stringify({ error: 'Job description is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await analyzeJobDescription(jobDescription, userSkills || []);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to analyze job description via Gemini.' }), {
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
