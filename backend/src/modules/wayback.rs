use crate::{OsintModule, types::{Url, ModuleResult}};
use anyhow::{Result, Context};
use async_trait::async_trait;
use serde::Deserialize;
use chrono::{DateTime, Utc, NaiveDateTime, TimeZone};
use url::Url as ParsedUrl;
use std::collections::HashMap;

// Estruturas para deserialização da API do Wayback Machine
#[derive(Debug, Deserialize)]
struct WaybackResponse {
    url: Option<String>,
    archived_snapshots: HashMap<String, WaybackSnapshot>,
}

#[derive(Debug, Deserialize)]
struct WaybackSnapshot {
    url: String,
    timestamp: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct WaybackCdxRecord {
    original: String,
    timestamp: String,
    statuscode: Option<String>,
}

pub struct WaybackModule;

impl WaybackModule {
    pub fn new() -> Self {
        Self
    }
    
    // Função auxiliar para converter timestamp para DateTime
    fn parse_wayback_timestamp(&self, timestamp: &str) -> Option<DateTime<Utc>> {
        // Formato do Wayback: YYYYMMDDhhmmss
        if timestamp.len() != 14 {
            return None;
        }
        
        let year = &timestamp[0..4];
        let month = &timestamp[4..6];
        let day = &timestamp[6..8];
        let hour = &timestamp[8..10];
        let minute = &timestamp[10..12];
        let second = &timestamp[12..14];
        
        let datetime_str = format!("{}-{}-{}T{}:{}:{}", year, month, day, hour, minute, second);
        
        NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S")
            .ok()
            .map(|ndt| Utc.from_utc_datetime(&ndt))
    }
}

#[async_trait]
impl OsintModule for WaybackModule {
    fn name(&self) -> &'static str {
        "Wayback Machine"
    }
    
    async fn scan(&self, target: &str) -> Result<ModuleResult> {
        let mut result = ModuleResult::default();
        
        tracing::info!("Consultando Wayback Machine para {}", target);
        
        // Constrói a URL de consulta CDX (mais completa)
        let cdx_url = format!(
            "http://web.archive.org/cdx/search/cdx?url=*.{}&output=json&collapse=urlkey&limit=500",
            target
        );
        
        // Realiza a requisição
        let client = reqwest::Client::new();
        let response = client.get(&cdx_url)
            .send()
            .await
            .context("Falha ao consultar Wayback CDX API")?;
        
        if !response.status().is_success() {
            tracing::warn!("Wayback retornou status {}", response.status());
            return Ok(result);
        }
        
        // Parse da resposta JSON
        let cdx_data: Vec<Vec<String>> = response
            .json()
            .await
            .context("Falha ao parsear resposta do Wayback CDX")?;
        
        // CDX API retorna a primeira linha como cabeçalho
        if cdx_data.len() <= 1 {
            tracing::info!("Wayback: nenhum resultado encontrado para {}", target);
            return Ok(result);
        }
        
        // Mapeamento de índices da resposta CDX
        let headers = &cdx_data[0];
        let mut url_idx = 0;
        let mut timestamp_idx = 0;
        let mut status_idx = 0;
        
        for (i, header) in headers.iter().enumerate() {
            match header.as_str() {
                "original" => url_idx = i,
                "timestamp" => timestamp_idx = i,
                "statuscode" => status_idx = i,
                _ => {}
            }
        }
        
        // Processa os resultados
        for record in cdx_data.iter().skip(1) {  // Pula o cabeçalho
            if record.len() <= timestamp_idx || record.len() <= url_idx {
                continue;
            }
            
            let url_str = &record[url_idx];
            let timestamp = &record[timestamp_idx];
            
            // Obtém o código de status, se disponível
            let status_code = if record.len() > status_idx {
                record[status_idx].parse::<u16>().ok()
            } else {
                None
            };
            
            // Parse do timestamp
            let last_seen = self.parse_wayback_timestamp(timestamp);
            
            // Verifica se a URL é válida
            if let Ok(_parsed_url) = ParsedUrl::parse(url_str) {
                // Adiciona a URL à lista de resultados
                result.urls.push(Url {
                    url: url_str.clone(),
                    status_code,
                    first_seen: last_seen, // Wayback não diferencia first/last
                    last_seen,
                    source: self.name().to_string(),
                });
            }
        }
        
        // Remove duplicatas
        result.urls.sort_unstable();
        result.urls.dedup();
        
        tracing::info!("Wayback: encontradas {} URLs para {}", result.urls.len(), target);
        
        Ok(result)
    }
} 