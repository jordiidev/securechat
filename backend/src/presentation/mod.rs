pub mod http;
pub mod ws;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.configure(http::configure)
        .route("/ws", web::get().to(ws::connect));
}
