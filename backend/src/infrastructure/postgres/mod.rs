mod attachment_repository;
mod message_repository;
mod user_repository;

use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::domain::error::DomainError;

pub use attachment_repository::PgAttachmentRepository;
pub use message_repository::PgMessageRepository;
pub use user_repository::PgUserRepository;

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}

pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}

fn internal(error: sqlx::Error) -> DomainError {
    DomainError::Internal(error.to_string())
}
