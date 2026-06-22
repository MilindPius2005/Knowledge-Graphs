from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "bolt://127.0.0.1:7687",
    auth=("neo4j", "password")
)

with driver.session(database="super4j") as session:
    result = session.run("RETURN 'Connected to Neo4j' AS msg")

    print(result.single()["msg"])

driver.close()