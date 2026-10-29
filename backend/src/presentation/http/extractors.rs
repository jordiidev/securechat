use std::sync::Arc;

use actix_web::dev::Payload;
use actix_web::http::header::AUTHORIZATION;
use actix_web::{web, FromRequest, HttpRequest};
use futures_util::future::{ready, Ready};

use crate::application::ports::TokenService;
use crate::domain::error::DomainError;
use crate::domain::user::UserId;

use super::error::ApiError;

/// The user identified by the `Authorization: Bearer <jwt>` header.
pub struct AuthenticatedUser(pub UserId);

impl FromRequest for AuthenticatedUser {
    type Error = ApiError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        ready(authenticate(req))
    }
}

fn authenticate(req: &HttpRequest) -> Result<AuthenticatedUser, ApiError> {
    let tokens = req
        .app_data::<web::Data<Arc<dyn TokenService>>>()
        .ok_or_else(|| DomainError::Internal("token service is not configured".into()))?;

    let token = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(DomainError::Unauthenticated)?;

    Ok(AuthenticatedUser(tokens.verify(token)?))
}
