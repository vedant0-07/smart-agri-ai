#!/bin/bash
# ============================================================
# Smart Agriculture AI — AWS EC2 Ubuntu 22.04 Setup Script
# Run this ONCE on a fresh EC2 t2.micro instance
# Usage: bash aws_setup.sh
# ============================================================

set -e
echo "========================================"
echo "  Smart Agri AI — AWS EC2 Setup"
echo "========================================"

# ── 1. System update ─────────────────────────────────────────
echo "[1/8] Updating system..."
sudo apt-get update -qq
sudo apt-get install -y python3 python3-pip python3-venv nginx git curl

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 2. Clone repo ─────────────────────────────────────────────
echo "[2/8] Cloning repository..."
cd /home/ubuntu
if [ -d "smart-agri-ai" ]; then
    cd smart-agri-ai && git pull
else
    git clone https://github.com/vedant0-07/smart-agri-ai.git
    cd smart-agri-ai
fi

# ── 3. Backend setup ──────────────────────────────────────────
echo "[3/8] Setting up Python backend..."
cd /home/ubuntu/smart-agri-ai/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Create required directories
mkdir -p models uploads reports

# ── 4. Environment file ───────────────────────────────────────
echo "[4/8] Creating .env file..."
cat > /home/ubuntu/smart-agri-ai/backend/.env << 'EOF'
HOST=0.0.0.0
PORT=8000
DEBUG=false
TF_ENABLE_ONEDNN_OPTS=0
CORS_ORIGINS=*
EOF

# ── 5. Build frontend ─────────────────────────────────────────
echo "[5/8] Building React frontend..."
cd /home/ubuntu/smart-agri-ai/frontend
npm install --silent
npm run build

echo "  Frontend built → ../frontend/dist"

# ── 6. Systemd service ────────────────────────────────────────
echo "[6/8] Creating systemd service..."
sudo tee /etc/systemd/system/smart-agri.service > /dev/null << 'EOF'
[Unit]
Description=Smart Agriculture AI FastAPI Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/smart-agri-ai/backend
Environment="TF_ENABLE_ONEDNN_OPTS=0"
ExecStart=/home/ubuntu/smart-agri-ai/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable smart-agri
sudo systemctl restart smart-agri

echo "  Backend service started"

# ── 7. Nginx setup ────────────────────────────────────────────
echo "[7/8] Configuring nginx..."
sudo tee /etc/nginx/sites-available/smart-agri > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    # API → FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        if ($request_method = OPTIONS) { return 204; }
    }

    # PDF reports
    location /reports/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    # Serve React frontend from /frontend/dist (for direct access)
    location / {
        root /home/ubuntu/smart-agri-ai/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/smart-agri /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo "  Nginx configured"

# ── 8. Status check ───────────────────────────────────────────
echo "[8/8] Checking status..."
sleep 3
sudo systemctl status smart-agri --no-pager -l | tail -5
echo ""

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")

echo "========================================"
echo "  DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "  API URL:       http://$PUBLIC_IP"
echo "  Dashboard:     http://$PUBLIC_IP"
echo "  Pest Detection: http://$PUBLIC_IP/pest"
echo "  API Docs:      http://$PUBLIC_IP/api/docs"
echo ""
echo "  For Vercel env variable:"
echo "  VITE_API_URL = http://$PUBLIC_IP"
echo "========================================"
