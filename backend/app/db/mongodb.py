from pymongo import MongoClient
from app.core.config import settings

def ping_mongodb():
    with MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000       
    ) as client:
        client.admin.command("ping")

def create_mongo_client():
    return MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000,
    )
