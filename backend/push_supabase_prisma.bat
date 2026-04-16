@echo off
setlocal

echo [1/2] Prisma db push vers Supabase...
python -m prisma db push --schema prisma\schema.prisma
if %errorlevel% neq 0 (
  echo Echec prisma db push
  exit /b %errorlevel%
)

echo [2/2] Generation du client Prisma Python...
python -m prisma generate --schema prisma\schema.prisma
if %errorlevel% neq 0 (
  echo Echec prisma generate
  exit /b %errorlevel%
)

echo Prisma/Supabase pret.
exit /b 0
