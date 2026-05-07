#!/usr/bin/env pwsh

# ═══════════════════════════════════════════════════════════════════════
# 🚀 SCRIPT DE INICIALIZACIÓN - BOT DE SOLICITUDES DE CRÉDITO
# ═══════════════════════════════════════════════════════════════════════

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   BOT DE SOLICITUDES DE CRÉDITO - INICIALIZACIÓN          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Paso 1: Verificar Node.js
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "   ✅ Node.js: $nodeVersion`n"

# Paso 2: Instalar dependencias
Write-Host "2️⃣  Instalando dependencias npm..." -ForegroundColor Yellow
npm install
Write-Host "   ✅ Dependencias instaladas`n"

# Paso 3: Verificar credenciales
Write-Host "3️⃣  Verificando credenciales.json..." -ForegroundColor Yellow
if (Test-Path "./credenciales.json") {
    Write-Host "   ✅ credenciales.json encontrado`n"
} else {
    Write-Host "   ❌ FALTA: credenciales.json" -ForegroundColor Red
    Write-Host "      Pasos para obtenerlo:"
    Write-Host "      1. Ve a: https://console.cloud.google.com"
    Write-Host "      2. Crea proyecto nuevo"
    Write-Host "      3. Habilita Gmail API"
    Write-Host "      4. Crea credenciales 'Desktop App'"
    Write-Host "      5. Descarga como JSON y renombra a credenciales.json`n"
}

# Paso 4: Verificar GEMINI_API_KEY
Write-Host "4️⃣  Verificando GEMINI_API_KEY..." -ForegroundColor Yellow
$geminiKey = $env:GEMINI_API_KEY
if ($geminiKey) {
    Write-Host "   ✅ GEMINI_API_KEY configurada`n"
} else {
    Write-Host "   ❌ FALTA: GEMINI_API_KEY" -ForegroundColor Red
    Write-Host "      Establece: `$env:GEMINI_API_KEY='tu-clave'`n"
}

# Paso 5: Ejecutar diagnóstico
Write-Host "5️⃣  Ejecutando diagnóstico..." -ForegroundColor Yellow
Write-Host ""
npx ts-node src/diagnose.ts
