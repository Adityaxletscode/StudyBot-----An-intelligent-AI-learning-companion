import os
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# -------- LOAD ENV --------
load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
mongo_uri = os.getenv("MONGODB_URI")

# -------- MONGODB --------
client = MongoClient(
    mongo_uri,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000
)
db = client["ChatBotDB"]
collection = db["users"]

app = FastAPI()

# Mount static files
app.mount("/docs", StaticFiles(directory="docs"), name="docs")

@app.get("/")
def get_index():
    return FileResponse("docs/index.html")

class ChatRequest(BaseModel):
    question: str
    user_id: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# -------- PROMPT --------
prompt = ChatPromptTemplate.from_messages([
    ("system",
 "You are a Study bot,that can answer only study-related questions. "
 "If the user shares personal info like name, remember it and use it naturally."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}")
])

# -------- MODEL --------
llm = ChatGroq(
    api_key=groq_api_key,
    model="openai/gpt-oss-20b"
)

chain = prompt | llm

# -------- HISTORY --------
def get_history(user_id):
    chats = collection.find({"user_id": user_id}).sort("timestamp", 1)
    history = []
    for chat in chats:
        if chat["role"] == "user":
            history.append(HumanMessage(content=chat["message"]))
        elif chat["role"] == "assistant":
            history.append(AIMessage(content=chat["message"]))
    return history

@app.get("/history/{user_id}")
def get_chat_history(user_id: str):
    chats = collection.find({"user_id": user_id}).sort("timestamp", 1)
    history = []
    for chat in chats:
        history.append({
            "role": chat["role"],
            "message": chat["message"],
            "timestamp": chat["timestamp"].isoformat() if "timestamp" in chat else None
        })
    return JSONResponse(content=history)

# -------- ROUTES --------
@app.post("/chat")
def chat(request: ChatRequest):
    history = get_history(request.user_id)

    response = chain.invoke({
        "history": history,
        "question": request.question
    })

    # Save user msg
    collection.insert_one({
        "user_id": request.user_id,
        "role": "user",
        "message": request.question,
        "timestamp": datetime.utcnow()
    })

    # Save assistant msg
    collection.insert_one({
        "user_id": request.user_id,
        "role": "assistant",
        "message": response.content,
        "timestamp": datetime.utcnow()
    })

    return {"response": response.content}
