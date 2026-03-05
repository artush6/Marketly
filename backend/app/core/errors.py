"""Application-level exception types shared across the backend."""


class AppError(RuntimeError):
    """Base class for domain/application errors."""


class UpstreamServiceError(AppError):
    """Raised when an external dependency fails unexpectedly."""


class MisconfigurationError(AppError):
    """Raised when required environment configuration is missing."""
