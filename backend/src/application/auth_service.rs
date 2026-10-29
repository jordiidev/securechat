use std::sync::Arc;

use crate::domain::encoding::require_decoded_len;
use crate::domain::error::DomainError;
use crate::domain::user::{KeyBundle, NewUser, User, UserRepository, Username};

use super::ports::{DecoySaltProvider, PasswordHasher, TokenService};

/// The auth secret is a 256-bit value the client derives from the password.
/// The raw password never leaves the browser.
const AUTH_SECRET_BYTES: usize = 32;

pub struct RegisterInput {
    pub username: String,
    pub auth_secret: String,
    pub kdf_salt: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub private_key_iv: String,
}

pub struct AuthSession {
    pub token: String,
    pub user: User,
}

pub struct AuthService {
    users: Arc<dyn UserRepository>,
    hasher: Arc<dyn PasswordHasher>,
    tokens: Arc<dyn TokenService>,
    decoy_salts: Arc<dyn DecoySaltProvider>,
}

impl AuthService {
    pub fn new(
        users: Arc<dyn UserRepository>,
        hasher: Arc<dyn PasswordHasher>,
        tokens: Arc<dyn TokenService>,
        decoy_salts: Arc<dyn DecoySaltProvider>,
    ) -> Self {
        Self {
            users,
            hasher,
            tokens,
            decoy_salts,
        }
    }

    /// Returns the KDF salt the client needs before it can derive its credentials.
    pub async fn kdf_salt(&self, username: &str) -> Result<String, DomainError> {
        let username = Username::parse(username)?;
        match self.users.find_by_username(&username).await? {
            Some(user) => Ok(user.keys.kdf_salt),
            None => Ok(self.decoy_salts.salt_for(&username)),
        }
    }

    pub async fn register(&self, input: RegisterInput) -> Result<AuthSession, DomainError> {
        let username = Username::parse(&input.username)?;
        require_decoded_len("auth_secret", &input.auth_secret, AUTH_SECRET_BYTES)?;
        let keys = KeyBundle::new(
            input.kdf_salt,
            input.public_key,
            input.encrypted_private_key,
            input.private_key_iv,
        )?;

        let password_hash = self.hasher.hash(&input.auth_secret).await?;
        let user = self
            .users
            .create(NewUser {
                username,
                password_hash,
                keys,
            })
            .await?;

        self.start_session(user)
    }

    pub async fn login(
        &self,
        username: &str,
        auth_secret: &str,
    ) -> Result<AuthSession, DomainError> {
        let username = Username::parse(username).map_err(|_| DomainError::InvalidCredentials)?;
        let user = self
            .users
            .find_by_username(&username)
            .await?
            .ok_or(DomainError::InvalidCredentials)?;

        if !self.hasher.verify(auth_secret, &user.password_hash).await? {
            return Err(DomainError::InvalidCredentials);
        }
        self.start_session(user)
    }

    fn start_session(&self, user: User) -> Result<AuthSession, DomainError> {
        let token = self.tokens.issue(user.id)?;
        Ok(AuthSession { token, user })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::testing::{
        sample_register_input, FakeDecoySalts, FakeHasher, FakeTokens, InMemoryUsers,
    };

    fn service() -> AuthService {
        AuthService::new(
            Arc::new(InMemoryUsers::default()),
            Arc::new(FakeHasher),
            Arc::new(FakeTokens),
            Arc::new(FakeDecoySalts),
        )
    }

    #[tokio::test]
    async fn registered_user_can_log_in() {
        let service = service();
        let input = sample_register_input("alice");
        let secret = input.auth_secret.clone();
        service.register(input).await.unwrap();

        let session = service.login("Alice", &secret).await.unwrap();
        assert_eq!(session.user.username.as_str(), "alice");
    }

    #[tokio::test]
    async fn duplicate_username_is_rejected() {
        let service = service();
        service
            .register(sample_register_input("alice"))
            .await
            .unwrap();

        let result = service.register(sample_register_input("alice")).await;
        assert!(matches!(result, Err(DomainError::UsernameTaken)));
    }

    #[tokio::test]
    async fn wrong_secret_and_unknown_user_look_identical() {
        let service = service();
        service
            .register(sample_register_input("alice"))
            .await
            .unwrap();

        let wrong_secret = service.login("alice", "nope").await;
        let unknown_user = service.login("bob", "nope").await;
        assert!(matches!(wrong_secret, Err(DomainError::InvalidCredentials)));
        assert!(matches!(unknown_user, Err(DomainError::InvalidCredentials)));
    }

    #[tokio::test]
    async fn salt_lookup_does_not_reveal_unknown_accounts() {
        let service = service();
        let salt = service.kdf_salt("ghost_user").await.unwrap();
        assert!(!salt.is_empty());
    }
}
