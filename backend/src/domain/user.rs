use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::encoding::{decoded_len, require_decoded_len};
use super::error::DomainError;

pub type UserId = Uuid;

const USERNAME_MIN_LEN: usize = 3;
const USERNAME_MAX_LEN: usize = 32;
const KDF_SALT_BYTES: usize = 16;
const AES_GCM_IV_BYTES: usize = 12;
/// Uncompressed SEC1 point of a P-256 public key.
const P256_PUBLIC_KEY_BYTES: usize = 65;
const MAX_WRAPPED_PRIVATE_KEY_BYTES: usize = 1024;

/// A normalised (lowercase) username that satisfies the format rules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Username(String);

impl Username {
    pub fn parse(raw: &str) -> Result<Self, DomainError> {
        let normalised = raw.trim().to_lowercase();
        let length_ok = (USERNAME_MIN_LEN..=USERNAME_MAX_LEN).contains(&normalised.len());
        let charset_ok = normalised
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');

        if length_ok && charset_ok {
            Ok(Self(normalised))
        } else {
            Err(DomainError::invalid(format!(
                "username must be {USERNAME_MIN_LEN}-{USERNAME_MAX_LEN} characters of letters, digits or underscore"
            )))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Everything the client needs to restore its identity on a new device.
/// The private key only ever reaches the server wrapped with a key derived from the password.
#[derive(Debug, Clone)]
pub struct KeyBundle {
    pub kdf_salt: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub private_key_iv: String,
}

impl KeyBundle {
    pub fn new(
        kdf_salt: String,
        public_key: String,
        encrypted_private_key: String,
        private_key_iv: String,
    ) -> Result<Self, DomainError> {
        require_decoded_len("kdf_salt", &kdf_salt, KDF_SALT_BYTES)?;
        require_decoded_len("public_key", &public_key, P256_PUBLIC_KEY_BYTES)?;
        require_decoded_len("private_key_iv", &private_key_iv, AES_GCM_IV_BYTES)?;
        if decoded_len("encrypted_private_key", &encrypted_private_key)?
            > MAX_WRAPPED_PRIVATE_KEY_BYTES
        {
            return Err(DomainError::invalid("encrypted_private_key is too large"));
        }
        Ok(Self {
            kdf_salt,
            public_key,
            encrypted_private_key,
            private_key_iv,
        })
    }
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: UserId,
    pub username: Username,
    pub password_hash: String,
    pub keys: KeyBundle,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewUser {
    pub username: Username,
    pub password_hash: String,
    pub keys: KeyBundle,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create(&self, new_user: NewUser) -> Result<User, DomainError>;
    async fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError>;
    async fn find_by_username(&self, username: &Username) -> Result<Option<User>, DomainError>;
    async fn find_many(&self, ids: &[UserId]) -> Result<Vec<User>, DomainError>;
    async fn search_by_username_prefix(
        &self,
        prefix: &str,
        exclude: UserId,
        limit: i64,
    ) -> Result<Vec<User>, DomainError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn username_is_normalised_to_lowercase() {
        assert_eq!(Username::parse("  Alice_01 ").unwrap().as_str(), "alice_01");
    }

    #[test]
    fn username_rejects_invalid_input() {
        for raw in ["ab", "has space", "emoji😀", &"x".repeat(33), "dash-name"] {
            assert!(Username::parse(raw).is_err(), "{raw:?} should be rejected");
        }
    }
}
