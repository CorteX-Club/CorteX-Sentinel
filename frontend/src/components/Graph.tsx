import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { FaSearch, FaSearchMinus, FaSearchPlus, FaFilter } from 'react-icons/fa';
import ExportOptions from './ExportOptions';

interface GraphProps {
  data: {
    target: string;
    subdomains: any[];
    ips: string[];
    services: any[];
  };
  onNodeClick?: (node: any) => void;
}

const Graph: React.FC<GraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [search, setSearch] = useState('');
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeFilters, setActiveFilters] = useState({
    target: true,
    subdomain: true,
    ip: true,
    service: true
  });
  const [groupSubdomains, setGroupSubdomains] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [maxNodesVisible, setMaxNodesVisible] = useState(100);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !data || !data.target) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Limpa o SVG
    d3.select(svgRef.current).selectAll("*").remove();

    // Prepara os dados para o gráfico
    const nodes: any[] = [];
    const links: any[] = [];

    // Adiciona o alvo principal se o filtro estiver ativo
    if (activeFilters.target) {
      nodes.push({
        id: data.target,
        name: data.target,
        type: 'target',
        value: 20
      });
    }

    // Verifica quantos subdomínios existem para decidir se agrupa ou não
    const tooManySubdomains = data.subdomains.length > 50;
    
    // Gerencia agrupamentos para subdomínios grandes
    const subdomainGroups: Record<string, any[]> = {};
    
    // Adiciona subdomínios se o filtro estiver ativo
    if (activeFilters.subdomain) {
      // Limita o número de subdomínios visíveis se necessário
      const visibleSubdomains = data.subdomains.slice(0, maxNodesVisible);
      
      if (groupSubdomains && tooManySubdomains) {
        // Agrupa subdomínios por padrão (ex: *.example.com)
        visibleSubdomains.forEach(subdomain => {
          const parts = subdomain.name.split('.');
          const rootDomain = parts.slice(-2).join('.');
          const prefix = parts.slice(0, -2).join('.');
          
          // Usa o primeiro caractere como grupo para agrupar (a.*, b.*, etc)
          const groupKey = prefix.charAt(0) || '_';
          
          if (!subdomainGroups[groupKey]) {
            subdomainGroups[groupKey] = [];
          }
          
          subdomainGroups[groupKey].push(subdomain);
        });
        
        // Cria nós para cada grupo
        Object.keys(subdomainGroups).forEach(groupKey => {
          const group = subdomainGroups[groupKey];
          const groupId = `group-${groupKey}`;
          
          nodes.push({
            id: groupId,
            name: `Grupo ${groupKey}* (${group.length})`,
            type: 'subdomain-group',
            value: 15,
            childCount: group.length,
            children: group
          });
          
          if (activeFilters.target) {
            links.push({
              source: data.target,
              target: groupId,
              type: 'subdomain-link'
            });
          }
        });
      } else {
        // Adiciona subdomínios individualmente
        visibleSubdomains.forEach(subdomain => {
          nodes.push({
            id: subdomain.name,
            name: subdomain.name,
            type: 'subdomain',
            value: 10,
            source: subdomain.source
          });

          if (activeFilters.target) {
            links.push({
              source: data.target,
              target: subdomain.name,
              type: 'subdomain-link'
            });
          }

          // Conecta subdomínios aos IPs se ambos os filtros estiverem ativos
          if (activeFilters.ip && subdomain.ips && subdomain.ips.length > 0) {
            subdomain.ips.forEach((ip: string) => {
              links.push({
                source: subdomain.name,
                target: ip,
                type: 'ip-link'
              });
            });
          }
        });
      }
    }

    // Adiciona IPs se o filtro estiver ativo
    if (activeFilters.ip) {
      // Limita o número de IPs visíveis
      const visibleIPs = data.ips.slice(0, maxNodesVisible);
      
      visibleIPs.forEach(ip => {
        if (!nodes.some(node => node.id === ip)) {
          nodes.push({
            id: ip,
            name: ip,
            type: 'ip',
            value: 8
          });
        }
      });
    }

    // Adiciona serviços se o filtro estiver ativo
    if (activeFilters.service) {
      // Limita o número de serviços visíveis
      const visibleServices = data.services.slice(0, maxNodesVisible);
      
      visibleServices.forEach(service => {
        const serviceId = `${service.ip}:${service.port}`;
        nodes.push({
          id: serviceId,
          name: `${service.service} (${service.port})`,
          fullName: `${service.service} on port ${service.port}`,
          type: 'service',
          value: 5,
          service: service
        });

        if (activeFilters.ip) {
          links.push({
            source: service.ip,
            target: serviceId,
            type: 'service-link'
          });
        }
      });
    }

    // Aplica a filtragem se houver termo de busca
    if (search) {
      const searchLower = search.toLowerCase();
      const filteredNodeIds = nodes
        .filter(node => node.name.toLowerCase().includes(searchLower))
        .map(node => node.id);
      
      setHighlightedNodes(filteredNodeIds);
    } else {
      setHighlightedNodes([]);
    }

    // Ajusta a força de repulsão com base no número de nós
    const chargeStrength = Math.min(-300, -30 * Math.log(nodes.length));
    
    // Configurações de força do gráfico
    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(d => {
        // Distâncias maiores para gráficos com muitos nós
        if (nodes.length > 100) return 150;
        if (nodes.length > 50) return 120;
        return 100;
      }))
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1))
      .force("collision", d3.forceCollide().radius((d: any) => d.value * 2.5));

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Adiciona zoom e arraste
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setTransform({ 
          x: event.transform.x, 
          y: event.transform.y, 
          k: event.transform.k 
        });
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    // Restaura a transformação anterior
    if (transform.k !== 1) {
      svg.call(
        zoom.transform as any, 
        d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k)
      );
    }

    const g = svg.append("g");

    // Adiciona marcadores de seta para os links
    svg.append("defs").selectAll("marker")
      .data(["subdomain-link", "ip-link", "service-link"])
      .enter().append("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", d => {
        if (d === "subdomain-link") return "#8b5cf6";
        if (d === "ip-link") return "#10b981";
        return "#3b82f6";
      })
      .attr("d", "M0,-5L10,0L0,5");

    // Renderiza os links com cores diferentes para cada tipo
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", d => {
        if (d.type === "subdomain-link") return "#8b5cf6";
        if (d.type === "ip-link") return "#10b981";
        return "#3b82f6";
      })
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.7)
      .attr("marker-end", d => `url(#arrow-${d.type})`)
      .style("filter", "drop-shadow(0px 0px 1px rgba(255, 255, 255, 0.2))");

    // Grupos para os nós
    const node = g.append("g")
      .selectAll(".node")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .attr("data-id", (d) => d.id)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onNodeClick) onNodeClick(d);
      })
      .on("mouseover", (event, d) => {
        const isHighlighted = search ? highlightedNodes.includes(d.id) : false;
        setTooltip({
          show: true,
          text: d.fullName || d.name,
          x: event.pageX,
          y: event.pageY
        });

        // Destaca os nós conectados
        const connectedLinks = links.filter(link => link.source.id === d.id || link.target.id === d.id);
        const connectedNodeIds = new Set<string>();
        connectedLinks.forEach(link => {
          connectedNodeIds.add(typeof link.source === 'object' ? link.source.id : link.source);
          connectedNodeIds.add(typeof link.target === 'object' ? link.target.id : link.target);
        });

        d3.selectAll(".node")
          .style("opacity", (node: any) => {
            const nodeId = node.id || '';
            return nodeId === d.id || connectedNodeIds.has(nodeId) ? 1 : 0.3;
          });

        d3.selectAll("line")
          .style("opacity", (link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return sourceId === d.id || targetId === d.id ? 1 : 0.1;
          })
          .style("stroke-width", (link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return sourceId === d.id || targetId === d.id ? 2.5 : 1.5;
          });
      })
      .on("mouseout", () => {
        setTooltip({ show: false, text: '', x: 0, y: 0 });
        d3.selectAll(".node").style("opacity", 1);
        d3.selectAll("line")
          .style("opacity", 0.6)
          .style("stroke-width", 1.5);
      })
      .call(d3.drag()
        .on("start", (event, d) => {
          setIsDragging(true);
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          setIsDragging(false);
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    // Renderiza os círculos para os nós com cores diferentes para cada tipo
    node.append("circle")
      .attr("r", (d) => {
        if (d.type === "target") return 30;
        if (d.type === "subdomain") return 15;
        if (d.type === "subdomain-group") return 20;
        if (d.type === "ip") return 12;
        return 10;
      })
      .attr("fill", (d) => {
        if (d.type === "target") return "#ef4444";
        if (d.type === "subdomain") return "#8b5cf6";
        if (d.type === "ip") return "#10b981";
        return "#3b82f6";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("opacity", (d) => {
        if (search && highlightedNodes.length > 0) {
          return highlightedNodes.includes(d.id) ? 1 : 0.3;
        }
        return 1;
      })
      .style("filter", "drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.3))");

    // Adiciona rótulos aos nós apenas se showLabels for true
    if (showLabels) {
      node.append("text")
        .attr("dx", 15)
        .attr("dy", ".35em")
        .attr("font-size", (d) => {
          if (d.type === "target") return "16px";
          if (d.type === "subdomain-group") return "14px";
          if (d.type === "subdomain") return "12px";
          return "11px";
        })
        .style("fill", (d) => {
          if (search && highlightedNodes.length > 0) {
            return highlightedNodes.includes(d.id) ? "#fff" : "#9ca3af";
          }
          return "#fff";
        })
        .style("font-weight", (d) => {
          if (d.type === "target" || d.type === "subdomain-group") return "bold";
          if (search && highlightedNodes.includes(d.id)) return "bold";
          return "normal";
        })
        .style("text-shadow", "0px 0px 3px rgba(0, 0, 0, 0.7)")
        .text((d) => {
          const maxTextLength = nodes.length > 50 ? 15 : 25;
          return d.name && d.name.length > maxTextLength ? 
                 d.name.substring(0, maxTextLength-2) + '...' : 
                 d.name || '';
        })
        .style("pointer-events", "none");
    }

    // Atualiza as posições dos elementos durante a simulação
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    // Adicionar evento de arrastar para o canvas inteiro
    svg.on("mousedown", (event) => {
      if (event.target === svgRef.current) {
        setIsDraggingCanvas(true);
        setDragStart({ x: event.clientX, y: event.clientY });
      }
    });

    svg.on("mousemove", (event) => {
      if (isDraggingCanvas) {
        const dx = event.clientX - dragStart.x;
        const dy = event.clientY - dragStart.y;
        setDragOffset({ x: dx, y: dy });
        setTransform(prev => ({ 
          ...prev, 
          x: prev.x + dx / prev.k, 
          y: prev.y + dy / prev.k 
        }));
        setDragStart({ x: event.clientX, y: event.clientY });
        // Atualizar o transform da visualização
        svg.call(
          zoom.transform as any,
          d3.zoomIdentity
            .translate(transform.x + dx / transform.k, transform.y + dy / transform.k)
            .scale(transform.k)
        );
      }
    });

    svg.on("mouseup", () => {
      setIsDraggingCanvas(false);
    });

    svg.on("mouseleave", () => {
      setIsDraggingCanvas(false);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, search, highlightedNodes, onNodeClick, transform, isDraggingCanvas, dragStart, dragOffset, activeFilters, groupSubdomains, showLabels, maxNodesVisible]);

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.1, 10]);
    svg.transition().call(
      zoom.transform as any, 
      d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k * 1.2)
    );
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.1, 10]);
    svg.transition().call(
      zoom.transform as any, 
      d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k / 1.2)
    );
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.1, 10]);
    svg.transition().call(
      zoom.transform as any, 
      d3.zoomIdentity
    );
    setTransform({ x: 0, y: 0, k: 1 });
  };

  const renderLegend = () => {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-sm">
        <div className="font-medium mb-2 text-white">Legenda</div>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <div className="text-gray-300">Alvo Principal</div>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            <div className="text-gray-300">Subdomínios</div>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <div className="text-gray-300">Endereços IP</div>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <div className="text-gray-300">Serviços</div>
          </div>
        </div>
      </div>
    );
  };

  // Função para alternar filtros
  const toggleFilter = (filterType: 'target' | 'subdomain' | 'ip' | 'service') => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }));
  };

  // Função para alternar o menu de filtros
  const toggleFilterMenu = () => {
    setShowFilterMenu(!showFilterMenu);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar nós..."
              className="bg-dark-card border border-dark-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-cortex-purple-500 focus:border-transparent w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-gray-400 text-sm">
            {highlightedNodes.length > 0 && `${highlightedNodes.length} resultados`}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <div className="relative">
            <button
              className="p-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border/50 text-gray-300 transition"
              onClick={toggleFilterMenu}
              title="Filtros"
            >
              <FaFilter />
            </button>
            
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-2 bg-dark-card border border-dark-border rounded-lg p-2 shadow-lg z-10">
                <div className="space-y-2 w-48">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.target} 
                        onChange={() => toggleFilter('target')}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>Alvo Principal</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.subdomain} 
                        onChange={() => toggleFilter('subdomain')}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>Subdomínios</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.ip} 
                        onChange={() => toggleFilter('ip')}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>IPs</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.service} 
                        onChange={() => toggleFilter('service')}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>Serviços</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-border">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={groupSubdomains} 
                        onChange={() => setGroupSubdomains(!groupSubdomains)}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>Agrupar Subdomínios</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={showLabels} 
                        onChange={() => setShowLabels(!showLabels)}
                        className="rounded bg-dark-border text-cortex-purple-500 focus:ring-cortex-purple-500"
                      />
                      <span>Mostrar Rótulos</span>
                    </label>
                  </div>
                  <div className="pt-2 border-t border-dark-border">
                    <label className="text-sm text-gray-300">
                      <span>Máx. Nós Visíveis: {maxNodesVisible}</span>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        step="50"
                        value={maxNodesVisible}
                        onChange={(e) => setMaxNodesVisible(Number(e.target.value))}
                        className="w-full mt-1"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleZoomIn}
            className="p-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border/50 text-gray-300 transition"
            title="Aumentar zoom"
          >
            <FaSearchPlus />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border/50 text-gray-300 transition"
            title="Diminuir zoom"
          >
            <FaSearchMinus />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border/50 text-gray-300 transition text-xs"
            title="Resetar visualização"
          >
            Reset
          </button>
          <ExportOptions 
            data={data} 
            targetRef={containerRef} 
            filename={`cortex-map-${data.target}`} 
          />
        </div>
      </div>
      
      <div className="flex flex-1 gap-4">
        <div 
          ref={containerRef} 
          className="flex-1 bg-dark-card border border-dark-border rounded-lg overflow-hidden relative"
          style={{ 
            cursor: isDragging ? 'grabbing' : isDraggingCanvas ? 'grabbing' : 'grab',
            height: '75vh',
            minHeight: '600px'
          }}
        >
          <svg 
            ref={svgRef} 
            className="w-full h-full"
          ></svg>
          
          {tooltip.show && (
            <div 
              className="absolute bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-white pointer-events-none"
              style={{ 
                left: tooltip.x - (containerRef.current?.getBoundingClientRect().left || 0) + 10,
                top: tooltip.y - (containerRef.current?.getBoundingClientRect().top || 0) + 10,
                maxWidth: '250px',
                zIndex: 10,
                boxShadow: '0 0 10px rgba(163, 92, 255, 0.5)'
              }}
            >
              {tooltip.text}
            </div>
          )}
          
          <div className="absolute bottom-4 right-4 text-sm text-gray-300 bg-dark-card bg-opacity-70 px-2 py-1 rounded">
            Zoom: {Math.round(zoomLevel * 100)}%
          </div>
        </div>
        
        <div className="w-44 flex-shrink-0">
          {renderLegend()}
          
          <div className="mt-4 bg-dark-card border border-dark-border rounded-lg p-3 text-sm">
            <div className="font-medium mb-2 text-white">Dicas</div>
            <ul className="space-y-2 text-gray-400 text-xs">
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Arraste os nós para organizar o gráfico</span>
              </li>
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Arraste o fundo para mover o gráfico inteiro</span>
              </li>
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Use a roda do mouse ou os botões para zoom</span>
              </li>
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Passe o mouse sobre um nó para ver detalhes</span>
              </li>
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Clique em um nó para selecionar</span>
              </li>
              <li className="flex items-start">
                <span className="mr-1">•</span>
                <span>Exporte o mapa para JSON ou PDF</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Graph; 