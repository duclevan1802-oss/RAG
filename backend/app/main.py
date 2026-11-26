# Tạo ứng dụng FastAPI, thiết lập CORS và đăng ký các nhóm endpoint.

from fastapi import FastAPI, HTTPException
from pymongo.errors import PyMongoError
from app.db.mongodb import ping_mongodb
from app.api.routes.chat import router as chat_router
from app.api.routes.knowledge_bases import router as knowledge_bases_router
from app.api.routes.documents import router as documents_router
from app.schemas.system import DatabaseHealthResponse, HealthResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes.conversations import router as conversations_router

app = FastAPI(
    title= "VIT AI",
    description= "Xin chào mừng đến với trợ lý sử dụng Retrival-Augmented Generation",
    version= "1.0.0" 
)

# Cho phép trình duyệt gọi API từ các địa chỉ giao diện khai báo trong CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(knowledge_bases_router)
app.include_router(documents_router)
app.include_router(conversations_router)

# Endpoint nhẹ để xác nhận FastAPI phản hồi. Kết nối Atlas được kiểm tra ở /health/mongodb.
@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse()


@app.get("/health/mongodb", response_model=DatabaseHealthResponse)
def mongodb_health():
    try:
        ping_mongodb()
        return DatabaseHealthResponse()
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Chưa kết nối được với MôngDB. Kiểm tra URI và IP Access List"
        )
