mod application;
mod bootstrap;
mod config;
mod domain;
mod infrastructure;
mod presentation;

use actix_cors::Cors;
use actix_web::http::header::{AUTHORIZATION, CONTENT_TYPE};
use actix_web::middleware::Logger;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use bootstrap::Services;
use config::Config;
use infrastructure::postgres;

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Config::from_env()?;
    let pool = postgres::connect(&config.database_url).await?;
    postgres::migrate(&pool).await?;

    let services = Services::build(&config, pool).await?;
    let payload_limit = config.max_upload_bytes;
    let allowed_origin = config.allowed_origin.clone();

    tracing::info!(address = %config.bind_addr, "starting server");
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&allowed_origin)
            .allowed_methods(["GET", "POST"])
            .allowed_headers([AUTHORIZATION, CONTENT_TYPE])
            .max_age(3600);

        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(web::PayloadConfig::new(payload_limit))
            .app_data(web::JsonConfig::default().limit(256 * 1024))
            .app_data(services.auth.clone())
            .app_data(services.users.clone())
            .app_data(services.messages.clone())
            .app_data(services.attachments.clone())
            .app_data(services.tokens.clone())
            .app_data(services.hub.clone())
            .configure(presentation::configure)
    })
    .bind(&config.bind_addr)?
    .run()
    .await?;

    Ok(())
}
