use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::application::user_service::UserService;

use super::dto::{SearchUsersQuery, UserDto};
use super::error::ApiError;
use super::extractors::AuthenticatedUser;

pub async fn me(
    auth: AuthenticatedUser,
    service: web::Data<UserService>,
) -> Result<HttpResponse, ApiError> {
    let user = service.get(auth.0).await?;
    Ok(HttpResponse::Ok().json(UserDto::from(&user)))
}

pub async fn get(
    _auth: AuthenticatedUser,
    service: web::Data<UserService>,
    id: web::Path<Uuid>,
) -> Result<HttpResponse, ApiError> {
    let user = service.get(id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(UserDto::from(&user)))
}

pub async fn search(
    auth: AuthenticatedUser,
    service: web::Data<UserService>,
    query: web::Query<SearchUsersQuery>,
) -> Result<HttpResponse, ApiError> {
    let users = service.search(auth.0, &query.q).await?;
    let body: Vec<UserDto> = users.iter().map(UserDto::from).collect();
    Ok(HttpResponse::Ok().json(body))
}
