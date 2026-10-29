use std::fmt;

use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};
use serde::Serialize;

use crate::domain::error::DomainError;

/// Adapts a [`DomainError`] to an HTTP response.
#[derive(Debug)]
pub struct ApiError(pub DomainError);

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl From<DomainError> for ApiError {
    fn from(error: DomainError) -> Self {
        Self(error)
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self.0 {
            DomainError::InvalidInput(_) => StatusCode::BAD_REQUEST,
            DomainError::UsernameTaken => StatusCode::CONFLICT,
            DomainError::InvalidCredentials | DomainError::Unauthenticated => {
                StatusCode::UNAUTHORIZED
            }
            DomainError::Forbidden => StatusCode::FORBIDDEN,
            DomainError::NotFound(_) => StatusCode::NOT_FOUND,
            DomainError::PayloadTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            DomainError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let message = match &self.0 {
            DomainError::Internal(detail) => {
                tracing::error!(%detail, "internal error");
                "internal server error".to_owned()
            }
            other => other.to_string(),
        };
        HttpResponse::build(self.status_code()).json(ErrorBody { error: message })
    }
}
