@echo off
echo Starting AI-Powered Smart Agriculture Backend...
cd /d "%~dp0backend"
set TF_ENABLE_ONEDNN_OPTS=0
python main.py
