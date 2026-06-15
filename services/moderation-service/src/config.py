from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 3007
    database_url: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/blobe"
    kafka_broker: str = "localhost:9092"
    jwt_secret: str = "super-secret-default-key-for-dev"
    sentry_dsn: str = ""
    sentry_environment: str = "production"

    # Classifier thresholds
    text_hate_threshold: float = 0.7
    text_spam_threshold: float = 0.8
    nsfw_threshold: float = 0.7
    auto_approve_confidence: float = 0.95

    # NSFW backend: "openai" or "local"
    nsfw_backend: str = "openai"
    openai_api_key: str = ""

    # HuggingFace model ID or local path
    text_model_name: str = "Hate-speech-CNERG/dehatebert-mono-english"

    # Hamming distance < this = CSAM match
    phash_distance_threshold: int = 10


settings = Settings()
