//! Test doubles shared by the application-layer unit tests.

use std::sync::Mutex;

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::user::{NewUser, User, UserId, UserRepository, Username};

use super::auth_service::RegisterInput;
use super::ports::{DecoySaltProvider, PasswordHasher, TokenService};

const SAMPLE_SALT: &str = "AAAAAAAAAAAAAAAAAAAAAA==";
const SAMPLE_IV: &str = "AAAAAAAAAAAAAAAA";
const SAMPLE_AUTH_SECRET: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

pub fn sample_register_input(username: &str) -> RegisterInput {
    let public_key = base64_of(&[4u8; 65]);
    RegisterInput {
        username: username.to_owned(),
        auth_secret: SAMPLE_AUTH_SECRET.to_owned(),
        kdf_salt: SAMPLE_SALT.to_owned(),
        public_key,
        encrypted_private_key: base64_of(&[7u8; 100]),
        private_key_iv: SAMPLE_IV.to_owned(),
    }
}

fn base64_of(bytes: &[u8]) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    STANDARD.encode(bytes)
}

#[derive(Default)]
pub struct InMemoryUsers {
    users: Mutex<Vec<User>>,
}

#[async_trait]
impl UserRepository for InMemoryUsers {
    async fn create(&self, new_user: NewUser) -> Result<User, DomainError> {
        let mut users = self.users.lock().unwrap();
        if users.iter().any(|u| u.username == new_user.username) {
            return Err(DomainError::UsernameTaken);
        }
        let user = User {
            id: Uuid::new_v4(),
            username: new_user.username,
            password_hash: new_user.password_hash,
            keys: new_user.keys,
            created_at: Utc::now(),
        };
        users.push(user.clone());
        Ok(user)
    }

    async fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .find(|u| u.id == id)
            .cloned())
    }

    async fn find_by_username(&self, username: &Username) -> Result<Option<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .find(|u| &u.username == username)
            .cloned())
    }

    async fn find_many(&self, ids: &[UserId]) -> Result<Vec<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .filter(|u| ids.contains(&u.id))
            .cloned()
            .collect())
    }

    async fn search_by_username_prefix(
        &self,
        prefix: &str,
        exclude: UserId,
        limit: i64,
    ) -> Result<Vec<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .filter(|u| u.id != exclude && u.username.as_str().starts_with(prefix))
            .take(limit as usize)
            .cloned()
            .collect())
    }
}

/// "Hashes" by prefixing, which is enough to verify the service wiring.
pub struct FakeHasher;

#[async_trait]
impl PasswordHasher for FakeHasher {
    async fn hash(&self, secret: &str) -> Result<String, DomainError> {
        Ok(format!("hashed:{secret}"))
    }

    async fn verify(&self, secret: &str, hash: &str) -> Result<bool, DomainError> {
        Ok(hash == format!("hashed:{secret}"))
    }
}

pub struct FakeTokens;

impl TokenService for FakeTokens {
    fn issue(&self, user_id: UserId) -> Result<String, DomainError> {
        Ok(user_id.to_string())
    }

    fn verify(&self, token: &str) -> Result<UserId, DomainError> {
        Uuid::parse_str(token).map_err(|_| DomainError::Unauthenticated)
    }
}

pub struct FakeDecoySalts;

impl DecoySaltProvider for FakeDecoySalts {
    fn salt_for(&self, _username: &Username) -> String {
        SAMPLE_SALT.to_owned()
    }
}
