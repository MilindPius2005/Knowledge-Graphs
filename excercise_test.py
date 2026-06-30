import io
import json
import unittest
from unittest.mock import patch, MagicMock

from ontology import app, get_user_state, USER_DATA

class TestOntologyExplorer(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config["TESTING"] = True
        self.client = app.test_client()
        # Reset user cache store before each test
        USER_DATA.clear()
        # Prevent auto-rebuild from wiping our in-memory cache during tests
        self.rebuild_patcher = patch("ontology._rebuild_ontology_from_neo4j")
        self.mock_rebuild = self.rebuild_patcher.start()

    def tearDown(self):
        self.rebuild_patcher.stop()
    @patch("ontology.mongo_collection")
    def test_signup_success(self, mock_mongo):
        users_db = {}
        sessions_db = {}
        def mock_coll(name):
            mock = MagicMock()
            if name == "users":
                mock.find_one.side_effect = lambda q: users_db.get(q.get("email"))
                mock.insert_one.side_effect = lambda doc: users_db.update({doc["email"]: doc})
                return mock
            elif name == "sessions":
                mock.insert_one.side_effect = lambda doc: sessions_db.update({doc["id"]: doc})
                return mock
            return None
        mock_mongo.side_effect = mock_coll

        signup_payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "password": "securepassword123"
        }
        
        response = self.client.post("/auth/signup", json=signup_payload)
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], "jane@example.com")
        
        cookie_header = response.headers.get("Set-Cookie")
        self.assertIsNotNone(cookie_header)
        self.assertIn("oe_session=", cookie_header)

    @patch("ontology.mongo_collection")
    def test_login_invalid_password(self, mock_mongo):

        from werkzeug.security import generate_password_hash
        test_user = {
            "email": "tester@example.com",
            "passwordHash": generate_password_hash("realpassword")
        }
        
        mock_users = MagicMock()
        mock_users.find_one.return_value = test_user
        mock_mongo.side_effect = lambda name: mock_users if name == "users" else None

        login_payload = {
            "email": "tester@example.com",
            "password": "wrongpassword"
        }
        response = self.client.post("/auth/login", json=login_payload)
        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertIn("error", data)
        self.assertEqual(data["error"], "Invalid email or password.")


    
    def test_ingestion_schema_validation_failure(self):
        csv_data = "Emp_Name,Client_Name\nAlice,Google\n"
 
        response = self.client.post(
            "/ingestion/upload",
            data={"file": (io.BytesIO(csv_data.encode("utf-8")), "test.csv")},
            headers={"X-Ontology-User": "test@example.com"}
        )
        self.assertEqual(response.status_code, 422)
        data = response.get_json()
        self.assertIn("error", data)
        self.assertIn("Schema Validation Failed", data["error"])
        self.assertIn("missing_columns", data)
        self.assertIn("Skills", data["missing_columns"])
        self.assertIn("misc skill", data["missing_columns"])



    def test_search_results(self):
  
        username = "searcher@example.com"
        
        # Pre-populate the user state cache directly in memory (No database needed!)
        state = get_user_state(username)
        state["ontology"] = {
            "EmployeeOne": {"type": "Employee", "neighbors": []},
            "Python Programming": {"type": "Skill", "neighbors": []},
            "Google Inc": {"type": "Client", "neighbors": []}
        }

        response = self.client.get(
            "/search?q=Python",
            headers={"X-Ontology-User": username}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("results", data)
        matching_ids = [item["id"] for item in data["results"]]
        self.assertIn("Python Programming", matching_ids)
        self.assertNotIn("EmployeeOne", matching_ids)
        self.assertNotIn("Google Inc", matching_ids)

    def test_filter_options(self):
        username = "filterer@example.com"
        state = get_user_state(username)
        
        state["ontology"] = {
            "ClientA": {"type": "Client", "neighbors": []},
            "SkillA": {"type": "Skill", "neighbors": []},
            "Skills": {"type": "Skill", "neighbors": []},
            "Misc Skill": {"type": "Skill", "neighbors": []},
            "ProjectA": {"type": "Project", "neighbors": []},
        }
        state["employee_meta"] = {
            "Emp1": {"bench_aging": 10},
            "Emp2": {"bench_aging": 20}
        }

        response = self.client.get(
            "/filter-options",
            headers={"X-Ontology-User": username}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("clients", data)
        self.assertIn("ClientA", data["clients"])
        self.assertIn("skills", data)
        self.assertIn("SkillA", data["skills"])
        self.assertNotIn("Skills", data["skills"])
        self.assertNotIn("Misc Skill", data["skills"])
        self.assertIn("benchAging", data)
        self.assertEqual(data["benchAging"]["min"], 10)
        self.assertEqual(data["benchAging"]["max"], 20)

    def test_employees_filtering(self):

        username = "filterer@example.com"
        state = get_user_state(username)
        
        state["ontology"] = {
            "EmployeeA": {"type": "Employee", "neighbors": ["ClientA", "SkillA"]},
            "ClientA": {"type": "Client", "neighbors": ["EmployeeA"]},
            "SkillA": {"type": "Skill", "neighbors": ["EmployeeA"]}
        }
        response = self.client.get(
            "/employees?skill=SkillA",
            headers={"X-Ontology-User": username}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("results", data)
        matching_ids = [item["id"] for item in data["results"]]
        self.assertIn("EmployeeA", matching_ids)

    def test_multi_skill_filtering(self):
        username = "multiskill@example.com"
        state = get_user_state(username)
        
        state["ontology"] = {
            "EmpBoth": {"type": "Employee", "neighbors": ["Python", "AWS"]},
            "EmpOne": {"type": "Employee", "neighbors": ["Python"]},
            "Python": {"type": "Skill", "neighbors": ["EmpBoth", "EmpOne"]},
            "AWS": {"type": "Skill", "neighbors": ["EmpBoth"]}
        }
        response = self.client.get(
            "/employees?skills=Python,AWS",
            headers={"X-Ontology-User": username}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        matching_ids = [item["id"] for item in data["results"]]
        self.assertIn("EmpBoth", matching_ids)
        self.assertNotIn("EmpOne", matching_ids)

if __name__ == "__main__":
    unittest.main()

        