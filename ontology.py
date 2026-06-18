import json
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request

app = Flask(__name__)
OVERRIDES_PATH = Path(__file__).with_name("ontology_overrides.json")
overrides_lock = Lock()

ontology = {
    # Employees
    "Milind Sharma": {"type": "Employee", "neighbors": ["Engineering", "Python", "React", "Docker", "AWS"]},
    "Rahul Verma": {"type": "Employee", "neighbors": ["Engineering", "Java", "Spring Boot", "SQL", "Docker"]},
    "Anjali Mehta": {"type": "Employee", "neighbors": ["Data Science", "Python", "Machine Learning", "SQL", "Power BI"]},
    "Priya Kulkarni": {"type": "Employee", "neighbors": ["Human Resources", "Management", "Power BI", "PMP"]},
    "Rohit Nair": {"type": "Employee", "neighbors": ["Data Science", "Python", "Neo4j", "Data Analysis", "Azure"]},
    "Suman Iyer": {"type": "Employee", "neighbors": ["Data Science", "Machine Learning", "Python", "AWS", "SQL"]},
    "Vikram Singh": {"type": "Employee", "neighbors": ["Finance", "SQL", "Power BI", "Data Analysis"]},
    "Neha Gupta": {"type": "Employee", "neighbors": ["Marketing", "React", "Figma", "Data Analysis"]},
    "Karan Joshi": {"type": "Employee", "neighbors": ["Operations", "Docker", "Kubernetes", "AWS", "Python"]},
    "Meera Rao": {"type": "Employee", "neighbors": ["Sales", "Salesforce", "Power BI", "SQL"]},
    "Arjun Rao": {"type": "Employee", "neighbors": ["Engineering", "Java", "React", "Docker", "Azure"]},
    "Tanya ": {"type": "Employee", "neighbors": ["Human Resources", "Management", "Data Analysis"]},
    "Aditya ": {"type": "Employee", "neighbors": ["Finance", "Python", "Flask", "SQL", "Power BI"]},
    "Ishaan Banerjee": {"type": "Employee", "neighbors": ["Operations", "Python", "Docker", "Kubernetes"]},
    "Sneha Kapoor": {"type": "Employee", "neighbors": ["Marketing", "Figma", "React", "Salesforce"]},
    "Dev Malhotra": {"type": "Employee", "neighbors": ["Engineering", "JavaScript", "React", "Node.js", "AWS"]},
    "Ayesha Khan": {"type": "Employee", "neighbors": ["Data Science", "Python", "Machine Learning", "Neo4j"]},
    "Nitin Desai": {"type": "Employee", "neighbors": ["Security", "Python", "Azure", "Kubernetes"]},
    "Pooja Shah": {"type": "Employee", "neighbors": ["Security", "Java", "AWS", "Docker"]},
    "Kabir Bhat": {"type": "Employee", "neighbors": ["Sales", "Salesforce", "Management", "Power BI"]},

    # Departments
    "Engineering": {"type": "Department", "neighbors": ["Milind Sharma", "Rahul Verma", "Arjun Rao", "Dev Malhotra"]},
    "Data Science": {"type": "Department", "neighbors": ["Anjali Mehta", "Rohit Nair", "Suman Iyer", "Ayesha Khan"]},
    "Human Resources": {"type": "Department", "neighbors": ["Priya Kulkarni", "Tanya Patel"]},
    "Finance": {"type": "Department", "neighbors": ["Vikram Singh", "Aditya Roy"]},
    "Marketing": {"type": "Department", "neighbors": ["Neha Gupta", "Sneha Kapoor"]},
    "Operations": {"type": "Department", "neighbors": ["Karan Joshi", "Ishaan Banerjee"]},
    "Sales": {"type": "Department", "neighbors": ["Meera Rao", "Kabir Bhat"]},
    "Security": {"type": "Department", "neighbors": ["Nitin Desai", "Pooja Shah"]},

    # Skills
    "Python": {"type": "Skill", "neighbors": ["PCAP", "Flask", "Machine Learning", "Data Analysis"]},
    "Java": {"type": "Skill", "neighbors": ["Oracle Java SE", "Spring Boot"]},
    "JavaScript": {"type": "Skill", "neighbors": ["React", "Node.js"]},
    "React": {"type": "Skill", "neighbors": ["Meta Front-End Developer", "JavaScript"]},
    "Node.js": {"type": "Skill", "neighbors": ["JavaScript", "AWS"]},
    "Flask": {"type": "Skill", "neighbors": ["Python", "Docker"]},
    "Spring Boot": {"type": "Skill", "neighbors": ["Java", "Docker"]},
    "SQL": {"type": "Skill", "neighbors": ["Data Analysis", "Power BI"]},
    "Machine Learning": {"type": "Skill", "neighbors": ["Python", "AWS Machine Learning Specialty"]},
    "Data Analysis": {"type": "Skill", "neighbors": ["SQL", "Power BI"]},
    "Power BI": {"type": "Skill", "neighbors": ["Microsoft Power BI Data Analyst", "Microsoft"]},
    "Neo4j": {"type": "Skill", "neighbors": ["Neo4j Professional", "Neo4j Inc"]},
    "Docker": {"type": "Skill", "neighbors": ["Docker Certified Associate", "Kubernetes"]},
    "Kubernetes": {"type": "Skill", "neighbors": ["Certified Kubernetes Administrator", "CNCF"]},
    "AWS": {"type": "Skill", "neighbors": ["AWS Solutions Architect", "Amazon"]},
    "Azure": {"type": "Skill", "neighbors": ["Azure Fundamentals", "Microsoft"]},
    "Figma": {"type": "Skill", "neighbors": ["Figma Inc"]},
    "Salesforce": {"type": "Skill", "neighbors": ["Salesforce Administrator", "Salesforce Inc"]},
    "Management": {"type": "Skill", "neighbors": ["PMP", "PMI"]},

    # Certifications
    "PCAP": {"type": "Certification", "neighbors": ["Python Institute"]},
    "Oracle Java SE": {"type": "Certification", "neighbors": ["Oracle"]},
    "Meta Front-End Developer": {"type": "Certification", "neighbors": ["Meta"]},
    "AWS Solutions Architect": {"type": "Certification", "neighbors": ["Amazon"]},
    "AWS Machine Learning Specialty": {"type": "Certification", "neighbors": ["Amazon"]},
    "Azure Fundamentals": {"type": "Certification", "neighbors": ["Microsoft"]},
    "Microsoft Power BI Data Analyst": {"type": "Certification", "neighbors": ["Microsoft"]},
    "Neo4j Professional": {"type": "Certification", "neighbors": ["Neo4j Inc"]},
    "Docker Certified Associate": {"type": "Certification", "neighbors": ["Docker Inc"]},
    "Certified Kubernetes Administrator": {"type": "Certification", "neighbors": ["CNCF"]},
    "Salesforce Administrator": {"type": "Certification", "neighbors": ["Salesforce Inc"]},
    "PMP": {"type": "Certification", "neighbors": ["PMI"]},

    # Companies and organizations
    "Microsoft": {"type": "Company", "neighbors": ["Azure Fundamentals", "Microsoft Power BI Data Analyst"]},
    "Amazon": {"type": "Company", "neighbors": ["AWS Solutions Architect", "AWS Machine Learning Specialty"]},
    "Meta": {"type": "Company", "neighbors": ["Meta Front-End Developer"]},
    "Oracle": {"type": "Company", "neighbors": ["Oracle Java SE"]},
    "Neo4j Inc": {"type": "Company", "neighbors": ["Neo4j Professional"]},
    "Docker Inc": {"type": "Company", "neighbors": ["Docker Certified Associate"]},
    "Salesforce Inc": {"type": "Company", "neighbors": ["Salesforce Administrator"]},
    "Figma Inc": {"type": "Company", "neighbors": []},
    "Python Institute": {"type": "Organization", "neighbors": ["PCAP"]},
    "PMI": {"type": "Organization", "neighbors": ["PMP"]},
    "CNCF": {"type": "Organization", "neighbors": ["Certified Kubernetes Administrator"]}
}


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
    return read_overrides().get(username, {}).get("nodes", {}).get(node_name, {})


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
    return {
        "id": node_name,
        "label": node["label"],
        "type": node["type"]
    }


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


def serialize_search_result(name):
    node_type = ontology[name]["type"]
    return {
        "id": name,
        "type": node_type,
        "description": f"{node_type} node"
    }


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Ontology-User"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/")
def home():

    return jsonify({
        "message": "Ontology Engine Running",
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
    canonical_name = find_canonical_node_name(node)
    if not canonical_name:
        return jsonify({"nodes": [], "links": [], "error": f"Node '{node}' not found"}), 404

    return jsonify(expand_recursive(canonical_name, depth, request_username()))


@app.route("/overrides/<path:node>", methods=["GET", "PUT", "DELETE"])
def node_override(node):
    username = request_username()
    canonical_name = find_canonical_node_name(node)
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
        store = read_overrides()
        user_nodes = store.setdefault(username, {}).setdefault("nodes", {})

        if request.method == "DELETE":
            user_nodes.pop(canonical_name, None)
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
                user_nodes[canonical_name] = override
            else:
                user_nodes.pop(canonical_name, None)

        if not user_nodes:
            store.pop(username, None)
        write_overrides(store)

    return jsonify({"ok": True, "override": get_node_override(username, canonical_name)})


@app.route("/search")
def search():
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify({"results": []})

    matches = [
        serialize_search_result(name)
        for name, data in ontology.items()
        if query in name.lower() or query in data["type"].lower()
    ]
    return jsonify({"results": matches[:8]})


@app.route("/departments")
def departments():
    return jsonify(node_names_by_type("Department"))


@app.route("/skills")
def skills():
    return jsonify(node_names_by_type("Skill"))


@app.route("/employees")
def employees():
    name_filter = request.args.get("name", "").strip().lower()
    department = find_canonical_node_name(request.args.get("department", ""))
    skill = find_canonical_node_name(request.args.get("skill", ""))

    employee_names = node_names_by_type("Employee")

    if name_filter:
        employee_names = [name for name in employee_names if name_filter in name.lower()]

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

    results = [
        {
            **serialize_search_result(name),
            "description": "Employee in selected filters"
        }
        for name in employee_names[:8]
    ]
    return jsonify({"results": results})

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
