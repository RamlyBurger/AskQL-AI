# AskQL - AI-Powered Query System

A full-stack chatbot application with Google Gemini AI integration, featuring a modern ChatGPT-like interface.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.8+** and pip
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### One-Command Setup

**Windows:**

```bash
# Just run this - it will automatically detect if setup is needed
.\start.bat
```

The script will:

- Detect if this is your first time running it
- Offer to run setup automatically
- Install all dependencies
- Start both servers

**macOS/Linux:**

```bash
chmod +x start.sh
./start.sh
```

This will start both the backend and frontend servers automatically.

### Manual Setup

#### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Create .env file
copy env.example .env  # Windows
cp env.example .env  # macOS/Linux

# Edit .env and add your Gemini API key
# Then start the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd askql-app
npm install
npm run dev
```

## 📍 Access Points

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Login Page:** http://localhost:3000/login
- **Signup Page:** http://localhost:3000/signup

## ✨ Features

### Frontend

- ✅ ChatGPT-style interface
- ✅ Collapsible sidebar with chat history
- ✅ Real-time chat with Gemini AI
- ✅ Ask/Agent mode toggle
- ✅ User authentication (login/signup)
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Message history persistence

### Backend

- ✅ FastAPI REST API
- ✅ Google Gemini AI integration
- ✅ JWT authentication
- ✅ SQLite database
- ✅ Password hashing with bcrypt
- ✅ Conversation management
- ✅ User management
- ✅ Auto-generated API docs

## 🔐 Authentication

### Register

1. Go to http://localhost:3000/signup
2. Enter your email, name, and password
3. Automatically logged in after registration

### Login

1. Go to http://localhost:3000/login
2. Enter your credentials
3. JWT token stored in localStorage

## 📚 API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Chat

- `POST /api/ask` - Send query to Gemini AI
- `GET /api/conversations` - List conversations
- `GET /api/conversations/{id}` - Get conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `GET /api/conversations/{id}/messages` - Get messages

## 🎯 Usage

1. **Start the application** using `start.bat` or `start.sh`
2. **Register an account** at http://localhost:3000/signup
3. **Start chatting** with the AI assistant
4. **Switch modes** between Ask and Agent
5. **View chat history** in the sidebar
6. **Create new chats** or continue existing ones

## 🐛 Troubleshooting

### Backend Issues

- **Gemini API Error:** Check your API key in `.env`
- **Module Not Found:** Run `pip install -r requirements.txt`
- **Port Already in Use:** Change port in startup script

### Frontend Issues

- **Failed to Fetch:** Ensure backend is running on port 8000
- **Components Not Found:** Run `npm install`
- **PowerShell Error:** Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

## 📝 Development

### Backend Development

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd askql-app
npm run dev
```

### Database Reset

Delete `backend/askql.db` and restart the backend server.

## 🤝 Contributing

This is a demo project. Feel free to fork and customize!

## 📄 License

MIT

## 🔗 Links

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Google Gemini API](https://ai.google.dev/)
