//! Error handling for the semantic analysis system


/// Simple error type for when napi is not available
#[derive(Debug)]
pub struct SimpleError {
    message: String,
}

impl SimpleError {
    pub fn from_reason<S: Into<String>>(message: S) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for SimpleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for SimpleError {}

/// Conditional type alias - use proper napi::Error when available
#[cfg(feature = "napi-bindings")]
pub type ParseError = napi::Error;

#[cfg(not(feature = "napi-bindings"))]
pub type ParseError = SimpleError;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_error_creation() {
        let error = SimpleError::from_reason("test error");
        assert_eq!(error.message, "test error");
        assert_eq!(format!("{}", error), "test error");
    }

    #[test]
    fn test_simple_error_display() {
        let error = SimpleError::from_reason("display test");
        let display_str = format!("{}", error);
        assert_eq!(display_str, "display test");
    }

    #[test]
    fn test_simple_error_debug() {
        let error = SimpleError::from_reason("debug test");
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("debug test"));
    }

    #[test]
    fn test_error_trait_implementation() {
        let error = SimpleError::from_reason("trait test");
        let error_trait: &dyn std::error::Error = &error;
        assert_eq!(format!("{}", error_trait), "trait test");
    }
}