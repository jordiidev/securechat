//! Composition root: the only place that knows which concrete adapter backs each port.

use std::sync::Arc;

use actix_web::web;
use chrono::Duration;
use sqlx::PgPool;

use crate::application::attachment_service::AttachmentService;
use crate::application::auth_service::AuthService;
use crate::application::message_service::MessageService;
use crate::application::ports::TokenService;
use crate::application::user_service::UserService;
use crate::config::Config;
use crate::infrastructure::postgres::{
    PgAttachmentRepository, PgMessageRepository, PgUserRepository,
};
use crate::infrastructure::realtime::ConnectionHub;
use crate::infrastructure::security::{
    Argon2PasswordHasher, HmacDecoySaltProvider, JwtTokenService,
};
use crate::infrastructure::storage::LocalFileStorage;

/// Shared application state, ready to be registered with `App::app_data`.
#[derive(Clone)]
pub struct Services {
    pub auth: web::Data<AuthService>,
    pub users: web::Data<UserService>,
    pub messages: web::Data<MessageService>,
    pub attachments: web::Data<AttachmentService>,
    pub tokens: web::Data<Arc<dyn TokenService>>,
    pub hub: web::Data<ConnectionHub>,
}

impl Services {
    pub async fn build(config: &Config, pool: PgPool) -> anyhow::Result<Self> {
        let user_repository = Arc::new(PgUserRepository::new(pool.clone()));
        let message_repository = Arc::new(PgMessageRepository::new(pool.clone()));
        let attachment_repository = Arc::new(PgAttachmentRepository::new(pool));

        let hub = Arc::new(ConnectionHub::default());
        let storage = Arc::new(LocalFileStorage::new(config.upload_dir.clone()).await?);
        let tokens: Arc<dyn TokenService> = Arc::new(JwtTokenService::new(
            config.jwt_secret.as_bytes(),
            Duration::hours(config.token_ttl_hours),
        ));

        let auth = AuthService::new(
            user_repository.clone(),
            Arc::new(Argon2PasswordHasher),
            tokens.clone(),
            Arc::new(HmacDecoySaltProvider::new(config.jwt_secret.as_bytes())),
        );
        let users = UserService::new(user_repository.clone());
        let messages =
            MessageService::new(user_repository.clone(), message_repository, hub.clone());
        let attachments = AttachmentService::new(
            user_repository,
            attachment_repository,
            storage,
            config.max_upload_bytes,
        );

        Ok(Self {
            auth: web::Data::new(auth),
            users: web::Data::new(users),
            messages: web::Data::new(messages),
            attachments: web::Data::new(attachments),
            tokens: web::Data::new(tokens),
            hub: web::Data::from(hub),
        })
    }
}
