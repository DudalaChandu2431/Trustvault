# TrustVault Vercel Deployment Guide

## Overview
This guide covers deploying TrustVault to Vercel with production-ready configuration.

## Prerequisites
- Vercel account
- GitHub repository connected to Vercel
- PostgreSQL database (Vercel Postgres or external)

## Environment Variables
Set these in the Vercel Dashboard > Project Settings > Environment Variables:

```
TRUSTVAULT_SECRET_KEY=your-secret-key-generate-with-openssl
TRUSTVAULT_DEBUG=false
TRUSTVAULT_ALLOWED_HOSTS=your-app.vercel.app
DATABASE_URL=postgres://username:password@host:port/database
```

## Deployment Steps

### 1. Push to GitHub
Ensure all files are committed:
```bash
cd /sessions/zen-charming-ramanujan/mnt/outputs
git add -A
git commit -m "Production-ready TrustVault deployment"
git push origin main
```

### 2. Vercel Dashboard Configuration
1. Create new project on Vercel
2. Import GitHub repository
3. Go to Settings > Environment Variables
4. Add the variables listed above
5. Save

### 3. Automatic Deployment
Vercel will automatically:
1. Install dependencies from requirements.txt
2. Run collectstatic
3. Start gunicorn with the app

## Production Checklist
- [ ] TRUSTVAULT_SECRET_KEY set to strong random value
- [ ] TRUSTVAULT_DEBUG=false
- [ ] TRUSTVAULT_ALLOWED_HOSTS set to Vercel domain
- [ ] DATABASE_URL points to PostgreSQL
- [ ] Static files collected (collectstatic runs automatically)
- [ ] Media files configured (S3 or external storage)
- [ ] CORS settings updated for production
- [ ] Admin user credentials in README

## PostgreSQL Setup

### Option A: Vercel Postgres (Recommended)
1. In Vercel Dashboard, click "Add Postgres"
2. Select plan (Hobby is free)
3. Vercel will provide DATABASE_URL automatically
4. No manual configuration needed

### Option B: External PostgreSQL (Supabase, Neon, etc.)
1. Create database account
2. Get connection string: `postgres://user:password@host:port/db`
3. Set DATABASE_URL environment variable
4. Ensure SSL is enabled if required

## Static Files on Vercel
- WhiteNoise handles static files automatically
- `collectstatic` runs during build
- Files stored in `.vercel/output/static/`
- No need for external S3 bucket for basic deployment

## Media Files
For document uploads, configure one of:
1. **Vercel Blob**: `pip install vercel-blob`, use in views
2. **External S3**: Configure boto3 with settings.MEDIA_ROOT
3. **Local + migration**: Accept that media won't persist across deploys (use for testing)

## Security Checklist
- [ ] SECRET_KEY is strong and random
- [ ] DEBUG is False
- [ ] ALLOWED_HOSTS is configured
- [ ] CORS_ALLOWED_ORIGINS is set for production
- [ ] HTTPS is enforced (Vercel provides free SSL)
- [ ] CSRF trusted origins configured if needed

## Rollback
Vercel automatically keeps previous deployments. To rollback:
1. Go to Deployments tab
2. Click "Rollback" on previous deployment

## Troubleshooting
Common issues:
1. **Site shows blank white screen**: Check logs in Vercel Dashboard > Functions
2. **Database connection failed**: Verify DATABASE_URL format
3. **Static files 404**: Ensure collectstatic ran (check build logs)
4. **Import errors**: Verify requirements.txt has all dependencies

## Sample .env File (local development)
```
TRUSTVAULT_SECRET_KEY=dev-secret-key-do-not-use-in-production
TRUSTVAULT_DEBUG=True
TRUSTVAULT_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

## Running Locally After Deployment
```bash
# Migrate database
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static
python manage.py collectstatic

# Run development server
python manage.py runserver
```
