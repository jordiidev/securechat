mod protocol;
mod session;

use std::sync::Arc;

use actix_web::{web, Error, HttpRequest, HttpResponse};

use crate::application::ports::TokenService;
use crate::infrastructure::realtime::ConnectionHub;

/// Upgrades the request to a WebSocket. The client proves who it is with its first frame.
pub async fn connect(
    req: HttpRequest,
    body: web::Payload,
    tokens: web::Data<Arc<dyn TokenService>>,
    hub: web::Data<ConnectionHub>,
) -> Result<HttpResponse, Error> {
    let (response, ws_session, stream) = actix_ws::handle(&req, body)?;
    actix_web::rt::spawn(session::run(
        ws_session,
        stream,
        tokens.get_ref().clone(),
        hub.into_inner(),
    ));
    Ok(response)
}
