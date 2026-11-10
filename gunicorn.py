"""gunicorn configuration for TrustVault"""
import os
from pathlib import Path

# Bind to 0.0.0.0:8000 for Vercel
bind = "0.0.0.0:8000"
workers = os.environ.get('GUNICORN_WORKERS', '4')
worker_class = 'gthread'
threads = int(os.environ.get('GUNICORN_THREADS', '2'))

# Logging
loglevel = os.environ.get('LOG_LEVEL', 'info')
accesslog = '-'
errorlog = '-'

# PID file
pidfile = '/tmp/gunicorn.pid'

# Timeout
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '120'))

# Working directory
chdir = '/sessions/zen-charming-ramanujan/mnt/outputs'
