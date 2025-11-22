# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Simple MCP server configuration.
    """
    
    # High-level metadata
    SERVER_NAME: str = "Simple MCP Server"
    SERVER_VERSION: str = "0.1.0"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()

