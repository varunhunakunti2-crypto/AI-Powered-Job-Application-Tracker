-- Supabase SQL Migration: AI Job Tracker Schema Setup
-- Generated for Appi

-- Enable pgcrypto extension for UUID generation functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABLES CREATION
-- =========================================================================

-- PROFILES TABLE
-- Stores user profile data linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name text,
    email text,
    avatar_url text,
    resume_url text,
    skills text[],
    target_role text,
    target_salary_min numeric,
    target_salary_max numeric,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- APPLICATIONS TABLE
-- Stores job applications submitted or saved by users
CREATE TABLE IF NOT EXISTS public.applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_name text NOT NULL,
    job_title text NOT NULL,
    job_url text,
    job_description text,
    status text NOT NULL CHECK (status IN ('saved', 'applied', 'interview', 'offer', 'rejected')),
    applied_date date,
    response_date date,
    salary_min numeric,
    salary_max numeric,
    location text,
    work_type text,
    notes text,
    ai_match_score integer,
    ai_summary text,
    ai_missing_skills text[],
    ai_matching_skills text[],
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- COVER LETTERS TABLE
-- Stores AI-generated or custom cover letters for applications
CREATE TABLE IF NOT EXISTS public.cover_letters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    ai_generated boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- INTERVIEWS TABLE
-- Stores interview events scheduled for job applications
CREATE TABLE IF NOT EXISTS public.interviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    interview_date timestamptz NOT NULL,
    interview_type text NOT NULL CHECK (interview_type IN ('phone', 'video', 'onsite', 'technical', 'hr')),
    interviewer_name text,
    notes text,
    outcome text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- REMINDERS TABLE
-- Stores user reminders for follow-ups or interview prep
CREATE TABLE IF NOT EXISTS public.reminders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    reminder_date timestamptz NOT NULL,
    message text NOT NULL,
    is_sent boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- =========================================================================
-- 2. AUTOMATIC TIMESTAMP TRIGGERS
-- =========================================================================

-- Trigger function to automatically update `updated_at` on modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE OR REPLACE TRIGGER on_profiles_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_applications_update
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_cover_letters_update
    BEFORE UPDATE ON public.cover_letters
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 3. AUTOMATIC PROFILE CREATION FROM AUTH.USERS
-- =========================================================================

-- Trigger function to automatically create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        new.email,
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle auth.users inserts
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) & CRUD POLICIES
-- =========================================================================

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- ----------------- PROFILES POLICIES -----------------
DROP POLICY IF EXISTS select_own_profile ON public.profiles;
CREATE POLICY select_own_profile ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS insert_own_profile ON public.profiles;
CREATE POLICY insert_own_profile ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS update_own_profile ON public.profiles;
CREATE POLICY update_own_profile ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS delete_own_profile ON public.profiles;
CREATE POLICY delete_own_profile ON public.profiles
    FOR DELETE USING (auth.uid() = id);

-- ----------------- APPLICATIONS POLICIES -----------------
DROP POLICY IF EXISTS select_own_applications ON public.applications;
CREATE POLICY select_own_applications ON public.applications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_applications ON public.applications;
CREATE POLICY insert_own_applications ON public.applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_own_applications ON public.applications;
CREATE POLICY update_own_applications ON public.applications
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_own_applications ON public.applications;
CREATE POLICY delete_own_applications ON public.applications
    FOR DELETE USING (auth.uid() = user_id);

-- ----------------- COVER LETTERS POLICIES -----------------
DROP POLICY IF EXISTS select_own_cover_letters ON public.cover_letters;
CREATE POLICY select_own_cover_letters ON public.cover_letters
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_cover_letters ON public.cover_letters;
CREATE POLICY insert_own_cover_letters ON public.cover_letters
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_own_cover_letters ON public.cover_letters;
CREATE POLICY update_own_cover_letters ON public.cover_letters
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_own_cover_letters ON public.cover_letters;
CREATE POLICY delete_own_cover_letters ON public.cover_letters
    FOR DELETE USING (auth.uid() = user_id);

-- ----------------- INTERVIEWS POLICIES -----------------
DROP POLICY IF EXISTS select_own_interviews ON public.interviews;
CREATE POLICY select_own_interviews ON public.interviews
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_interviews ON public.interviews;
CREATE POLICY insert_own_interviews ON public.interviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_own_interviews ON public.interviews;
CREATE POLICY update_own_interviews ON public.interviews
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_own_interviews ON public.interviews;
CREATE POLICY delete_own_interviews ON public.interviews
    FOR DELETE USING (auth.uid() = user_id);

-- ----------------- REMINDERS POLICIES -----------------
DROP POLICY IF EXISTS select_own_reminders ON public.reminders;
CREATE POLICY select_own_reminders ON public.reminders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_reminders ON public.reminders;
CREATE POLICY insert_own_reminders ON public.reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_own_reminders ON public.reminders;
CREATE POLICY update_own_reminders ON public.reminders
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_own_reminders ON public.reminders;
CREATE POLICY delete_own_reminders ON public.reminders
    FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- 5. PERFORMANCE OPTIMIZATION INDEXES
-- =========================================================================

-- Indexes for foreign keys to optimize relationship queries and speed up user dashboard loads
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_application_id ON public.cover_letters(application_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON public.cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON public.interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_application_id ON public.reminders(application_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
