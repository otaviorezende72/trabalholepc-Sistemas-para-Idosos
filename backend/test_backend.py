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
        import os
        os.environ["TEST_MODE"] = "True"
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
        self.assertEqual(data["sleep_start_night"], "22:00")
        self.assertEqual(data["sleep_end_night"], "07:00")
        self.assertEqual(data["sleep_start_afternoon"], "13:30")
        self.assertEqual(data["sleep_end_afternoon"], "15:30")
        self.assertEqual(data["is_away"], False)
        self.assertEqual(data["elder_name"], "Senhor")

        # PUT deve atualizar as configurações
        payload = {
            "checkin_interval_hours": 8,
            "emergency_contact_name": "Maria Silva",
            "emergency_contact_phone": "+55 11 98888-8888",
            "profile_summary": "Gosta de futebol, tem 2 gatos",
            "sleep_start_night": "23:00",
            "sleep_end_night": "06:00",
            "sleep_start_afternoon": "14:00",
            "sleep_end_afternoon": "15:00",
            "is_away": True,
            "elder_name": "João"
        }
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 200)
        updated_data = response.json()
        self.assertEqual(updated_data["checkin_interval_hours"], 8)
        self.assertEqual(updated_data["emergency_contact_name"], "Maria Silva")
        self.assertEqual(updated_data["profile_summary"], "Gosta de futebol, tem 2 gatos")
        self.assertEqual(updated_data["sleep_start_night"], "23:00")
        self.assertEqual(updated_data["sleep_end_night"], "06:00")
        self.assertEqual(updated_data["sleep_start_afternoon"], "14:00")
        self.assertEqual(updated_data["sleep_end_afternoon"], "15:00")
        self.assertEqual(updated_data["is_away"], True)
        self.assertEqual(updated_data["elder_name"], "João")

    def test_set_away_status_endpoint(self):
        # Configura is_away via endpoint POST /api/status/away
        response = self.client.post("/api/status/away")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["is_away"], True)
        self.assertIsNotNone(response.json()["away_start_time"])
        self.assertIsNone(response.json()["away_end_time"])

        # Verifica se atualizou nas configurações gerais
        response = self.client.get("/settings")
        self.assertEqual(response.json()["is_away"], True)

        # Volta para False usando POST /api/status/home
        response = self.client.post("/api/status/home")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["is_away"], False)
        self.assertIsNotNone(response.json()["away_end_time"])


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

    def test_task_crud(self):
        # 1. POST - Criar tarefa
        payload = {
            "descricao": "Fazer exercícios leves",
            "horarios": "09:00, 16:00",
            "dias": "Seg, Qua, Sex"
        }
        response = self.client.post("/tasks", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["descricao"], "Fazer exercícios leves")
        self.assertEqual(data["title"], "Fazer exercícios leves")
        self.assertEqual(data["horarios"], ["09:00", "16:00"])
        self.assertEqual(data["dias"], ["Seg", "Qua", "Sex"])
        self.assertEqual(data["completed"], False)
        self.assertEqual(data["concluido"], False)
        task_id = data["id"]

        # 2. GET - Listar tarefas
        response = self.client.get("/tasks")
        self.assertEqual(response.status_code, 200)
        tasks = response.json()
        self.assertTrue(len(tasks) > 0)
        found = False
        for t in tasks:
            if t["id"] == task_id:
                self.assertEqual(t["descricao"], "Fazer exercícios leves")
                found = True
                break
        self.assertTrue(found)

        # 3. DELETE - Remover tarefa
        response = self.client.delete(f"/tasks/{task_id}")
        self.assertEqual(response.status_code, 204)

        # 4. GET - Listar novamente e verificar remoção
        response = self.client.get("/tasks")
        self.assertEqual(response.status_code, 200)
        task_ids = [t["id"] for t in response.json()]
        self.assertNotIn(task_id, task_ids)

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

    def test_auth_register_login_and_scoping(self):
        # 1. Cadastro de cuidador
        reg_payload = {
            "username": "caregiver1",
            "password": "securepassword"
        }
        response = self.client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("token", data)
        self.assertIn("access_code", data)
        self.assertEqual(data["username"], "caregiver1")
        access_code = data["access_code"]
        token = data["token"]
        
        # 2. Login de cuidador
        login_payload = {
            "username": "caregiver1",
            "password": "securepassword"
        }
        response = self.client.post("/api/auth/login", json=login_payload)
        self.assertEqual(response.status_code, 200)
        login_data = response.json()
        self.assertEqual(login_data["token"], token)
        self.assertEqual(login_data["access_code"], access_code)
        
        # 3. Login do idoso via código de acesso
        elder_payload = {
            "code": access_code
        }
        response = self.client.post("/api/auth/login-elder", json=elder_payload)
        self.assertEqual(response.status_code, 200)
        elder_data = response.json()
        self.assertIn("token", elder_data)
        
        # 4. Scoping: medicamentos criados sob o usuário autenticado
        headers = {"Authorization": f"Bearer {token}"}
        med_payload = {
            "name": "Ibuprofeno",
            "dosage": "400mg",
            "time": "14:00",
            "active": True
        }
        # Cria medicamento com autenticação
        response = self.client.post("/medications", json=med_payload, headers=headers)
        self.assertEqual(response.status_code, 201)
        med_id = response.json()["id"]
        
        # Listagem deve trazer o medicamento sob o escopo correto
        response = self.client.get("/medications", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["name"], "Ibuprofeno")
        
        # 5. Toggle de tarefas
        task_payload = {
            "descricao": "Beber água",
            "horarios": "10:00",
            "dias": "Seg, Ter",
            "completed": False
        }
        response = self.client.post("/api/tasks", json=task_payload, headers=headers)
        self.assertEqual(response.status_code, 201)
        task_id = response.json()["id"]
        self.assertEqual(response.json()["completed"], False)
        
        # Toggle para True
        response = self.client.patch(f"/api/tasks/{task_id}/toggle", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["completed"], True)
        
        # 6. Desconfirmar medicamento
        # Confirma primeiro
        response = self.client.put(f"/medications/{med_id}/confirm", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "tomado")
        
        # Desconfirma
        response = self.client.put(f"/medications/{med_id}/unconfirm", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ativo")

    def test_utility_endpoints(self):
        # 1. Test weather endpoint
        response = self.client.get("/api/utility/weather")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["city"], "Cachoeira do Sul")
        self.assertEqual(data["temperature"], 14.0)
        self.assertIn("Hoje em Cachoeira do Sul o tempo está nublado", data["voice_summary"])

        # 2. Test weather with custom city
        response = self.client.get("/api/utility/weather?city=Porto Alegre")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["city"], "Porto Alegre")
        self.assertIn("Hoje em Porto Alegre", data["voice_summary"])

        # 3. Test football endpoint
        response = self.client.get("/api/utility/football")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["last_update"], "Junho de 2026")
        self.assertIn("O Grêmio jogou no último final de semana", data["voice_summary"])
        self.assertEqual(len(data["matches"]), 2)

        # 4. Test nutrition endpoint
        response = self.client.get("/api/utility/nutrition")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["recipe_name"], "Sopa de mandioquinha com frango desfiado e raspas de gengibre")
        self.assertIn("Para hoje, que tal uma sopa quentinha de mandioquinha", data["voice_summary"])

    def test_settings_sleep_time_validation(self):
        # Envia payload com sleep_start_night malformatado
        payload = {
            "checkin_interval_hours": 12,
            "emergency_contact_name": "Maria Silva",
            "emergency_contact_phone": "+55 11 99999-9999",
            "sleep_start_night": "25:00",  # Hora inválida
            "sleep_end_night": "07:00",
            "sleep_start_afternoon": "13:30",
            "sleep_end_afternoon": "15:30"
        }
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 422)

        # Envia outro formato inválido
        payload["sleep_start_night"] = "9:00"  # Falta o zero à esquerda
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 422)

        # Envia formato de texto
        payload["sleep_start_night"] = "22h00"
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 422)

        # Envia formato válido
        payload["sleep_start_night"] = "22:00"
        response = self.client.put("/settings", json=payload)
        self.assertEqual(response.status_code, 200)

if __name__ == "__main__":
    unittest.main()


