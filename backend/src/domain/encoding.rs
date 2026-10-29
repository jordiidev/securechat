use base64::{engine::general_purpose::STANDARD, Engine};

use super::error::DomainError;

/// Returns the decoded byte length of a standard base64 string.
pub fn decoded_len(field: &str, value: &str) -> Result<usize, DomainError> {
    STANDARD
        .decode(value)
        .map(|bytes| bytes.len())
        .map_err(|_| DomainError::invalid(format!("{field} must be valid base64")))
}

pub fn require_decoded_len(field: &str, value: &str, expected: usize) -> Result<(), DomainError> {
    if decoded_len(field, value)? == expected {
        Ok(())
    } else {
        Err(DomainError::invalid(format!(
            "{field} must decode to exactly {expected} bytes"
        )))
    }
}
