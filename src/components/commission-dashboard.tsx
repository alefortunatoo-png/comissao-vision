import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Users, DollarSign, CheckCircle, Clock, AlertCircle, Filter, Search, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock data structure based on the Google Sheets
interface PolicyData {
  vigenciaInicio: string;
  vigenciaFim: string;
  apolice: string;
  segurado: string;
  seguradora: string;
  parcelas: number;
  premioLiquido: number;
  comissao100: number;
  comissaoPrevista: number;
  tipo: string;
}

interface PaymentData {
  segurado: string;
  seguradora: string;
  apolice: string;
  parcela: number;
  pgtoSeguradora: string;
  pgtoColaborador: string;
  comissao100: number;
  comissaoRecebida: number;
}

interface CommissionSummary {
  segurado: string;
  seguradora: string;
  apolice: string;
  comissaoPrevista: number;
  comissaoRecebida: number;
  percentualRecebido: number;
  status: "recebida" | "parcelado" | "pendente";
  ultimoPagamento?: string;
}

// Mock data for demonstration
const mockPolicyData: PolicyData[] = [
  { vigenciaInicio: "02/01/2025", vigenciaFim: "02/01/2026", apolice: "225802", segurado: "IRACI PEREIRA SANTOS LEITE", seguradora: "BRADESCO", parcelas: 10, premioLiquido: 1548.98, comissao100: 154.90, comissaoPrevista: 108.43, tipo: "Renovação" },
  { vigenciaInicio: "02/01/2025", vigenciaFim: "02/01/2026", apolice: "872505313367000", segurado: "ARCENIO CASSID REGGIORI", seguradora: "AZUL", parcelas: 10, premioLiquido: 1209.91, comissao100: 241.98, comissaoPrevista: 169.38, tipo: "Renovação" },
  { vigenciaInicio: "03/01/2025", vigenciaFim: "03/01/2026", apolice: "", segurado: "VINICIUS RODRIGUES LAGRIMANTE", seguradora: "TOKIO MARINE", parcelas: 12, premioLiquido: 1974.76, comissao100: 197.48, comissaoPrevista: 138.23, tipo: "Nova" },
  { vigenciaInicio: "03/01/2025", vigenciaFim: "03/01/2026", apolice: "310014504", segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", parcelas: 6, premioLiquido: 852.23, comissao100: 213.06, comissaoPrevista: 149.14, tipo: "Renovação" },
  { vigenciaInicio: "04/01/2025", vigenciaFim: "04/01/2026", apolice: "310019095", segurado: "LEILIER DOS SANTOS ANDRADE", seguradora: "ALLIANZ", parcelas: 10, premioLiquido: 938.63, comissao100: 281.59, comissaoPrevista: 197.11, tipo: "Renovação" }
];

const mockPaymentData: PaymentData[] = [
  { segurado: "IRACI PEREIRA SANTOS LEITE", seguradora: "BRADESCO", apolice: "225802", parcela: 1, pgtoSeguradora: "15/01/2025", pgtoColaborador: "20/01/2025", comissao100: 15.49, comissaoRecebida: 10.84 },
  { segurado: "IRACI PEREIRA SANTOS LEITE", seguradora: "BRADESCO", apolice: "225802", parcela: 2, pgtoSeguradora: "15/02/2025", pgtoColaborador: "20/02/2025", comissao100: 15.49, comissaoRecebida: 10.84 },
  { segurado: "ARCENIO CASSID REGGIORI", seguradora: "AZUL", apolice: "872505313367000", parcela: 1, pgtoSeguradora: "10/01/2025", pgtoColaborador: "15/01/2025", comissao100: 24.20, comissaoRecebida: 16.94 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 1, pgtoSeguradora: "10/01/2025", pgtoColaborador: "15/01/2025", comissao100: 35.51, comissaoRecebida: 24.86 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 2, pgtoSeguradora: "10/02/2025", pgtoColaborador: "15/02/2025", comissao100: 35.51, comissaoRecebida: 24.86 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 3, pgtoSeguradora: "10/03/2025", pgtoColaborador: "15/03/2025", comissao100: 35.51, comissaoRecebida: 24.86 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 4, pgtoSeguradora: "10/04/2025", pgtoColaborador: "15/04/2025", comissao100: 35.51, comissaoRecebida: 24.86 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 5, pgtoSeguradora: "10/05/2025", pgtoColaborador: "15/05/2025", comissao100: 35.51, comissaoRecebida: 24.86 },
  { segurado: "ANDRE LUIS DE OLIVEIRA PIRES", seguradora: "ALLIANZ", apolice: "310014504", parcela: 6, pgtoSeguradora: "10/06/2025", pgtoColaborador: "15/06/2025", comissao100: 35.51, comissaoRecebida: 24.86 }
];

export function CommissionDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [seguradoraFilter, setSeguradoraFilter] = useState("all");
  const [realTimeData, setRealTimeData] = useState<{
    policies: PolicyData[];
    payments: PaymentData[];
    lastUpdated: string;
  } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch real-time data from Google Sheets
  const fetchGoogleSheetsData = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-google-sheets');
      
      if (error) {
        console.error('Erro ao buscar dados:', error);
        toast.error('Erro ao buscar dados das planilhas');
        return;
      }

      if (data?.error) {
        console.error('Erro na função:', data.error);
        toast.error(`Erro: ${data.error}`);
        return;
      }

      setRealTimeData(data);
      toast.success('Dados atualizados com sucesso!');
    } catch (error) {
      console.error('Erro na requisição:', error);
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load data on component mount and set up auto-refresh
  useEffect(() => {
    if (user) {
      fetchGoogleSheetsData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchGoogleSheetsData();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Use real data if available, otherwise fallback to mock data
  const currentPolicyData = realTimeData?.policies || mockPolicyData;
  const currentPaymentData = realTimeData?.payments || mockPaymentData;

  // Aggregate data by client (considering empty policies)
  const commissionSummary: CommissionSummary[] = useMemo(() => {
    const clientMap = new Map<string, CommissionSummary>();

    // Process policies
    currentPolicyData.forEach(policy => {
      const key = policy.apolice || `${policy.segurado}_${policy.seguradora}`;
      
      if (clientMap.has(key)) {
        const existing = clientMap.get(key)!;
        existing.comissaoPrevista += policy.comissaoPrevista;
      } else {
        clientMap.set(key, {
          segurado: policy.segurado,
          seguradora: policy.seguradora,
          apolice: policy.apolice,
          comissaoPrevista: policy.comissaoPrevista,
          comissaoRecebida: 0,
          percentualRecebido: 0,
          status: "pendente"
        });
      }
    });

    // Process payments
    currentPaymentData.forEach(payment => {
      const key = payment.apolice || `${payment.segurado}_${payment.seguradora}`;
      
      if (clientMap.has(key)) {
        const existing = clientMap.get(key)!;
        existing.comissaoRecebida += payment.comissaoRecebida;
        existing.ultimoPagamento = payment.pgtoColaborador;
      }
    });

    // Calculate percentages and status
    clientMap.forEach((summary) => {
      summary.percentualRecebido = summary.comissaoPrevista > 0 
        ? (summary.comissaoRecebida / summary.comissaoPrevista) * 100 
        : 0;
      
      if (summary.percentualRecebido >= 90) {
        summary.status = "recebida";
      } else if (summary.percentualRecebido > 0) {
        summary.status = "parcelado";
      } else {
        summary.status = "pendente";
      }
    });

    return Array.from(clientMap.values());
  }, [currentPolicyData, currentPaymentData]);

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    return commissionSummary.filter(item => {
      const matchesSearch = searchTerm === "" || 
        item.segurado.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.apolice.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.seguradora.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSeguradora = seguradoraFilter === "all" || item.seguradora === seguradoraFilter;
      
      return matchesSearch && matchesStatus && matchesSeguradora;
    });
  }, [commissionSummary, searchTerm, statusFilter, seguradoraFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = commissionSummary.length;
    const recebidas = commissionSummary.filter(item => item.status === "recebida").length;
    const parcelados = commissionSummary.filter(item => item.status === "parcelado").length;
    const pendentes = commissionSummary.filter(item => item.status === "pendente").length;
    
    const totalPrevista = commissionSummary.reduce((sum, item) => sum + item.comissaoPrevista, 0);
    const totalRecebida = commissionSummary.reduce((sum, item) => sum + item.comissaoRecebida, 0);
    const percentualGeral = totalPrevista > 0 ? (totalRecebida / totalPrevista) * 100 : 0;

    return { total, recebidas, parcelados, pendentes, totalPrevista, totalRecebida, percentualGeral };
  }, [commissionSummary]);

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recebida":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />Recebida</Badge>;
      case "parcelado":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Parcelado</Badge>;
      case "pendente":
        return <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Dashboard de Comissões
            </h1>
            <p className="text-muted-foreground text-lg">
              Controle e monitoramento de comissões de seguros
            </p>
            {realTimeData?.lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Última atualização: {new Date(realTimeData.lastUpdated).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={fetchGoogleSheetsData}
              disabled={isLoadingData}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total}</div>
              <p className="text-xs text-muted-foreground">
                Clientes cadastrados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800">Comissão Recebida</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">{metrics.recebidas}</div>
              <p className="text-xs text-emerald-600">
                ≥90% da comissão prevista
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">Recebendo Parcelado</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-800">{metrics.parcelados}</div>
              <p className="text-xs text-amber-600">
                Pagamento parcial recebido
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Não Recebida</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-800">{metrics.pendentes}</div>
              <p className="text-xs text-red-600">
                Aguardando pagamento
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-secondary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Comissão Prevista</p>
                <p className="text-2xl font-bold">
                  {metrics.totalPrevista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Comissão Recebida</p>
                <p className="text-2xl font-bold text-primary">
                  {metrics.totalRecebida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-subtle rounded-lg">
                <p className="text-sm text-muted-foreground">Percentual Geral</p>
                <p className="text-2xl font-bold">{metrics.percentualGeral.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar cliente, apólice ou seguradora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="recebida">Comissão Recebida</SelectItem>
                  <SelectItem value="parcelado">Recebendo Parcelado</SelectItem>
                  <SelectItem value="pendente">Não Recebida</SelectItem>
                </SelectContent>
              </Select>
              <Select value={seguradoraFilter} onValueChange={setSeguradoraFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por seguradora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as seguradoras</SelectItem>
                  {Array.from(new Set(commissionSummary.map(item => item.seguradora))).map(seguradora => (
                    <SelectItem key={seguradora} value={seguradora}>{seguradora}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-elegant">
          <CardHeader>
            <CardTitle>Detalhamento por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Seguradora</TableHead>
                    <TableHead>Apólice</TableHead>
                    <TableHead>Comissão Prevista</TableHead>
                    <TableHead>Comissão Recebida</TableHead>
                    <TableHead>% Recebido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.segurado}</TableCell>
                      <TableCell>{item.seguradora}</TableCell>
                      <TableCell>{item.apolice || "-"}</TableCell>
                      <TableCell>
                        {item.comissaoPrevista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        {item.comissaoRecebida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={item.percentualRecebido >= 90 ? "text-emerald-600 font-semibold" : item.percentualRecebido > 0 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                            {item.percentualRecebido.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.ultimoPagamento || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum resultado encontrado para os filtros aplicados.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}