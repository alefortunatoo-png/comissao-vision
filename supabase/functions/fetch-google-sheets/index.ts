import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SheetData {
  range: string;
  majorDimension: string;
  values: string[][];
}

// Function to create JWT for Google Service Account
async function createJWT() {
  const privateKeyPem = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL');

  if (!privateKeyPem || !clientEmail) {
    throw new Error('Google Service Account credentials not configured');
  }

  // Normalize PEM from secrets ("\n" -> real newlines)
  const pem = privateKeyPem.replace(/\\n/g, '\n');
  const alg = 'RS256';
  const key = await importPKCS8(pem, alg);

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  })
    .setProtectedHeader({ alg, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .sign(key);

  return jwt;
}

// Function to get access token
async function getAccessToken() {
  const assertion = await createJWT();

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error('Failed to get access token:', response.status, text);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = JSON.parse(text);
  return data.access_token as string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Buscando dados das planilhas Google Sheets...');
    
    // Create Supabase client (no auth required)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get sheets configuration from database (get the first/only row)
    const { data: config, error: configError } = await supabase
      .from('sheets_config')
      .select('producao_sheet_id, pagamento_sheet_id')
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.error('Erro ao buscar configuração:', configError);
      return new Response(
        JSON.stringify({ 
          error: 'Configuração das planilhas não encontrada. Por favor, configure os IDs das planilhas nas configurações.',
          policies: [],
          payments: [],
          lastUpdated: new Date().toISOString()
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const producaoSheetId = config.producao_sheet_id;
    const pagamentoSheetId = config.pagamento_sheet_id;

    console.log('Usando planilhas:', { producaoSheetId, pagamentoSheetId });
    
    // Get access token using service account
    const accessToken = await getAccessToken();

    // Buscar dados da planilha de Produção (usar diferentes formatos para o range)
    const producaoRange = encodeURIComponent('Produção!A:O');
    const producaoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${producaoSheetId}/values/${producaoRange}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!producaoResponse.ok) {
      const errorText = await producaoResponse.text();
      console.error('Erro ao buscar planilha de produção:', errorText);
      throw new Error(`Erro na API do Google Sheets para produção: ${producaoResponse.status}`);
    }

    const producaoData: SheetData = await producaoResponse.json();

    // Buscar dados da planilha de Pagamentos
    const pagamentosRange = encodeURIComponent('Pagamentos!A:J');
    const pagamentoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${pagamentoSheetId}/values/${pagamentosRange}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!pagamentoResponse.ok) {
      const errorText = await pagamentoResponse.text();
      console.error('Erro ao buscar planilha de pagamentos:', errorText);
      throw new Error(`Erro na API do Google Sheets para pagamentos: ${pagamentoResponse.status}`);
    }

    const pagamentoData: SheetData = await pagamentoResponse.json();

    console.log('Dados de produção:', producaoData.values?.length || 0, 'linhas');
    console.log('Dados de pagamento:', pagamentoData.values?.length || 0, 'linhas');

    // Processar dados de produção (pular header)
    const policiesData = producaoData.values?.slice(1).map(row => ({
      vigenciaInicio: row[0] || '',
      vigenciaFim: row[1] || '',
      apolice: row[2] || '',
      segurado: row[3] || '',
      seguradora: row[4] || '',
      parcelas: parseInt(row[5] || '0'),
      premioLiquido: parseFloat(row[6]?.replace(',', '.') || '0'),
      comissao100: parseFloat(row[7]?.replace(',', '.') || '0'),
      comissaoPrevista: parseFloat(row[8]?.replace(',', '.') || '0'),
      tipo: row[9] || ''
    })) || [];

    // Processar dados de pagamentos (pular header)
    const paymentsData = pagamentoData.values?.slice(1).map(row => ({
      segurado: row[0] || '',
      seguradora: row[1] || '',
      apolice: row[2] || '',
      parcela: parseInt(row[3] || '0'),
      pgtoSeguradora: row[4] || '',
      pgtoColaborador: row[5] || '',
      comissao100: parseFloat(row[6]?.replace(',', '.') || '0'),
      comissaoRecebida: parseFloat(row[7]?.replace(',', '.') || '0')
    })) || [];

    const result = {
      policies: policiesData,
      payments: paymentsData,
      lastUpdated: new Date().toISOString()
    };

    console.log('Dados processados com sucesso:', {
      policies: policiesData.length,
      payments: paymentsData.length
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função fetch-google-sheets:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        policies: [],
        payments: [],
        lastUpdated: new Date().toISOString()
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});