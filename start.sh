#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to show main menu
show_menu() {
    clear
    echo "========================================"
    echo "AskQL Application Launcher"
    echo "========================================"
    echo ""
    
    # Check setup status
    echo "Checking setup status..."
    
    if [ -d "backend/venv" ]; then
        echo -e "${GREEN}- Backend virtual environment: OK${NC}"
        BACKEND_EXISTS=1
    else
        echo -e "${RED}- Backend virtual environment: NOT FOUND${NC}"
        BACKEND_EXISTS=0
    fi
    
    if [ -d "askql-app/node_modules" ]; then
        echo -e "${GREEN}- Frontend dependencies: OK${NC}"
        FRONTEND_EXISTS=1
    else
        echo -e "${RED}- Frontend dependencies: NOT FOUND${NC}"
        FRONTEND_EXISTS=0
    fi
    
    if [ -f "backend/.env" ]; then
        echo -e "${GREEN}- Backend .env file: OK${NC}"
        BACKEND_ENV_EXISTS=1
    else
        echo -e "${RED}- Backend .env file: NOT FOUND${NC}"
        BACKEND_ENV_EXISTS=0
    fi
    
    if [ -f "askql-app/.env" ]; then
        echo -e "${GREEN}- Frontend .env file: OK${NC}"
        FRONTEND_ENV_EXISTS=1
    else
        echo -e "${YELLOW}- Frontend .env file: NOT FOUND${NC}"
        FRONTEND_ENV_EXISTS=0
    fi
    
    echo ""
    echo "========================================"
    echo ""
    echo "[1] Run both frontend and backend"
    echo "[2] Run backend only"
    echo "[3] Run frontend only"
    echo "[4] Reinstall backend"
    echo "[5] Reinstall frontend"
    echo "[6] Reinstall .env file"
    echo "[7] Reinstall everything"
    echo "[8] Check setup status again"
    echo "[9] Exit"
    echo ""
    read -p "Enter your choice (1-9): " choice
    
    case $choice in
        1) run_application ;;
        2) run_backend_only ;;
        3) run_frontend_only ;;
        4) reinstall_backend ;;
        5) reinstall_frontend ;;
        6) reinstall_env ;;
        7) reinstall_all ;;
        8) show_menu ;;
        9) exit_script ;;
        *) echo "Invalid choice"; sleep 2; show_menu ;;
    esac
}

# Function to setup .env files
setup_env_files() {
    echo "========================================"
    echo "AskQL - Setup Environment Files"
    echo "========================================"
    echo ""
    echo "Script directory: $SCRIPT_DIR"
    echo ""
    
    # Backend .env
    echo "[1/2] Setting up Backend .env file..."
    if [ -f "$SCRIPT_DIR/backend/.env" ]; then
        echo "      Removing old backend/.env..."
        rm "$SCRIPT_DIR/backend/.env"
    fi
    
    if [ -f "$SCRIPT_DIR/backend/.env.example" ]; then
        cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
        if [ $? -eq 0 ]; then
            echo -e "      ${GREEN}SUCCESS: backend/.env created!${NC}"
        else
            echo -e "      ${RED}ERROR: Failed to copy backend/.env.example${NC}"
        fi
    else
        echo -e "      ${RED}ERROR: backend/.env.example not found!${NC}"
    fi
    echo ""
    
    # Frontend .env
    echo "[2/2] Setting up Frontend .env file..."
    if [ -f "$SCRIPT_DIR/askql-app/.env" ]; then
        echo "      Removing old askql-app/.env..."
        rm "$SCRIPT_DIR/askql-app/.env"
    fi
    
    if [ -f "$SCRIPT_DIR/askql-app/.env.example" ]; then
        cp "$SCRIPT_DIR/askql-app/.env.example" "$SCRIPT_DIR/askql-app/.env"
        if [ $? -eq 0 ]; then
            echo -e "      ${GREEN}SUCCESS: askql-app/.env created!${NC}"
        else
            echo -e "      ${RED}ERROR: Failed to copy askql-app/.env.example${NC}"
        fi
    else
        echo -e "      ${YELLOW}WARNING: askql-app/.env.example not found, skipping...${NC}"
    fi
    echo ""
    
    echo "========================================"
    echo "Setup Complete!"
    echo "========================================"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Edit backend/.env and add your Gemini API key!${NC}"
    echo ""
}

# Function to reinstall .env files
reinstall_env() {
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR' && $(declare -f setup_env_files); setup_env_files; read -p 'Press Enter to close...'"
    elif command_exists xterm; then
        xterm -hold -e "cd '$SCRIPT_DIR' && bash -c '$(declare -f setup_env_files); setup_env_files; read -p \"Press Enter to close...\"'" &
    else
        setup_env_files
        read -p "Press Enter to continue..."
    fi
    show_menu
}

# Function to reinstall backend
reinstall_backend() {
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "
            cd '$SCRIPT_DIR'
            echo '========================================'
            echo 'Reinstalling Backend'
            echo '========================================'
            echo ''
            echo '[Backend] Checking Python installation...'
            python3 --version
            echo ''
            if [ -d backend/venv ]; then
                echo '[Backend] Removing old virtual environment...'
                rm -rf backend/venv
                echo '[Backend] Old venv removed.'
            fi
            echo '[Backend] Creating Python virtual environment...'
            cd backend
            python3 -m venv venv
            echo '[Backend] Installing Python dependencies...'
            source venv/bin/activate
            pip install -r requirements.txt
            cd ..
            echo ''
            echo '========================================'
            echo 'Backend reinstalled successfully!'
            echo '========================================'
            echo ''
            read -p 'Press Enter to close...'
        "
    else
        echo "========================================"
        echo "Reinstalling Backend"
        echo "========================================"
        echo ""
        echo "[Backend] Checking Python installation..."
        python3 --version
        echo ""
        if [ -d backend/venv ]; then
            echo "[Backend] Removing old virtual environment..."
            rm -rf backend/venv
            echo "[Backend] Old venv removed."
        fi
        echo "[Backend] Creating Python virtual environment..."
        cd backend
        python3 -m venv venv
        echo "[Backend] Installing Python dependencies..."
        source venv/bin/activate
        pip install -r requirements.txt
        cd ..
        echo ""
        echo "========================================"
        echo "Backend reinstalled successfully!"
        echo "========================================"
        echo ""
        read -p "Press Enter to continue..."
    fi
    show_menu
}

# Function to reinstall frontend
reinstall_frontend() {
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "
            cd '$SCRIPT_DIR'
            echo '========================================'
            echo 'Reinstalling Frontend'
            echo '========================================'
            echo ''
            echo '[Frontend] Checking Node.js installation...'
            node --version
            echo ''
            if [ -d askql-app/node_modules ]; then
                echo '[Frontend] Removing old node_modules...'
                rm -rf askql-app/node_modules
                echo '[Frontend] Old node_modules removed.'
            fi
            echo '[Frontend] Installing Node.js dependencies...'
            cd askql-app
            npm install
            cd ..
            echo ''
            echo '========================================'
            echo 'Frontend reinstalled successfully!'
            echo '========================================'
            echo ''
            read -p 'Press Enter to close...'
        "
    else
        echo "========================================"
        echo "Reinstalling Frontend"
        echo "========================================"
        echo ""
        echo "[Frontend] Checking Node.js installation..."
        node --version
        echo ""
        if [ -d askql-app/node_modules ]; then
            echo "[Frontend] Removing old node_modules..."
            rm -rf askql-app/node_modules
            echo "[Frontend] Old node_modules removed."
        fi
        echo "[Frontend] Installing Node.js dependencies..."
        cd askql-app
        npm install
        cd ..
        echo ""
        echo "========================================"
        echo "Frontend reinstalled successfully!"
        echo "========================================"
        echo ""
        read -p "Press Enter to continue..."
    fi
    show_menu
}

# Function to reinstall everything
reinstall_all() {
    echo "Reinstalling everything..."
    echo "Opening separate terminals for backend, frontend, and .env setup..."
    
    # Backend
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "
            cd '$SCRIPT_DIR'
            echo '========================================'
            echo 'Reinstalling Backend'
            echo '========================================'
            echo ''
            echo '[Backend] Checking Python installation...'
            python3 --version
            echo ''
            if [ -d backend/venv ]; then
                echo '[Backend] Removing old virtual environment...'
                rm -rf backend/venv
                echo '[Backend] Old venv removed.'
            fi
            echo '[Backend] Creating Python virtual environment...'
            cd backend
            python3 -m venv venv
            echo '[Backend] Installing Python dependencies...'
            source venv/bin/activate
            pip install -r requirements.txt
            cd ..
            echo ''
            echo '========================================'
            echo 'Backend reinstalled successfully!'
            echo '========================================'
            echo ''
            read -p 'Press Enter to close...'
        " &
    fi
    
    # Frontend
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "
            cd '$SCRIPT_DIR'
            echo '========================================'
            echo 'Reinstalling Frontend'
            echo '========================================'
            echo ''
            echo '[Frontend] Checking Node.js installation...'
            node --version
            echo ''
            if [ -d askql-app/node_modules ]; then
                echo '[Frontend] Removing old node_modules...'
                rm -rf askql-app/node_modules
                echo '[Frontend] Old node_modules removed.'
            fi
            echo '[Frontend] Installing Node.js dependencies...'
            cd askql-app
            npm install
            cd ..
            echo ''
            echo '========================================'
            echo 'Frontend reinstalled successfully!'
            echo '========================================'
            echo ''
            read -p 'Press Enter to close...'
        " &
    fi
    
    # .env files
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR' && $(declare -f setup_env_files); setup_env_files; read -p 'Press Enter to close...'" &
    fi
    
    show_menu
}

# Function to run backend only
run_backend_only() {
    # Check if backend is set up
    if [ ! -d "backend/venv" ]; then
        clear
        echo "========================================"
        echo "Backend not set up. Installing..."
        echo "========================================"
        echo ""
        reinstall_backend
        return
    fi
    
    # Check if .env exists
    if [ ! -f "backend/.env" ]; then
        clear
        echo "========================================"
        echo "Backend .env file not found. Creating..."
        echo "========================================"
        echo ""
        setup_env_files
        echo ""
        echo -e "${YELLOW}IMPORTANT: Edit backend/.env and add your Gemini API key before starting!${NC}"
        echo ""
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Start backend
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR/backend' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; exec bash"
    elif command_exists xterm; then
        xterm -hold -e "cd '$SCRIPT_DIR/backend' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" &
    else
        cd backend
        source venv/bin/activate
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    fi
    
    show_menu
}

# Function to run frontend only
run_frontend_only() {
    # Check if frontend is set up
    if [ ! -d "askql-app/node_modules" ]; then
        clear
        echo "========================================"
        echo "Frontend not set up. Installing..."
        echo "========================================"
        echo ""
        reinstall_frontend
        return
    fi
    
    # Start frontend
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR/askql-app' && npm run dev; exec bash"
    elif command_exists xterm; then
        xterm -hold -e "cd '$SCRIPT_DIR/askql-app' && npm run dev" &
    else
        cd askql-app
        npm run dev
    fi
    
    show_menu
}

# Function to run both servers
run_application() {
    # Check if backend is set up
    if [ ! -d "backend/venv" ]; then
        clear
        echo "========================================"
        echo "Backend not set up. Installing..."
        echo "========================================"
        echo ""
        reinstall_backend
        return
    fi
    
    # Check if frontend is set up
    if [ ! -d "askql-app/node_modules" ]; then
        clear
        echo "========================================"
        echo "Frontend not set up. Installing..."
        echo "========================================"
        echo ""
        reinstall_frontend
        return
    fi
    
    # Check if .env exists
    if [ ! -f "backend/.env" ]; then
        clear
        echo "========================================"
        echo "Backend .env file not found. Creating..."
        echo "========================================"
        echo ""
        setup_env_files
        echo ""
        echo -e "${YELLOW}IMPORTANT: Edit backend/.env and add your Gemini API key before starting!${NC}"
        echo ""
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Start both servers
    if command_exists gnome-terminal; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR/backend' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; exec bash" &
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR/askql-app' && npm run dev; exec bash" &
    elif command_exists xterm; then
        xterm -hold -e "cd '$SCRIPT_DIR/backend' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" &
        xterm -hold -e "cd '$SCRIPT_DIR/askql-app' && npm run dev" &
    else
        echo "Starting backend in background..."
        cd backend
        source venv/bin/activate
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
        BACKEND_PID=$!
        cd ..
        
        echo "Starting frontend..."
        cd askql-app
        npm run dev
        
        # Kill backend when frontend stops
        kill $BACKEND_PID 2>/dev/null
    fi
    
    show_menu
}

# Function to exit
exit_script() {
    clear
    echo ""
    echo "Thank you for using AskQL!"
    echo ""
    sleep 2
    exit 0
}

# Check prerequisites
check_prerequisites() {
    if ! command_exists python3; then
        echo -e "${RED}ERROR: Python 3 is not installed or not in PATH${NC}"
        echo "Please install Python 3.8+ from https://www.python.org/"
        exit 1
    fi
    
    if ! command_exists node; then
        echo -e "${RED}ERROR: Node.js is not installed or not in PATH${NC}"
        echo "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
}

# Main execution
check_prerequisites
show_menu
