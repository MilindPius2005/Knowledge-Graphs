# Project Walkthrough: Backend Services & D3.js Graph Visualization

This document explains the architecture, design, and inner workings of the Ontology Explorer's **Backend Services** and its **D3.js Visualization Engine**.

---

## 1. Backend Architecture (`ontology.py`)

The backend is built as a lightweight Python application using **Flask** and communicates with **Neo4j** (graph database) and **MongoDB** (document database).

### Databases Used
1. **Neo4j (`super4j` database):** Stores the relational database of Employees, Clients, Projects, Skills, and Departments as nodes and edges.
2. **MongoDB (`knowledge_graph` database):** Stores application state, user accounts, audit event logs, and file ingestion history.

---

### Core Backend Modules & Workflows

#### A. File Ingestion Pipeline
The ingestion pipeline allows users to upload spreadsheets (Excel/CSV) or JSON files to build the graph:
1. **File Parsing ([_parse_uploaded_file](file:///c:/Users/Administrator/Documents/Codex/2026-06-13/you-are-a-senior-frontend-engineer/ontology.py#L1103-L1135)):**
   - Checks the file extension (`.csv`, `.xlsx`, `.xls`, `.json`).
   - Uses `pandas` to read CSV or Excel files.
   - Cleans the headers (whitespace stripping) and drops empty rows.
   - Exposes data as a list of Python dictionaries.
2. **Schema Validation ([ingestion_upload](file:///c:/Users/Administrator/Documents/Codex/2026-06-13/you-are-a-senior-frontend-engineer/ontology.py#L1269-L1343)):**
   - Validates that the columns contain at least the 4 essential required columns listed in `REQUIRED_COLUMNS` (`Emp_Name`, `Client_Name`, `Skills`, `misc skill`).
   - Returns a `422 Unprocessable Entity` with a list of `missing_columns` if validation fails (any extra columns are permitted and dynamically mapped).
3. **Neo4j Writer ([_ingest_rows_to_neo4j](file:///c:/Users/Administrator/Documents/Codex/2026-06-13/you-are-a-senior-frontend-engineer/ontology.py#L1138-L1209)):**
   - Reads the primary column (`Emp_Name`) and merges the primary node using Cypher:
     `MERGE (n:Employee {name: $name})`
   - Iterates over all subsequent columns, dynamically resolving labels using `COLUMN_LABEL_MAP` (e.g. `Client_Name` maps to `:Client`).
   - Merges the secondary entity node and connects it to the employee node:
     `MERGE (a)-[:REL_TYPE]->(b)`
     *(Where `REL_TYPE` is the column name converted to upperc
     ase with spaces replaced by underscores, e.g. `CLIENT_NAME`)*.
4. **Ontology Rebuilding ([_rebuild_ontology_from_neo4j](file:///c:/Users/Administrator/Documents/Codex/2026-06-13/you-are-a-senior-frontend-engineer/ontology.py#L1212-L1266)):**
   - Triggers immediately after ingestion to reload all nodes and adjacency relationships into the Flask application's in-memory cache, ensuring new uploads are instantly searchable without restarts.

---

### Backend API Endpoints

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Authentication** | `/auth/signup` | `POST` | Registers a new user account in MongoDB. |
| | `/auth/login` | `POST` | Authenticates a user and starts a session. |
| | `/auth/me` | `GET` | Returns current user details. |
| | `/auth/logout` | `POST` | Invalidates active user session. |
| **Ingestion** | `/ingestion/upload` | `POST` | Accepts file, validates it, and writes rows into Neo4j. |
| | `/ingestion/uploads` | `GET` | Retrieves file upload history. |
| | `/ingestion/jobs` | `GET`/`POST` | Queues and lists manual ingestion payloads. |
| **Explorer** | `/search` | `GET` | Performs auto-search querying employees/skills/departments. |
| | `/employees` | `GET` | Lists employees filtered by client, bench state, level, etc. |
| | `/departments` | `GET` | Lists all distinct departments. |
| | `/skills` | `GET` | Lists all distinct skills. |
| | `/filter-options` | `GET` | Populates dropdowns for filters dynamically from Neo4j. |
| | `/expand/<path:node>` | `GET`/`POST` | Fetches the first-degree neighbors for a specific node. |
| | `/expand_recursive/<node>/<depth>`| `GET` | Fetches neighbors recursively up to specified depth. |
| | `/overrides/<node>` | `GET`/`PUT` | Allows admins to view or update metadata properties. |
| | `/admin/refresh` | `POST` | Manually forces the Flask in-memory cache to sync with Neo4j. |
| **Audit Events** | `/events` | `POST`/`GET` | Records user interaction events (searches, view expansions). |

---

## 2. D3.js Graph Visualization Engine (`OntologyGraph.jsx`)

The front-end rendering is managed by [OntologyGraph.jsx](file:///c:/Users/Administrator/Documents/Codex/2026-06-13/you-are-a-senior-frontend-engineer/src/components/OntologyGraph.jsx), combining **React lifecycle hooks** with **D3.js selection and math utilities** to draw an interactive force-directed structure.

### Key Visual & Functional Mechanisms

#### A. Structured BFS Tree Layout (`buildStructuredLayout`)
Rather than using standard chaotic physics layouts, the graph visualizer groups related nodes into organized vertical layers using Breadth-First Search (BFS) to display a tree structure:
1. **Adjacency Mapping:** Creates a Map representing node connections.
2. **Root Node BFS:** Starting from the active root node (depth `0`), it does a BFS traversal of all connected links to calculate the shortest path/depth from the root for every node.
3. **Layer Assignments:** Groups nodes by their BFS depth.
4. **Coordinate Calculator:** Computes layout positions to expand downwards like a tree:
   - **Y Coordinate (Vertical Layering):** Spaced vertically according to depth (`verticalGap * (depthIndex + 1)`). To prevent overlap and make relationship lines clearly visible, the vertical distance is scaled by `1.5x`, and an extra `0.5x` vertical gap is injected below the root node (depth `0`) to separate the root and child entities cleanly.
   - **X Coordinate (Horizontal Distribution):** Nodes belonging to the same depth layer are distributed horizontally across the screen (`horizontalGap * (nodeIndex + 1)`).

#### B. D3.js DOM Rendering Pipeline
Inside the React `useEffect` hook, the SVG element is cleared and rebuilt via D3 select/enter/join pipelines:
- **Links (`line` elements):** Renders lines connecting `(x1, y1)` to `(x2, y2)` based on computed BFS coordinate maps.
- **Edge Labels (`g` containing `rect` + `text`):** Computes the midpoint of each link and places an SVG group containing a background rectangle and a text label displaying the relationship type (e.g. `HAS_SKILL`), converting underscores back to spaces.
- **Nodes (`circle` elements):** Draws circular nodes. The node colors and radii are dynamically retrieved using `NODE_STYLES` matching the entity label (e.g. `:Employee` gets `#58a6ff` and `18px` radius, `:Skill` gets `#36d399` and `13px` radius).
- **Labels (`text` elements):** Places label text shifted slightly to the right of the node circle.
- **Collapse Rings (`circle` elements):** An animated dashed ring is overlayed around expanded nodes (excluding the root node) to indicate they can be clicked again to collapse.
- **Employee Status Badges (`g` containing `rect` + `text`):** Renders status labels (such as `[Deployed]` or `[Available]`) below employee nodes.

#### C. Zooming and Panning
- Attaches D3's zoom controller (`d3.zoom()`) to the outer SVG container.
- Captures wheel, touch, and double-click events, applying the transform matrix to a grouped layer `<g class="zoom-layer">` which contains the links, nodes, and labels.
- Constrains zoom limits to a scale between `0.25` and `3.0`.

#### D. Auto-Centering and Scale Fitting (`centerGraph`)
When nodes are expanded or a new graph is generated, D3 automatically transitions to center and fit the graph:
1. Calculates the bounding box (minimum and maximum X/Y coordinates) of the active node positions.
2. Determines the scale factor by comparing the graph dimensions to the client container width/height.
3. Sets a translation vector to align the graph center with the SVG canvas center.
4. Applies a smooth D3 transition:
   ```javascript
   d3.select(svgRef.current)
     .transition()
     .duration(600)
     .call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
   ```
