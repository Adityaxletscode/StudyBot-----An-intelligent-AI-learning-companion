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

from passlib.context import CryptContext

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
messages_collection = db["messages"]
users_collection = db["users"]

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

# Mount static files
app.mount("/docs", StaticFiles(directory="docs"), name="docs")

@app.get("/")
def get_index():
    return {"status": "online", "message": "Study Bot API is running. If you see this, the backend is working!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

class AuthRequest(BaseModel):
    user_id: str
    password: str

class ChatRequest(BaseModel):
    question: str
    user_id: str
    password: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# -------- AUTH HELPERS --------
def get_user(user_id):
    return users_collection.find_one({"user_id": user_id})

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

@app.post("/auth")
def authenticate(request: AuthRequest):
    user = get_user(request.user_id)
    if not user:
        # Register new user
        users_collection.insert_one({
            "user_id": request.user_id,
            "password": get_password_hash(request.password)
        })
        return {"status": "success", "message": "Account created"}
    
    # Check password
    if not verify_password(request.password, user["password"]):
        return JSONResponse(status_code=401, content={"status": "error", "message": "Invalid password"})
    
    return {"status": "success", "message": "Logged in"}

# -------- PROMPT --------
prompt = ChatPromptTemplate.from_messages([
    ("system",
  "You are a Study bot that answers only study-related questions. "
  "STRICT FORMATTING RULES - DO NOT VIOLATE:\n"
  "1. USE ONLY PLAIN TEXT. NO MARKDOWN SYMBOLS.\n"
  "2. NO HEADERS: Do not use #, ##, or ###.\n"
  "3. NO BOLD/ITALIC: Do not use ** or __ or *.\n"
  "4. NO HORIZONTAL RULES: Do not use --- or ***.\n"
  "5. NO TABLES: Absolutely no pipe (|) or border symbols.\n"
  "6. BULLETS: Use only simple dashes (-) for bullet points.\n"
  "7. Use double line breaks to separate paragraphs.\n"
  "If the user shares personal info like name, remember it and use it naturally."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}")
])

# -------- MODEL --------
llm = ChatGroq(
    api_key=groq_api_key,
    model="llama3-8b-8192"
)

chain = prompt | llm

# -------- HISTORY --------
def get_history(user_id):
    chats = messages_collection.find({"user_id": user_id}).sort("timestamp", 1)
    history = []
    for chat in chats:
        if chat["role"] == "user":
            history.append(HumanMessage(content=chat["message"]))
        elif chat["role"] == "assistant":
            history.append(AIMessage(content=chat["message"]))
    return history

@app.post("/history")
def get_chat_history(request: AuthRequest):
    user = get_user(request.user_id)
    if not user or not verify_password(request.password, user["password"]):
        return JSONResponse(status_code=401, content={"status": "error", "message": "Unauthorized"})

    chats = messages_collection.find({"user_id": request.user_id}).sort("timestamp", 1)
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
    if not groq_api_key or not mongo_uri:
        return JSONResponse(
            status_code=500, 
            content={"response": "ERROR: Backend configuration missing. Please add GROQ_API_KEY and MONGODB_URI to Render environment variables."}
        )
    
    user = get_user(request.user_id)
    if not user or not verify_password(request.password, user["password"]):
        return JSONResponse(status_code=401, content={"response": "Unauthorized: Access denied."})

    try:
        history = get_history(request.user_id)
        response = chain.invoke({
            "history": history,
            "question": request.question
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"response": f"AI Error: {str(e)}"}
        )

    # Save user msg
    messages_collection.insert_one({
        "user_id": request.user_id,
        "role": "user",
        "message": request.question,
        "timestamp": datetime.utcnow()
    })

    # Save assistant msg
    messages_collection.insert_one({
        "user_id": request.user_id,
        "role": "assistant",
        "message": response.content,
        "timestamp": datetime.utcnow()
    })

    return {"response": response.content}
