#!/bin/bash

# Automated Supabase Setup Script
# Detects configuration and provides appropriate next steps

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Design Systems MCP - Supabase Setup Check        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Supabase CLI
echo -e "${BLUE}🔍 Checking Supabase CLI...${NC}"
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
    SUPABASE_VERSION=$(supabase --version)
    echo "   Version: $SUPABASE_VERSION"
else
    echo -e "${YELLOW}⚠️  Supabase CLI not found${NC}"
    echo "   Install: brew install supabase/tap/supabase"
    echo ""
fi

# Check Docker
echo ""
echo -e "${BLUE}🔍 Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo -e "${GREEN}✅ Docker installed and running${NC}"
        DOCKER_VERSION=$(docker --version)
        echo "   $DOCKER_VERSION"
    else
        echo -e "${YELLOW}⚠️  Docker installed but not running${NC}"
        echo "   Start Docker Desktop to use local Supabase"
    fi
else
    echo -e "${YELLOW}⚠️  Docker not installed${NC}"
    echo "   Install: https://www.docker.com/products/docker-desktop/"
fi

# Check .env file
echo ""
echo -e "${BLUE}🔍 Checking .env configuration...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"

    if grep -q "SUPABASE_URL" .env; then
        echo -e "${GREEN}✅ SUPABASE_URL configured${NC}"
        HAS_URL=true
    else
        echo -e "${YELLOW}⚠️  SUPABASE_URL not found${NC}"
        HAS_URL=false
    fi

    if grep -q "SUPABASE_SERVICE_KEY" .env; then
        echo -e "${GREEN}✅ SUPABASE_SERVICE_KEY configured${NC}"
        HAS_SERVICE=true
    elif grep -q "SUPABASE_ANON_KEY" .env; then
        echo -e "${YELLOW}⚠️  Only SUPABASE_ANON_KEY found${NC}"
        echo "   Recommend adding SUPABASE_SERVICE_KEY for ingestion"
        HAS_SERVICE=false
    else
        echo -e "${YELLOW}⚠️  No Supabase keys configured${NC}"
        HAS_SERVICE=false
    fi

    if grep -q "OPENAI_API_KEY" .env; then
        echo -e "${GREEN}✅ OPENAI_API_KEY configured${NC}"
        HAS_OPENAI=true
    else
        echo -e "${YELLOW}⚠️  OPENAI_API_KEY not found${NC}"
        HAS_OPENAI=false
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    HAS_URL=false
    HAS_SERVICE=false
    HAS_OPENAI=false
fi

# Check Supabase project
echo ""
echo -e "${BLUE}🔍 Checking Supabase project...${NC}"
if [ -d "supabase" ]; then
    echo -e "${GREEN}✅ Supabase project initialized${NC}"
    HAS_PROJECT=true
else
    echo -e "${YELLOW}⚠️  No local Supabase project${NC}"
    HAS_PROJECT=false
fi

# Provide recommendations
echo ""
echo "═════════════════════════════════════════════════════════"
echo -e "${BLUE}📋 Setup Status Summary${NC}"
echo "═════════════════════════════════════════════════════════"

if [ "$HAS_URL" = true ] && [ "$HAS_SERVICE" = true ] && [ "$HAS_OPENAI" = true ]; then
    echo -e "${GREEN}✅ All credentials configured!${NC}"
    echo ""
    echo -e "${BLUE}🚀 Next Steps:${NC}"
    echo "   1. Install database schema:"
    echo "      - Go to: https://app.supabase.com/project/_/sql/new"
    echo "      - Paste contents of: database/schema.sql"
    echo "      - Click 'Run'"
    echo ""
    echo "   2. Validate setup:"
    echo "      npm run validate:ingestion"
    echo ""
    echo "   3. Start ingesting content:"
    echo "      npm run ingest:vectors"
else
    echo -e "${YELLOW}⚠️  Setup incomplete${NC}"
    echo ""
    echo -e "${BLUE}🔧 Configuration Options:${NC}"
    echo ""

    if [ "$HAS_PROJECT" = false ]; then
        echo -e "${BLUE}Option 1: Local Development Setup${NC}"
        echo "   Requirements: Docker + Supabase CLI"
        echo "   Commands:"
        echo "      supabase init"
        echo "      supabase start"
        echo "      # Credentials will be automatically added to .env"
        echo ""
    fi

    echo -e "${BLUE}Option 2: Cloud Supabase Project${NC}"
    echo "   1. Create project at: https://app.supabase.com"
    echo "   2. Get credentials from: https://app.supabase.com/project/_/settings/api"
    echo "   3. Add to .env file:"
    echo ""
    echo "      SUPABASE_URL=https://your-project.supabase.co"
    echo "      SUPABASE_ANON_KEY=your-anon-key"
    echo "      SUPABASE_SERVICE_KEY=your-service-role-key"

    if [ "$HAS_OPENAI" = false ]; then
        echo ""
        echo "   4. Add OpenAI key:"
        echo "      OPENAI_API_KEY=sk-your-openai-key"
    fi
    echo ""

    echo -e "${BLUE}Option 3: Use Existing Credentials${NC}"
    echo "   If you have a Supabase project, update .env manually"
    echo "   Template available in: .env.example (if exists)"
    echo ""
fi

# Check if schema needs to be installed
if [ "$HAS_URL" = true ] && [ "$HAS_SERVICE" = true ]; then
    echo "═════════════════════════════════════════════════════════"
    echo -e "${BLUE}📦 Database Schema Installation${NC}"
    echo "═════════════════════════════════════════════════════════"
    echo ""
    echo "To install the database schema:"
    echo ""
    echo "1. Open Supabase SQL Editor:"
    echo "   https://app.supabase.com/project/_/sql/new"
    echo ""
    echo "2. Copy the schema file contents:"
    echo "   cat database/schema.sql | pbcopy"
    echo "   # (or manually open database/schema.sql)"
    echo ""
    echo "3. Paste into SQL Editor and click 'Run'"
    echo ""
    echo "4. Verify installation:"
    echo "   npm run validate:ingestion"
    echo ""
fi

echo "═════════════════════════════════════════════════════════"
echo -e "${BLUE}📚 Documentation${NC}"
echo "═════════════════════════════════════════════════════════"
echo "Complete setup guide: docs/VECTOR_SEARCH_SETUP.md"
echo ""
