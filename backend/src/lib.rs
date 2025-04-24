pub mod modules;
pub mod types;

use anyhow::Result;
use async_trait::async_trait;

// Trait para todos os módulos OSINT
#[async_trait]
pub trait OsintModule: Send + Sync {
    // O método de escaneamento que todos os módulos devem implementar
    async fn scan(&self, target: &str) -> Result<types::ModuleResult>;
    
    // Nome do módulo
    fn name(&self) -> &'static str;
} 