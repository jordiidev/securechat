use actix_web::{web, HttpResponse};

use crate::application::auth_service::AuthService;

use super::dto::{AuthResponse, LoginRequest, PreloginRequest, PreloginResponse, RegisterRequest};
use super::error::ApiError;

pub async fn prelogin(
    service: web::Data<AuthService>,
    body: web::Json<PreloginRequest>,
) -> Result<HttpResponse, ApiError> {
    let kdf_salt = service.kdf_salt(&body.username).await?;
    Ok(HttpResponse::Ok().json(PreloginResponse { kdf_salt }))
}

pub async fn register(
    service: web::Data<AuthService>,
    body: web::Json<RegisterRequest>,
) -> Result<HttpResponse, ApiError> {
    let session = service.register(body.into_inner().into()).await?;
    Ok(HttpResponse::Created().json(AuthResponse::from(session)))
}

pub async fn login(
    service: web::Data<AuthService>,
    body: web::Json<LoginRequest>,
) -> Result<HttpResponse, ApiError> {
    let session = service.login(&body.username, &body.auth_secret).await?;
    Ok(HttpResponse::Ok().json(AuthResponse::from(session)))
}
