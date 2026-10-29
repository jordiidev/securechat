use actix_web::{web, HttpResponse};

use crate::application::message_service::MessageService;

use super::dto::ConversationDto;
use super::error::ApiError;
use super::extractors::AuthenticatedUser;

pub async fn list(
    auth: AuthenticatedUser,
    service: web::Data<MessageService>,
) -> Result<HttpResponse, ApiError> {
    let conversations = service.conversations(auth.0).await?;
    let body: Vec<ConversationDto> = conversations.iter().map(ConversationDto::from).collect();
    Ok(HttpResponse::Ok().json(body))
}
