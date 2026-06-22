from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")

db = client["knowledge_graph"]

users = db["users"]

users.insert_one({
    "username": "Milind",
    "email": "milind@gmail.com"
})
print("Inserted")
