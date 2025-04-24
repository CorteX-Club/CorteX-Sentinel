import React, { useState, useEffect, useMemo } from 'react';
import { FaSortAlphaDown, FaSortAlphaUp, FaSearch, FaFilter, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { HiOutlineClipboardCopy } from 'react-icons/hi';

interface Service {
  ip: string;
  port: number;
  service: string;
  source?: string;
}

interface Subdomain {
  name: string;
  source?: string;
  ips?: string[];
}

interface ResultsTableProps {
  data: {
    target?: string;
    subdomains?: any[];
    ips?: any[];
    services?: any[];
  };
  type: 'subdomains' | 'ips' | 'services';
}

export default function ResultsTable({ data, type }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'name', 
    direction: 'asc' 
  });
  const [filter, setFilter] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Obter os dados relevantes com base no tipo
  const items = useMemo(() => {
    let rawItems = type === 'subdomains' 
      ? data.subdomains || []
      : type === 'ips' 
        ? data.ips || []
        : data.services || [];
        
    // Processamento adicional para normalizar os dados
    return rawItems.map(item => {
      const processedItem = { ...item };
      
      // Processar strings que contêm múltiplos subdomínios
      if (type === 'subdomains' && typeof item.name === 'string' && item.name.includes(' ')) {
        // Se o nome contém espaços e parece ser uma lista de subdomínios
        if (item.name.includes('.') && !item.name.includes('"') && !item.name.includes("'")) {
          // Dividir em subdomínios individuais e criar novos itens
          const subdomainNames = item.name.trim().split(/\s+/);
          
          // Se temos múltiplos subdomínios, dividir em itens separados
          if (subdomainNames.length > 1) {
            // Retornar apenas o primeiro subdomínio neste item, os outros serão criados depois
            processedItem.name = subdomainNames[0];
            processedItem._otherSubdomains = subdomainNames.slice(1);
          }
        }
      }
      
      // Processar strings que contêm múltiplos IPs
      if (type === 'ips' && typeof item.ip === 'string' && item.ip.includes(' ')) {
        // Se o IP contém espaços e parece ser uma lista de IPs
        const ipAddresses = item.ip.trim().split(/\s+/).filter(ip => 
          /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)
        );
        
        // Se temos múltiplos IPs, dividir em itens separados
        if (ipAddresses.length > 1) {
          processedItem.ip = ipAddresses[0];
          processedItem._otherIPs = ipAddresses.slice(1);
        }
      }
      
      return processedItem;
    });
  }, [data, type]);
  
  // Expandir itens que contêm múltiplos subdomínios/IPs
  const expandedItems = useMemo(() => {
    const result = [];
    
    for (const item of items) {
      // Adicionar o item original (já com o primeiro subdomínio/IP)
      result.push(item);
      
      // Adicionar itens adicionais para os outros subdomínios
      if (item._otherSubdomains && item._otherSubdomains.length > 0) {
        for (const subdomain of item._otherSubdomains) {
          // Criar um novo item com o mesmo ID e fonte, mas com um subdomínio diferente
          result.push({
            ...item,
            name: subdomain,
            _isDuplicate: true, // Marcar como item secundário
            _otherSubdomains: undefined // Não propagar a lista
          });
        }
      }
      
      // Adicionar itens adicionais para os outros IPs
      if (item._otherIPs && item._otherIPs.length > 0) {
        for (const ip of item._otherIPs) {
          // Criar um novo item com os mesmos dados, mas com um IP diferente
          result.push({
            ...item,
            ip: ip,
            _isDuplicate: true, // Marcar como item secundário
            _otherIPs: undefined // Não propagar a lista
          });
        }
      }
    }
    
    return result;
  }, [items]);
  
  // Processar dados de subdomínios para garantir que cada nome esteja em uma linha separada
  useEffect(() => {
    // Se estivermos lidando com subdomínios e houver dados
    if (type === 'subdomains' && data.subdomains) {
      // Percorrer todos os subdomínios
      data.subdomains.forEach(subdomain => {
        // Se o nome contém múltiplos subdomínios separados por espaço
        if (typeof subdomain.name === 'string' && subdomain.name.includes(' ')) {
          // Dividir e criar novos itens separados
          const names = subdomain.name.trim().split(/\s+/);
          if (names.length > 1) {
            // Atualizar o item atual para ter apenas o primeiro subdomínio
            subdomain.name = names[0];
            
            // Adicionar os outros como novos itens
            for (let i = 1; i < names.length; i++) {
              const newSubdomain = { ...subdomain, name: names[i] };
              // Apenas adicionar se ainda não existir
              if (!data.subdomains.some(s => s.name === names[i])) {
                data.subdomains.push(newSubdomain);
              }
            }
          }
        }
      });
    }
  }, [data, type]);
  
  // Definição de colunas por tipo
  const columns = useMemo(() => {
    switch (type) {
      case 'subdomains':
        return [
          { key: 'name', label: 'Subdomínio', sortable: true },
          { key: 'ip', label: 'IP', sortable: true },
          { key: 'source', label: 'Origem', sortable: true },
        ];
      case 'ips':
        return [
          { key: 'ip', label: 'IP', sortable: true },
          { key: 'ports', label: 'Portas', sortable: false },
          { key: 'isp', label: 'ISP', sortable: true },
          { key: 'location', label: 'Localização', sortable: true },
        ];
      case 'services':
        return [
          { key: 'name', label: 'Serviço', sortable: true },
          { key: 'port', label: 'Porta', sortable: true },
          { key: 'protocol', label: 'Protocolo', sortable: true },
          { key: 'status', label: 'Status', sortable: true },
        ];
      default:
        return [];
    }
  }, [type]);
  
  // Resetar a página atual quando o tipo de dados muda
  useEffect(() => {
    setCurrentPage(1);
    setFilter('');
    setAdvancedFilters({});
  }, [type]);
  
  // Ordenar e filtrar itens
  const sortedAndFilteredItems = useMemo(() => {
    let filteredItems = [...expandedItems];
    
    // Aplicar o filtro de texto simples
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        // Verifica se algum valor de campo do item contém o texto de filtro
        return Object.values(item).some(value => {
          if (value === null || value === undefined) return false;
          if (Array.isArray(value)) {
            return value.some(v => String(v).toLowerCase().includes(lowerFilter));
          }
          return String(value).toLowerCase().includes(lowerFilter);
        });
      });
    }
    
    // Aplicar filtros avançados
    if (Object.keys(advancedFilters).length > 0) {
      filteredItems = filteredItems.filter(item => {
        return Object.entries(advancedFilters).every(([key, value]) => {
          if (!value) return true;
          const lowerValue = value.toLowerCase();
          const itemValue = item[key];
          
          if (itemValue === null || itemValue === undefined) return false;
          if (Array.isArray(itemValue)) {
            return itemValue.some(v => String(v).toLowerCase().includes(lowerValue));
          }
          return String(itemValue).toLowerCase().includes(lowerValue);
        });
      });
    }
    
    // Ordenar itens
    return filteredItems.sort((a, b) => {
      // Obter os valores a serem comparados
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      // Lidar com valores indefinidos ou nulos
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;
      
      // Comparação personalizada por tipo de dado
      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        // Para arrays, comparar o primeiro elemento ou o comprimento
        const aCompare = aValue.length > 0 ? aValue[0] : '';
        const bCompare = bValue.length > 0 ? bValue[0] : '';
        
        if (sortConfig.direction === 'asc') {
          return String(aCompare).localeCompare(String(bCompare));
        } else {
          return String(bCompare).localeCompare(String(aCompare));
        }
      } else {
        // Comparação padrão para strings e números
        if (sortConfig.direction === 'asc') {
          return String(aValue).localeCompare(String(bValue));
        } else {
          return String(bValue).localeCompare(String(aValue));
        }
      }
    });
  }, [expandedItems, sortConfig, filter, advancedFilters]);
  
  // Cálculos para paginação
  const totalItems = sortedAndFilteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = sortedAndFilteredItems.slice(startIndex, endIndex);
  
  // Controle de paginação
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };
  
  // Ordenação
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };
  
  // Copiar para a área de transferência
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedItem(text);
        setTimeout(() => setCopiedItem(null), 2000);
      })
      .catch(err => console.error('Erro ao copiar:', err));
  };
  
  // Renderizar valor da célula com base no seu tipo
  const renderCellValue = (item: any, key: string) => {
    const value = item[key];
    
    if (value === undefined || value === null) {
      return <span className="text-gray-400">N/A</span>;
    }
    
    if (Array.isArray(value)) {
      // Exibir arrays como lista para melhor visualização
      return value.length > 0 
        ? (
            <div className="flex flex-col space-y-1">
              {value.map((v, idx) => (
                <span key={idx} className="whitespace-nowrap block">{v}</span>
              ))}
            </div>
          )
        : <span className="text-gray-400">-</span>;
    }
    
    // Detectar se há múltiplos subdomínios ou IPs em uma string (separados por espaço)
    if (typeof value === 'string' && (key === 'name' || key === 'ip')) {
      // Verifica se o valor contém espaços e se parece com uma lista de subdomínios/IPs
      if (value.includes(' ') && (
          value.includes('.') || 
          value.trim().split(/\s+/).every(part => /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})?$/.test(part))
        )) {
        const parts = value.trim().split(/\s+/);
        if (parts.length > 1) {
          return (
            <div className="flex flex-col space-y-1">
              {parts.map((part, idx) => (
                <span key={idx} className="whitespace-nowrap block">{part}</span>
              ))}
            </div>
          );
        }
      }
    }
    
    // Renderizar células especiais
    if (key === 'status') {
      const status = String(value).toLowerCase();
      const statusClasses = status === 'online' || status === 'active' || status === 'up'
        ? 'text-green-400'
        : status === 'unknown' || status === 'indefinido'
          ? 'text-yellow-400'
          : 'text-red-400';
      
      return <span className={statusClasses}>{value}</span>;
    }
    
    return <span className="whitespace-normal break-words">{value}</span>;
  };
  
  // Se não houver dados, mostrar mensagem
  if (!items || items.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        Nenhum dado encontrado.
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {/* Barra de filtros e paginação */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Filtrar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-dark-card px-4 py-1.5 pl-9 text-sm border border-dark-border rounded text-white w-48 focus:outline-none focus:ring-1 focus:ring-cortex-purple-600"
            />
            <FaSearch className="absolute left-3 top-2.5 text-gray-400" />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 text-sm rounded ${showFilters ? 'bg-cortex-purple-500 text-white' : 'bg-dark-card border border-dark-border text-gray-300'}`}
            title="Filtros avançados"
          >
            <FaFilter />
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-400">
            {totalItems === 0 
              ? 'Nenhum resultado' 
              : `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems}`}
          </div>
          
          <div className="flex items-center space-x-1">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Resetar para a primeira página
              }}
              className="bg-dark-card border border-dark-border text-sm rounded px-2 py-1 text-gray-300"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            
            <span className="text-sm text-gray-400">por página</span>
          </div>
        </div>
      </div>
      
      {/* Filtros avançados */}
      {showFilters && (
        <div className="mb-3 p-3 bg-dark-card border border-dark-border rounded flex flex-wrap gap-3">
          {columns.map((column) => (
            <div key={column.key} className="flex flex-col flex-grow min-w-[150px] max-w-xs">
              <label className="text-xs text-gray-400 mb-1">{column.label}</label>
              <input
                type="text"
                value={advancedFilters[column.key] || ''}
                onChange={(e) => setAdvancedFilters(prev => ({
                  ...prev,
                  [column.key]: e.target.value
                }))}
                placeholder={`Filtrar por ${column.label.toLowerCase()}`}
                className="bg-dark-input px-3 py-1.5 text-sm border border-dark-border rounded text-white focus:outline-none focus:ring-1 focus:ring-cortex-purple-600"
              />
            </div>
          ))}
          
          <div className="flex items-end w-full sm:w-auto">
            <button
              onClick={() => setAdvancedFilters({})}
              className="px-3 py-1.5 text-sm bg-dark-hover text-gray-300 hover:bg-dark-border rounded"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}
      
      {/* Tabela */}
      <div className="w-full overflow-x-auto bg-dark-card border border-dark-border rounded">
        <table className="min-w-full divide-y divide-dark-border">
          <thead>
            <tr>
              {columns.map((column) => (
                <th 
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="ml-1 focus:outline-none"
                      >
                        {sortConfig.key === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <FaSortAlphaDown className="text-cortex-purple-500" />
                          ) : (
                            <FaSortAlphaUp className="text-cortex-purple-500" />
                          )
                        ) : (
                          <FaSortAlphaDown className="text-gray-500 opacity-40" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {currentItems.map((item, index) => (
              <tr key={index} className="hover:bg-dark-hover transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-2.5 text-sm text-gray-300 max-w-xs">
                    {renderCellValue(item, column.key)}
                  </td>
                ))}
                <td className="px-4 py-2.5 w-10 text-right">
                  <button
                    onClick={() => handleCopy(type === 'subdomains' ? item.name : item.ip || item.name)}
                    className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                    title="Copiar"
                  >
                    <HiOutlineClipboardCopy size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className={`p-1.5 rounded ${currentPage === 1 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}`}
            >
              <span className="sr-only">Primeira</span>
              <FaChevronLeft />
              <FaChevronLeft className="-ml-2" />
            </button>
            
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-1.5 rounded ${currentPage === 1 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}`}
            >
              <span className="sr-only">Anterior</span>
              <FaChevronLeft />
            </button>
            
            {/* Botões de página */}
            <div className="flex items-center space-x-1 px-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                // Centralizar a página atual
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                if (pageNum <= 0 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={i}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                      currentPage === pageNum 
                        ? 'bg-cortex-purple-600 text-white' 
                        : 'text-gray-400 hover:bg-dark-hover hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded ${currentPage === totalPages ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}`}
            >
              <span className="sr-only">Próxima</span>
              <FaChevronRight />
            </button>
            
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded ${currentPage === totalPages ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}`}
            >
              <span className="sr-only">Última</span>
              <FaChevronRight />
              <FaChevronRight className="-ml-2" />
            </button>
          </div>
          
          <div className="text-sm text-gray-400">
            Total: {totalItems}
          </div>
        </div>
      )}
      
      {/* Toast para confirmação de cópia */}
      {copiedItem && (
        <div className="fixed bottom-4 right-4 bg-dark-card border border-dark-border px-4 py-2 rounded shadow-lg text-white text-sm z-50 animate-fade-in flex items-center">
          <span className="text-green-400 mr-2">✓</span>
          <span>Copiado para a área de transferência!</span>
        </div>
      )}
    </div>
  );
} 