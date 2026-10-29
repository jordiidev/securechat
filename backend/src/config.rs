use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{bail, Context};

const MIN_JWT_SECRET_LEN: usize = 32;

pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub jwt_secret: String,
    pub allowed_origin: String,
    pub upload_dir: PathBuf,
    pub max_upload_bytes: usize,
    pub token_ttl_hours: i64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = required("JWT_SECRET")?;
        if jwt_secret.len() < MIN_JWT_SECRET_LEN {
            bail!("JWT_SECRET must be at least {MIN_JWT_SECRET_LEN} characters long");
        }

        Ok(Self {
            database_url: required("DATABASE_URL")?,
            bind_addr: optional("BIND_ADDR", "127.0.0.1:8080".to_owned())?,
            jwt_secret,
            allowed_origin: optional("ALLOWED_ORIGIN", "http://localhost:5173".to_owned())?,
            upload_dir: PathBuf::from(optional("UPLOAD_DIR", "./uploads".to_owned())?),
            max_upload_bytes: optional("MAX_UPLOAD_BYTES", 25 * 1024 * 1024)?,
            token_ttl_hours: optional("TOKEN_TTL_HOURS", 72)?,
        })
    }
}

fn required(key: &str) -> anyhow::Result<String> {
    std::env::var(key).with_context(|| format!("environment variable {key} is required"))
}

fn optional<T>(key: &str, default: T) -> anyhow::Result<T>
where
    T: FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    match std::env::var(key) {
        Ok(raw) => raw
            .parse()
            .with_context(|| format!("environment variable {key} is invalid")),
        Err(_) => Ok(default),
    }
}
