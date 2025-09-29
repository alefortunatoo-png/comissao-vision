import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL');
  
  if (!privateKey || !clientEmail) {
    throw new Error('Google Service Account credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const iat = now;
  const exp = now + 3600; // 1 hour

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: iat,
    exp: exp
  };

  // Base64url encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  // Import the private key
  const keyData = privateKey.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${encodedSignature}`;
}

// Function to get access token
async function getAccessToken() {
  const jwt = await createJWT();
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Buscando dados das planilhas Google Sheets...');
    
    // Get access token using service account
    const accessToken = await getAccessToken();

    // IDs das planilhas do usuário
    const producaoSheetId = '1h_WtlfjOxZ_fEcyHtQShxtUyW-b5M4QNXJ3t3LMeMnI';
    const pagamentoSheetId = '14f1fLUmEBy7XYFv1aMmE_zFpgsNfGkXfJvJuyvv8_kA';

    console.log('Buscando dados das planilhas Google Sheets...');

    // Buscar dados da planilha de Produção (usar diferentes formatos para o range)
    const producaoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${producaoSheetId}/values/Produção!A:O`,
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
    const pagamentoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${pagamentoSheetId}/values/Pagamentos!A:J`,
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