import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, XCircle, Search, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";

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
  apolice: string;
  seguradora: string;
  comissaoPrevista: number;
  comissaoRecebida: number;
  percentualRecebido: number;
  status: 'received' | 'partial' | 'pending';
  parcelas: number;
  ultimoPagamento?: string;
}

// Mock data - In real implementation, this would come from the Google Sheets API
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'partial' | 'pending'>('all');
  const [seguradoraFilter, setSeguradoraFilter] = useState<string>('all');

  // Process data to create commission summary
  const commissionSummary: CommissionSummary[] = useMemo(() => {
    const summaryMap = new Map<string, CommissionSummary>();

    // Process policy data
    mockPolicyData.forEach(policy => {
      const key = policy.apolice || `${policy.segurado}_${policy.seguradora}`;
      summaryMap.set(key, {
        segurado: policy.segurado,
        apolice: policy.apolice || 'N/A',
        seguradora: policy.seguradora,
        comissaoPrevista: policy.comissaoPrevista,
        comissaoRecebida: 0,
        percentualRecebido: 0,
        status: 'pending',
        parcelas: policy.parcelas
      });
    });

    // Process payment data
    mockPaymentData.forEach(payment => {
      const key = payment.apolice || `${payment.segurado}_${payment.seguradora}`;
      const summary = summaryMap.get(key);
      if (summary) {
        summary.comissaoRecebida += payment.comissaoRecebida;
        summary.ultimoPagamento = payment.pgtoColaborador;
      }
    });

    // Calculate percentages and status
    summaryMap.forEach(summary => {
      if (summary.comissaoPrevista > 0) {
        summary.percentualRecebido = (summary.comissaoRecebida / summary.comissaoPrevista) * 100;
        
        if (summary.percentualRecebido >= 90) {
          summary.status = 'received';
        } else if (summary.percentualRecebido > 0) {
          summary.status = 'partial';
        } else {
          summary.status = 'pending';
        }
      }
    });

    return Array.from(summaryMap.values());
  }, []);

  // Filter data
  const filteredData = commissionSummary.filter(item => {
    const matchesSearch = item.segurado.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.apolice.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.seguradora.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSeguradora = seguradoraFilter === 'all' || item.seguradora === seguradoraFilter;
    
    return matchesSearch && matchesStatus && matchesSeguradora;
  });

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const received = commissionSummary.filter(item => item.status === 'received');
    const partial = commissionSummary.filter(item => item.status === 'partial');
    const pending = commissionSummary.filter(item => item.status === 'pending');
    
    const totalPrevista = commissionSummary.reduce((sum, item) => sum + item.comissaoPrevista, 0);
    const totalRecebida = commissionSummary.reduce((sum, item) => sum + item.comissaoRecebida, 0);
    
    return {
      totalClients: commissionSummary.length,
      received: received.length,
      partial: partial.length,
      pending: pending.length,
      totalPrevista,
      totalRecebida,
      percentualGeral: totalPrevista > 0 ? (totalRecebida / totalPrevista) * 100 : 0
    };
  }, [commissionSummary]);

  const getStatusBadge = (status: CommissionSummary['status'], percentage: number) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-gradient-success text-success-foreground border-0"><CheckCircle className="w-3 h-3 mr-1" />Recebida</Badge>;
      case 'partial':
        return <Badge className="bg-gradient-pending text-pending-foreground border-0"><Clock className="w-3 h-3 mr-1" />Parcial ({percentage.toFixed(1)}%)</Badge>;
      case 'pending':
        return <Badge className="bg-gradient-warning text-warning-foreground border-0"><XCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  const seguradorasUnique = Array.from(new Set(commissionSummary.map(item => item.seguradora)));

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Dashboard de Comissões
        </h1>
        <p className="text-muted-foreground">
          Controle e acompanhamento de comissões de seguros
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalClients}</div>
          </CardContent>
        </Card>

        <Card className="border-success bg-gradient-success/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Recebidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.received}</div>
            <p className="text-xs text-success/80">≥90% recebido</p>
          </CardContent>
        </Card>

        <Card className="border-pending bg-gradient-pending/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebendo Parcelado</CardTitle>
            <Clock className="h-4 w-4 text-pending" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pending">{metrics.partial}</div>
            <p className="text-xs text-pending/80">&lt;90% recebido</p>
          </CardContent>
        </Card>

        <Card className="border-warning bg-gradient-warning/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Recebidas</CardTitle>
            <XCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.pending}</div>
            <p className="text-xs text-warning/80">0% recebido</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-primary" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Comissão Prevista</p>
              <p className="text-2xl font-bold">R$ {metrics.totalPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Comissão Recebida</p>
              <p className="text-2xl font-bold text-success">R$ {metrics.totalRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Percentual Geral</p>
              <p className="text-2xl font-bold">{metrics.percentualGeral.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={metrics.percentualGeral} className="h-3" />
        </CardContent>
      </Card>

      {/* Filters and Data Table */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Detalhamento por Cliente</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, apólice ou seguradora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="received">Comissão Recebida</SelectItem>
                <SelectItem value="partial">Recebendo Parcelado</SelectItem>
                <SelectItem value="pending">Não Recebida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={seguradoraFilter} onValueChange={setSeguradoraFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Seguradora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Seguradoras</SelectItem>
                {seguradorasUnique.map(seguradora => (
                  <SelectItem key={seguradora} value={seguradora}>{seguradora}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Apólice</TableHead>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Prevista</TableHead>
                  <TableHead>Recebida</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.segurado}</TableCell>
                    <TableCell className="font-mono text-sm">{item.apolice}</TableCell>
                    <TableCell>{item.seguradora}</TableCell>
                    <TableCell>R$ {item.comissaoPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-success">R$ {item.comissaoRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{item.percentualRecebido.toFixed(1)}%</span>
                        {item.percentualRecebido >= 90 ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : item.percentualRecebido > 0 ? (
                          <TrendingUp className="w-4 h-4 text-pending" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status, item.percentualRecebido)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.ultimoPagamento || 'Não informado'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum resultado encontrado para os filtros aplicados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}