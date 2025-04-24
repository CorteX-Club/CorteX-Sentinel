import Head from 'next/head';
import { useState } from 'react';
import { motion } from 'framer-motion';
import SearchForm from '../components/SearchForm';
import ResultsGraph from '../components/ResultsGraph';
import ResultsTable from '../components/ResultsTable';
import Logo from '../components/Logo';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const graphRef = useState<HTMLDivElement | null>(null);
  
  const handleSearch = async (target: string) => {
    setLoading(true);
    
    try {
      // Requisição real ao backend
      const response = await fetch('http://localhost:3300/api/target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target }),
      });
      
      if (!response.ok) {
        throw new Error(`Erro: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erro ao consultar API:', error);
      // Tratamento de erro aqui (poderia mostrar um alerta)
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!results) return;
    
    switch (format) {
      case 'pdf':
        exportToPDF();
        break;
      case 'svg':
        exportToSVG();
        break;
      case 'json':
        exportToJSON();
        break;
      default:
        console.error('Formato de exportação não suportado');
    }
  };
  
  const exportToPDF = async () => {
    if (!results) return;
    
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const width = doc.internal.pageSize.getWidth();
    const margin = 10;
    
    // Adicionar título
    doc.setFontSize(20);
    doc.setTextColor(163, 92, 255);
    doc.text(`Relatório CorteX MAP: ${results.target}`, margin, margin + 10);
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, margin, margin + 20);
    
    // Adicionar separador
    doc.setDrawColor(163, 92, 255);
    doc.line(margin, margin + 25, width - margin, margin + 25);
    
    // Dados do alvo
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Informações do Alvo', margin, margin + 35);
    
    let yPos = margin + 45;
    
    // Subdomínios
    if (results.subdomains && results.subdomains.length > 0) {
      doc.setFontSize(12);
      doc.text(`Subdomínios (${results.subdomains.length})`, margin, yPos);
      yPos += 10;
      
      results.subdomains.slice(0, 20).forEach((subdomain: any, index: number) => {
        if (yPos > 180) {
          doc.addPage();
          yPos = margin + 10;
        }
        
        const source = subdomain.source ? ` [${subdomain.source}]` : '';
        doc.setFontSize(10);
        doc.text(`${index + 1}. ${subdomain.name}${source}`, margin + 5, yPos);
        yPos += 6;
      });
      
      if (results.subdomains.length > 20) {
        doc.setFontSize(10);
        doc.text(`... e mais ${results.subdomains.length - 20} subdomínios`, margin + 5, yPos);
        yPos += 10;
      } else {
        yPos += 5;
      }
    }
    
    // IPs
    if (results.ips && results.ips.length > 0) {
      if (yPos > 160) {
        doc.addPage();
        yPos = margin + 10;
      }
      
      doc.setFontSize(12);
      doc.text(`IPs (${results.ips.length})`, margin, yPos);
      yPos += 10;
      
      results.ips.slice(0, 15).forEach((ip: string, index: number) => {
        doc.setFontSize(10);
        doc.text(`${index + 1}. ${ip}`, margin + 5, yPos);
        yPos += 6;
      });
      
      if (results.ips.length > 15) {
        doc.setFontSize(10);
        doc.text(`... e mais ${results.ips.length - 15} IPs`, margin + 5, yPos);
        yPos += 10;
      } else {
        yPos += 5;
      }
    }
    
    // Serviços
    if (results.services && results.services.length > 0) {
      if (yPos > 160) {
        doc.addPage();
        yPos = margin + 10;
      }
      
      doc.setFontSize(12);
      doc.text(`Serviços (${results.services.length})`, margin, yPos);
      yPos += 10;
      
      results.services.slice(0, 15).forEach((service: any, index: number) => {
        doc.setFontSize(10);
        doc.text(`${index + 1}. ${service.ip}:${service.port} - ${service.service}`, margin + 5, yPos);
        yPos += 6;
      });
      
      if (results.services.length > 15) {
        doc.setFontSize(10);
        doc.text(`... e mais ${results.services.length - 15} serviços`, margin + 5, yPos);
      }
    }
    
    // Adicionar rodapé
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`CorteX MAP - @mairinkdev - Página ${i} de ${pageCount}`, width / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }
    
    // Salvar o PDF
    doc.save(`cortex-map-${results.target}-${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  const exportToSVG = async () => {
    if (!document.querySelector('.graph-container')) {
      console.error('Elemento do gráfico não encontrado');
      return;
    }
    
    try {
      const container = document.querySelector('.graph-container') as HTMLElement;
      const canvas = await html2canvas(container, {
        backgroundColor: '#121212',
        scale: 2
      });
      
      // Converter para imagem
      const imgData = canvas.toDataURL('image/png');
      
      // Criar link para download
      const link = document.createElement('a');
      link.download = `cortex-map-${results.target}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error('Erro ao exportar SVG:', error);
    }
  };
  
  const exportToJSON = () => {
    if (!results) return;
    
    // Criar objeto JSON formatado
    const jsonData = JSON.stringify(results, null, 2);
    
    // Criar Blob e link para download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `cortex-map-${results.target}-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
    
    // Liberar URL
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <title>CorteX MAP - OSINT Passivo</title>
        <meta name="description" content="Ferramenta de footprint digital baseada em OSINT passivo" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Logo />
          </motion.div>
          <motion.h1 
            className="title-glow text-4xl md:text-5xl font-bold mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            CorteX MAP
          </motion.h1>
          <motion.p 
            className="text-gray-400 mt-2 text-center max-w-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Visualização e coleta de pegadas digitais com OSINT passivo
          </motion.p>
        </div>

        <motion.div 
          className="max-w-xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <SearchForm onSearch={handleSearch} loading={loading} />
        </motion.div>

        {results && (
          <div className="mt-4">
            <div className="flex mb-6 space-x-2 border-b border-dark-border">
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'graph' 
                    ? 'bg-dark-card text-cortex-purple-500 border-t border-l border-r border-dark-border' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Visualização do Grafo
              </button>
              <button
                onClick={() => setActiveTab('subdomains')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'subdomains' 
                    ? 'bg-dark-card text-cortex-purple-500 border-t border-l border-r border-dark-border' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Subdomínios ({results.subdomains?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('ips')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'ips' 
                    ? 'bg-dark-card text-cortex-purple-500 border-t border-l border-r border-dark-border' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                IPs ({results.ips?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'services' 
                    ? 'bg-dark-card text-cortex-purple-500 border-t border-l border-r border-dark-border' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Serviços ({results.services?.length || 0})
              </button>
            </div>
            
            <div className="graph-container" style={{ height: 'calc(100vh - 350px)', minHeight: '500px', width: '100%' }}>
              {activeTab === 'graph' && (
                <div className="h-full w-full">
                  <ResultsGraph data={results} />
                </div>
              )}
              {activeTab === 'subdomains' && (
                <ResultsTable data={results} type="subdomains" />
              )}
              {activeTab === 'ips' && (
                <ResultsTable data={results} type="ips" />
              )}
              {activeTab === 'services' && (
                <ResultsTable data={results} type="services" />
              )}
            </div>
          </div>
        )}

        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p className="mb-1">CorteX Club</p>
          <p className="mb-1">Desenvolvedor: <a href="https://github.com/mairinkdev" target="_blank" rel="noopener noreferrer" className="text-cortex-purple-400 hover:text-cortex-purple-300">@mairinkdev</a></p>
        </footer>
      </div>
    </>
  );
} 