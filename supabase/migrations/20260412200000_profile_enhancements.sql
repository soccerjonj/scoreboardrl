-- Add favorite_car and bio columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_car text,
  ADD COLUMN IF NOT EXISTS bio text;
