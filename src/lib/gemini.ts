import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');
const pdf = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule);

// =========================================================================
// INTERFACES & TYPES
// =========================================================================

export interface AnalyzeJobDescriptionResult {
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  difficulty_level: 'junior' | 'mid' | 'senior';
  estimated_salary_min: number;
  estimated_salary_max: number;
  summary: string;
  red_flags: string[];
}

export interface GenerateCoverLetterResult {
  cover_letter: string;
  key_points: string[];
}

export interface ExtractJobInfoResult {
  title: string;
  company: string;
  location: string;
  work_type: string;
  salary_min: number | null;
  salary_max: number | null;
  requirements: string[];
  responsibilities: string[];
  tech_stack: string[];
}

export interface GenerateInterviewPrepResult {
  likely_questions: string[];
  tips: string[];
  topics_to_study: string[];
}

// =========================================================================
// HELPER FUNCTION FOR GROQ API
// =========================================================================

async function callGroq(prompt: string, systemMessage?: string, model: string = 'llama-3.1-8b-instant'): Promise<string> {
  const apiKey = (import.meta as any).env?.GROQ_API_KEY || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : undefined);
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not defined in the environment.');
  }

  const messages: any[] = [];
  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response.');
  }
  return content;
}

// =========================================================================
// SERVICE FUNCTIONS
// =========================================================================

/**
 * Analyzes a job description against a user's skills to compute a match score,
 * find matching and missing skills, estimate difficulty and salary, and identify red flags.
 */
export async function analyzeJobDescription(
  jobDescription: string,
  userSkills: string[]
): Promise<AnalyzeJobDescriptionResult | null> {
  try {
    const prompt = `
      You are an expert career advisor and technical recruiter. Compare the following job description with the list of user skills.
      
      Job Description:
      "${jobDescription}"
      
      User Skills:
      ${JSON.stringify(userSkills)}
      
      Perform a rigorous skill analysis and match assessment. Estimate the difficulty level (junior, mid, or senior), and any estimated salary range in USD (yearly or hourly converted to yearly equivalent; use 0 if not possible). Highlight any red flags in the job description.
      
      Provide your response strictly in the following JSON format:
      {
        "match_score": 0-100 integer representing the matching percentage,
        "matching_skills": ["skills that match between the description and user skills"],
        "missing_skills": ["important skills mentioned in the job description that the user lacks"],
        "difficulty_level": "junior" | "mid" | "senior",
        "estimated_salary_min": number representing minimum estimated annual salary (e.g. 80000, use 0 if not estimable),
        "estimated_salary_max": number representing maximum estimated annual salary (e.g. 120000, use 0 if not estimable),
        "summary": "a professional 2-3 sentence summary of the matching results",
        "red_flags": ["any potential red flags in the description like vague wording, unrealistic expectations, etc., or an empty array if none"]
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage);
    return JSON.parse(resultText) as AnalyzeJobDescriptionResult;
  } catch (error: any) {
    console.error('Error in analyzeJobDescription:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Groq API rate limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to analyze job description. Please try again.');
  }
}

/**
 * Generates a tailored cover letter and key highlights based on a job specification and user profile.
 */
export async function generateCoverLetter(
  job: Record<string, any>,
  profile: Record<string, any>
): Promise<GenerateCoverLetterResult | null> {
  try {
    const prompt = `
      You are a professional resume and cover letter writer. Draft a custom cover letter based on the following job details and user profile.
      
      Job Details:
      ${JSON.stringify(job, null, 2)}
      
      User Profile Details:
      ${JSON.stringify(profile, null, 2)}
      
      Ensure the cover letter is professional, compelling, and references the user's specific matching skills to highlight suitability for the role.
      
      Provide your response strictly in the following JSON format:
      {
        "cover_letter": "the full formatted cover letter text, including placeholders for date and recruiter name if not provided",
        "key_points": ["2-3 key selling points or strategies used in this cover letter to grab the recruiter's attention"]
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage);
    return JSON.parse(resultText) as GenerateCoverLetterResult;
  } catch (error: any) {
    console.error('Error in generateCoverLetter:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Groq API rate limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to generate cover letter. Please try again.');
  }
}

/**
 * Parses raw text from a job posting (e.g. from copy-pasting a website)
 * and extracts standard structured fields.
 */
export async function extractJobInfo(
  rawText: string
): Promise<ExtractJobInfoResult | null> {
  try {
    const prompt = `
      You are a precise data extraction agent. Parse the following raw job description text and extract key metadata.
      
      Raw Text:
      "${rawText}"
      
      Extract the job title, company name, location (city/state or 'Remote'), work type (e.g. 'Full-time', 'Part-time', 'Contract'), minimum and maximum annual salary (numeric or null if not found), requirements list, responsibilities list, and tech stack details.
      
      Provide your response strictly in the following JSON format:
      {
        "title": "extracted job title, or 'Unknown'",
        "company": "extracted company name, or 'Unknown'",
        "location": "extracted location or 'Remote' / 'Unknown'",
        "work_type": "extracted work type or 'Full-time' / 'Unknown'",
        "salary_min": extracted minimum annual salary (number or null if not found),
        "salary_max": extracted maximum annual salary (number or null if not found),
        "requirements": ["list of key requirements/skills needed"],
        "responsibilities": ["list of key responsibilities/duties"],
        "tech_stack": ["list of tools, languages, and technologies mentioned"]
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage);
    return JSON.parse(resultText) as ExtractJobInfoResult;
  } catch (error: any) {
    console.error('Error in extractJobInfo:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Groq API rate limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to extract job info. Please try again.');
  }
}

/**
 * Generates tailored interview preparation materials like expected questions, study topics, and general tips.
 */
export async function generateInterviewPrep(
  jobDescription: string,
  role: string
): Promise<GenerateInterviewPrepResult | null> {
  try {
    const prompt = `
      You are an expert technical interviewer and interview preparation coach. Given the job description and the role name, prepare customized prep materials.
      
      Job Description:
      "${jobDescription}"
      
      Role:
      "${role}"
      
      Provide a set of likely interview questions, tactical preparation/interview tips, and key study topics/technologies to review.
      
      Provide your response strictly in the following JSON format:
      {
        "likely_questions": ["4-5 expected questions tailored specifically to this job description and role"],
        "tips": ["3-4 action-oriented interview strategy tips"],
        "topics_to_study": ["key technical topics, frameworks, or domain areas to review before the interview"]
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage);
    return JSON.parse(resultText) as GenerateInterviewPrepResult;
  } catch (error: any) {
    console.error('Error in generateInterviewPrep:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Groq API rate limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to generate interview prep. Please try again.');
  }
}

/**
 * Extracts a list of skills from a resume. Note: Groq is text-only.
 * We expect the incoming data to be raw text, or we attempt to process text.
 */
export async function extractSkillsFromResume(
  textOrBase64: string
): Promise<string[] | null> {
  try {
    // Basic heuristics to check if it looks like a base64 PDF
    let textToAnalyze = textOrBase64;
    if (textOrBase64.startsWith('JVBERi')) {
      // PDF base64 detected. Use pdf-parse to extract actual text content.
      try {
        const buffer = Buffer.from(textOrBase64, 'base64');
        const data = await pdf(buffer);
        textToAnalyze = data.text || '';
        
        // Truncate resume text if it's too long
        if (textToAnalyze.length > 8000) {
          textToAnalyze = textToAnalyze.substring(0, 8000) + '... [Resume Truncated]';
        }
      } catch (e) {
        console.error('pdf-parse failed, falling back:', e);
        try {
          const decoded = Buffer.from(textOrBase64, 'base64').toString('utf-8');
          textToAnalyze = decoded.replace(/[^\x20-\x7E\n\r]/g, ' ').substring(0, 3000);
        } catch (err) {
          textToAnalyze = "[Base64 PDF Content - could not parse]";
        }
      }
    }

    const prompt = `
      You are an expert technical recruiter and resume parser.
      Analyze the text content of the resume below and extract a comprehensive list of professional skills, programming languages, libraries, tools, frameworks, databases, methodologies, cloud platforms, and core competencies.
      
      Resume Content:
      "${textToAnalyze}"
      
      Provide your response strictly in the following JSON format:
      {
        "skills": ["skill1", "skill2", "skill3", ...]
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage);
    const parsed = JSON.parse(resultText);
    return (parsed.skills || parsed) as string[];
  } catch (error: any) {
    console.error('Error in extractSkillsFromResume:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Groq API rate limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to extract skills from resume. Please try again.');
  }
}

export interface MockInterviewResult {
  grade: string | null;
  feedback: string | null;
  nextQuestion: string;
}

/**
 * Simulates a recruiter conducting a mock interview, generating feedback for the user's answer and the next question.
 */
export async function conductMockInterview(
  role: string,
  jobDescription: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userProfile?: Record<string, any>
): Promise<MockInterviewResult | null> {
  try {
    // Truncate job description to prevent token limit errors
    const truncatedJobDesc = jobDescription && jobDescription.length > 3000 
      ? jobDescription.substring(0, 3000) + '...' 
      : jobDescription || 'No description provided.';

    // Strip out unnecessary profile properties (like base64, large objects, etc.)
    const cleanProfile = userProfile ? {
      full_name: userProfile.full_name,
      skills: userProfile.skills,
      target_role: userProfile.target_role,
      target_salary_min: userProfile.target_salary_min,
      target_salary_max: userProfile.target_salary_max
    } : {};

    const prompt = `
      You are an expert technical interviewer and recruiter for the role of "${role}".
      
      Job Description:
      "${truncatedJobDesc}"
      
      User Profile/Resume context:
      ${JSON.stringify(cleanProfile)}
      
      Below is the interview chat history. The assistant messages represent the recruiter's questions/responses, and the user messages represent the candidate's answers:
      ${JSON.stringify(chatHistory)}
      
      Your tasks:
      1. If the candidate just answered a question (i.e. the last message in chat history is from the "user"), evaluate their answer. Provide a constructive letter grade (A, B, C, D, or F) and 2-3 sentences of feedback (what they did well, what they missed, how to improve). If the chat history does not end with a user answer (e.g. this is the start of the interview), set "grade" and "feedback" to null.
      2. Generate the next logical, professional interview question based on the job description, candidate's profile, and the flow of the conversation.
      
      Provide your response strictly in the following JSON format:
      {
        "grade": "A" | "B" | "C" | "D" | "F" | null,
        "feedback": "string containing constructive feedback, or null",
        "nextQuestion": "string containing the next interview question"
      }
    `;

    const systemMessage = "You are a professional assistant that must return responses strictly formatted as a JSON object.";
    const resultText = await callGroq(prompt, systemMessage, 'llama-3.1-8b-instant');
    return JSON.parse(resultText) as MockInterviewResult;
  } catch (error: any) {
    console.error('Error in conductMockInterview:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('Limit')) {
      throw new Error('Groq API rate limit or token limit exceeded. Please wait 30-60 seconds and try again.');
    }
    throw new Error(error?.message || 'Failed to generate interview response. Please try again.');
  }
}

