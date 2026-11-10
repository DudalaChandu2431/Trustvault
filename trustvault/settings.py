"""
Django settings for trustvault project - Security Enhanced

Production-ready configuration with focus on verified security features.
"""

from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('TRUSTVAULT_SECRET_KEY', 'django-insecure-dev-key-do-not-use')

# DEBUG - only True when explicitly enabled
DEBUG = os.environ.get('TRUSTVAULT_DEBUG', 'False') == 'True'

# Allowed hosts
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('TRUSTVAULT_ALLOWED_HOSTS', '*').split(',') if h.strip()]
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['*']

# Database configuration
if 'DATABASE_URL' in os.environ and not DEBUG:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.config(conn_max_age=600, ssl_require=True)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Allauth for social authentication
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'documents',  # TrustVault document management app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Allauth middleware
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'trustvault.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'trustvault.wsgi.application'

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Password validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'trustvault.validators.StrongPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Authentication Configuration ---

LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'document_list'
LOGOUT_REDIRECT_URL = 'document_list'

# Allauth configuration
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = 'optional'
# ACCOUNT_AUTHENTICATION_METHOD is deprecated in newer allauth versions
# Use ACCOUNT_LOGIN_METHODS or ACCOUNT_SIGNUP_FIELDS instead

# Social account signup fields
ACCOUNT_SIGNUP_FIELDS = [
    'email*',
    'username*',
    'password1*',
    'password2*',
]

# Google OAuth2 configuration
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': 'YOUR_GOOGLE_CLIENT_ID',
            'secret': 'YOUR_GOOGLE_CLIENT_SECRET',
            'key': '',
            'hosted_domain': ''
        }
    },
    'twitter': {
        'APP': {
            'client_id': 'YOUR_TWITTER_CONSUMER_KEY',
            'secret': 'YOUR_TWITTER_CONSUMER_SECRET',
            'key': '',
            'screen_name': ''
        }
    }
}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True  # Use HTTPS only (set via env when prod)
SESSION_COOKIE_SAMESITE = 'Strict'
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# --- CSRF Security ---

CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True  # Use HTTPS only (set via env when prod)
CSRF_COOKIE_SAMESITE = 'Strict'

# --- Security Configuration ---

# Rate limiting settings (simple in-memory, no Redis required)
RATELIMIT_ENABLE = True
RATELIMIT_ATTEMPT_LIMIT = 5
RATELIMIT_ATTEMPT_TIMEOUT = 300  # 5 minutes

# View-level decorators will be used instead of middleware
# - Use @ratelimit decorator on sensitive views/API endpoints
# - Pattern: @ratelimit(key='user', rate='5/300') for per-user limiting

# --- Session Security ---

# Already configured above

# --- CSRF Security ---

# Already configured above

# --- MFA Configuration (placeholder for future) ---

TOTP_ISSUER_NAME = 'TrustVault'
TOTP_DIGITS = 6
TOTP_PERIOD = 30

# --- Security Headers ---

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# --- HTTPS / HSTS ---

# SECURE_HSTS_SECONDS = 31536000  # Uncomment when behind HTTPS proxy
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# SECURE_HSTS_PRELOAD = True

# --- File Security Configuration ---

TRUSTVAULT_ALLOWED_FILE_TYPES = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'zip']
TRUSTVAULT_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB