import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from neo4j import GraphDatabase
except ImportError:  # Keeps the UI usable before backend deps are installed.
    GraphDatabase = None

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
except ImportError:
    MongoClient = None
    PyMongoError = Exception
    ServerSelectionTimeoutError = Exception

try:
    import pandas as pd
except ImportError:
    pd = None

app = Flask(__name__)
OVERRIDES_PATH = Path(__file__).with_name("ontology_overrides.json")
ADMIN_REQUESTS_PATH = Path(__file__).with_name("ontology_admin_requests.json")
overrides_lock = Lock()
runtime_events = []
runtime_ingestion_jobs = []
runtime_upload_history = []
runtime_users = []
runtime_sessions = {}

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "knowledge_graph")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "super4j")

# Required columns that uploaded files must contain.
REQUIRED_COLUMNS = [
    "Emp_Name", "Client_Name", "Skills", "misc skill"
]

# Maps CSV/Excel column names → Neo4j node labels so that the ontology
# can recognise nodes by type (e.g. filter by Employee, Client, Skill).
COLUMN_LABEL_MAP = {
    "Emp_Name":                   "Employee",
    "Client_Name":                "Client",
    "Project":                    "Project",
    "Skills":                     "Skill",
    "misc skill":                 "Skill",
    "module":                     "Module",
    "skillgroup":                 "SkillGroup",
    "KPMG_Level":                 "Level",
    "SST":                        "Department",
}

# The set of columns (lowercase) that should be generated as separate nodes/edges in the graph
NODE_COLUMNS = {
    "emp_name", "emp name",
    "client_name", "client name",
    "project",
    "skills", "skill",
    "misc skill",
    "module",
    "skillgroup", "skill group",
    "level", "kpmg_level", "kpmg level",
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def get_mongo_db():
    if MongoClient is None:
        return None

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=800)
        client.admin.command("ping")
        return client[MONGO_DB_NAME]
    except (PyMongoError, ServerSelectionTimeoutError, OSError):
        return None


mongo_db = get_mongo_db()


def public_user(user):
    if not user:
        return None

    return {
        "id": user.get("id") or str(user.get("_id", "")),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "Explorer"),
        "createdAt": user.get("createdAt", ""),
    }


def mongo_collection(name):
    return mongo_db[name] if mongo_db is not None else None


def load_graph_dataset_from_neo4j(username):
    if GraphDatabase is None:
        return None

    driver = None
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            connection_timeout=2,
        )
        with driver.session(database=NEO4J_DATABASE) as session:
            rows = session.run(
                """
                MATCH (e:Employee {owner: $owner})
                OPTIONAL MATCH (e)-[r]-(n {owner: $owner})
                WHERE r.owner = $owner
                RETURN e.name AS name,
                       properties(e) AS props,
                       collect({
                         relationship: type(r),
                         name: n.name,
                         labels: labels(n),
                         props: properties(n)
                       }) AS connected
                ORDER BY name
                """,
                owner=username
            )
            employees = []
            for record in rows:
                name = record["name"]
                if not name:
                    continue

                props = dict(record["props"] or {})
                connected = [
                    item for item in (record["connected"] or [])
                    if item and item.get("name")
                ]

                def get_any(keys, default=""):
                    for key in keys:
                        if key in props:
                            return props[key]
                    return default

                def connected_name(*labels):
                    label_set = {label.lower() for label in labels}
                    for item in connected:
                        if label_set & {label.lower() for label in item.get("labels", [])}:
                            return item["name"]
                    return ""

                skills = [
                    item["name"] for item in connected
                    if "Skill" in item.get("labels", [])
                ]

                employees.append({
                    "SL": props.get("SL") or props.get("sl") or len(employees) + 1,
                    "SS": props.get("SS") or props.get("ss") or props.get("serviceSegment") or "",
                    "SST": props.get("SST") or props.get("sst") or connected_name("Department") or "",
                    "Emp_Name": name,
                    "DOJ": props.get("DOJ") or props.get("doj") or "",
                    "Temp": props.get("Temp") or props.get("temp") or "No",
                    "Bench": props.get("Bench") or props.get("bench") or "No",
                    "Client_Name": props.get("Client_Name") or props.get("clientName") or connected_name("Client") or "Unassigned",
                    "Deployment_Status": get_any(["deployment_status", "Deployment_Status", "deploymentStatus"], "Deployed"),
                    "Soft_BI": props.get("Soft_BI") or (skills[0] if len(skills) > 0 else ""),
                    "Soft_BI_2": props.get("Soft_BI_2") or (skills[1] if len(skills) > 1 else ""),
                    "Soft_BI_3": props.get("Soft_BI_3") or (skills[2] if len(skills) > 2 else ""),
                    "Practice_Update": props.get("Practice_Update") or "Available",
                    "Project": props.get("Project") or props.get("project") or connected_name("Project") or "",
                    "Apr_Util": int(get_any(["april_utilization", "Apr_Util", "aprUtil"], 0)),
                    "May_Util": int(get_any(["may_utilization", "May_Util", "mayUtil"], 0)),
                    "YTD_Util": int(get_any(["ytd_utilization", "YTD_Util", "utilization"], 0)),
                    "Util_Gap": int(props.get("Util_Gap") or props.get("utilGap") or 0),
                    "UG_Flag": get_any(["ug_flag", "UG_Flag", "ugFlag"], ""),
                    "RM_Remarks": get_any(["performance_unit", "performance_manager", "rm_remarks", "RM_Remarks"], "Unassigned"),
                    "Project_Status": get_any(["project_status", "Project_Status", "projectStatus"], "Active"),
                    "Month": props.get("Month") or props.get("month") or "",
                    "KPMG_Level": get_any(["kpmg_level", "KPMG_Level", "level"], ""),
                    "Current_Performance": get_any(["current_performance", "Current_Performance", "performance"], ""),
                    "LM_Rated": props.get("LM_Rated") or "Yes",
                    "Q_Rating": int(get_any(["q_rating", "Q_Rating", "rating"], 0)),
                    "Skills": skills,
                    "Mobile": get_any(["mobile", "Mobile"], ""),
                    "Secondary_Skill": props.get("Secondary_Skill") or (skills[-1] if skills else ""),
                    "RM_Notes": props.get("RM_Notes") or props.get("notes") or "",
                    "Campus_Lateral": get_any(["campus_lateral", "campus/lateral"], ""),
                    "Bench_Aging": get_any(["bench_aging", "bench_ageing"], 0),
                })

            return employees or None
    except Exception:
        return None
    finally:
        if driver is not None:
            driver.close()


# Per-user cache store for EMPLOYEES, EMPLOYEE_META, ONTOLOGY, and ONTOLOGY_EDGES
USER_DATA = {}


def build_ontology(rows):
    graph = {}

    def add(name, node_type):
        graph.setdefault(name, {"type": node_type, "neighbors": []})

    def link(source, target):
        if target not in graph[source]["neighbors"]:
            graph[source]["neighbors"].append(target)

    for row in rows:
        name = row["Emp_Name"]
        add(name, "Employee")
        facts = [
            (row.get("SST"), "Department"), (row.get("Client_Name"), "Client"),
            (row.get("Project"), "Project"), (row.get("KPMG_Level"), "Level"),
            (row.get("Deployment_Status"), "Deployment Status"),
            (row.get("Current_Performance"), "Performance"),
            (row.get("UG_Flag"), "Utilization Flag"), (row.get("Project_Status"), "Project Status"),
            (row.get("SS"), "Service Segment"), (row.get("Month"), "Month"),
        ]
        for value, node_type in facts:
            if not value:
                continue
            add(value, node_type)
            link(name, value)
            link(value, name)
        for skill in [row.get("Soft_BI"), row.get("Soft_BI_2"), row.get("Soft_BI_3"), row.get("Secondary_Skill"), *row.get("Skills", [])]:
            if not skill:
                continue
            add(skill, "Skill")
            link(name, skill)
            link(skill, name)

    return graph

def get_active_username():
    username = request.headers.get("X-Ontology-User", "").strip().lower()
    if not username:
        curr_user = get_current_user()
        if curr_user:
            username = curr_user.get("email", "").strip().lower()
    return username

def get_user_state(username=None):
    if not username:
        return {
            "employees": [],
            "employee_meta": {},
            "ontology": {},
            "ontology_edges": {},
            "graph_source": "empty"
        }

    username = username.strip().lower()
    if username not in USER_DATA:
        USER_DATA[username] = {
            "employees": [],
            "employee_meta": {},
            "ontology": {},
            "ontology_edges": {},
            "graph_source": "empty"
        }
        try:
            _rebuild_ontology_from_neo4j(username)
        except Exception:
            pass
    return USER_DATA[username]


def find_canonical_node_name(node_name: str, username=None):
    if not isinstance(node_name, str):
        return None
    query = node_name.strip().lower()
    if not query:
        return None

    state = get_user_state(username)
    user_ontology = state["ontology"]

    for key in user_ontology.keys():
        if key.lower() == query:
            return key

    first_name_matches = [
        key for key, data in user_ontology.items()
        if data["type"] == "Employee" and key.split()[0].lower() == query
    ]
    if len(first_name_matches) == 1:
        return first_name_matches[0]
    return None


def read_overrides():
    if not OVERRIDES_PATH.exists():
        return {}
    try:
        data = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_overrides(data):
    temporary_path = OVERRIDES_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    temporary_path.replace(OVERRIDES_PATH)


def request_username():
    return request.headers.get("X-Ontology-User", "").strip().lower()


def get_node_override(username, node_name):
    if not username:
        return {}

    overrides = mongo_collection("user_graph_overrides")
    if overrides is not None:
        record = overrides.find_one(
            {"username": username, "node": node_name},
            {"_id": 0, "override": 1},
        )
        return record.get("override", {}) if record else {}

    return read_overrides().get(username, {}).get("nodes", {}).get(node_name, {})


def save_node_override(username, node_name, override):
    overrides = mongo_collection("user_graph_overrides")
    if overrides is not None:
        overrides.update_one(
            {"username": username, "node": node_name},
            {
                "$set": {
                    "username": username,
                    "node": node_name,
                    "override": override,
                    "updatedAt": now_iso(),
                },
                "$setOnInsert": {"createdAt": now_iso()},
            },
            upsert=True,
        )
        return

    store = read_overrides()
    store.setdefault(username, {}).setdefault("nodes", {})[node_name] = override
    write_overrides(store)


def delete_node_override(username, node_name):
    overrides = mongo_collection("user_graph_overrides")
    if overrides is not None:
        overrides.delete_one({"username": username, "node": node_name})
        return

    store = read_overrides()
    user_nodes = store.get(username, {}).get("nodes", {})
    user_nodes.pop(node_name, None)
    if not user_nodes:
        store.pop(username, None)
    write_overrides(store)


def user_label(username, node_name):
    return get_node_override(username, node_name).get("label") or node_name


def find_effective_node_name(node_name: str, username=""):
    canonical_name = find_canonical_node_name(node_name, username)
    if canonical_name:
        return canonical_name

    query = str(node_name or "").strip().lower()
    if not query or not username:
        return None

    state = get_user_state(username)
    for name in state["ontology"].keys():
        if user_label(username, name).strip().lower() == query:
            return name

    return None


def effective_node(node_name, username):
    state = get_user_state(username)
    user_ontology = state["ontology"]
    node = user_ontology.get(node_name)
    if not node:
        return None

    override = get_node_override(username, node_name)
    removed = set(override.get("removed_neighbors", []))
    neighbors = [neighbor for neighbor in node["neighbors"] if neighbor not in removed]
    for neighbor in override.get("added_neighbors", []):
        if neighbor in user_ontology and neighbor not in neighbors:
            neighbors.append(neighbor)

    return {
        "type": node["type"],
        "label": override.get("label") or node_name,
        "neighbors": neighbors
    }

def serialize_graph_node(node_name, username):
    node = effective_node(node_name, username)
    if not node:
        return {
            "id": node_name,
            "type": "Unknown"
        }
    payload = {
        "id": node_name,
        "label": node["label"],
        "type": node["type"]
    }
    if node["type"] == "Employee":
        state = get_user_state(username)
        row = state["employee_meta"].get(node_name, {})
        payload["deploymentStatus"] = row.get("Deployment_Status", "")
        payload["clientName"] = row.get("Client_Name", "")
        payload["ssl"] = row.get("SS", "")
    return payload


def generate_graph(node_name, username=""):
    state = get_user_state(username)
    canonical_name = find_canonical_node_name(node_name, username) or node_name
    node = effective_node(canonical_name, username)

    if not node:
        return {
            "nodes": [],
            "links": [],
            "error": f"Node '{node_name}' not found"
        }

    nodes = [serialize_graph_node(canonical_name, username)]
    links = []

    for neighbor in node["neighbors"]:
        neighbor_data = effective_node(neighbor, username)
        if neighbor_data:
            nodes.append(serialize_graph_node(neighbor, username))
        else:
            nodes.append({
                "id": neighbor,
                "type": "Unknown"
            })

        links.append({
            "source": canonical_name,
            "target": neighbor,
            "relType": (
                state["ontology_edges"].get((canonical_name, neighbor))
                or state["ontology_edges"].get((neighbor, canonical_name))
                or ""
            )
        })

    return {
        "nodes": nodes,
        "links": links
    }


def expand_recursive(node_name, depth, username=""):
    state = get_user_state(username)
    canonical_name = find_canonical_node_name(node_name, username) or node_name

    visited = set()
    nodes = []
    node_ids = set()
    links = []

    def dfs(current_node, current_depth):
        if current_depth > depth:
            return
        if current_node in visited:
            return
        visited.add(current_node)

        node_data = effective_node(current_node, username)
        if not node_data:
            return

        if current_node not in node_ids:
            node_ids.add(current_node)
            nodes.append(serialize_graph_node(current_node, username))

        for neighbor in node_data["neighbors"]:
            neighbor_data = effective_node(neighbor, username)
            if not neighbor_data:
                continue

            if neighbor not in node_ids:
                node_ids.add(neighbor)
                nodes.append(serialize_graph_node(neighbor, username))

            links.append({
                "source": current_node,
                "target": neighbor,
                "relType": (
                    state["ontology_edges"].get((current_node, neighbor))
                    or state["ontology_edges"].get((neighbor, current_node))
                    or ""
                )
            })

            dfs(neighbor, current_depth + 1)

    dfs(canonical_name, 0)

    return {
        "nodes": nodes,
        "links": links
    }


def node_names_by_type(node_type, username=None):
    state = get_user_state(username)
    return sorted(
        name for name, data in state["ontology"].items()
        if data["type"] == node_type
    )


def serialize_search_result(name, username=""):
    state = get_user_state(username)
    node_type = state["ontology"][name]["type"]
    label = user_label(username, name)
    result = {
        "id": name,
        "label": label,
        "type": node_type,
        "description": f"{node_type} node" if label == name else f"{node_type} node, originally {name}"
    }
    if node_type == "Employee":
        profile = employee_profile(name, username)
        result["deploymentStatus"] = profile["deployment_status"].capitalize()
        dept = "Lighthouse" if profile["ssl"] else "Employee"
        result["description"] = f"{dept} - {profile['deployment_status'].capitalize()}"
    return result



def find_user_by_email(email):
    clean_email = str(email or "").strip().lower()
    if not clean_email:
        return None

    users = mongo_collection("users")
    if users is not None:
        return users.find_one({"email": clean_email})

    return next((user for user in runtime_users if user["email"] == clean_email), None)

def find_user_by_id(user_id):
    if not user_id:
        return None

    users = mongo_collection("users")
    if users is not None:
        return users.find_one({"id": user_id})

    return next((user for user in runtime_users if user["id"] == user_id), None)

def create_session(user_id):
    session_id = str(uuid.uuid4())
    record = {
        "id": session_id,
        "userId": user_id,
        "createdAt": now_iso(),
    }
    sessions = mongo_collection("sessions")
    if sessions is not None:
        sessions.insert_one(record)
    else:
        runtime_sessions[session_id] = record
    return session_id

def get_current_user():
    session_id = request.cookies.get("oe_session")
    if not session_id:
        return None
    sessions = mongo_collection("sessions")
    session_record = sessions.find_one({"id": session_id}) if sessions is not None else runtime_sessions.get(session_id)
    if not session_record:
        return None
    return find_user_by_id(session_record.get("userId"))


def clear_session():
    session_id = request.cookies.get("oe_session")
    if not session_id:
        return
    sessions = mongo_collection("sessions")
    if sessions is not None:
        sessions.delete_one({"id": session_id})
    else:
        runtime_sessions.pop(session_id, None)


def attach_session_cookie(response, session_id):
    response.set_cookie(
        "oe_session",
        session_id,
        httponly=True,
        samesite="Lax",
        secure=False,
        max_age=60 * 60 * 24 * 7,
    )
    return response


def connected_neighbor_of_type(node_name, target_type, username=None):
    state = get_user_state(username)
    user_ontology = state["ontology"]
    for neighbor in user_ontology.get(node_name, {}).get("neighbors", []):
        if user_ontology.get(neighbor, {}).get("type") == target_type:
            return neighbor
    return ""


def employee_profile(employee_name, username=None):
    state = get_user_state(username)
    meta = state["employee_meta"].get(employee_name, {})

    # 1. client_name
    client_name = meta.get("Client_Name") or connected_neighbor_of_type(employee_name, "Client", username) or "Unassigned"

    # 2. skill_group
    skill_group = meta.get("skillgroup") or meta.get("skill_group") or connected_neighbor_of_type(employee_name, "SkillGroup", username) or "General"

    # 3. bench_aging
    bench_aging = meta.get("Bench_Aging") or meta.get("bench_aging") or meta.get("bench_ageing")
    if bench_aging is None:
        bench_aging_str = connected_neighbor_of_type(employee_name, "BenchAging", username)
        try:
            bench_aging = int(float(bench_aging_str)) if bench_aging_str else 0
        except (ValueError, TypeError):
            bench_aging = 0
    else:
        try:
            bench_aging = int(float(bench_aging))
        except (ValueError, TypeError):
            bench_aging = 0

    # 4. deployment_status
    deployment_status = meta.get("Deployment_Status") or meta.get("deployment_status")
    if not deployment_status:
        client_lower = client_name.lower()
        if bench_aging > 0 or client_lower in ("unassigned", "bench", ""):
            deployment_status = "available"
        else:
            deployment_status = "deployed"
    else:
        deployment_status = str(deployment_status).lower()

    # 5. performance_manager
    performance_manager = meta.get("RM_Remarks") or meta.get("performance_unit") or meta.get("performance_manager") or "Unassigned"


    # 7. level
    level = meta.get("KPMG_Level") or meta.get("level") or connected_neighbor_of_type(employee_name, "Level", username) or ""

  

    return {
        "employee": employee_name, 
        "bench_aging": bench_aging,
        "client_name": client_name,
        "deployment_status": deployment_status,
        "performance_manager": performance_manager,
        "level": level,
        "performance": performance,
        "utilization": utilization,
        "skill_group": skill_group,
        "campus_lateral": meta.get("Campus_Lateral") or meta.get("campus_lateral") or meta.get("campus/lateral") or ""
    }


def read_admin_requests():
    if not ADMIN_REQUESTS_PATH.exists():
        return []
    try:
        data = json.loads(ADMIN_REQUESTS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def write_admin_requests(data):
    temporary_path = ADMIN_REQUESTS_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    temporary_path.replace(ADMIN_REQUESTS_PATH)


@app.before_request
def auto_rebuild_ontology():
    """Automatically rebuild the ontology cache from Neo4j before serving any request."""
    username = get_active_username()
    if username:
        try:
            _rebuild_ontology_from_neo4j(username)
        except Exception:
            pass


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Ontology-User"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    if not name or not email or len(password) < 8:
        return jsonify({"error": "Name, email, and an 8 character password are required"}), 400
    if find_user_by_email(email):
        return jsonify({"error": "An account with this email already exists."}), 409

    user = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "role": "Explorer",
        "passwordHash": generate_password_hash(password),
        "createdAt": now_iso(),
    }
    users = mongo_collection("users")
    if users is not None:
        users.insert_one(user)
    else:
        runtime_users.append(user)

    response = jsonify({"user": public_user(user)})
    return attach_session_cookie(response, create_session(user["id"]))


@app.route("/auth/login", methods=["POST"])
def auth_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    user = find_user_by_email(email)

    if not user or not check_password_hash(user.get("passwordHash", ""), password):
        return jsonify({"error": "Invalid email or password."}), 401

    response = jsonify({"user": public_user(user)})
    return attach_session_cookie(response, create_session(user["id"]))


@app.route("/auth/me")
def auth_me():
    return jsonify({"user": public_user(get_current_user())})


@app.route("/auth/logout", methods=["POST"])
def auth_logout():
    clear_session()
    response = jsonify({"ok": True})
    response.delete_cookie("oe_session")
    return response


@app.route("/events", methods=["POST"])
def create_event():
    payload = request.get_json(silent=True) or {}
    event = {
        "id": str(uuid.uuid4()),
        "timestamp": now_iso(),
        "source": "frontend",
        **payload,
    }
    events = mongo_collection("events")
    if events is not None:
        events.insert_one(dict(event))
    else:
        runtime_events.insert(0, event)
        del runtime_events[250:]
    return jsonify(event)


@app.route("/events/search")
def search_events():
    query = request.args.get("q", "").strip().lower()
    event_type = request.args.get("type", "all").strip()

    events = mongo_collection("events")
    if events is not None:
        criteria = {}
        if event_type != "all":
            criteria["type"] = event_type
        records = list(events.find(criteria, {"_id": 0}).sort("timestamp", -1).limit(250))
    else:
        records = list(runtime_events)

    def matches(event):
        type_matches = event_type == "all" or event.get("type") == event_type
        text_matches = not query or query in json.dumps(event, default=str).lower()
        return type_matches and text_matches

    return jsonify({"events": [event for event in records if matches(event)][:50]})


@app.route("/ingestion/jobs", methods=["GET", "POST"])
def ingestion_jobs():
    username = get_active_username()
    if not username:
        return jsonify({"error": "A signed-in user is required"}), 400

    jobs = mongo_collection("ingestion_jobs")

    if request.method == "GET":
        if jobs is not None:
            records = list(jobs.find({"username": username}, {"_id": 0}).sort("createdAt", -1).limit(50))
        else:
            records = [job for job in runtime_ingestion_jobs if job.get("username") == username]
        return jsonify({"jobs": records})

    payload = request.get_json(silent=True) or {}
    content = str(payload.get("content", ""))
    job = {
        "id": str(uuid.uuid4()),
        "status": "queued",
        "sourceType": str(payload.get("sourceType", "unknown")),
        "sourceName": str(payload.get("sourceName", "Untitled source")).strip() or "Untitled source",
        "entitiesDetected": max(1, len([word for word in content.split() if word]) % 17),
        "createdAt": now_iso(),
        "username": username,
    }
    if jobs is not None:
        jobs.insert_one(dict(job))
    else:
        runtime_ingestion_jobs.insert(0, job)
        del runtime_ingestion_jobs[50:]
    return jsonify(job)


@app.route("/")
def home():
    return jsonify({
        "message": "Ontology Engine Running",
        "mongoConnected": mongo_db is not None,
    })


@app.route("/expand/<path:node>", methods=["GET", "POST"])
def expand(node):
    username = get_active_username()
    state = get_user_state(username)
    if len(state["ontology"]) == 0:
        return jsonify({"nodes": [], "links": []}), 200
    graph = generate_graph(node, username)
    return jsonify(graph), 404 if graph.get("error") else 200


@app.route("/expand_recursive/<path:node>/<int:depth>")
def recursive(node, depth):
    username = get_active_username()
    state = get_user_state(username)
    if len(state["ontology"]) == 0:
        return jsonify({"nodes": [], "links": []}), 200
    canonical_name = find_effective_node_name(node, username)
    if not canonical_name:
        return jsonify({"nodes": [], "links": [], "error": f"Node '{node}' not found"}), 404

    return jsonify(expand_recursive(canonical_name, depth, username))


@app.route("/overrides/<path:node>", methods=["GET", "PUT", "DELETE"])
def node_override(node):
    username = get_active_username()
    state = get_user_state(username)
    canonical_name = find_effective_node_name(node, username)
    if not username:
        return jsonify({"error": "A signed-in user is required"}), 400
    if not canonical_name:
        return jsonify({"error": f"Node '{node}' not found"}), 404

    if request.method == "GET":
        return jsonify({
            "node": canonical_name,
            "original": {
                "label": canonical_name,
                "neighbors": state["ontology"][canonical_name]["neighbors"]
            },
            "override": get_node_override(username, canonical_name)
        })

    with overrides_lock:
         if request.method == "DELETE":
             delete_node_override(username, canonical_name)
         else:
             payload = request.get_json(silent=True) or {}
             label = str(payload.get("label", "")).strip()[:80]
             added = payload.get("added_neighbors", [])
             removed = payload.get("removed_neighbors", [])
             if not isinstance(added, list) or not isinstance(removed, list):
                 return jsonify({"error": "Relationship overrides must be lists"}), 400

             original_neighbors = set(state["ontology"][canonical_name]["neighbors"])
             added_nodes = {
                 match for value in added
                 if (match := find_canonical_node_name(value, username)) and match != canonical_name
             }
             removed_nodes = {
                 match for value in removed
                 if (match := find_canonical_node_name(value, username)) and match != canonical_name
             }
             override = {}
             if label and label != canonical_name:
                 override["label"] = label
             if added_nodes - original_neighbors:
                 override["added_neighbors"] = sorted(added_nodes - original_neighbors)
             if removed_nodes & original_neighbors:
                 override["removed_neighbors"] = sorted(removed_nodes & original_neighbors)

             if override:
                 save_node_override(username, canonical_name, override)
             else:
                 delete_node_override(username, canonical_name)

    return jsonify({"ok": True, "override": get_node_override(username, canonical_name)})


@app.route("/search")
def search():
    username = get_active_username()
    state = get_user_state(username)
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify({"results": []})

    def row_matches(name):
        if state["ontology"].get(name, {}).get("type") != "Employee":
            return False
        profile = employee_profile(name, username)
        return any(query in str(value).lower() for value in profile.values())

    matches = [
        serialize_search_result(name, username)
        for name, data in state["ontology"].items()
        if query in name.lower()
        or query in user_label(username, name).lower()
        or query in data["type"].lower()
        or row_matches(name)
    ]
    return jsonify({"results": matches[:30]})


@app.route("/departments")
def departments():
    username = get_active_username()
    return jsonify(node_names_by_type("Department", username))


@app.route("/skills")
def skills():
    username = get_active_username()
    return jsonify(node_names_by_type("Skill", username))


@app.route("/employees")
def employees():
    username = get_active_username()
    state = get_user_state(username)
    if len(state["ontology"]) == 0:
        return jsonify({"results": []}), 200
    query_filter = request.args.get("query", "").strip().lower()
    name_filter = request.args.get("name", "").strip().lower()
    department = find_effective_node_name(request.args.get("department", ""), username)
    skill = find_effective_node_name(request.args.get("skill", ""), username)
    ssl = request.args.get("ssl", "").strip().lower()
    bench_min = request.args.get("benchMin", "").strip()
    bench_max = request.args.get("benchMax", "").strip()
    client_name = request.args.get("clientName", "").strip().lower()
    deployment_status = request.args.get("deploymentStatus", "").strip().lower()
    employee_filter = request.args.get("employee", "").strip().lower()
    performance_manager = request.args.get("performanceManager", "").strip().lower()
    skill_group = request.args.get("skillGroup", "").strip().lower()
    campus_lateral = request.args.get("campusLateral", "").strip().lower()

    try:
        bench_min = int(bench_min) if bench_min else None
        bench_max = int(bench_max) if bench_max else None
    except ValueError:
        bench_min = None
        bench_max = None

    employee_names = node_names_by_type("Employee", username)

    if name_filter:
        employee_names = [
            name for name in employee_names
            if name_filter in name.lower() or name_filter in user_label(username, name).lower()
        ]

    if query_filter:
        employee_names = [
            name for name in employee_names
            if query_filter in name.lower() or query_filter in user_label(username, name).lower()
        ]

    if employee_filter:
        employee_names = [
            name for name in employee_names
            if employee_filter in name.lower() or employee_filter in user_label(username, name).lower()
        ]

    if department:
        department_node = state["ontology"].get(department, {})
        if department_node.get("type") != "Department":
            employee_names = []
        else:
            members = set(department_node.get("neighbors", []))
            employee_names = [name for name in employee_names if name in members]

    if skill:
        skill_node = state["ontology"].get(skill, {})
        if skill_node.get("type") != "Skill":
            employee_names = []
        else:
            employee_names = [
                name for name in employee_names
                if skill in state["ontology"][name].get("neighbors", [])
            ]

    filtered = []
    for name in employee_names:
        profile = employee_profile(name, username)
        if ssl in {"true", "1", "yes"} and not profile["ssl"]:
            continue
        if bench_min is not None and profile["bench_aging"] < bench_min:
            continue
        if bench_max is not None and profile["bench_aging"] > bench_max:
            continue
        if client_name and client_name not in profile["client_name"].lower():
            continue
        if deployment_status and deployment_status != profile["deployment_status"]:
            continue
        if performance_manager and performance_manager not in profile["performance_manager"].lower():
            continue
        if skill_group and skill_group != profile["skill_group"].lower():
            continue
        if campus_lateral and campus_lateral not in profile["campus_lateral"].lower():
            continue
        filtered.append(name)

    results = [
        {
            **serialize_search_result(name, username),
            "description": "Employee in selected filters"
        }
        for name in filtered[:30]
    ]
    return jsonify({"results": results})


@app.route("/filter-options")
def filter_options():
    username = get_active_username()
    state = get_user_state(username)
    if len(state["ontology"]) == 0:
        return jsonify({
            "clients": [],
            "deploymentStatuses": ["available", "deployed"],
            "employees": [],
            "performanceManagers": [],
            "skillGroups": [],
            "skills": [],
            "projects": [],
            "benchAging": {"min": 0, "max": 0},
            "campusLaterals": [],
        }), 200
    employees = node_names_by_type("Employee", username)
    clients   = sorted(node_names_by_type("Client", username))
    skills    = sorted(node_names_by_type("Skill", username))
    skill_groups = sorted(node_names_by_type("SkillGroup", username))
    projects  = sorted(node_names_by_type("Project", username))

    # Build bench aging range and campus lateral list from employee properties
    bench_vals = []
    campus_laterals = set()
    for name, meta in state["employee_meta"].items():
        ba = meta.get("bench_aging") or meta.get("bench_ageing") or meta.get("Bench_Aging")
        if ba is not None:
            try:
                bench_vals.append(float(ba))
            except (ValueError, TypeError):
                pass
        cl = meta.get("campus_lateral") or meta.get("Campus_Lateral")
        if cl:
            campus_laterals.add(cl)

    return jsonify({
        "clients": clients,
        "deploymentStatuses": ["available", "deployed"],
        "employees": employees,
        "performanceManagers": [],
        "skillGroups": skill_groups,
        "skills": skills,
        "projects": projects,
        "benchAging": {
            "min": int(min(bench_vals)) if bench_vals else 0,
            "max": int(max(bench_vals)) if bench_vals else 0,
        },
        "campusLaterals": sorted(list(campus_laterals)),
    })



@app.route("/admin-change-requests", methods=["POST"])
def admin_change_request():
    username = request_username()
    payload = request.get_json(silent=True) or {}
    canonical_name = find_effective_node_name(payload.get("node", ""), username)
    if not username:
        return jsonify({"error": "A signed-in user is required"}), 400
    if not canonical_name:
        return jsonify({"error": "Node not found"}), 404

    requests = read_admin_requests()
    request_record = {
        "id": len(requests) + 1,
        "status": "pending",
        "requested_by": username,
        "node": canonical_name,
        "override": get_node_override(username, canonical_name),
    }
    requests.append(request_record)
    write_admin_requests(requests)
    return jsonify({"ok": True, "request": request_record})


# ─────────────────────────────────────────────────────────────
# Document Upload & Neo4j Ingestion

def _parse_uploaded_file(file_storage):
    """Parse CSV, Excel or JSON file into a list of row dicts."""
    filename = file_storage.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "json":
        try:
            raw = json.loads(file_storage.read().decode("utf-8"))
        except Exception as exc:
            raise ValueError(f"Invalid JSON: {exc}")
        if isinstance(raw, dict):
            raw = [raw]
        if not isinstance(raw, list):
            raise ValueError("JSON must be an array or object.")
        return raw

    if ext in ("csv", "xlsx", "xls"):
        if pd is None:
            raise RuntimeError("pandas is not installed. Run: pip install pandas openpyxl")
        try:
            if ext == "csv":
                df = pd.read_csv(file_storage)
            else:
                df = pd.read_excel(file_storage, engine="openpyxl")
        except Exception as exc:
            raise ValueError(f"Could not parse file: {exc}")
        if df.empty or len(df.columns) == 0:
            raise ValueError("File is empty or has no columns.")
        df.dropna(how="all", inplace=True)
        df.columns = [str(c).strip() for c in df.columns]
        return df.to_dict(orient="records")

    raise ValueError(f"Unsupported file type: .{ext}. Use CSV, XLSX, XLS or JSON.")


def _ingest_rows_to_neo4j(rows, username):
    """
    Convert a list of row-dicts into Neo4j nodes + relationships.
    Only creates separate nodes for columns matching NODE_COLUMNS.
    All other columns are stored directly as properties on the Employee node.
    """
    if not username:
        raise ValueError("Ingestion requires a signed-in user.")
    if GraphDatabase is None:
        raise RuntimeError("neo4j driver not installed.")
    if not rows:
        return 0, 0

    columns = list(rows[0].keys())
    if not columns:
        raise ValueError("No columns found in data.")

    primary_col = columns[0]
    primary_label = COLUMN_LABEL_MAP.get(primary_col, primary_col)
    nodes_merged = set()
    rels_merged = set()

    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD),
        connection_timeout=5,
    )
    try:
        with driver.session(database=NEO4J_DATABASE) as session:
            for row in rows:
                primary_val = str(row.get(columns[0], "")).strip()
                if not primary_val:
                    continue

                # Build employee properties dynamically from non-graph columns
                emp_props = {
                    "owner": username
                }

                def clean_prop_name(col):
                    return col.strip().lower().replace(" ", "_").replace("/", "_").replace("-", "_")

                for col in columns[1:]:
                    if col.strip().lower() not in NODE_COLUMNS:
                        val = row[col]
                        if val is not None and str(val).lower() not in ("nan", "none", ""):
                            prop_name = clean_prop_name(col)
                            try:
                                if "." in str(val):
                                    emp_props[prop_name] = float(val)
                                else:
                                    emp_props[prop_name] = int(val)
                            except (ValueError, TypeError):
                                emp_props[prop_name] = str(val).strip()

                # MERGE primary node and SET all properties at once
                session.run(
                    f"MERGE (n:`{primary_label}` {{name: $name, owner: $owner}}) SET n += $props",
                    name=primary_val,
                    owner=username,
                    props=emp_props
                )
                nodes_merged.add((primary_label, primary_val))

                for col in columns[1:]:
                    # Skip columns that are properties (not graph nodes)
                    if col.strip().lower() not in NODE_COLUMNS:
                        continue

                    cell_val = str(row.get(col, "")).strip()
                    if not cell_val or cell_val.lower() in ("nan", "none", ""):
                        continue

                    rel_type = col.upper().replace(" ", "_").replace("-", "_").replace("/", "_")
                    col_label = COLUMN_LABEL_MAP.get(col, col.strip())

                    # MERGE related node using the mapped label and owner
                    session.run(
                        f"MERGE (n:`{col_label}` {{name: $name, owner: $owner}})",
                        name=cell_val,
                        owner=username
                    )
                    nodes_merged.add((col_label, cell_val))

                    # MERGE relationship
                    session.run(
                        f"""
                        MATCH (a:`{primary_label}` {{name: $primary, owner: $owner}})
                        MATCH (b:`{col_label}` {{name: $related, owner: $owner}})
                        MERGE (a)-[r:`{rel_type}`]->(b)
                        ON CREATE SET r.owner = $owner
                        ON MATCH SET r.owner = $owner
                        """,
                        primary=primary_val,
                        related=cell_val,
                        owner=username
                    )
                    rels_merged.add((primary_val, rel_type, cell_val))
    finally:
        driver.close()

    return len(nodes_merged), len(rels_merged)


def _rebuild_ontology_from_neo4j(username):
    """Re-read the user's graph from Neo4j and rebuild the in-memory ontology for that user."""
    if not username:
        return
        
    username = username.strip().lower()
    fresh = load_graph_dataset_from_neo4j(username) or []
    
    state = USER_DATA.setdefault(username, {
        "employees": [],
        "employee_meta": {},
        "ontology": {},
        "ontology_edges": {},
        "graph_source": "empty"
    })
    
    state["employees"] = fresh
    state["employee_meta"] = {row["Emp_Name"]: row for row in fresh}
    state["graph_source"] = "neo4j" if fresh else "empty"
    state["ontology"] = build_ontology(fresh)
    state["ontology_edges"] = {}

    if GraphDatabase is None:
        return
    driver = None
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            connection_timeout=5,
        )
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(
                """
                MATCH (n {owner: $owner})
                OPTIONAL MATCH (n)-[r]->(m {owner: $owner})
                WHERE r.owner = $owner
                RETURN labels(n) AS labels, n.name AS name,
                       collect({type: type(r), target: m.name, targetLabels: labels(m)}) AS rels
                """,
                owner=username
            )
            for record in result:
                name = record["name"]
                if not name:
                    continue
                labels = record["labels"] or []
                node_type = labels[0] if labels else "Unknown"
                if name not in state["ontology"]:
                    state["ontology"][name] = {"type": node_type, "neighbors": []}
                for rel in (record["rels"] or []):
                    target = rel.get("target")
                    rel_type = rel.get("type") or ""
                    if target and target not in state["ontology"][name]["neighbors"]:
                        state["ontology"][name]["neighbors"].append(target)
                    if target and target not in state["ontology"]:
                        tl = (rel.get("targetLabels") or ["Unknown"])
                        state["ontology"][target] = {"type": tl[0], "neighbors": []}
                    if target and name not in state["ontology"][target]["neighbors"]:
                        state["ontology"][target]["neighbors"].append(name)
                    # Store the relationship type for edge label display
                    if target and rel_type:
                        state["ontology_edges"][(name, target)] = rel_type
    except Exception:
        pass
    finally:
        if driver:
            driver.close()


@app.route("/ingestion/upload", methods=["POST"])
def ingestion_upload():
    """Accept a CSV/XLSX/XLS/JSON file, parse it, write to Neo4j super4j, refresh ontology."""
    username = get_active_username()
    if not username:
        return jsonify({"error": "A signed-in user is required"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file part in request. Send field name 'file'."}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "No file selected."}), 400

    try:
        rows = _parse_uploaded_file(uploaded_file)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    if not rows:
        return jsonify({"error": "File is empty — no data rows found."}), 422

    # Check headers present
    uploaded_columns = list(rows[0].keys())
    if not uploaded_columns:
        return jsonify({"error": "Missing column headers in uploaded file."}), 422

    uploaded_set = set(uploaded_columns)
    missing = [col for col in REQUIRED_COLUMNS if col not in uploaded_set]

    if missing:
        return jsonify({
            "status": "error",
            "error": "Schema Validation Failed: Missing required columns",
            "missing_columns": missing,
            "unexpected_columns": []
        }), 422


    try:
        nodes_count, rels_count = _ingest_rows_to_neo4j(rows, username)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Neo4j write failed: {exc}"}), 500

    # Rebuild ontology so data is immediately searchable
    try:
        _rebuild_ontology_from_neo4j(username)
    except Exception:
        pass  # Non-fatal; data is in Neo4j even if rebuild fails

    filename = uploaded_file.filename
    record = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "uploadedAt": now_iso(),
        "totalRows": len(rows),
        "totalNodes": nodes_count,
        "totalRelationships": rels_count,
        "columns": list(rows[0].keys()),
        "primaryEntity": list(rows[0].keys())[0] if rows else "",
        "status": "completed",
        "username": username,
    }

    # Persist to Mongo if available, else in-memory
    uploads_col = mongo_collection("upload_history")
    if uploads_col is not None:
        uploads_col.insert_one(dict(record))
    else:
        runtime_upload_history.insert(0, record)
        del runtime_upload_history[100:]

    return jsonify(record), 200


@app.route("/ingestion/uploads", methods=["GET"])
def ingestion_uploads():
    """List past document uploads."""
    username = get_active_username()
    uploads_col = mongo_collection("upload_history")
    if uploads_col is not None:
        records = list(uploads_col.find({"username": username}, {"_id": 0}).sort("uploadedAt", -1).limit(50))
    else:
        records = [r for r in runtime_upload_history if r.get("username") == username]
    return jsonify({"uploads": records})


@app.route("/admin/refresh", methods=["POST"])
def admin_refresh():
    """Force a full re-read of Neo4j and rebuild the in-memory ontology.
    Call this after clearing or modifying Neo4j externally."""
    username = get_active_username()
    try:
        _rebuild_ontology_from_neo4j(username)
        state = get_user_state(username)
        return jsonify({
            "ok": True,
            "graphSource": state["graph_source"],
            "nodeCount": len(state["ontology"]),
            "employeeCount": len(state["employees"]),
        })
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


# ── Startup: rebuild ontology + edge map from existing Neo4j data ────────────
# Verify connection to Neo4j. Cache states are loaded dynamically per-user.
if GraphDatabase is not None:
    try:
        _driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            connection_timeout=2,
        )
        _driver.verify_connectivity()
        _driver.close()
    except Exception:
        pass


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("FLASK_PORT", "5001")),
        debug=False
    )

