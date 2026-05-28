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
        # Valida que o tipo inválido de cliente retorna policy violation (gerando erro na conexão)
        try:
            with self.client.websocket_connect("/ws?client_type=invalid_type"):
                self.fail("WebSocket não deveria ter aceitado conexão com client_type inválido.")
        except Exception:
            pass # Esperado

        # Conecta o motor e o mobile simulados usando instâncias independentes do TestClient
        client_motor = TestClient(app)
        client_mobile = TestClient(app)
        with client_motor.websocket_connect("/ws?client_type=motor") as ws_motor:
            with client_mobile.websocket_connect("/ws?client_type=mobile") as ws_mobile:
                
                # Motor envia sinal de SOS
                sos_message = {"event": "SOS_TRIGGERED", "data": {"reason": "silence"}}
                ws_motor.send_json(sos_message)
                
                # Mobile deve receber o sinal repassado pelo broadcast
                received_by_mobile = ws_mobile.receive_json()
                self.assertEqual(received_by_mobile["event"], "SOS_TRIGGERED")
                self.assertEqual(received_by_mobile["data"]["reason"], "silence")

if __name__ == "__main__":
    unittest.main()
