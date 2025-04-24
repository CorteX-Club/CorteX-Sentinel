use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use std::fmt;

// Estado da aplicação
pub struct AppState {
    // Para uso futuro (cache, configurações, etc.)
}

impl AppState {
    pub fn new() -> Self {
        Self {}
    }
}

// Request para escaneamento de alvo
#[derive(Debug, Deserialize)]
pub struct TargetRequest {
    pub target: String,
}

// Resposta completa de escaneamento
#[derive(Debug, Serialize)]
pub struct TargetResponse {
    pub target: String,
    pub timestamp: DateTime<Utc>,
    pub subdomains: Vec<Subdomain>,
    pub ips: Vec<String>,
    pub services: Vec<Service>,
    pub urls: Vec<Url>,
    pub dorks: Vec<Dork>,
}

// Estrutura de subdomínio
#[derive(Debug, Serialize, Clone, Ord, PartialOrd, Eq, PartialEq)]
pub struct Subdomain {
    pub name: String,
    pub ip: Option<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub source: String,
}

// Estrutura de serviço
#[derive(Debug, Serialize, Clone, Ord, PartialOrd, Eq, PartialEq)]
pub struct Service {
    pub ip: String,
    pub port: u16,
    pub service: String,
    pub banner: Option<String>,
    pub source: String,
}

// Estrutura de URL
#[derive(Debug, Serialize, Clone, Ord, PartialOrd, Eq, PartialEq)]
pub struct Url {
    pub url: String,
    pub status_code: Option<u16>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub source: String,
}

// Estrutura de Dork
#[derive(Debug, Serialize, Clone, Ord, PartialOrd, Eq, PartialEq)]
pub struct Dork {
    pub query: String,
    pub description: String,
    pub results: Option<usize>,
}

// Resultado genérico de módulo OSINT
#[derive(Debug, Default, Serialize)]
pub struct ModuleResult {
    pub subdomains: Vec<Subdomain>,
    pub ips: Vec<String>,
    pub services: Vec<Service>,
    pub urls: Vec<Url>,
    pub dorks: Vec<Dork>,
}

// Erros da aplicação
#[derive(Debug)]
pub enum AppError {
    InvalidInput(String),
    NetworkError(String),
    ModuleError(String),
    InternalError(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::InvalidInput(msg) => write!(f, "Entrada inválida: {}", msg),
            AppError::NetworkError(msg) => write!(f, "Erro de rede: {}", msg),
            AppError::ModuleError(msg) => write!(f, "Erro de módulo: {}", msg),
            AppError::InternalError(msg) => write!(f, "Erro interno: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NetworkError(msg) => (StatusCode::BAD_GATEWAY, msg),
            AppError::ModuleError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = Json(serde_json::json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::InternalError(err.to_string())
    }
} 