use actix_web::{web, HttpResponse};

use crate::application::message_service::MessageService;

use super::dto::{HistoryQuery, MessageDto, SendMessageRequest};
use super::error::ApiError;
use super::extractors::AuthenticatedUser;

pub async fn send(
    auth: AuthenticatedUser,
    service: web::Data<MessageService>,
    body: web::Json<SendMessageRequest>,
) -> Result<HttpResponse, ApiError> {
    let request = body.into_inner();
    let message = service
        .send(auth.0, request.recipient_id, request.ciphertext, request.iv)
        .await?;
    Ok(HttpResponse::Created().json(MessageDto::from(&message)))
}

pub async fn history(
    auth: AuthenticatedUser,
    service: web::Data<MessageService>,
    query: web::Query<HistoryQuery>,
) -> Result<HttpResponse, ApiError> {
    let messages = service
        .history(auth.0, query.peer_id, query.before, query.limit)
        .await?;
    let body: Vec<MessageDto> = messages.iter().map(MessageDto::from).collect();
    Ok(HttpResponse::Ok().json(body))
}
