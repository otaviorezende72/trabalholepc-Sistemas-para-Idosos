import unittest
import os
import sys

# Adiciona o diretório raiz ao sys.path para conseguir importar backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine

class TestBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Garante banco de dados de teste limpo recriando as tabelas
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        # Limpa conexões ativas do gerenciador global para evitar vazamento de estado
        from backend.websockets.manager import manager
        manager.active_connections = {
            "motor": set(),
            "mobile": set()
        }

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_settings_endpoints(self):
        # GET deve retornar as configurações padrão (auto-healing)
        response = self.client.get("/settings")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("checkin_interval_hours", data)
        self.assertEqual(data["checkin_interval_hours"], 12)
        self.assertEqual(data["profile_summary"], "")

        # PUT deve atualizar as configurações
        payload = {
            "checkin_interval_hours": 8,
            "emergency_contact_name": "Maria Silva",
            "emergency_contact_phone": "+55 11 98888-8888",
            "profile_summary": "Gosta de futebol, tem 2 gatos"
        }
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 200)
        updated_data = response.json()
        self.assertEqual(updated_data["checkin_interval_hours"], 8)
        self.assertEqual(updated_data["emergency_contact_name"], "Maria Silva")
        self.assertEqual(updated_data["profile_summary"], "Gosta de futebol, tem 2 gatos")

    def test_medication_crud(self):
        # 1. POST - Criar medicamento
        payload = {
            "name": "Paracetamol",
            "dosage": "500mg",
            "time": "08:00",
            "active": True
        }
        response = self.client.post("/medications", json=payload)
        self.assertEqual(response.status_code, 201)
        med_id = response.json()["id"]

        # 2. GET - Listar e verificar presença
        response = self.client.get("/medications")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()) > 0)
        # Encontra o medicamento criado pelo ID
        meds = response.json()
        found = False
        for med in meds:
            if med["id"] == med_id:
                self.assertEqual(med["name"], "Paracetamol")
                found = True
                break
        self.assertTrue(found)

        # 3. PUT - Atualizar medicamento
        update_payload = {
            "name": "Paracetamol",
            "dosage": "750mg",
            "time": "12:00",
            "active": False
        }
        response = self.client.put(f"/medications/{med_id}", json=update_payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["dosage"], "750mg")
        self.assertFalse(response.json()["active"])

        # 4. DELETE - Remover medicamento
        response = self.client.delete(f"/medications/{med_id}")
        self.assertEqual(response.status_code, 204)

        # 5. GET - Listar novamente e verificar vazio
        response = self.client.get("/medications")
        self.assertEqual(response.status_code, 200)
        # Verifica que o medicamento de ID deletado não está na lista
        med_ids = [m["id"] for m in response.json()]
        self.assertNotIn(med_id, med_ids)

    def test_alert_history(self):
        # POST - Criar alerta de pânico
        payload = {
            "type": "SOS_TRIGGERED",
            "resolved": False
        }
        response = self.client.post("/alerts", json=payload)
        self.assertEqual(response.status_code, 201)
        alert_id = response.json()["id"]

        # GET - Listar alertas e verificar presença
        response = self.client.get("/alerts")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()) > 0)
        self.assertEqual(response.json()[0]["type"], "SOS_TRIGGERED")

        # PUT - Resolver alerta
        response = self.client.put(f"/alerts/{alert_id}/resolve")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["resolved"])
        self.assertIsNotNone(response.json()["resolved_at"])

    def test_websocket_connection_and_broadcast(self):
        # Para evitar travamentos de AnyIO/WebSocket no Windows durante os testes,
        # testamos a validação do endpoint e a lógica do ConnectionManager com mocks.
        from unittest.mock import AsyncMock, MagicMock
        from fastapi import WebSocket
        from backend.main import websocket_endpoint
        from backend.websockets.manager import manager
        import asyncio

        # 1. Testa validação de client_type inválido no endpoint
        ws_invalid = AsyncMock(spec=WebSocket)
        asyncio.run(websocket_endpoint(ws_invalid, "invalid_type"))
        ws_invalid.close.assert_called_once_with(code=1008)

        # 2. Testa conexão de clientes válidos no manager
        ws_motor = AsyncMock(spec=WebSocket)
        ws_mobile = AsyncMock(spec=WebSocket)
        
        asyncio.run(manager.connect(ws_motor, "motor"))
        asyncio.run(manager.connect(ws_mobile, "mobile"))
        
        self.assertIn(ws_motor, manager.active_connections["motor"])
        self.assertIn(ws_mobile, manager.active_connections["mobile"])
        
        # 3. Testa envio de broadcast para tipo de cliente específico
        message = {"event": "SOS_TRIGGERED", "data": {"reason": "silence"}}
        asyncio.run(manager.broadcast_to_type("mobile", message))
        
        ws_mobile.send_json.assert_called_once_with(message)
        ws_motor.send_json.assert_not_called()
        
        # 4. Testa desconexão
        manager.disconnect(ws_motor, "motor")
        manager.disconnect(ws_mobile, "mobile")
        
        self.assertNotIn(ws_motor, manager.active_connections["motor"])
        self.assertNotIn(ws_mobile, manager.active_connections["mobile"])

if __name__ == "__main__":
    unittest.main()
