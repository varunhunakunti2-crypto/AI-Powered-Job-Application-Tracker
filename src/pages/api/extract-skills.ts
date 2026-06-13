import type { APIRoute } from 'astro';
import { extractSkillsFromResume } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { resumeBase64 } = await request.json();

    if (!resumeBase64) {
      return new Response(JSON.stringify({ error: 'Resume PDF base64 data is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const skills = await extractSkillsFromResume(resumeBase64);

    if (!skills) {
      return new Response(JSON.stringify({ error: 'Failed to extract skills via Gemini.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ skills }), {
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
