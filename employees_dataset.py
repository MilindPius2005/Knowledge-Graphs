# employees_dataset.py
# Single source of truth for all employee records.
# Imported by:
#   - ontology.py  → used as fallback dataset when Neo4j is unavailable
#   - load_neo4j.py → used to load employees into the Neo4j database

DATASET = {
    "employees": [
        {
            "SL": 1,
            "Emp_Name": "Milind Sharma",
            "Client_Name": "Infosys",
            "Project": "Employee Knowledge Graph",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 5,
            "Mobile": "9876543210",
            "Skills": ["Python", "React", "Docker", "AWS"]
        },
        {
            "SL": 2,
            "Emp_Name": "Rahul Verma",
            "Client_Name": "TCS",
            "Project": "Enterprise API Platform",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543211",
            "Skills": ["Java", "Spring Boot", "SQL", "Docker"]
        },
        {
            "SL": 3,
            "Emp_Name": "Anjali Mehta",
            "Client_Name": "Accenture",
            "Project": "Customer Churn Prediction",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 5,
            "Mobile": "9876543212",
            "Skills": ["Python", "Machine Learning", "SQL", "Power BI"]
        },
        {
            "SL": 4,
            "Emp_Name": "Dilip",
            "Client_Name": "Infosys",
            "Project": "Supply Chain Management",
            "Current_Performance": "Average",
            "KPMG_Level": "Associate",
            "Q_Rating": 3,
            "Mobile": "9876543213",
            "Skills": ["Excel", "Tally", "Power BI"]
        },
        {
            "SL": 5,
            "Emp_Name": "Anand",
            "Client_Name": "Infosys",
            "Project": "Employee Knowledge Graph",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Consultant",
            "Q_Rating": 5,
            "Mobile": "9876543214",
            "Skills": ["React", "Nest.js", "AWS", "Docker"]
        },
        {
            "SL": 6,
            "Emp_Name": "Divya",
            "Client_Name": "Accenture",
            "Project": "Employee Knowledge Graph",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Consultant",
            "Q_Rating": 5,
            "Mobile": "9876543215",
            "Skills": ["React", "Nest.js", "AWS", "Docker"]
        },
        {
            "SL": 7,
            "Emp_Name": "Manish",
            "Client_Name": "TCS",
            "Project": "Employee Knowledge Graph",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Consultant",
            "Q_Rating": 5,
            "Mobile": "9876543216",
            "Skills": ["Node.js", "AWS", "Docker"]
        },
        {
            "SL": 8,
            "Emp_Name": "SSL1",
            "Client_Name": "Infosys",
            "Project": "SSL1 Delivery Pod",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 2,
            "Mobile": "9876543201",
            "Skills": ["Python", "React", "Docker", "AWS"]
        },
        {
            "SL": 9,
            "Emp_Name": "SSL2",
            "Client_Name": "TCS",
            "Project": "SSL2 Delivery Pod",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 3,
            "Mobile": "9876543202",
            "Skills": ["Java", "Spring Boot", "SQL", "Docker"]
        },
        {
            "SL": 10,
            "Emp_Name": "SSL3",
            "Client_Name": "Accenture",
            "Project": "SSL3 Delivery Pod",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543203",
            "Skills": ["Python", "Machine Learning", "SQL", "Power BI"]
        },
        {
            "SL": 11,
            "Emp_Name": "SSL4",
            "Client_Name": "Deloitte",
            "Project": "SSL4 Delivery Pod",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 2,
            "Mobile": "9876543204",
            "Skills": ["Azure", "Kubernetes", "Docker", "Terraform"]
        },
        {
            "SL": 12,
            "Emp_Name": "SSL5",
            "Client_Name": "EY",
            "Project": "SSL5 Delivery Pod",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 3,
            "Mobile": "9876543205",
            "Skills": ["SQL", "Tableau", "Data Analysis", "Power BI"]
        },
        {
            "SL": 13,
            "Emp_Name": "SSL6",
            "Client_Name": "Infosys",
            "Project": "SSL6 Delivery Pod",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543206",
            "Skills": ["Python", "React", "Docker", "AWS"]
        },
        {
            "SL": 14,
            "Emp_Name": "SSL7",
            "Client_Name": "TCS",
            "Project": "SSL7 Delivery Pod",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 2,
            "Mobile": "9876543207",
            "Skills": ["Java", "Spring Boot", "SQL", "Docker"]
        },
        {
            "SL": 15,
            "Emp_Name": "SSL8",
            "Client_Name": "Accenture",
            "Project": "SSL8 Delivery Pod",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 3,
            "Mobile": "9876543208",
            "Skills": ["Python", "Machine Learning", "SQL", "Power BI"]
        },
        {
            "SL": 16,
            "Emp_Name": "SSL9",
            "Client_Name": "Deloitte",
            "Project": "SSL9 Delivery Pod",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543209",
            "Skills": ["Azure", "Kubernetes", "Docker", "Terraform"]
        },
        {
            "SL": 17,
            "Emp_Name": "SSL10",
            "Client_Name": "EY",
            "Project": "SSL10 Delivery Pod",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 2,
            "Mobile": "9876543210",
            "Skills": ["SQL", "Tableau", "Data Analysis", "Power BI"]
        },
        {
            "SL": 18,
            "Emp_Name": "SSL11",
            "Client_Name": "Infosys",
            "Project": "SSL11 Delivery Pod",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 3,
            "Mobile": "9876543211",
            "Skills": ["Python", "React", "Docker", "AWS"]
        },
        {
            "SL": 19,
            "Emp_Name": "SSL12",
            "Client_Name": "TCS",
            "Project": "SSL12 Delivery Pod",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543212",
            "Skills": ["Java", "Spring Boot", "SQL", "Docker"]
        },
        {
            "SL": 20,
            "Emp_Name": "SSL13",
            "Client_Name": "Accenture",
            "Project": "SSL13 Delivery Pod",
            "Current_Performance": "Meets Expectations",
            "KPMG_Level": "Associate",
            "Q_Rating": 2,
            "Mobile": "9876543213",
            "Skills": ["Python", "Machine Learning", "SQL", "Power BI"]
        },
        {
            "SL": 21,
            "Emp_Name": "SSL14",
            "Client_Name": "Deloitte",
            "Project": "SSL14 Delivery Pod",
            "Current_Performance": "Exceeds Expectations",
            "KPMG_Level": "Consultant",
            "Q_Rating": 3,
            "Mobile": "9876543214",
            "Skills": ["Azure", "Kubernetes", "Docker", "Terraform"]
        },
        {
            "SL": 22,
            "Emp_Name": "SSL15",
            "Client_Name": "EY",
            "Project": "SSL15 Delivery Pod",
            "Current_Performance": "Outstanding",
            "KPMG_Level": "Senior Consultant",
            "Q_Rating": 4,
            "Mobile": "9876543215",
            "Skills": ["SQL", "Tableau", "Data Analysis", "Power BI"]
        },
    ]
}
