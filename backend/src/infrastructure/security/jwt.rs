use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::application::ports::TokenService;
use crate::domain::error::DomainError;
use crate::domain::user::UserId;

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: UserId,
    iat: i64,
    exp: i64,
}

pub struct JwtTokenService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    ttl: Duration,
}

impl JwtTokenService {
    pub fn new(secret: &[u8], ttl: Duration) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
            ttl,
        }
    }
}

impl TokenService for JwtTokenService {
    fn issue(&self, user_id: UserId) -> Result<String, DomainError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id,
            iat: now.timestamp(),
            exp: (now + self.ttl).timestamp(),
        };
        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|error| DomainError::Internal(error.to_string()))
    }

    fn verify(&self, token: &str) -> Result<UserId, DomainError> {
        decode::<Claims>(token, &self.decoding_key, &Validation::default())
            .map(|data| data.claims.sub)
            .map_err(|_| DomainError::Unauthenticated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn issued_token_round_trips() {
        let service = JwtTokenService::new(b"secret", Duration::hours(1));
        let user_id = Uuid::new_v4();

        let token = service.issue(user_id).unwrap();
        assert_eq!(service.verify(&token).unwrap(), user_id);
    }

    #[test]
    fn token_signed_with_another_secret_is_rejected() {
        let issuer = JwtTokenService::new(b"secret-a", Duration::hours(1));
        let verifier = JwtTokenService::new(b"secret-b", Duration::hours(1));

        let token = issuer.issue(Uuid::new_v4()).unwrap();
        assert!(matches!(
            verifier.verify(&token),
            Err(DomainError::Unauthenticated)
        ));
    }

    #[test]
    fn expired_token_is_rejected() {
        let service = JwtTokenService::new(b"secret", Duration::hours(-2));
        let token = service.issue(Uuid::new_v4()).unwrap();
        assert!(service.verify(&token).is_err());
    }
}
