from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "attendance_db"
    face_match_threshold: float = 0.6
    ble_timeout_minutes: int = 5
    rssi_threshold: int = -70

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
