import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [producaoSheetId, setProducaoSheetId] = useState("");
  const [pagamentoSheetId, setPagamentoSheetId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('sheets_config')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProducaoSheetId(data.producao_sheet_id);
        setPagamentoSheetId(data.pagamento_sheet_id);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!producaoSheetId || !pagamentoSheetId) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('sheets_config')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('sheets_config')
          .update({
            producao_sheet_id: producaoSheetId,
            pagamento_sheet_id: pagamentoSheetId,
          })
          .eq('user_id', user?.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sheets_config')
          .insert({
            user_id: user?.id,
            producao_sheet_id: producaoSheetId,
            pagamento_sheet_id: pagamentoSheetId,
          });

        if (error) throw error;
      }

      toast.success('Configuração salva com sucesso!');
      navigate('/');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Configure as planilhas do Google Sheets</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>IDs das Planilhas do Google Sheets</CardTitle>
            <CardDescription>
              Insira os IDs das suas planilhas do Google Sheets abaixo. 
              O ID é a parte da URL entre /d/ e /edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="producao">Planilha de Produção</Label>
              <Input
                id="producao"
                placeholder="Ex: 1h_WtlfjOxZ_fEcyHtQShxtUyW-b5M4QNXJ3t3LMeMnI"
                value={producaoSheetId}
                onChange={(e) => setProducaoSheetId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                URL exemplo: https://docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagamento">Planilha de Pagamentos</Label>
              <Input
                id="pagamento"
                placeholder="Ex: 14f1fLUmEBy7XYFv1aMmE_zFpgsNfGkXfJvJuyvv8_kA"
                value={pagamentoSheetId}
                onChange={(e) => setPagamentoSheetId(e.target.value)}
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Como compartilhar as planilhas
              </h3>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Abra cada planilha no Google Sheets</li>
                <li>Clique em "Compartilhar" no canto superior direito</li>
                <li>Adicione o email do service account com permissão de visualização</li>
                <li>O email está disponível nas configurações do Supabase</li>
              </ol>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instruções de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Copie suas planilhas (opcional)</h4>
              <p className="text-muted-foreground">
                Se quiser duplicar este sistema, basta fazer uma cópia das planilhas originais no Google Sheets e usar os novos IDs aqui.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2. Estrutura das planilhas</h4>
              <p className="text-muted-foreground">
                Planilha de Produção: deve ter uma aba chamada "Produção" com as colunas de A a O
              </p>
              <p className="text-muted-foreground">
                Planilha de Pagamentos: deve ter uma aba chamada "Pagamentos" com as colunas de A a J
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3. Permissões</h4>
              <p className="text-muted-foreground">
                Certifique-se de que o service account tem permissão para visualizar ambas as planilhas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
