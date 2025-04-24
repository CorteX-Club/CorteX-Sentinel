import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { HiDotsVertical, HiDownload, HiX } from 'react-icons/hi';
import { FaCog, FaFilePdf, FaFileCode } from 'react-icons/fa';

interface ExportOptionsProps {
  onExport?: (format: string, data: any) => void;
  data: any;
  graphRef?: React.RefObject<HTMLDivElement>;
}

interface ExportSettings {
  includeGraph: boolean;
  includeSubdomains: boolean;
  includeIps: boolean;
  includeServices: boolean;
  paginateResults: boolean;
  fitToPage: boolean;
}

export default function ExportOptions({ onExport, data, graphRef }: ExportOptionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>({
    includeGraph: true,
    includeSubdomains: true,
    includeIps: true,
    includeServices: true,
    paginateResults: true,
    fitToPage: true,
  });

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const toggleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsOpen(!settingsOpen);
  };

  const updateSetting = (key: keyof ExportSettings, value: boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleJsonExport = () => {
    if (!data) return;
    
    try {
      const exportData = {
        target: data.target,
        date: new Date().toISOString(),
        subdomains: settings.includeSubdomains ? data.subdomains : [],
        ips: settings.includeIps ? data.ips : [],
        services: settings.includeServices ? data.services : []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${data.target}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      setMenuOpen(false);
    } catch (error) {
      console.error("Erro ao exportar JSON:", error);
      alert("Erro ao exportar dados como JSON");
    }
  };

  const handlePdfExport = async () => {
    if (!data) return;
    setExporting(true);
    
    try {
      // Criar documento PDF com orientação paisagem
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Definir margens e dimensões
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      
      // Adicionar cabeçalho com título e data
      pdf.setFontSize(20);
      pdf.setTextColor(75, 0, 130); // Roxo escuro
      pdf.text(`Relatório para ${data.target}`, margin, margin + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100); // Cinza
      pdf.text(`Gerado em: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, margin + 16);
      
      pdf.setTextColor(0, 0, 0); // Preto para o resto do documento
      pdf.setFontSize(12);
      
      // Posição inicial para o conteúdo abaixo do cabeçalho
      let yPos = margin + 25;
      
      // Função helper para adicionar nova página
      const addNewPage = () => {
        pdf.addPage();
        yPos = margin + 15;
        
        // Adicionar cabeçalho da página
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${data.target} - Página ${pdf.getNumberOfPages()}`, margin, margin + 5);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
      };
      
      // Função para verificar se precisa de nova página antes de adicionar conteúdo
      const checkNewPage = (contentHeight: number) => {
        if (yPos + contentHeight + 10 > pageHeight - margin) {
          addNewPage();
          return true;
        }
        return false;
      };

      // Adicionar gráfico se ativado nas configurações
      if (settings.includeGraph && graphRef?.current) {
        try {
          const canvas = await html2canvas(graphRef.current, {
            scale: 1,
            backgroundColor: '#1f2937', // Fundo escuro do gráfico
            logging: false
          });
          
          const imgData = canvas.toDataURL('image/png');
          
          // Calcular dimensões para ajustar ao PDF
          let imgWidth = contentWidth;
          let imgHeight = canvas.height * imgWidth / canvas.width;
          
          // Se a opção fitToPage estiver ativada, garantir que a imagem caiba na página
          if (settings.fitToPage && imgHeight > contentHeight * 0.75) {
            imgHeight = contentHeight * 0.75;
            imgWidth = canvas.width * imgHeight / canvas.height;
          }
          
          // Verificar espaço disponível
          checkNewPage(imgHeight + 15);
          
          // Adicionar título da seção
          pdf.setFontSize(14);
          pdf.setTextColor(75, 0, 130);
          pdf.text("Visualização do Grafo", margin, yPos);
          yPos += 8;
          
          // Restaurar formatação padrão
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          
          // Centralizar a imagem
          const xPos = margin + (contentWidth - imgWidth) / 2;
          
          // Adicionar a imagem
          pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (err) {
          console.error("Erro ao capturar gráfico:", err);
          pdf.setTextColor(255, 0, 0);
          pdf.text("Erro ao capturar gráfico. Verifique o console para detalhes.", margin, yPos);
          pdf.setTextColor(0, 0, 0);
          yPos += 10;
        }
      }
      
      // Função para processar arrays de dados com paginação
      const processDataArray = (
        title: string, 
        dataArray: any[], 
        formatter: (item: any) => string,
        columnHeaders?: string[],
        itemsPerPage: number = 40
      ) => {
        if (!dataArray || dataArray.length === 0) return;
        
        // Verificar espaço ou adicionar nova página
        checkNewPage(30);
        
        // Título da seção
        pdf.setFontSize(14);
        pdf.setTextColor(75, 0, 130);
        pdf.text(`${title} (${dataArray.length})`, margin, yPos);
        yPos += 8;
        
        // Restaurar formatação de texto
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        // Se não estiver paginando, mostrar todos os resultados
        if (!settings.paginateResults) {
          itemsPerPage = dataArray.length;
        }
        
        // Definir layout de colunas se fornecido
        if (columnHeaders && columnHeaders.length > 0) {
          // Configuração para tabela
          const numColumns = columnHeaders.length;
          const colWidth = contentWidth / numColumns;
          
          // Adicionar cabeçalhos das colunas
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          
          columnHeaders.forEach((header, index) => {
            pdf.text(header, margin + (colWidth * index), yPos);
          });
          
          yPos += 5;
          
          // Linha divisória
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 5;
          
          pdf.setTextColor(0, 0, 0);
          
          // Calcular número de páginas necessárias
          const totalPages = Math.ceil(dataArray.length / itemsPerPage);
          
          // Processar dados página por página
          for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            const pageStart = pageNum * itemsPerPage;
            const pageEnd = Math.min((pageNum + 1) * itemsPerPage, dataArray.length);
            
            // Adicionar nova página se não for a primeira página de dados
            if (pageNum > 0) {
              addNewPage();
              
              // Re-adicionar cabeçalhos das colunas
              pdf.setFontSize(10);
              pdf.setTextColor(100, 100, 100);
              
              columnHeaders.forEach((header, index) => {
                pdf.text(header, margin + (colWidth * index), yPos);
              });
              
              yPos += 5;
              
              // Linha divisória
              pdf.setDrawColor(200, 200, 200);
              pdf.line(margin, yPos, pageWidth - margin, yPos);
              yPos += 5;
              
              pdf.setTextColor(0, 0, 0);
            }
            
            // Processar itens desta página
            for (let i = pageStart; i < pageEnd; i++) {
              const item = dataArray[i];
              const row = formatter(item);
              const rowParts = row.split('|');
              
              // Verificar se precisa de nova página
              if (yPos > pageHeight - margin - 15) {
                addNewPage();
                
                // Re-adicionar cabeçalhos
                pdf.setFontSize(10);
                pdf.setTextColor(100, 100, 100);
                
                columnHeaders.forEach((header, index) => {
                  pdf.text(header, margin + (colWidth * index), yPos);
                });
                
                yPos += 5;
                
                // Linha divisória
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 5;
                
                pdf.setTextColor(0, 0, 0);
              }
              
              // Adicionar linha de dados
              rowParts.forEach((part, index) => {
                const xPos = margin + (colWidth * index);
                pdf.text(part.trim(), xPos, yPos);
              });
              
              yPos += 5;
            }
            
            // Adicionar indicadores de paginação se houver múltiplas páginas
            if (totalPages > 1) {
              pdf.setFontSize(8);
              pdf.setTextColor(100, 100, 100);
              pdf.text(`Página ${pageNum + 1} de ${totalPages} para ${title}`, margin, pageHeight - margin - 5);
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(10);
            }
          }
        } else {
          // Layout simples para listas sem colunas
          yPos += 5;
          
          // Calcular itens por página
          const itemsPerPage = settings.paginateResults ? 50 : dataArray.length;
          const totalPages = Math.ceil(dataArray.length / itemsPerPage);
          
          for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            const pageStart = pageNum * itemsPerPage;
            const pageEnd = Math.min((pageNum + 1) * itemsPerPage, dataArray.length);
            
            // Adicionar nova página se não for a primeira
            if (pageNum > 0) {
              addNewPage();
              
              // Re-adicionar título da seção
              pdf.setFontSize(14);
              pdf.setTextColor(75, 0, 130);
              pdf.text(`${title} (continuação)`, margin, yPos);
              yPos += 8;
              
              pdf.setFontSize(10);
              pdf.setTextColor(0, 0, 0);
            }
            
            // Processar cada item
            for (let i = pageStart; i < pageEnd; i++) {
              const item = dataArray[i];
              const text = formatter(item);
              
              // Verificar se precisa de nova página
              if (yPos > pageHeight - margin - 10) {
                addNewPage();
                
                // Re-adicionar título da seção
                pdf.setFontSize(14);
                pdf.setTextColor(75, 0, 130);
                pdf.text(`${title} (continuação)`, margin, yPos);
                yPos += 8;
                
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
              }
              
              pdf.text(text, margin, yPos);
              yPos += 5;
            }
            
            // Adicionar indicadores de paginação
            if (totalPages > 1) {
              pdf.setFontSize(8);
              pdf.setTextColor(100, 100, 100);
              pdf.text(`Página ${pageNum + 1} de ${totalPages} para ${title}`, margin, pageHeight - margin - 5);
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(10);
            }
          }
        }
        
        yPos += 10;
      };
      
      // Processar subdomínios
      if (settings.includeSubdomains && data.subdomains?.length > 0) {
        processDataArray(
          'Subdomínios', 
          data.subdomains, 
          (subdomain) => `${subdomain.name} | ${subdomain.ip || 'N/A'}`,
          ['Subdomínio', 'IP']
        );
      }
      
      // Processar IPs
      if (settings.includeIps && data.ips?.length > 0) {
        processDataArray(
          'Endereços IP', 
          data.ips, 
          (ip) => `${ip.ip} | ${ip.ports?.join(', ') || 'N/A'} | ${ip.isp || 'N/A'} | ${ip.location || 'N/A'}`,
          ['Endereço IP', 'Portas', 'ISP', 'Localização']
        );
      }
      
      // Processar serviços
      if (settings.includeServices && data.services?.length > 0) {
        processDataArray(
          'Serviços', 
          data.services, 
          (service) => `${service.name} | ${service.port} | ${service.protocol} | ${service.status || 'desconhecido'}`,
          ['Serviço', 'Porta', 'Protocolo', 'Status']
        );
      }
      
      // Adicionar rodapé com informações de geração
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      const pageCount = pdf.getNumberOfPages();
      
      // Adicionar rodapé a todas as páginas
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.text(
          `Gerado por CorteX Map em ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Página ${i} de ${pageCount}`,
          margin,
          pageHeight - 5
        );
      }
      
      // Salvar o PDF
      pdf.save(`${data.target}_relatório_${new Date().toISOString().split('T')[0]}.pdf`);
      setMenuOpen(false);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Erro ao gerar PDF. Verifique o console para detalhes.");
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="p-2 flex items-center justify-center bg-dark-card border border-dark-border rounded text-white hover:bg-dark-hover transition-colors"
        disabled={exporting}
        title="Opções de exportação"
      >
        {exporting ? (
          <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
        ) : (
          <HiDownload className="text-lg" />
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-dark-card border border-dark-border rounded shadow-lg z-20">
          <div className="flex items-center justify-between p-2 border-b border-dark-border">
            <span className="text-sm font-medium text-gray-300">Exportar</span>
            <button
              onClick={toggleMenu}
              className="text-gray-400 hover:text-white"
            >
              <HiX className="text-sm" />
            </button>
          </div>
          
          <div className="p-1">
            <button
              onClick={handleJsonExport}
              className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-hover rounded flex items-center"
            >
              <FaFileCode className="mr-2" /> JSON
            </button>
            
            <div className="flex items-center">
              <button
                onClick={handlePdfExport}
                className="flex-grow px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-hover rounded flex items-center"
              >
                <FaFilePdf className="mr-2" /> PDF
              </button>
              
              <button
                onClick={toggleSettings}
                className="px-2 py-2 text-gray-300 hover:bg-dark-hover rounded flex items-center"
                title="Configurações de PDF"
              >
                <FaCog />
              </button>
            </div>
            
            {settingsOpen && (
              <div className="mt-1 p-2 bg-dark-hover rounded">
                <div className="text-xs font-medium text-gray-400 mb-1">Configurações de PDF</div>
                
                <div className="space-y-1">
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.includeGraph}
                      onChange={() => updateSetting('includeGraph', !settings.includeGraph)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Incluir gráfico
                  </label>
                  
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.includeSubdomains}
                      onChange={() => updateSetting('includeSubdomains', !settings.includeSubdomains)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Incluir subdomínios
                  </label>
                  
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.includeIps}
                      onChange={() => updateSetting('includeIps', !settings.includeIps)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Incluir IPs
                  </label>
                  
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.includeServices}
                      onChange={() => updateSetting('includeServices', !settings.includeServices)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Incluir serviços
                  </label>
                  
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.paginateResults}
                      onChange={() => updateSetting('paginateResults', !settings.paginateResults)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Paginar resultados
                  </label>
                  
                  <label className="flex items-center text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.fitToPage}
                      onChange={() => updateSetting('fitToPage', !settings.fitToPage)}
                      className="mr-2 rounded accent-cortex-purple-500"
                    />
                    Ajustar ao tamanho da página
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 