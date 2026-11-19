from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "ok"


class DatabaseHealthResponse(HealthResponse):
    message: str = "MongoDB đã kết nối."
