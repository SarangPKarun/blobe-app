from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 3006
    database_url: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/blobe"
    kafka_broker: str = "localhost:9092"
    jwt_secret: str = "super-secret-default-key-for-dev"
    jury_threshold: float = 5.0
    jury_size: int = 5


settings = Settings()
