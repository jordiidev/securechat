use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::application::ports::DecoySaltProvider;
use crate::domain::user::Username;

const SALT_BYTES: usize = 16;

pub struct HmacDecoySaltProvider {
    pepper: Vec<u8>,
}

impl HmacDecoySaltProvider {
    pub fn new(pepper: &[u8]) -> Self {
        Self {
            pepper: pepper.to_vec(),
        }
    }
}

impl DecoySaltProvider for HmacDecoySaltProvider {
    fn salt_for(&self, username: &Username) -> String {
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.pepper).expect("HMAC accepts keys of any length");
        mac.update(b"decoy-kdf-salt:");
        mac.update(username.as_str().as_bytes());
        let digest = mac.finalize().into_bytes();
        STANDARD.encode(&digest[..SALT_BYTES])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn salt_is_deterministic_and_sixteen_bytes() {
        let provider = HmacDecoySaltProvider::new(b"pepper");
        let username = Username::parse("ghost").unwrap();

        let first = provider.salt_for(&username);
        assert_eq!(first, provider.salt_for(&username));
        assert_eq!(STANDARD.decode(first).unwrap().len(), SALT_BYTES);
    }
}
