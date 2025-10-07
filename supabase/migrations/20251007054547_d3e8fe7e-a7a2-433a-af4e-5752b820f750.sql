-- Remove user_id requirement from sheets_config
ALTER TABLE public.sheets_config ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own config" ON public.sheets_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON public.sheets_config;
DROP POLICY IF EXISTS "Users can update their own config" ON public.sheets_config;

-- Create public policies
CREATE POLICY "Anyone can view config" 
ON public.sheets_config 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert config" 
ON public.sheets_config 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update config" 
ON public.sheets_config 
FOR UPDATE 
USING (true);