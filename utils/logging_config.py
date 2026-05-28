import logging
import sys

def setup_logging():
    """Configura o sistema de logging do projeto."""
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] [%(levelname)s] [%(module)s] - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("lyra_assistant.log", encoding="utf-8")
        ]
    )
    logging.info("Sistema de logging inicializado.")
