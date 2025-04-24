import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import ExportOptions from './ExportOptions';
import * as d3 from 'd3';
import { FaSearchPlus, FaSearchMinus, FaExpand, FaCompress, FaFilter, FaSlidersH, FaLock, FaLockOpen, FaCog, FaPlus, FaMinus } from 'react-icons/fa';
import html2canvas from 'html2canvas';

interface Node {
  id: string;
  type: string; // Modificado para aceitar qualquer tipo de string
  label: string;
  data?: any;
  group?: string;
  fixed?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  color?: string;
  size?: number;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  id?: string;
  color?: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface GraphSettings {
  showDomains: boolean;
  showSubdomains: boolean;
  showIPs: boolean;
  showServices: boolean;
  nodeSeparation: number;
  nodeLimit: number;
  groupingThreshold: number;
}

// Mock de processamento de dados para a visualização
const processDataForGraph = (data: any): GraphData => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeIds = new Set<string>();
  
  if (!data) return { nodes, edges };
  
  console.log('Dados brutos recebidos:', JSON.stringify(data, null, 2));
  
  // Função auxiliar para adicionar nós
  const addNode = (id: string, label: string, type: 'domain' | 'subdomain' | 'ip' | 'service', group?: string) => {
    if (!nodeIds.has(id)) {
      nodes.push({ id, label, type, group });
      nodeIds.add(id);
      console.log(`Adicionado nó: ${type} - ${label}`);
    }
  };
  
  // Adicionar o nó do domínio principal
  if (data.target) {
    addNode(`domain-${data.target}`, data.target, 'domain');
  }

  // Verificar se está recebendo os dados em um formato alternativo
  if (data.subdomains && Array.isArray(data.subdomains)) {
    console.log('Formato alternativo detectado com data.subdomains');
    // Processar subdomínios diretamente do objeto data
    data.subdomains.forEach((subdomain: any, index: number) => {
      if (typeof subdomain === 'string') {
        const subdomainId = `subdomain-${subdomain}-direct`;
        addNode(subdomainId, subdomain, 'subdomain');
        if (data.target) {
          edges.push({ source: `domain-${data.target}`, target: subdomainId, type: 'has_subdomain' });
        }
      } else if (subdomain && (subdomain.name || subdomain.subdomain)) {
        const subName = subdomain.name || subdomain.subdomain;
        const subdomainId = `subdomain-${subName}-direct-${index}`;
        addNode(subdomainId, subName, 'subdomain');
        if (data.target) {
          edges.push({ source: `domain-${data.target}`, target: subdomainId, type: 'has_subdomain' });
        }
      }
    });
  }
  
  // Processar subdomínios a partir de domains
  if (data && Array.isArray(data.domains)) {
    console.log('Processando data.domains, contagem:', data.domains.length);
    data.domains.forEach((domain: any) => {
      const domainId = `domain-${domain.domain}`;
      addNode(domainId, domain.domain, 'domain');
      
      if (Array.isArray(domain.subdomains)) {
        console.log(`Processando subdomínios para ${domain.domain}, contagem:`, domain.subdomains.length);
        domain.subdomains.forEach((subdomain: any) => {
          if (typeof subdomain === 'string') {
            // Lidar com formato simples (string)
            const subdomainId = `subdomain-${subdomain}`;
            addNode(subdomainId, subdomain, 'subdomain');
            edges.push({ source: domainId, target: subdomainId, type: 'has_subdomain' });
          } else if (subdomain && subdomain.subdomain) {
            // Lidar com formato de objeto
            const subdomainId = `subdomain-${subdomain.subdomain}`;
            addNode(subdomainId, subdomain.subdomain, 'subdomain');
            edges.push({ source: domainId, target: subdomainId, type: 'has_subdomain' });
            
            // Processar IPs associados ao subdomínio
            if (subdomain.ips && Array.isArray(subdomain.ips)) {
              subdomain.ips.forEach((ip: any, ipIndex: number) => {
                if (typeof ip === 'string') {
                  // IP é uma string simples
                  const ipId = `ip-${ip}`;
                  addNode(ipId, ip, 'ip');
                  edges.push({ source: subdomainId, target: ipId, type: 'resolves_to' });
                } else if (ip && ip.ip) {
                  // IP é um objeto
                  const ipId = `ip-${ip.ip}`;
                  addNode(ipId, ip.ip, 'ip');
                  edges.push({ source: subdomainId, target: ipId, type: 'resolves_to' });
                  
                  // Processar serviços associados ao IP
                  if (ip.services && Array.isArray(ip.services)) {
                    ip.services.forEach((service: any) => {
                      if (service && service.port) {
                        const serviceName = service.name || `Port ${service.port}`;
                        const serviceId = `service-${ip.ip}-${service.port}`;
                        addNode(serviceId, `${serviceName}:${service.port}`, 'service');
                        edges.push({ source: ipId, target: serviceId, type: 'runs' });
                      }
                    });
                  }
                }
              });
            }
          }
        });
      }
    });
  }
  
  // Processamento direto de IPs (se estiverem no nível raiz)
  if (data.ips && Array.isArray(data.ips)) {
    console.log('Processando IPs, contagem:', data.ips.length);
    data.ips.forEach((ip: any) => {
      if (typeof ip === 'string') {
        const ipId = `ip-${ip}`;
        addNode(ipId, ip, 'ip');
        if (data.target) {
          edges.push({ source: `domain-${data.target}`, target: ipId, type: 'has_ip' });
        }
      } else if (ip && ip.ip) {
        const ipId = `ip-${ip.ip}`;
        addNode(ipId, ip.ip, 'ip');
        if (data.target) {
          edges.push({ source: `domain-${data.target}`, target: ipId, type: 'has_ip' });
        }
      }
    });
  }
  
  // Processamento direto de serviços (se estiverem no nível raiz)
  if (data.services && Array.isArray(data.services)) {
    console.log('Processando serviços, contagem:', data.services.length);
    data.services.forEach((service: any) => {
      if (service && service.ip && service.port) {
        // Primeiro, garantir que o IP existe
        const ipId = `ip-${service.ip}`;
        if (!nodeIds.has(ipId)) {
          addNode(ipId, service.ip, 'ip');
          if (data.target) {
            edges.push({ source: `domain-${data.target}`, target: ipId, type: 'has_ip' });
          }
        }
        
        // Adicionar o serviço
        const serviceName = service.name || `Port ${service.port}`;
        const serviceId = `service-${service.ip}-${service.port}`;
        addNode(serviceId, `${serviceName}:${service.port}`, 'service');
        edges.push({ source: ipId, target: serviceId, type: 'runs' });
      }
    });
  }
  
  // Dados de debug: logar para ver o que está sendo processado
  console.log('Nós gerados:', nodes.length);
  console.log('Arestas geradas:', edges.length);
  
  return { nodes, edges };
};

interface ResultsGraphProps {
  data: any;
}

const ResultsGraph: React.FC<ResultsGraphProps> = ({ data }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoomPanMatrix, setZoomPanMatrix] = useState('translate(0,0) scale(1)');
  const [visibleNodeTypes, setVisibleNodeTypes] = useState({
    domain: true,
    subdomain: true,
    ip: true,
    service: true
  });
  const [groupNodes, setGroupNodes] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [groupedMode, setGroupedMode] = useState(false);
  const [groupingThreshold, setGroupingThreshold] = useState(10);
  const [simulation, setSimulation] = useState<any>(null);
  const [enablePhysics, setEnablePhysics] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [forceSeparation, setForceSeparation] = useState(100);
  const [graphSettings, setGraphSettings] = useState<GraphSettings>({
    showDomains: true,
    showSubdomains: true,
    showIPs: true,
    showServices: true,
    nodeSeparation: 150,
    nodeLimit: 100,
    groupingThreshold: 5
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  const graphData = processDataForGraph(data);
  
  // Filtra os nós visíveis com base nas configurações
  const visibleNodes = graphData.nodes.filter(node => visibleNodeTypes[node.type]);
  
  // Filtra as arestas com base nos nós visíveis
  const visibleEdges = graphData.edges.filter(edge => {
    const sourceNode = graphData.nodes.find(node => node.id === edge.source);
    const targetNode = graphData.nodes.find(node => node.id === edge.target);
    
    return sourceNode && targetNode && 
           visibleNodeTypes[sourceNode.type] && 
           visibleNodeTypes[targetNode.type];
  });
  
  // Atualizar a transformação do SVG com base no zoom e offset
  useEffect(() => {
    const translateX = viewOffset.x;
    const translateY = viewOffset.y;
    const scale = zoomLevel;
    setZoomPanMatrix(`translate(${translateX},${translateY}) scale(${scale})`);
  }, [zoomLevel, viewOffset]);

  // Gerenciar o zoom com scroll do mouse
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      // Para zoom, usamos Ctrl+roda do mouse, e prevenimos o comportamento padrão
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.5, Math.min(2, zoomLevel + delta));
        setZoomLevel(newZoom);
      }
      // Caso contrário, permitimos o scroll normal
    },
    [zoomLevel]
  );

  // Gerenciar o arraste do gráfico
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Só inicia o arraste se clicou no fundo do SVG, não em um nó
    if ((e.target as SVGElement).tagName === 'svg') {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (dragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setViewOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [dragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Resetar a visualização
  const resetView = useCallback(() => {
    setZoomLevel(1);
    setViewOffset({ x: 0, y: 0 });
  }, []);
  
  // Função para calcular posições dos nós em um layout melhorado
  const calculateNodePositions = useCallback(() => {
    const centerX = 400;
    const centerY = 300;
    let radius = 200 * zoomLevel;
    
    const domainNode = visibleNodes.find(n => n.type === 'domain');
    const subdomainNodes = visibleNodes.filter(n => n.type === 'subdomain');
    const ipNodes = visibleNodes.filter(n => n.type === 'ip');
    const serviceNodes = visibleNodes.filter(n => n.type === 'service');
    
    const positions: Record<string, { x: number, y: number }> = {};
    
    // Posição do domínio principal (centro)
    if (domainNode) {
      positions[domainNode.id] = { x: centerX, y: centerY };
    }
    
    if (groupNodes) {
      // Agrupar subdomínios por grupo
      const subdomainGroups: Record<string, Node[]> = {};
      subdomainNodes.forEach(node => {
        const group = node.group || 'outros';
        if (!subdomainGroups[group]) {
          subdomainGroups[group] = [];
        }
        subdomainGroups[group].push(node);
      });
      
      // Posicionar grupos de subdomínios em círculo
      const groupCount = Object.keys(subdomainGroups).length;
      Object.entries(subdomainGroups).forEach(([group, nodes], groupIndex) => {
        const groupAngle = (Math.PI * 2 * groupIndex) / groupCount;
        const groupX = centerX + radius * 0.7 * Math.cos(groupAngle);
        const groupY = centerY + radius * 0.7 * Math.sin(groupAngle);
        
        // Posicionar nós dentro do grupo em um pequeno círculo
        nodes.forEach((node, nodeIndex) => {
          const nodeAngle = (Math.PI * 2 * nodeIndex) / Math.max(nodes.length, 1);
          const nodeRadius = 50 * zoomLevel;
          positions[node.id] = {
            x: groupX + nodeRadius * Math.cos(nodeAngle),
            y: groupY + nodeRadius * Math.sin(nodeAngle),
          };
        });
      });
      
      // Agrupar serviços por grupo
      const serviceGroups: Record<string, Node[]> = {};
      serviceNodes.forEach(node => {
        const group = node.group || 'outros';
        if (!serviceGroups[group]) {
          serviceGroups[group] = [];
        }
        serviceGroups[group].push(node);
      });
      
      // Posicionar IPs de forma distribuída
      ipNodes.forEach((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(ipNodes.length, 1);
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
      
      // Posicionar grupos de serviços próximos aos IPs relacionados
      serviceNodes.forEach((node) => {
        const parentEdge = visibleEdges.find(e => e.target === node.id);
        const parentIp = parentEdge?.source;
        if (parentIp && positions[parentIp]) {
          const group = node.group || 'outros';
          const groupNodes = serviceGroups[group];
          const groupIndex = groupNodes.indexOf(node);
          const angle = Math.PI / 4 + (Math.PI / 2) * (groupIndex / Math.max(groupNodes.length, 1));
          const nodeRadius = 40 * zoomLevel;
          positions[node.id] = {
            x: positions[parentIp].x + nodeRadius * Math.cos(angle),
            y: positions[parentIp].y + nodeRadius * Math.sin(angle),
          };
        } else {
          positions[node.id] = { x: centerX, y: centerY + 150 };
        }
      });
    } else {
      // Distribuição original
      // Distribuir subdomínios em semicírculo acima
      subdomainNodes.forEach((node, index) => {
        const angle = Math.PI * (0.2 + 0.6 * (index / Math.max(subdomainNodes.length - 1, 1)));
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY - radius * Math.sin(angle)
        };
      });
      
      // Distribuir IPs em semicírculo abaixo
      ipNodes.forEach((node, index) => {
        const angle = Math.PI * (1 + 0.5 * (index / Math.max(ipNodes.length - 1, 1)));
        positions[node.id] = {
          x: centerX + radius * 0.7 * Math.cos(angle),
          y: centerY + radius * 0.7 * Math.sin(angle)
        };
      });
      
      // Distribuir serviços abaixo dos IPs associados
      serviceNodes.forEach((node) => {
        const parentIp = visibleEdges.find(e => e.target === node.id)?.source;
        if (parentIp && positions[parentIp]) {
          positions[node.id] = {
            x: positions[parentIp].x,
            y: positions[parentIp].y + 50
          };
        } else {
          positions[node.id] = { x: centerX, y: centerY + 150 };
        }
      });
    }
    
    return positions;
  }, [visibleNodes, visibleEdges, zoomLevel, groupNodes]);
  
  const nodePositions = calculateNodePositions();
  
  const getNodeColor = (type: string, isHovered: boolean) => {
    switch (type) {
      case 'domain':
        return isHovered ? '#E2C7FF' : '#A35CFF';
      case 'subdomain':
        return isHovered ? '#CDA3FF' : '#8F38FF';
      case 'ip':
        return isHovered ? '#B880FF' : '#7B14FF';
      case 'service':
        return isHovered ? '#F6EBFF' : '#6600F0';
      default:
        return '#A35CFF';
    }
  };
  
  const getNodeSize = (type: string) => {
    switch (type) {
      case 'domain':
        return 30;
      case 'subdomain':
        return 20;
      case 'ip':
        return 25;
      case 'service':
        return 18;
      default:
        return 20;
    }
  };
  
  // Função para renderizar as arestas
  const renderEdges = () => {
    return visibleEdges.map((edge, index) => {
      const sourceNode = visibleNodes.find(node => node.id === edge.source);
      const targetNode = visibleNodes.find(node => node.id === edge.target);
      
      const sourcePos = sourceNode ? nodePositions[sourceNode.id] : null;
      const targetPos = targetNode ? nodePositions[targetNode.id] : null;
      
      if (!sourcePos || !targetPos) return null;
      
      return (
        <motion.line
          key={`edge-${edge.source}-${edge.target}-${index}`}
          x1={sourcePos.x}
          y1={sourcePos.y}
          x2={targetPos.x}
          y2={targetPos.y}
          stroke="#333333"
          strokeWidth={hoveredNode === edge.source || hoveredNode === edge.target ? 2 : 1}
          strokeOpacity={hoveredNode === edge.source || hoveredNode === edge.target ? 0.8 : 0.4}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: index * 0.05 }}
        />
      );
    });
  };
  
  // Função para renderizar os nós
  const renderNodes = () => {
    return visibleNodes.map((node) => {
      const position = nodePositions[node.id];
      if (!position) return null;
      
      const isHovered = hoveredNode === node.id;
      
      // Determinar cores com base no tipo e grupo
      let color = '#64748B'; // Cor padrão
      let size = 6;
      let strokeColor = '#CBD5E1';
      
      switch (node.type) {
        case 'domain':
          color = '#8B5CF6'; // Roxo
          size = 12;
          strokeColor = '#A78BFA';
          break;
        case 'subdomain':
          if (node.group) {
            // Cores diferentes para diferentes grupos de subdomínios
            const groupColors: Record<string, string> = {
              'api': '#F472B6', // Rosa
              'dev': '#4ADE80', // Verde
              'staging': '#FBBF24', // Amarelo
              'test': '#60A5FA', // Azul
              'prod': '#F87171', // Vermelho
              'admin': '#C084FC', // Roxo claro
              'outros': '#94A3B8' // Cinza
            };
            color = groupColors[node.group] || groupColors['outros'];
          } else {
            color = '#38BDF8'; // Azul
          }
          size = 8;
          break;
        case 'ip':
          color = '#4ADE80'; // Verde
          size = 8;
          break;
        case 'service':
          if (node.group) {
            // Cores diferentes para diferentes grupos de serviços
            const groupColors: Record<string, string> = {
              'web': '#F472B6', // Rosa
              'email': '#4ADE80', // Verde
              'database': '#FBBF24', // Amarelo
              'file': '#60A5FA', // Azul
              'remote': '#F87171', // Vermelho
              'dns': '#C084FC', // Roxo claro
              'outros': '#94A3B8' // Cinza
            };
            color = groupColors[node.group] || groupColors['outros'];
          } else {
            color = '#FB923C'; // Laranja
          }
          size = 6;
          break;
      }
      
      return (
        <React.Fragment key={node.id}>
          {/* Círculo do nó */}
          <motion.circle
            cx={position.x}
            cy={position.y}
            r={size * (isHovered ? 1.3 : 1)}
            fill={color}
            stroke={strokeColor}
            strokeWidth={isHovered ? 2 : 1}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          />
          
          {/* Label do nó */}
          <motion.text
            x={position.x}
            y={position.y + size + 10}
            textAnchor="middle"
            fill={isHovered ? '#F1F5F9' : '#94A3B8'}
            fontSize={isHovered ? 12 : 10}
            fontWeight={isHovered ? 'bold' : 'normal'}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Limitar tamanho de texto para não sobrecarregar visualmente */}
            {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
          </motion.text>
          
          {/* Mostrar informações adicionais em hover */}
          {isHovered && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <rect
                x={position.x + 15}
                y={position.y - 15}
                width={Math.max(node.label.length * 7, 80)}
                height={node.group ? 60 : 40}
                rx={4}
                fill="#1E293B"
                stroke="#334155"
              />
              <text
                x={position.x + 25}
                y={position.y + 5}
                fontSize={12}
                fill="#F1F5F9"
              >
                {node.label}
              </text>
              <text
                x={position.x + 25}
                y={position.y + 25}
                fontSize={10}
                fill="#94A3B8"
              >
                Tipo: {node.type}
              </text>
              {node.group && (
                <text
                  x={position.x + 25}
                  y={position.y + 45}
                  fontSize={10}
                  fill="#94A3B8"
                >
                  Grupo: {node.group}
                </text>
              )}
            </motion.g>
          )}
        </React.Fragment>
      );
    });
  };
  
  // Agrupar nós similares quando há muitos nós
  const organizeNodes = (nodes: Node[], edges: Edge[]) => {
    if (!groupedMode || nodes.length <= groupingThreshold) {
      return { nodes, edges };
    }
    
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const groups: Record<string, {count: number, type: string, nodes: Node[]}> = {};
    
    // Criar grupos para subdomínios baseados no primeiro segmento
    const domainNode = nodes.find(node => node.type === 'domain');
    if (domainNode) {
      newNodes.push(domainNode);
      
      // Agrupar subdomínios
      nodes.filter(node => node.type === 'subdomain').forEach(node => {
        const name = node.label;
        const domainPart = data.target;
        
        // Extrair prefixo para agrupamento (primeiro segmento)
        if (name.includes(`.${domainPart}`)) {
          const prefix = name.replace(`.${domainPart}`, '').split('.')[0];
          const groupKey = `group_subdomain_${prefix}`;
          
          if (!groups[groupKey]) {
            groups[groupKey] = {
              count: 0,
              type: 'subdomain',
              nodes: []
            };
          }
          
          groups[groupKey].count++;
          groups[groupKey].nodes.push(node);
        } else {
          // Se não seguir o padrão, adiciona individualmente
          newNodes.push(node);
        }
      });
      
      // Agrupar IPs baseados em CIDR
      const ipGroups: Record<string, {nodes: Node[], count: number}> = {};
      nodes.filter(node => node.type === 'ip').forEach(node => {
        const ipAddress = node.label;
        // Simplificado: agrupar pelo primeiro octeto (poderia ser mais sofisticado usando CIDR real)
        const ipPrefix = ipAddress.split('.')[0];
        const groupKey = `group_ip_${ipPrefix}`;
        
        if (!ipGroups[groupKey]) {
          ipGroups[groupKey] = { nodes: [], count: 0 };
        }
        
        ipGroups[groupKey].nodes.push(node);
        ipGroups[groupKey].count++;
      });
      
      // Adicionar grupos de IPs apenas se houver múltiplos IPs no grupo
      Object.entries(ipGroups).forEach(([groupKey, group]) => {
        if (group.count > 1) {
          groups[groupKey] = {
            count: group.count,
            type: 'ip',
            nodes: group.nodes
          };
        } else {
          // Se só tem um IP no grupo, adicionar individualmente
          group.nodes.forEach(node => newNodes.push(node));
        }
      });
      
      // Agrupar serviços por tipo
      const serviceGroups: Record<string, {nodes: Node[], count: number, type: string}> = {};
      nodes.filter(node => node.type === 'service').forEach(node => {
        // Identificar tipo de serviço
        const serviceName = node.label.toLowerCase();
        let serviceType = 'other';
        
        if (serviceName.includes('http') || serviceName.includes('https') || serviceName.includes('www') || 
            serviceName.includes('web') || serviceName.includes('ssl')) {
          serviceType = 'web';
        } else if (serviceName.includes('ssh') || serviceName.includes('telnet') || 
                  serviceName.includes('rdp') || serviceName.includes('vnc')) {
          serviceType = 'remote';
        } else if (serviceName.includes('dns') || serviceName.includes('domain')) {
          serviceType = 'dns';
        } else if (serviceName.includes('smtp') || serviceName.includes('mail') || 
                  serviceName.includes('pop3') || serviceName.includes('imap')) {
          serviceType = 'email';
        } else if (serviceName.includes('ftp') || serviceName.includes('smb') || serviceName.includes('nfs')) {
          serviceType = 'file';
        }
        
        const groupKey = `group_service_${serviceType}`;
        
        if (!serviceGroups[groupKey]) {
          serviceGroups[groupKey] = { nodes: [], count: 0, type: serviceType };
        }
        
        serviceGroups[groupKey].nodes.push(node);
        serviceGroups[groupKey].count++;
      });
      
      // Adicionar grupos de serviços
      Object.entries(serviceGroups).forEach(([groupKey, group]) => {
        if (group.count > 1) {
          groups[groupKey] = {
            count: group.count,
            type: 'service',
            nodes: group.nodes
          };
        } else {
          // Se só tem um serviço no grupo, adicionar individualmente
          group.nodes.forEach(node => newNodes.push(node));
        }
      });
      
      // Criar nós de grupo
      Object.entries(groups).forEach(([groupKey, group]) => {
        if (group.count > 1) {
          // Criar nó representando o grupo
          const groupNode: Node = {
            id: groupKey,
            label: `${group.type === 'subdomain' ? 'Subdomínios' : 
                    group.type === 'ip' ? 'IPs' : 
                    group.type === 'service' ? `Serviços (${group.type})` : 'Grupo'} (${group.count})`,
            type: `${group.type}-group`,
            x: Math.random() * 500,
            y: Math.random() * 500,
            color: group.type === 'subdomain' ? '#6366f1' : 
                   group.type === 'ip' ? '#0ea5e9' : '#f59e0b',
            size: 25 + Math.min(group.count, 50) * 0.5
          };
          
          newNodes.push(groupNode);
          
          // Criar arestas do grupo para o domínio (para subdomínios)
          if (group.type === 'subdomain' && domainNode) {
            newEdges.push({
              id: `edge_${domainNode.id}_${groupNode.id}`,
              source: domainNode.id,
              target: groupNode.id,
              color: '#718096',
              type: 'has_subdomain'
            });
          }
          
          // Para cada nó original, encontrar suas conexões e criar conexões para o nó de grupo
          group.nodes.forEach(originalNode => {
            // Encontrar arestas conectadas a este nó
            edges.forEach(edge => {
              if (edge.source === originalNode.id) {
                // Se o alvo não está no mesmo grupo, adicionar aresta do grupo para o alvo
                const targetNode = nodes.find(n => n.id === edge.target);
                if (targetNode && !group.nodes.some(n => n.id === targetNode.id)) {
                  // Verificar se o alvo já é um nó no novo grafo ou se também está em um grupo
                  const targetInNewNodes = newNodes.find(n => n.id === targetNode.id);
                  
                  if (targetInNewNodes) {
                    // Se o alvo já está nos novos nós, criar aresta direta
                    const newEdgeId = `edge_${groupNode.id}_${targetNode.id}`;
                    if (!newEdges.some(e => e.id === newEdgeId)) {
                      newEdges.push({
                        id: newEdgeId,
                        source: groupNode.id,
                        target: targetNode.id,
                        color: edge.color,
                        type: edge.type
                      });
                    }
                  } else {
                    // Verificar se o alvo está em algum grupo
                    for (const [otherGroupKey, otherGroup] of Object.entries(groups)) {
                      if (otherGroup.nodes.some(n => n.id === targetNode.id)) {
                        // Encontrou o grupo onde o alvo está
                        const newEdgeId = `edge_${groupNode.id}_${otherGroupKey}`;
                        if (!newEdges.some(e => e.id === newEdgeId)) {
                          newEdges.push({
                            id: newEdgeId,
                            source: groupNode.id,
                            target: otherGroupKey,
                            color: edge.color,
                            type: edge.type
                          });
                        }
                        break;
                      }
                    }
                  }
                }
              } else if (edge.target === originalNode.id) {
                // Mesmo procedimento, mas para arestas onde o nó é o alvo
                const sourceNode = nodes.find(n => n.id === edge.source);
                if (sourceNode && !group.nodes.some(n => n.id === sourceNode.id)) {
                  const sourceInNewNodes = newNodes.find(n => n.id === sourceNode.id);
                  
                  if (sourceInNewNodes) {
                    const newEdgeId = `edge_${sourceNode.id}_${groupNode.id}`;
                    if (!newEdges.some(e => e.id === newEdgeId)) {
                      newEdges.push({
                        id: newEdgeId,
                        source: sourceNode.id,
                        target: groupNode.id,
                        color: edge.color,
                        type: edge.type
                      });
                    }
                  } else {
                    // Verificar se a fonte está em algum grupo
                    for (const [otherGroupKey, otherGroup] of Object.entries(groups)) {
                      if (otherGroup.nodes.some(n => n.id === sourceNode.id)) {
                        const newEdgeId = `edge_${otherGroupKey}_${groupNode.id}`;
                        if (!newEdges.some(e => e.id === newEdgeId)) {
                          newEdges.push({
                            id: newEdgeId,
                            source: otherGroupKey,
                            target: groupNode.id,
                            color: edge.color,
                            type: edge.type
                          });
                        }
                        break;
                      }
                    }
                  }
                }
              }
            });
          });
        }
      });
    } else {
      // Se não houver domínio, manter o grafo original
      return { nodes, edges };
    }
    
    return { nodes: newNodes, edges: newEdges };
  };
  
  useEffect(() => {
    if (!containerRef.current || !data) return;
    
    // ... existing code ...
    
    // Aplicar o algoritmo de agrupamento se ativado
    const organizedGraph = organizeNodes(graphData.nodes, graphData.edges);
    
    // ... existing code ...
  }, [data, containerRef, graphData.nodes, graphData.edges, groupedMode, groupingThreshold]);
  
  // Função para exportar o gráfico como imagem
  const exportToImage = () => {
    if (!containerRef.current) return;
    
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;
    
    try {
      // Usar html2canvas para capturar o SVG
      html2canvas(containerRef.current).then(canvas => {
        // Criar um link para download
        const link = document.createElement('a');
        link.download = `cortex-map-${data.target || 'export'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    } catch (error) {
      console.error('Erro ao exportar imagem:', error);
    }
  };
  
  return (
    <div className="relative w-full h-full bg-dark-background flex-grow" ref={containerRef} style={{ minHeight: '75vh' }}>
      <div className="absolute top-4 right-4 flex space-x-2 z-10">
        <button 
          onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2))}
          className="bg-dark-card p-2 rounded-full hover:bg-dark-border"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V20M4 12H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button 
          onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
          className="bg-dark-card p-2 rounded-full hover:bg-dark-border"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button 
          onClick={() => {
            setZoomLevel(1);
            setPosition({ x: 0, y: 0 });
          }}
          className="bg-dark-card p-2 rounded-full hover:bg-dark-border text-xs text-white"
          title="Redefinir visualização"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12Z" stroke="white" strokeWidth="2"/>
            <path d="M12 8V12L14 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button 
          onClick={() => exportToImage()}
          className="bg-dark-card p-2 rounded-full hover:bg-dark-border text-xs text-white"
          title="Exportar imagem"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      
      {/* Filtros de tipos de nós */}
      <div className="absolute top-4 left-4 z-10 bg-dark-card p-2 rounded-lg border border-dark-border">
        <div className="flex flex-col space-y-2">
          <label className="flex items-center text-xs text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleNodeTypes.domain}
              onChange={() => setVisibleNodeTypes(prev => ({ ...prev, domain: !prev.domain }))}
              className="mr-1 accent-cortex-purple-600"
            />
            Domínio
          </label>
          <label className="flex items-center text-xs text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleNodeTypes.subdomain}
              onChange={() => setVisibleNodeTypes(prev => ({ ...prev, subdomain: !prev.subdomain }))}
              className="mr-1 accent-cortex-purple-600"
            />
            Subdomínios
          </label>
          <label className="flex items-center text-xs text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleNodeTypes.ip}
              onChange={() => setVisibleNodeTypes(prev => ({ ...prev, ip: !prev.ip }))}
              className="mr-1 accent-cortex-purple-600"
            />
            IPs
          </label>
          <label className="flex items-center text-xs text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleNodeTypes.service}
              onChange={() => setVisibleNodeTypes(prev => ({ ...prev, service: !prev.service }))}
              className="mr-1 accent-cortex-purple-600"
            />
            Serviços
          </label>
          <div className="mt-2 pt-2 border-t border-dark-border">
            <label className="flex items-center text-xs text-gray-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={groupNodes}
                onChange={() => setGroupNodes(!groupNodes)}
                className="mr-1 accent-cortex-purple-600"
              />
              Agrupar nós semelhantes
            </label>
          </div>
        </div>
      </div>
      
      {/* Controles de zoom */}
      <div className="absolute bottom-4 right-4 z-10 flex space-x-2">
        <button
          onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 2))}
          className="bg-dark-card p-2 rounded-lg border border-dark-border text-gray-300 hover:bg-dark-card-hover"
          title="Aumentar zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button
          onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 0.5))}
          className="bg-dark-card p-2 rounded-lg border border-dark-border text-gray-300 hover:bg-dark-card-hover"
          title="Diminuir zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button
          onClick={resetView}
          className="bg-dark-card p-2 rounded-lg border border-dark-border text-gray-300 hover:bg-dark-card-hover"
          title="Resetar visualização"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </button>
      </div>
      
      {/* Info do zoom e instruções */}
      <div className="absolute bottom-4 left-4 z-10 bg-dark-card p-2 rounded-lg border border-dark-border text-xs text-gray-400">
        Zoom: {Math.round(zoomLevel * 100)}% | Arraste o fundo para mover | Use a roda do mouse para zoom
      </div>

      <div className="absolute bottom-3 left-3 flex space-x-2">
        <div className="px-2 py-1 bg-dark-card border border-dark-border rounded-lg flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-400 flex items-center">
              <input
                type="checkbox"
                checked={groupedMode}
                onChange={() => setGroupedMode(!groupedMode)}
                className="mr-1 accent-cortex-purple-600"
              />
              Agrupar nós
            </label>
          </div>
          
          {groupedMode && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Min:</span>
              <input
                type="range"
                min="5"
                max="50"
                value={groupingThreshold}
                onChange={(e) => setGroupingThreshold(parseInt(e.target.value))}
                className="w-16 h-1 accent-cortex-purple-600"
              />
              <span className="text-xs text-gray-400">{groupingThreshold}</span>
            </div>
          )}
        </div>
      </div>

      {/* Debug info - Temporário */}
      <div className="absolute bottom-20 left-4 z-10 bg-dark-card p-2 rounded-lg border border-dark-border text-xs text-gray-400 max-w-xs overflow-auto max-h-40">
        <h3>Debug Info:</h3>
        <div>Nós: {visibleNodes.length}</div>
        <div>Arestas: {visibleEdges.length}</div>
        <button 
          onClick={() => console.log('Data:', data)}
          className="bg-cortex-purple-600 text-white p-1 rounded mt-1"
        >
          Log Data
        </button>
      </div>

      <svg 
        width="100%" 
        height="100%" 
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          cursor: dragging ? 'grabbing' : 'grab', 
          minHeight: '100%', 
          display: 'block',
          maxWidth: '100%'
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#4B5563" />
          </marker>
        </defs>
        
        <g transform={zoomPanMatrix}>
          {renderEdges()}
          {renderNodes()}
        </g>
      </svg>
      
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 bg-dark-card p-3 rounded-md border border-dark-border max-w-xs">
          <h4 className="text-sm font-bold text-cortex-purple-400">
            {graphData.nodes.find(n => n.id === hoveredNode)?.label || 'Desconhecido'}
          </h4>
          <div className="text-xs text-gray-400 mt-1">
            Tipo: {
              (() => {
                const type = graphData.nodes.find(n => n.id === hoveredNode)?.type;
                switch (type) {
                  case 'domain': return 'Domínio Principal';
                  case 'subdomain': return 'Subdomínio';
                  case 'ip': return 'Endereço IP';
                  case 'service': return 'Serviço';
                  default: return type || 'Desconhecido';
                }
              })()
            }
          </div>
          {graphData.nodes.find(n => n.id === hoveredNode)?.data && (
            <div className="text-xs text-gray-400 mt-1">
              Fonte: {graphData.nodes.find(n => n.id === hoveredNode)?.data?.source || 'Desconhecida'}
            </div>
          )}
        </div>
      )}
      
      <div className="absolute top-4 left-4 text-xs bg-dark-card p-2 rounded-lg border border-dark-border opacity-60 hover:opacity-100 transition-opacity">
        <div className="font-medium mb-1 text-white">Legenda</div>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-cortex-purple-600 mr-1"></div>
            <span className="text-gray-400">Domínio</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-cortex-purple-700 mr-1"></div>
            <span className="text-gray-400">Subdomínio</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-cortex-purple-800 mr-1"></div>
            <span className="text-gray-400">IP</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-cortex-purple-900 mr-1"></div>
            <span className="text-gray-400">Serviço</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsGraph; 