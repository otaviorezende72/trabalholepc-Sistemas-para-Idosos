from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./backend.db"

# connect_args={"check_same_thread": False} é necessário para o SQLite em ambientes multithreaded (como FastAPI)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependência para injetar a sessão de banco de dados do SQLAlchemy nas rotas do FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
