from fastapi import APIRouter, Depends
from backend.models.user import User
from backend.utils.auth import get_current_user
from backend.schemas.utility import WeatherResponse, FootballResponse, NutritionResponse

router = APIRouter(prefix="/api/utility", tags=["utility"])

@router.get("/weather", response_model=WeatherResponse)
def get_weather(city: str = "Cachoeira do Sul", current_user: User = Depends(get_current_user)):
    temperature = 14.0
    condition = "Nublado"
    humidity = 85
    wind_speed = "vento sul a 15 km/h"
    
    voice_summary = (
        f"Hoje em {city} o tempo está nublado e frio, fazendo 14°C. "
        f"A máxima não passa dos 18°C, então é bom levar um casaco se for sair de casa."
    )
    
    return WeatherResponse(
        city=city,
        temperature=temperature,
        condition=condition,
        humidity=humidity,
        wind_speed=wind_speed,
        voice_summary=voice_summary
    )

@router.get("/football", response_model=FootballResponse)
def get_football(current_user: User = Depends(get_current_user)):
    matches = [
        {
            "team": "Grêmio",
            "opponent": "Corinthians",
            "score": "1-3",
            "date": "2026-06-07",
            "status": "Finalizado"
        },
        {
            "team": "Internacional",
            "opponent": "São Paulo",
            "score": "2-2",
            "date": "2026-06-08",
            "status": "Finalizado"
        }
    ]
    
    voice_summary = (
        "O Grêmio jogou no último final de semana pelo Brasileirão e teve um resultado duro, "
        "perdeu para o Corinthians por 3 a 1 jogando fora de casa. O próximo jogo será no domingo."
    )
    
    return FootballResponse(
        last_update="Junho de 2026",
        matches=matches,
        voice_summary=voice_summary
    )

@router.get("/nutrition", response_model=NutritionResponse)
def get_nutrition(current_user: User = Depends(get_current_user)):
    recipe_name = "Sopa de mandioquinha com frango desfiado e raspas de gengibre"
    ingredients = [
        "300g de mandioquinha cozida e batida no liquidificador",
        "150g de peito de frango desfiado",
        "1 colher de chá de raspas de gengibre",
        "1 dente de alho amassado (baixo sódio)",
        "Salsa picada a gosto"
    ]
    instructions = (
        "Refogue o alho e o frango desfiado. Adicione o creme de mandioquinha e as raspas de gengibre. "
        "Deixe cozinhar por 10 minutos. Sirva morno salpicado com salsa."
    )
    benefits = "Fácil mastigação e digestão, rica em fibras, gengibre auxilia na digestão e imunidade."
    
    voice_summary = (
        "Para hoje, que tal uma sopa quentinha de mandioquinha com frango desfiado? "
        "É leve, fácil de mastigar e ótima para aquecer esse frio de junho."
    )
    
    return NutritionResponse(
        recipe_name=recipe_name,
        ingredients=ingredients,
        instructions=instructions,
        benefits=benefits,
        voice_summary=voice_summary
    )
