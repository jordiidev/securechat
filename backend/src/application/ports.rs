use async_trait::async_trait;

use crate::domain::attachment::AttachmentId;
use crate::domain::error::DomainError;
use crate::domain::event::DomainEvent;
use crate::domain::user::{UserId, Username};

#[async_trait]
pub trait PasswordHasher: Send + Sync {
    async fn hash(&self, secret: &str) -> Result<String, DomainError>;
    async fn verify(&self, secret: &str, hash: &str) -> Result<bool, DomainError>;
}

pub trait TokenService: Send + Sync {
    fn issue(&self, user_id: UserId) -> Result<String, DomainError>;
    fn verify(&self, token: &str) -> Result<UserId, DomainError>;
}

/// Produces a stable, believable KDF salt for usernames that do not exist,
/// so the pre-login endpoint does not reveal which accounts are registered.
pub trait DecoySaltProvider: Send + Sync {
    fn salt_for(&self, username: &Username) -> String;
}

#[async_trait]
pub trait FileStorage: Send + Sync {
    async fn save(&self, id: AttachmentId, bytes: &[u8]) -> Result<(), DomainError>;
    async fn load(&self, id: AttachmentId) -> Result<Vec<u8>, DomainError>;
}

#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, to: UserId, event: DomainEvent);
}
