"""Response and request models; they also define the OpenAPI types used by the web app."""

from typing import Literal

from pydantic import BaseModel, Field

RaceStatus = Literal["completed", "qualifying", "projected", "scheduled"]


class Circuit(BaseModel):
    name: str
    location: str | None
    country: str | None
    lat: float | None
    lng: float | None


class DriverRef(BaseModel):
    driver_id: int
    code: str | None
    name: str
    team: str | None


class RaceSummary(BaseModel):
    year: int
    round: int
    name: str
    date: str
    circuit: Circuit
    status: RaceStatus
    winner: DriverRef | None = None
    predicted_winner: DriverRef | None = Field(
        None, description="Highest podium probability (out-of-sample for completed races)."
    )
    podium_hits: int | None = Field(None, description="Predicted top 3 that stood on the podium.")


class Contribution(BaseModel):
    feature: str
    label: str
    impact: float = Field(description="Effect on driver strength vs. the field average.")


class DriverPrediction(BaseModel):
    driver_id: int
    code: str | None
    name: str
    team: str | None
    team_id: int
    grid: int
    quali_position: int | None
    probability: float = Field(description="Podium probability.")
    win_probability: float | None
    expected_position: float | None
    position_probabilities: list[float] | None
    explanation: list[Contribution] | None
    finish_position: int | None


class Evaluation(BaseModel):
    predicted_podium: list[str]
    actual_podium: list[str]
    podium_hits: int
    winner_on_predicted_podium: bool
    top_pick_on_podium: bool


class RacePrediction(BaseModel):
    race: RaceSummary
    model: str
    out_of_sample: bool = Field(
        description="True when the model was trained without this race's season."
    )
    leaderboard: list[DriverPrediction]
    evaluation: Evaluation | None


class ScenarioRequest(BaseModel):
    grid: dict[int, int] = Field(
        description="driverId -> new grid slot; displaced drivers shift by one place.",
        examples=[{"1": 1}],
    )


class Season(BaseModel):
    year: int
    races: int
    completed: int


class Meta(BaseModel):
    version: str
    model: str
    model_label: str
    trained_through: str
    seasons: list[Season]
    latest_race: RaceSummary | None
    next_race: RaceSummary | None
    headline: dict[str, float]
