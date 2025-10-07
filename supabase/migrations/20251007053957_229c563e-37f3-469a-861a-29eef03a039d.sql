-- Create table for Google Sheets configuration
CREATE TABLE IF NOT EXISTS public.sheets_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  producao_sheet_id TEXT NOT NULL,
  pagamento_sheet_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sheets_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own config" 
ON public.sheets_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config" 
ON public.sheets_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config" 
ON public.sheets_config 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_sheets_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sheets_config_updated_at
BEFORE UPDATE ON public.sheets_config
FOR EACH ROW
EXECUTE FUNCTION public.update_sheets_config_updated_at();