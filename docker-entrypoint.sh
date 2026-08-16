#!/bin/bash
set -e

case "${1}" in
    test)
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  BAWS-NN Engine — Running Test Suite"
        echo "═══════════════════════════════════════════════════"
        echo ""
        python -m pytest tests/ -v --tb=short
        ;;
    test-quick)
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  BAWS-NN Engine — Quick Smoke Test"
        echo "═══════════════════════════════════════════════════"
        echo ""
        python -m pytest tests/test_preprocessing.py tests/test_baws_selector.py -v --tb=short -x
        ;;
    test-integration)
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  BAWS-NN Engine — Integration Tests"
        echo "═══════════════════════════════════════════════════"
        echo ""
        python -m pytest tests/test_integration.py -v --tb=long
        ;;
    api)
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  BAWS-NN Engine — FastAPI Dev Server"
        echo "  http://localhost:8000/docs"
        echo "═══════════════════════════════════════════════════"
        echo ""
        python api/server.py
        ;;
    api-node)
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  BAWS-NN Engine — Node.js Fastify Server"
        echo "  http://localhost:3000/api/v1/evaluate"
        echo "═══════════════════════════════════════════════════"
        echo ""
        cd js_bridge && node src/server.js
        ;;
    shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
