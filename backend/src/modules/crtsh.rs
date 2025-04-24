use crate::{OsintModule, types::{Subdomain, ModuleResult}};
use anyhow::{Result, Context};
use async_trait::async_trait;
use serde::Deserialize;
use chrono::{DateTime, Utc, NaiveDateTime, TimeZone};
use regex::Regex;
use std::collections::HashSet;
use futures::future::join_all;

#[derive(Debug, Deserialize)]
struct CrtShEntry {
    name_value: String,
    #[serde(rename = "not_before")]
    first_seen: Option<String>,
    #[serde(rename = "not_after")]
    last_seen: Option<String>,
}

#[derive(Default)]
pub struct CrtShModule;

impl CrtShModule {
    pub fn new() -> Self {
        Self
    }
    
    // Função auxiliar para converter timestamp para DateTime
    fn parse_timestamp(&self, timestamp: &str) -> Option<DateTime<Utc>> {
        NaiveDateTime::parse_from_str(timestamp, "%Y-%m-%dT%H:%M:%S")
            .ok()
            .map(|ndt| Utc.from_utc_datetime(&ndt))
    }
    
    // Consulta paralelizada para diferentes variações da pesquisa
    async fn fetch_crt_data(&self, target: &str) -> Result<Vec<CrtShEntry>> {
        // Diferentes estratégias de consulta para maximizar resultados
        let query_strategies = vec![
            format!("%.{}", target),           // Subdomínios diretos
            format!("%.%.{}", target),         // Subdomínios de segundo nível
            format!("%25.{}", target),         // URL encoded
        ];
        
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .context("Falha ao criar cliente HTTP")?;
        
        // Executa consultas em paralelo
        let fetch_futures = query_strategies.iter().map(|query| {
            let client = &client;
            let url = format!("https://crt.sh/?q={}&output=json", query);
            
            async move {
                match client.get(&url).send().await {
                    Ok(response) => {
                        if response.status().is_success() {
                            match response.json::<Vec<CrtShEntry>>().await {
                                Ok(entries) => Ok::<Vec<CrtShEntry>, anyhow::Error>(entries),
                                Err(_) => Ok(vec![])
                            }
                        } else {
                            Ok(vec![])
                        }
                    },
                    Err(_) => Ok(vec![])
                }
            }
        });
        
        // Combina os resultados
        let results = join_all(fetch_futures).await;
        
        // Flatten e filtra erros
        let mut all_entries = Vec::new();
        for result in results {
            if let Ok(entries) = result {
                all_entries.extend(entries);
            }
        }
        
        Ok(all_entries)
    }
}

#[async_trait]
impl OsintModule for CrtShModule {
    fn name(&self) -> &'static str {
        "crt.sh"
    }
    
    async fn scan(&self, target: &str) -> Result<ModuleResult> {
        let mut result = ModuleResult::default();
        
        tracing::info!("Consultando crt.sh para {}", target);
        
        // Obtém dados do crt.sh com consultas paralelas
        let entries = self.fetch_crt_data(target).await?;
        
        // Expressão regular para limpar wildcards e caracteres inválidos
        let wildcard_regex = Regex::new(r"^\*\.").unwrap();
        
        // Conjunto para evitar duplicatas durante o processamento
        let mut unique_subdomains = HashSet::new();
        
        // Processa os resultados
        for entry in entries {
            let subdomain_name = wildcard_regex
                .replace(&entry.name_value, "")
                .to_string()
                .trim()
                .to_lowercase();
            
            // Verifica se é um subdomínio válido do alvo
            if !subdomain_name.ends_with(target) && subdomain_name != target {
                continue;
            }
            
            // Evita duplicatas durante o processamento
            if unique_subdomains.contains(&subdomain_name) {
                continue;
            }
            
            unique_subdomains.insert(subdomain_name.clone());
            
            // Converte timestamps
            let first_seen = entry.first_seen
                .as_deref()
                .and_then(|ts| self.parse_timestamp(ts));
                
            let last_seen = entry.last_seen
                .as_deref()
                .and_then(|ts| self.parse_timestamp(ts));
            
            // Adiciona o subdomínio à lista de resultados
            result.subdomains.push(Subdomain {
                name: subdomain_name,
                ip: None, // O crt.sh não fornece IPs
                first_seen,
                last_seen,
                source: self.name().to_string(),
            });
        }
        
        // Já não precisamos fazer sort+dedup aqui pois já usamos um HashSet
        tracing::info!("crt.sh: encontrados {} subdomínios para {}", result.subdomains.len(), target);
        
        Ok(result)
    }
} 