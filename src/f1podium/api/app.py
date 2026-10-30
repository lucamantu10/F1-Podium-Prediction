"""FastAPI application: ``uvicorn f1podium.api.app:app``."""

import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from f1podium import __version__
from f1podium.api import schemas
from f1podium.api.service import F1Service, RaceNotPredictable
from f1podium.predict import RaceNotFound


def get_service(request: Request) -> F1Service:
    return request.app.state.service


Service = Annotated[F1Service, Depends(get_service)]


def create_app(service: F1Service | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.service = service or F1Service()
        yield

    app = FastAPI(
        title="F1 Podium Predictor API",
        version=__version__,
        description="Leak-free podium, win and finishing-position probabilities for F1 races.",
        lifespan=lifespan,
    )
    origins = os.environ.get("F1PODIUM_CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"])
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    def lookup(fn, *args):
        try:
            return fn(*args)
        except RaceNotFound as exc:
            raise HTTPException(404, str(exc)) from exc
        except RaceNotPredictable as exc:
            raise HTTPException(409, str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/api/health")
    def health(svc: Service) -> dict:
        return {
            "status": "ok",
            "version": __version__,
            "trained_through": svc.metrics["trained_through"],
        }

    @app.get("/api/meta", response_model=schemas.Meta)
    def meta(svc: Service):
        return svc.meta()

    @app.get("/api/seasons", response_model=list[schemas.Season])
    def seasons(svc: Service):
        return svc.seasons()

    @app.get("/api/seasons/{year}/races", response_model=list[schemas.RaceSummary])
    def races(year: int, svc: Service):
        return lookup(svc.races, year)

    @app.get("/api/races/{year}/{round_}", response_model=schemas.RacePrediction)
    def race(year: int, round_: int, svc: Service):
        return lookup(svc.race_prediction, year, round_)

    @app.post("/api/races/{year}/{round_}/scenario", response_model=schemas.RacePrediction)
    def scenario(year: int, round_: int, body: schemas.ScenarioRequest, svc: Service):
        return lookup(svc.race_prediction, year, round_, body.grid)

    @app.get("/api/model")
    def model(svc: Service) -> dict:
        """Backtest metrics, calibration, feature importance and simulator weights."""
        return svc.metrics

    return app


app = create_app()
