use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher as _, PasswordVerifier, SaltString};
use argon2::Argon2;
use async_trait::async_trait;

use crate::application::ports::PasswordHasher;
use crate::domain::error::DomainError;

pub struct Argon2PasswordHasher;

#[async_trait]
impl PasswordHasher for Argon2PasswordHasher {
    async fn hash(&self, secret: &str) -> Result<String, DomainError> {
        let secret = secret.to_owned();
        run_blocking(move || {
            let salt = SaltString::generate(&mut OsRng);
            Argon2::default()
                .hash_password(secret.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|error| DomainError::Internal(error.to_string()))
        })
        .await
    }

    async fn verify(&self, secret: &str, hash: &str) -> Result<bool, DomainError> {
        let secret = secret.to_owned();
        let hash = hash.to_owned();
        run_blocking(move || {
            let parsed = PasswordHash::new(&hash)
                .map_err(|error| DomainError::Internal(error.to_string()))?;
            Ok(Argon2::default()
                .verify_password(secret.as_bytes(), &parsed)
                .is_ok())
        })
        .await
    }
}

/// Argon2 is deliberately slow, so it must not run on the async worker threads.
async fn run_blocking<T, F>(work: F) -> Result<T, DomainError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, DomainError> + Send + 'static,
{
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|error| DomainError::Internal(error.to_string()))?
}
