-- SQL Migration: Add location_preference to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_preference text;
