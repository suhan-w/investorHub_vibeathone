from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fetch_moves import fetch_moves
from watchlist_store import TickerNotFoundError, add_ticker, remove_ticker

app = FastAPI(title="InvestorHub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AddTickerRequest(BaseModel):
    ticker: str


@app.get("/api/watchlist")
def get_watchlist():
    return fetch_moves()


@app.post("/api/watchlist")
def post_watchlist(body: AddTickerRequest):
    try:
        add_ticker(body.ticker)
    except TickerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return fetch_moves()


@app.delete("/api/watchlist/{ticker}")
def delete_watchlist(ticker: str):
    remove_ticker(ticker)
    return fetch_moves()


@app.post("/api/briefing")
def post_briefing():
    return {
        "status": "not_implemented",
        "message": "Podcast generation lands in Phase 3 — this button will trigger it once ElevenLabs is wired in.",
    }
