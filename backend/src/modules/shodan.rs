use crate::{OsintModule, types::{Service, ModuleResult, Subdomain}};
use anyhow::Result;
use async_trait::async_trait;
use serde::Deserialize;
use std::net::IpAddr;
use std::collections::{HashSet, HashMap};
use futures::future::join_all;
use tokio::time::timeout;
use std::time::Duration;

// Estruturas para deserialização da API do Shodan
#[derive(Debug, Deserialize)]
struct ShodanResponse {
    matches: Option<Vec<ShodanMatch>>,
    total: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct ShodanMatch {
    ip_str: String,
    port: u16,
    transport: Option<String>,
    product: Option<String>,
    version: Option<String>,
    data: Option<String>,
    hostnames: Option<Vec<String>>,
    domains: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ShodanHostResponse {
    ip_str: String,
    ports: Option<Vec<u16>>,
    hostnames: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    data: Option<Vec<ShodanDataDetail>>,
}

#[derive(Debug, Deserialize)]
struct ShodanDataDetail {
    port: u16,
    transport: Option<String>,
    product: Option<String>,
    version: Option<String>,
    data: Option<String>,
}

pub struct ShodanModule {
    api_key: String,
    client: reqwest::Client,
}

impl ShodanModule {
    pub fn new(api_key: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default();
            
        Self { api_key, client }
    }
    
    // Função auxiliar para realizar consultas em paralelo
    async fn search_shodan(&self, target: &str, is_ip: bool) -> Result<ShodanResponse> {
        // Determina a consulta base
        let base_query = if is_ip {
            format!("ip:{}", target)
        } else {
            format!("hostname:{}", target)
        };
        
        // Consultas adicionais para expandir os resultados
        let queries = vec![
            base_query.clone(),
            format!("{}+port:80,443,8080,8443", base_query),
            format!("{}+has:web", base_query),
        ];
        
        // Executa as consultas em paralelo com timeout
        let client = &self.client;
        let api_key = &self.api_key;
        
        let search_futures = queries.iter().map(|query| {
            let url = format!(
                "https://api.shodan.io/shodan/host/search?key={}&query={}",
                api_key, 
                urlencoding::encode(query)
            );
            let client = client.clone();
            
            async move {
                let result = timeout(
                    Duration::from_secs(10),
                    client.get(&url).send()
                ).await;
                
                match result {
                    Ok(Ok(response)) => {
                        if response.status().is_success() {
                            match response.json::<ShodanResponse>().await {
                                Ok(data) => Some(data),
                                Err(_) => None,
                            }
                        } else {
                            None
                        }
                    },
                    _ => None,
                }
            }
        });
        
        let results = join_all(search_futures).await;
        
        // Combina os resultados de todas as consultas
        let mut combined = ShodanResponse {
            matches: Some(Vec::new()),
            total: Some(0),
        };
        
        let mut seen_ips = HashSet::new();
        
        for result in results.into_iter().flatten() {
            if let Some(matches) = result.matches {
                for m in matches {
                    if !seen_ips.contains(&m.ip_str) {
                        seen_ips.insert(m.ip_str.clone());
                        combined.matches.as_mut().unwrap().push(m);
                    }
                }
            }
            
            if let Some(total) = result.total {
                if let Some(ref mut combined_total) = combined.total {
                    *combined_total += total;
                }
            }
        }
        
        Ok(combined)
    }
    
    // Consulta detalhada para um IP específico
    async fn get_host_details(&self, ip: String) -> Option<ShodanHostResponse> {
        let url = format!(
            "https://api.shodan.io/shodan/host/{}?key={}",
            ip, self.api_key
        );
        
        let result = timeout(
            Duration::from_secs(8),
            self.client.get(&url).send()
        ).await;
        
        match result {
            Ok(Ok(response)) => {
                if response.status().is_success() {
                    response.json::<ShodanHostResponse>().await.ok()
                } else {
                    None
                }
            },
            _ => None,
        }
    }
}

#[async_trait]
impl OsintModule for ShodanModule {
    fn name(&self) -> &'static str {
        "Shodan"
    }
    
    async fn scan(&self, target: &str) -> Result<ModuleResult> {
        let mut result = ModuleResult::default();
        
        // Verifica se temos uma API key
        if self.api_key.is_empty() {
            tracing::warn!("API key do Shodan não fornecida, pulando consulta");
            return Ok(result);
        }
        
        tracing::info!("Consultando Shodan para {}", target);
        
        // Determina se o target é um IP ou domínio
        let is_ip = target.parse::<IpAddr>().is_ok();
        
        // Realiza a busca principal
        let shodan_data = self.search_shodan(target, is_ip).await?;
        
        // Mapeia de IP para hostnames/domínios para extrair subdomínios
        let mut ip_hostnames_map: HashMap<String, Vec<String>> = HashMap::new();
        
        // Processamento inicial e coleta de IPs únicos
        let mut unique_ips = HashSet::new();
        
        if let Some(matches) = &shodan_data.matches {
            for m in matches {
                unique_ips.insert(m.ip_str.clone());
                
                // Coleta hostnames associados a este IP
                if let Some(hostnames) = &m.hostnames {
                    ip_hostnames_map
                        .entry(m.ip_str.clone())
                        .or_insert_with(Vec::new)
                        .extend(hostnames.iter().cloned());
                }
            }
        }
        
        // Consulta detalhes para cada IP em paralelo (limitado a 10 IPs para evitar sobrecarga)
        let ips_to_query: Vec<String> = unique_ips.iter()
            .take(10)
            .cloned()
            .collect();
            
        let detail_futures = ips_to_query.iter().map(|ip| {
            let ip_clone = ip.clone();
            self.get_host_details(ip_clone)
        });
        
        let details_results = join_all(detail_futures).await;
        
        // Processa os detalhes para enriquecer os resultados
        for (i, detail_opt) in details_results.into_iter().enumerate() {
            if let Some(detail) = detail_opt {
                let ip = &ips_to_query[i];
                
                // Adiciona hostnames ao mapeamento
                if let Some(hostnames) = detail.hostnames {
                    ip_hostnames_map
                        .entry(ip.clone())
                        .or_insert_with(Vec::new)
                        .extend(hostnames);
                }
                
                // Processa serviços detalhados
                if let Some(data_details) = detail.data {
                    for service_detail in data_details {
                        let service_name = match (service_detail.product, service_detail.version) {
                            (Some(prod), Some(ver)) => format!("{} {}", prod, ver),
                            (Some(prod), None) => prod,
                            (None, _) => service_detail.transport.unwrap_or_else(|| "unknown".to_string()),
                        };
                        
                        result.services.push(Service {
                            ip: ip.clone(),
                            port: service_detail.port,
                            service: service_name,
                            banner: service_detail.data,
                            source: self.name().to_string(),
                        });
                    }
                }
            }
        }
        
        // Processa os resultados da consulta principal
        if let Some(matches) = shodan_data.matches {
            for m in matches {
                // Adiciona IP à lista se ainda não estiver presente
                result.ips.push(m.ip_str.clone());
                
                // Prepara o nome do serviço
                let service_name = match (m.product, m.version) {
                    (Some(prod), Some(ver)) => format!("{} {}", prod, ver),
                    (Some(prod), None) => prod,
                    (None, _) => m.transport.unwrap_or_else(|| "unknown".to_string()),
                };
                
                // Adiciona o serviço à lista de resultados
                result.services.push(Service {
                    ip: m.ip_str,
                    port: m.port,
                    service: service_name,
                    banner: m.data,
                    source: self.name().to_string(),
                });
            }
        }
        
        // Processa subdomínios a partir dos hostnames mapeados
        for (ip, hostnames) in ip_hostnames_map {
            for hostname in hostnames {
                if hostname.contains(target) && hostname != target {
                    result.subdomains.push(Subdomain {
                        name: hostname,
                        ip: Some(ip.clone()),
                        first_seen: None,
                        last_seen: None,
                        source: self.name().to_string(),
                    });
                }
            }
        }
        
        // Remove duplicatas
        let unique_ips: HashSet<_> = result.ips.drain(..).collect();
        result.ips.extend(unique_ips);
        
        let mut unique_services = HashSet::new();
        result.services.retain(|service| {
            let key = format!("{}-{}-{}", service.ip, service.port, service.service);
            unique_services.insert(key)
        });
        
        let mut unique_subdomains = HashSet::new();
        result.subdomains.retain(|subdomain| {
            unique_subdomains.insert(subdomain.name.clone())
        });
        
        tracing::info!(
            "Shodan: encontrados {} IPs, {} serviços e {} subdomínios para {}",
            result.ips.len(),
            result.services.len(),
            result.subdomains.len(),
            target
        );
        
        Ok(result)
    }
} 