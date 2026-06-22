from neo4j import GraphDatabase
from employees_dataset import DATASET

driver = GraphDatabase.driver(
    "bolt://127.0.0.1:7687",
    auth=("neo4j", "password")
    )

with driver.session(database="super4j") as session:

        for emp in DATASET["employees"]:

            session.run(
                """
                MERGE (e:Employee {name:$name})

                SET
                    e.mobile = $mobile,
                    e.level = $level,
                    e.performance = $performance,
                    e.rating = $rating
                """,
                name=emp["Emp_Name"],
                mobile=emp["Mobile"],
                level=emp["KPMG_Level"],
                performance=emp["Current_Performance"],
                rating=emp["Q_Rating"]
            )

            session.run(
                """
                MERGE (c:Client {name:$client})

                MERGE (e:Employee {name:$employee})

                MERGE (e)-[:WORKS_FOR]->(c)
                """,
                client=emp["Client_Name"],
                employee=emp["Emp_Name"]
            )

            session.run(
                """
                MERGE (p:Project {name:$project})

                MERGE (e:Employee {name:$employee})

                MERGE (e)-[:WORKS_ON]->(p)
                """,
                project=emp["Project"],
                employee=emp["Emp_Name"]
            )

            for skill in emp["Skills"]:

                session.run(
                    """
                    MERGE (s:Skill {name:$skill})

                    MERGE (e:Employee {name:$employee})

                    MERGE (e)-[:HAS_SKILL]->(s)
                    """,
                    skill=skill,
                    employee=emp["Emp_Name"]
                )

driver.close()

print("Dataset loaded into Neo4j successfully!")