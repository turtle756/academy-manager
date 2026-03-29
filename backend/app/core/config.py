from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "학원 올인원 관리"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/academy"
    SECRET_KEY: str = "change-me-in-production"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    KAKAO_ALIMTALK_API_KEY: str = ""
    KAKAO_ALIMTALK_SENDER_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    model_config = {"env_file": ".env"}


settings = Settings()
