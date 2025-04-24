use crate::{OsintModule, types::{Dork, ModuleResult}};
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashSet;

// Lista de dorks populares para descoberta de informações organizados por categorias
const SECURITY_DORKS: &[(&str, &str)] = &[
    ("site:{target} ext:log", "Arquivos de log expostos"),
    ("site:{target} intext:password", "Textos contendo 'password'"),
    ("site:{target} intext:username password", "Possíveis credenciais expostas"),
    ("site:{target} intext:\"sql syntax near\" | intext:\"syntax error has occurred\" | intext:\"incorrect syntax near\" | intext:\"unexpected end of SQL command\" | intext:\"Warning: mysql_connect()\" | intext:\"Warning: mysql_query()\" | intext:\"Warning: pg_connect()\"", "Erros SQL expostos"),
    ("site:{target} ext:sql | ext:db | ext:backup | ext:bkp | ext:bak | ext:gz | ext:tar", "Possíveis backups de banco de dados"),
    ("site:{target} \"index of\" | \"parent directory\"", "Diretórios com listagem habilitada"),
    ("site:{target} intitle:\"Index of\" \"config.php\"", "Possíveis arquivos de configuração expostos"),
    ("site:{target} inurl:wp-config.php", "WordPress config files"),
    ("site:{target} inurl:\".env\" | intext:\"APP_ENV\" | intext:\"DB_PASSWORD\"", "Arquivos .env expostos"),
    ("site:{target} inurl:config | inurl:configuration | inurl:settings", "Arquivos de configuração"),
];

const FILES_DORKS: &[(&str, &str)] = &[
    ("site:{target} filetype:pdf", "Arquivos PDF"),
    ("site:{target} filetype:xls OR filetype:xlsx", "Planilhas Excel"),
    ("site:{target} filetype:doc OR filetype:docx", "Documentos Word"),
    ("site:{target} filetype:ppt OR filetype:pptx", "Apresentações PowerPoint"),
    ("site:{target} filetype:txt", "Arquivos de texto"),
    ("site:{target} filetype:xml | filetype:json | filetype:yaml | filetype:yml", "Arquivos de dados estruturados"),
    ("site:{target} filetype:conf | filetype:config | filetype:ini", "Arquivos de configuração"),
    ("site:{target} filetype:sh | filetype:bat | filetype:ps1", "Scripts"),
];

const TECH_DORKS: &[(&str, &str)] = &[
    ("site:{target} inurl:wp-content", "WordPress"),
    ("site:{target} inurl:joomla", "Joomla"),
    ("site:{target} inurl:drupal", "Drupal"),
    ("site:{target} inurl:magento | inurl:shop | inurl:cart", "E-commerce (potencial Magento)"),
    ("site:{target} inurl:admin | inurl:administrator | inurl:login | inurl:signin", "Painéis administrativos"),
    ("site:{target} intitle:\"phpMyAdmin\" | inurl:phpmyadmin", "phpMyAdmin"),
    ("site:{target} inurl:api | inurl:swagger | inurl:graphql", "APIs"),
    ("site:{target} inurl:jenkins | inurl:hudson", "Jenkins"),
    ("site:{target} inurl:gitlab", "GitLab"),
    ("site:{target} inurl:jira", "Jira"),
];

pub struct DorkerModule;

impl DorkerModule {
    pub fn new() -> Self {
        Self
    }
    
    // Gerar dorks específicos para o domínio alvo
    fn generate_targeted_dorks(&self, target: &str) -> Vec<Dork> {
        let mut dorks = Vec::new();
        let domain_parts: Vec<&str> = target.split('.').collect();
        
        if domain_parts.len() >= 2 {
            let organization = domain_parts[domain_parts.len() - 2];
            
            // Dorks para outros domínios e subdomínios relacionados
            dorks.push(Dork {
                query: format!("intext:{} -site:{}", organization, target),
                description: "Outros sites relacionados à mesma organização".to_string(),
                results: None,
            });
            
            // Dorks para redes sociais e repositórios de código
            dorks.push(Dork {
                query: format!("site:linkedin.com intext:{}", organization),
                description: "Perfis LinkedIn relacionados à organização".to_string(),
                results: None,
            });
            
            dorks.push(Dork {
                query: format!("site:github.com intext:{}", target),
                description: "Repositórios no GitHub que mencionam o domínio".to_string(),
                results: None,
            });
            
            dorks.push(Dork {
                query: format!("site:gitlab.com intext:{}", target),
                description: "Repositórios no GitLab que mencionam o domínio".to_string(),
                results: None,
            });
            
            // Dorks para vazamentos de dados
            dorks.push(Dork {
                query: format!("site:pastebin.com | site:paste.ee | site:paste.org | site:pastie.org intext:{}", target),
                description: "Pastes que mencionam o domínio".to_string(),
                results: None,
            });
            
            // Dorks para diretórios específicos
            const INTERESTING_DIRS: &[&str] = &[
                "admin", "dev", "staging", "test", "beta", "config", "backup", "old",
                "api", "internal", "private", "secret", "secure", "hidden"
            ];
            
            for dir in INTERESTING_DIRS {
                dorks.push(Dork {
                    query: format!("site:{} inurl:{}", target, dir),
                    description: format!("Diretório '{}' potencialmente sensível", dir),
                    results: None,
                });
            }
        }
        
        dorks
    }
    
    // Processar templates de dorks
    fn process_dork_templates(&self, target: &str, templates: &[(&str, &str)]) -> Vec<Dork> {
        templates.iter().map(|(query_template, description)| {
            Dork {
                query: query_template.replace("{target}", target),
                description: description.to_string(),
                results: None,
            }
        }).collect()
    }
}

#[async_trait]
impl OsintModule for DorkerModule {
    fn name(&self) -> &'static str {
        "Dork Generator"
    }
    
    async fn scan(&self, target: &str) -> Result<ModuleResult> {
        let mut result = ModuleResult::default();
        
        tracing::info!("Gerando dorks avançados para {}", target);
        
        // Processar dorks por categoria
        let mut all_dorks = Vec::new();
        
        all_dorks.extend(self.process_dork_templates(target, SECURITY_DORKS));
        all_dorks.extend(self.process_dork_templates(target, FILES_DORKS));
        all_dorks.extend(self.process_dork_templates(target, TECH_DORKS));
        
        // Adicionar dorks específicos para o domínio
        all_dorks.extend(self.generate_targeted_dorks(target));
        
        // Remover duplicatas potenciais
        let mut unique_queries = HashSet::new();
        for dork in all_dorks {
            if unique_queries.insert(dork.query.clone()) {
                result.dorks.push(dork);
            }
        }
        
        tracing::info!("Dork Generator: gerados {} dorks para {}", result.dorks.len(), target);
        
        Ok(result)
    }
} 