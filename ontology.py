from flask import Flask, jsonify

app = Flask(__name__)

ontology = {

    "Milind": {
        "type": "Employee",
        "neighbors": ["Rahul", "IT", "Python", "React"]
    },

    "Rahul": {
        "type": "Employee",
        "neighbors": ["Anjali", "IT", "Python", "Neo4j"]
    },

    "Anjali": {
        "type": "Employee",
        "neighbors": ["IT", "Management", "PMP"]
    },

    "Python": {
        "type": "Skill",
        "neighbors": ["Azure Fundamentals", "PCAP"]
    },

    "React": {
        "type": "Skill",
        "neighbors": ["Frontend Certification"]
    },

    "Neo4j": {
        "type": "Skill",
        "neighbors": ["Neo4j Professional"]
    },

    "IT": {
        "type": "Department",
        "neighbors": ["Milind", "Rahul", "Anjali"]
    },

    "Azure Fundamentals": {
        "type": "Certification",
        "neighbors": ["Microsoft"]
    },

    "PCAP": {
        "type": "Certification",
        "neighbors": ["Python Institute"]
    },

    "Frontend Certification": {
        "type": "Certification",
        "neighbors": ["Meta"]
    },

    "Neo4j Professional": {
        "type": "Certification",
        "neighbors": ["Neo4j Inc"]
    },

    "Management": {
        "type": "Skill",
        "neighbors": ["PMP"]
    },

    "PMP": {
        "type": "Certification",
        "neighbors": ["PMI"]
    },

    "Microsoft": {
        "type": "Company",
        "neighbors": []
    },

    "Python Institute": {
        "type": "Organization",
        "neighbors": []
    },

    "Meta": {
        "type": "Company",
        "neighbors": []
    },

    "Neo4j Inc": {
        "type": "Company",
        "neighbors": []
    },

    "PMI": {
        "type": "Organization",
        "neighbors": []
    }
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
    return None


def generate_graph(node_name):

    canonical_name = find_canonical_node_name(node_name) or node_name
    node = ontology.get(canonical_name)

    if not node:
        return {
            "nodes": [],
            "links": [],
            "error": f"Node '{node_name}' not found"
        }

    nodes = [
        {
            "id": canonical_name,
            "type": node["type"]
        }
    ]

    links = []

    for neighbor in node["neighbors"]:


        neighbor_data = ontology.get(neighbor)

        if neighbor_data:

            nodes.append({
                "id": neighbor,
                "type": neighbor_data["type"]
            })

        else:

            nodes.append({
                "id": neighbor,
                "type": "Unknown"
            })

        links.append({
            "source": node_name,
            "target": neighbor
        })

    return {
        "nodes": nodes,
        "links": links
    }
def expand_recursive(node_name, depth):

    canonical_name = find_canonical_node_name(node_name) or node_name

    visited = set()

    nodes = []
    currentNodes= set()
    links = []

    def dfs(current_node, current_depth):

        if current_depth > depth:
            return

        if current_node in visited:
            return

        visited.add(current_node)

        node_data = ontology.get(current_node)

        if not node_data:
            return
#[{},{}]
        nodes.append({
            "id": current_node,
            "type": node_data["type"]
        })

        for neighbor in node_data["neighbors"]:

            links.append({
                "source": current_node,
                "target": neighbor
            })

            dfs(neighbor, current_depth + 1)

    dfs(canonical_name, 0)

    return {
        "nodes": nodes,
        "links": links
    }

@app.route("/")
def home():

    return jsonify({
        "message": "Ontology Engine Running",
        "examples": [
            "/expand/Milind",
            "/expand/Rahul",
            "/expand/Python",
            "/expand/Azure Fundamentals"
        ]
    })


@app.route("/expand/<path:node>", ["POST"])
def expand(node):

    return jsonify(generate_graph(node))

@app.route("/expand_recursive/<path:node>/<int:depth>")

def recursive(node, depth):

    return jsonify(
        expand_recursive(node, depth)
    )

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )