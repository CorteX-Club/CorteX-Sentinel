import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SearchFormProps {
  onSearch: (target: string) => void;
  loading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, loading }) => {
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');

  // Função para limpar URLs e extrair o domínio ou IP
  const cleanUrl = (url: string): string => {
    // Remove protocolos (http://, https://)
    let cleaned = url.trim().toLowerCase();
    cleaned = cleaned.replace(/^(https?:\/\/)/, '');
    
    // Remove caminhos e parâmetros após o domínio
    cleaned = cleaned.split('/')[0];
    
    // Remove porta, se presente
    cleaned = cleaned.split(':')[0];
    
    return cleaned;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!target.trim()) {
      setError('Por favor, insira um domínio ou IP válido');
      return;
    }
    
    // Limpa a URL e extrai o domínio ou IP
    const cleanedTarget = cleanUrl(target);
    
    // Validação de IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    // Validação de domínio mais flexível
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z0-9]{2,}$/i;
    
    if (!ipRegex.test(cleanedTarget) && !domainRegex.test(cleanedTarget)) {
      setError('Por favor, insira um domínio ou IP válido');
      return;
    }
    
    setError('');
    onSearch(cleanedTarget);
  };

  return (
    <div className="card">
      <h2 className="text-xl font-medium mb-4">Iniciar Reconhecimento</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="target" className="block text-sm font-medium text-gray-400 mb-2">
            Domínio ou IP Alvo
          </label>
          <input
            type="text"
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="exemplo.com.br ou 192.168.1.1 ou https://site.com"
            className="input-field"
            disabled={loading}
          />
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </div>
        
        <motion.button
          type="submit"
          className="btn-primary w-full flex justify-center items-center"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processando...
            </>
          ) : (
            'Iniciar Mapeamento'
          )}
        </motion.button>
      </form>
      
      <div className="mt-6 text-xs text-gray-500">
        <p className="mb-1">🔒 <strong>Footprinting Passivo:</strong> Não gera tráfego de rede para o alvo</p>
        <p>🔍 <strong>Fontes OSINT:</strong> crt.sh, Shodan, Wayback Machine, Google Dorks</p>
      </div>
    </div>
  );
};

export default SearchForm; 