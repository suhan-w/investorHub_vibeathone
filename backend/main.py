from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fetch_moves import fetch_moves

app = FastAPI(title="InvestorHub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/watchlist")
def get_watchlist():
    return fetch_moves()
