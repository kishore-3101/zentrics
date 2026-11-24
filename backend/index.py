"""
FastAPI / ASGI Entrypoint for Vercel Serverless Deployment
"""
from mock_server import app, handler, application

__all__ = ["app", "handler", "application"]
