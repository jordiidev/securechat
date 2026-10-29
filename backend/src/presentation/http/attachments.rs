use actix_web::http::header::{CacheControl, CacheDirective};
use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::application::attachment_service::AttachmentService;

use super::dto::{AttachmentDto, UploadQuery};
use super::error::ApiError;
use super::extractors::AuthenticatedUser;

/// Accepts the raw, client-side-encrypted bytes as the request body.
pub async fn upload(
    auth: AuthenticatedUser,
    service: web::Data<AttachmentService>,
    query: web::Query<UploadQuery>,
    body: web::Bytes,
) -> Result<HttpResponse, ApiError> {
    let attachment = service.upload(auth.0, query.recipient_id, &body).await?;
    Ok(HttpResponse::Created().json(AttachmentDto {
        id: attachment.id,
        size_bytes: attachment.size_bytes,
        created_at: attachment.created_at,
    }))
}

pub async fn download(
    auth: AuthenticatedUser,
    service: web::Data<AttachmentService>,
    id: web::Path<Uuid>,
) -> Result<HttpResponse, ApiError> {
    let bytes = service.download(auth.0, id.into_inner()).await?;
    Ok(HttpResponse::Ok()
        .content_type("application/octet-stream")
        .insert_header(CacheControl(vec![CacheDirective::Private]))
        .body(bytes))
}
