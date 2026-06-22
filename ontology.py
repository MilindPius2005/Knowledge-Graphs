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

app = Flask(__name__)
OVERRIDES_PATH = Path(__file__).with_name("ontology_overrides.json")
ADMIN_REQUESTS_PATH = Path(__file__).with_name("ontology_admin_requests.json")
overrides_lock = Lock()
runtime_events = []
runtime_ingestion_jobs = []
runtime_users = []
runtime_sessions = {}

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "knowledge_graph")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "super4j")

from employees_dataset import DATASET





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


def load_graph_dataset_from_neo4j():
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
                MATCH (e:Employee)
                OPTIONAL MATCH (e)-[r]-(n)
                RETURN e.name AS name,
                       properties(e) AS props,
                       collect({
                         relationship: type(r),
                         name: n.name,
                         labels: labels(n),
                         props: properties(n)
                       }) AS connected
                ORDER BY name
                """
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
                    "Deployment_Status": props.get("Deployment_Status") or props.get("deploymentStatus") or "Deployed",
                    "Soft_BI": props.get("Soft_BI") or (skills[0] if len(skills) > 0 else ""),
                    "Soft_BI_2": props.get("Soft_BI_2") or (skills[1] if len(skills) > 1 else ""),
                    "Soft_BI_3": props.get("Soft_BI_3") or (skills[2] if len(skills) > 2 else ""),
                    "Practice_Update": props.get("Practice_Update") or "Available",
                    "Project": props.get("Project") or props.get("project") or connected_name("Project") or "",
                    "Apr_Util": int(props.get("Apr_Util") or props.get("aprUtil") or 0),
                    "May_Util": int(props.get("May_Util") or props.get("mayUtil") or 0),
                    "YTD_Util": int(props.get("YTD_Util") or props.get("utilization") or 0),
                    "Util_Gap": int(props.get("Util_Gap") or props.get("utilGap") or 0),
                    "UG_Flag": props.get("UG_Flag") or props.get("ugFlag") or "",
                    "RM_Remarks": props.get("RM_Remarks") or props.get("performance_manager") or "Unassigned",
                    "Project_Status": props.get("Project_Status") or props.get("projectStatus") or "Active",
                    "Month": props.get("Month") or props.get("month") or "",
                    "KPMG_Level": props.get("KPMG_Level") or props.get("level") or "",
                    "Current_Performance": props.get("Current_Performance") or props.get("performance") or "",
                    "LM_Rated": props.get("LM_Rated") or "Yes",
                    "Q_Rating": int(props.get("Q_Rating") or props.get("rating") or 0),
                    "Skills": skills,
                    "Mobile": props.get("Mobile") or props.get("mobile") or "",
                    "Secondary_Skill": props.get("Secondary_Skill") or (skills[-1] if skills else ""),
                    "RM_Notes": props.get("RM_Notes") or props.get("notes") or "",
                })

            return employees or None
    except Exception:
        return None
    finally:
        if driver is not None:
            driver.close()


EMPLOYEES = load_graph_dataset_from_neo4j() or DATASET["employees"]
GRAPH_SOURCE = "neo4j" if EMPLOYEES is not DATASET["employees"] else "sample"
EMPLOYEE_META = {row["Emp_Name"]: row for row in EMPLOYEES}


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


ontology = build_ontology(EMPLOYEES)


def find_canonical_node_name(node_name: str):
    if not isinstance(node_name, str):
        return None
    query = node_name.strip().lower()
    if not query:
        return None

    for key in ontology.keys():
        if key.lower() == query:
            return key

    first_name_matches = [
        key for key, data in ontology.items()
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
    canonical_name = find_canonical_node_name(node_name)
    if canonical_name:
        return canonical_name

    query = str(node_name or "").strip().lower()
    if not query or not username:
        return None

    for name in ontology.keys():
        if user_label(username, name).strip().lower() == query:
            return name

    return None


def effective_node(node_name, username):
    node = ontology.get(node_name)
    if not node:
        return None

    override = get_node_override(username, node_name)
    removed = set(override.get("removed_neighbors", []))
    neighbors = [neighbor for neighbor in node["neighbors"] if neighbor not in removed]
    for neighbor in override.get("added_neighbors", []):
        if neighbor in ontology and neighbor not in neighbors:
            neighbors.append(neighbor)

    return {
        "type": node["type"],
        "label": override.get("label") or node_name,
        "neighbors": neighbors
    }


def serialize_graph_node(node_name, username):
    node = effective_node(node_name, username)
    payload = {
        "id": node_name,
        "label": node["label"],
        "type": node["type"]
    }
    if node["type"] == "Employee":
        row = EMPLOYEE_META.get(node_name, {})
        payload["deploymentStatus"] = row.get("Deployment_Status", "")
        payload["clientName"] = row.get("Client_Name", "")
        payload["ssl"] = row.get("SS", "")
    return payload


def generate_graph(node_name, username=""):

    canonical_name = find_canonical_node_name(node_name) or node_name
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
            "target": neighbor
        })

    return {
        "nodes": nodes,
        "links": links
    }
def expand_recursive(node_name, depth, username=""):

    canonical_name = find_canonical_node_name(node_name) or node_name

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
#[{},{}]
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

            links.append({"source": current_node, "target": neighbor})

            dfs(neighbor, current_depth + 1)

    dfs(canonical_name, 0)

    return {
        "nodes": nodes,
        "links": links
    }


def node_names_by_type(node_type):
    return sorted(
        name for name, data in ontology.items()
        if data["type"] == node_type
    )


def serialize_search_result(name, username=""):
    node_type = ontology[name]["type"]
    label = user_label(username, name)
    result = {
        "id": name,
        "label": label,
        "type": node_type,
        "description": f"{node_type} node" if label == name else f"{node_type} node, originally {name}"
    }
    if node_type == "Employee":
        row = EMPLOYEE_META.get(name, {})
        result["deploymentStatus"] = row.get("Deployment_Status", "")
        result["description"] = f"{row.get('SS', 'Employee')} - {row.get('Deployment_Status', 'Unknown')}"
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


def employee_profile(employee_name):
    row = EMPLOYEE_META.get(employee_name, {})
    skills = [
        neighbor for neighbor in ontology.get(employee_name, {}).get("neighbors", [])
        if ontology.get(neighbor, {}).get("type") == "Skill"
    ]
    skill_group = "Leadership" if "Management" in skills else "Technical" if skills else "General"
    bench_days = 0 if row.get("Bench") != "Yes" else (sum(ord(char) for char in employee_name) % 120)
    return {
        "employee": employee_name,
        "ssl": str(row.get("SS", "")).upper().startswith("SSL") or row.get("SST") == "LH",
        "bench_aging": bench_days,
        "client_name": row.get("Client_Name", "Unassigned"),
        "deployment_status": row.get("Deployment_Status", "Available").lower(),
        "performance_manager": row.get("RM_Remarks", "Unassigned"),
        "level": row.get("KPMG_Level", ""),
        "performance": row.get("Current_Performance", ""),
        "utilization": row.get("YTD_Util", 0),
        "util_gap": row.get("Util_Gap", 0),
        "ug_flag": row.get("UG_Flag", ""),
        "skill_group": skill_group,
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
    jobs = mongo_collection("ingestion_jobs")

    if request.method == "GET":
        if jobs is not None:
            records = list(jobs.find({}, {"_id": 0}).sort("createdAt", -1).limit(50))
        else:
            records = runtime_ingestion_jobs
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
        "graphSource": GRAPH_SOURCE,
        "mongoConnected": mongo_db is not None,
        "examples": [
            "/expand/Milind Sharma",
            "/expand/Rahul Verma",
            "/expand/Python",
            "/expand/Azure Fundamentals"
        ]
    })


@app.route("/expand/<path:node>", methods=["GET", "POST"])
def expand(node):
    graph = generate_graph(node, request_username())
    return jsonify(graph), 404 if graph.get("error") else 200

@app.route("/expand_recursive/<path:node>/<int:depth>")

def recursive(node, depth):
    canonical_name = find_effective_node_name(node, request_username())
    if not canonical_name:
        return jsonify({"nodes": [], "links": [], "error": f"Node '{node}' not found"}), 404

    return jsonify(expand_recursive(canonical_name, depth, request_username()))


@app.route("/overrides/<path:node>", methods=["GET", "PUT", "DELETE"])
def node_override(node):
    username = request_username()
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
                "neighbors": ontology[canonical_name]["neighbors"]
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

            original_neighbors = set(ontology[canonical_name]["neighbors"])
            added_nodes = {
                match for value in added
                if (match := find_canonical_node_name(value)) and match != canonical_name
            }
            removed_nodes = {
                match for value in removed
                if (match := find_canonical_node_name(value)) and match != canonical_name
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
    username = request_username()
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify({"results": []})

    def row_matches(name):
        row = EMPLOYEE_META.get(name, {})
        values = []
        for value in row.values():
            values.extend(value if isinstance(value, list) else [value])
        return any(query in str(value).lower() for value in values)

    matches = [
        serialize_search_result(name, username)
        for name, data in ontology.items()
        if query in name.lower()
        or query in user_label(username, name).lower()
        or query in data["type"].lower()
        or row_matches(name)
    ]
    return jsonify({"results": matches[:30]})


@app.route("/departments")
def departments():
    return jsonify(node_names_by_type("Department"))


@app.route("/skills")
def skills():
    return jsonify(node_names_by_type("Skill"))


@app.route("/employees")
def employees():
    username = request_username()
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

    try:
        bench_min = int(bench_min) if bench_min else None
        bench_max = int(bench_max) if bench_max else None
    except ValueError:
        bench_min = None
        bench_max = None

    employee_names = node_names_by_type("Employee")

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
        department_node = ontology.get(department, {})
        if department_node.get("type") != "Department":
            employee_names = []
        else:
            members = set(department_node.get("neighbors", []))
            employee_names = [name for name in employee_names if name in members]

    if skill:
        skill_node = ontology.get(skill, {})
        if skill_node.get("type") != "Skill":
            employee_names = []
        else:
            employee_names = [
                name for name in employee_names
                if skill in ontology[name].get("neighbors", [])
            ]

    filtered = []
    for name in employee_names:
        profile = employee_profile(name)
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
    profiles = [employee_profile(name) for name in node_names_by_type("Employee")]
    return jsonify({
        "clients": sorted({profile["client_name"] for profile in profiles}),
        "deploymentStatuses": ["available", "deployed"],
        "employees": node_names_by_type("Employee"),
        "performanceManagers": sorted({profile["performance_manager"] for profile in profiles}),
        "skillGroups": sorted({profile["skill_group"] for profile in profiles}),
        "skills": node_names_by_type("Skill"),
        "benchAging": {
            "min": min(profile["bench_aging"] for profile in profiles),
            "max": max(profile["bench_aging"] for profile in profiles),
        },
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

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("FLASK_PORT", "5001")),
        debug=False
    )
