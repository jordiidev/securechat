mod attachments;
mod auth;
mod conversations;
mod dto;
mod error;
mod extractors;
mod messages;
mod users;

use actix_web::{web, HttpResponse};

pub use dto::MessageDto;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route(
                "/health",
                web::get().to(|| async { HttpResponse::Ok().finish() }),
            )
            .service(
                web::scope("/auth")
                    .route("/prelogin", web::post().to(auth::prelogin))
                    .route("/register", web::post().to(auth::register))
                    .route("/login", web::post().to(auth::login)),
            )
            .service(
                web::scope("/users")
                    .route("", web::get().to(users::search))
                    .route("/me", web::get().to(users::me))
                    .route("/{id}", web::get().to(users::get)),
            )
            .route("/conversations", web::get().to(conversations::list))
            .service(
                web::scope("/messages")
                    .route("", web::get().to(messages::history))
                    .route("", web::post().to(messages::send)),
            )
            .service(
                web::scope("/attachments")
                    .route("", web::post().to(attachments::upload))
                    .route("/{id}", web::get().to(attachments::download)),
            ),
    );
}
