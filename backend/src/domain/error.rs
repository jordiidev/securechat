use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("username is already taken")]
    UsernameTaken,
    #[error("invalid username or password")]
    InvalidCredentials,
    #[error("authentication required")]
    Unauthenticated,
    #[error("access denied")]
    Forbidden,
    #[error("{0} not found")]
    NotFound(&'static str),
    #[error("payload too large")]
    PayloadTooLarge,
    #[error("internal error: {0}")]
    Internal(String),
}

impl DomainError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }
}
