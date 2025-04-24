use cortex_passivemap::{
    OsintModule,
    modules::{
        crtsh::CrtShModule,
        shodan::ShodanModule,
        wayback::WaybackModule,
        dorker::DorkerModule,
    },
    types::{
        AppError, 
        AppState, 
        TargetRequest, 
        TargetResponse
    }
};
use axum::{
    routing::{get, post},
    Router,
    http::Method,
    extract::{State, Json},
};
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Inicializa o logger
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Carrega variáveis de ambiente
    dotenv::dotenv().ok();
    
    tracing::info!("Iniciando CorteX PassiveMap Backend...");
    
    // Configuração CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);
    
    // Inicializa o estado da aplicação
    let app_state = Arc::new(AppState::new());
    
    // Configuração de rotas
    let app = Router::new()
        .route("/", get(health_check))
        .route("/api/target", post(scan_target))
        .layer(cors)
        .with_state(app_state);
    
    // Inicia o servidor
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3300").await?;
    tracing::info!("Servidor iniciado na porta 3300");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

// Verificação de saúde da API
async fn health_check() -> &'static str {
    "CorteX PassiveMap Backend: OK"
}

// Endpoint principal para escanear um alvo
async fn scan_target(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<TargetRequest>,
) -> Result<Json<TargetResponse>, AppError> {
    tracing::info!("Recebida requisição para escanear: {}", request.target);
    
    // Valida o alvo
    let target = request.target.trim().to_lowercase();
    if target.is_empty() {
        return Err(AppError::InvalidInput("Alvo vazio fornecido".to_string()));
    }
    
    // Inicializa os módulos OSINT
    let crtsh_module = CrtShModule::new();
    let shodan_module = ShodanModule::new(
        std::env::var("SHODAN_API_KEY").unwrap_or_default()
    );
    let wayback_module = WaybackModule::new();
    let dorker_module = DorkerModule::new();
    
    // Executa os módulos em paralelo
    let (
        crtsh_result,
        shodan_result,
        wayback_result,
        dorker_result
    ) = tokio::join!(
        crtsh_module.scan(&target),
        shodan_module.scan(&target),
        wayback_module.scan(&target),
        dorker_module.scan(&target),
    );
    
    // Combina os resultados
    let mut response = TargetResponse {
        target: target.clone(),
        timestamp: chrono::Utc::now(),
        subdomains: Vec::new(),
        ips: Vec::new(),
        services: Vec::new(),
        urls: Vec::new(),
        dorks: Vec::new(),
    };
    
    // Adiciona resultados de cada módulo
    if let Ok(crtsh_data) = crtsh_result {
        response.subdomains.extend(crtsh_data.subdomains);
    }
    
    if let Ok(shodan_data) = shodan_result {
        response.ips.extend(shodan_data.ips);
        response.services.extend(shodan_data.services);
    }
    
    if let Ok(wayback_data) = wayback_result {
        response.urls.extend(wayback_data.urls);
    }
    
    if let Ok(dorker_data) = dorker_result {
        response.dorks.extend(dorker_data.dorks);
    }
    
    // Remove duplicatas
    response.subdomains.sort_unstable();
    response.subdomains.dedup();
    
    response.ips.sort_unstable();
    response.ips.dedup();
    
    tracing::info!(
        "Escaneamento completo para {}: {} subdomínios, {} IPs, {} serviços, {} URLs",
        target,
        response.subdomains.len(),
        response.ips.len(),
        response.services.len(),
        response.urls.len()
    );
    
    Ok(Json(response))
} 