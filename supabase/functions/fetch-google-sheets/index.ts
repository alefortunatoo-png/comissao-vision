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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    // IDs das planilhas do usuário
    const producaoSheetId = '1h_WtlfjOxZ_fEcyHtQShxtUyW-b5M4QNXJ3t3LMeMnI';
    const pagamentoSheetId = '14f1fLUmEBy7XYFv1aMmE_zFpgsNfGkXfJvJuyvv8_kA';

    console.log('Buscando dados das planilhas Google Sheets...');

    // Buscar dados da planilha de Produção
    const producaoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${producaoSheetId}/values/Produção!A:O?key=${apiKey}`
    );
    
    if (!producaoResponse.ok) {
      const errorText = await producaoResponse.text();
      console.error('Erro ao buscar planilha de produção:', errorText);
      throw new Error(`Erro na API do Google Sheets para produção: ${producaoResponse.status}`);
    }

    const producaoData: SheetData = await producaoResponse.json();

    // Buscar dados da planilha de Pagamentos
    const pagamentoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${pagamentoSheetId}/values/Pagamentos!A:J?key=${apiKey}`
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