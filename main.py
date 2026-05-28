import sys
import logging
from utils.logging_config import setup_logging
from app import Application

def main():
    """
    Ponto de entrada (Entrypoint) do sistema Lyra.
    
    Responsável apenas por:
    1. Inicializar infraestrutura basal (ex: Logging).
    2. Instanciar e rodar a aplicação principal.
    3. Capturar interrupções brutas (ex: Ctrl+C) graciosamente.
    """
    # 1. Setup inicial
    setup_logging()

    # 2. Inicialização e Execução da App
    try:
        app = Application()
        app.run()
    except KeyboardInterrupt:
        logging.info("Sinal de interrupção (Ctrl+C) recebido. Desligando...")
    except Exception as e:
        logging.critical(f"Falha não tratada no nível principal: {e}", exc_info=True)
    finally:
        logging.info("Sistema Lyra finalizado graciosamente.")
        sys.exit(0)

if __name__ == "__main__":
    main()
