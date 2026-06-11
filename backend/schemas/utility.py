from pydantic import BaseModel
from typing import List

class WeatherResponse(BaseModel):
    city: str
    temperature: float
    condition: str
    humidity: int
    wind_speed: str
    voice_summary: str

class FootballMatch(BaseModel):
    team: str
    opponent: str
    score: str
    date: str
    status: str

class FootballResponse(BaseModel):
    last_update: str
    matches: List[FootballMatch]
    voice_summary: str

class NutritionResponse(BaseModel):
    recipe_name: str
    ingredients: List[str]
    instructions: str
    benefits: str
    voice_summary: str
