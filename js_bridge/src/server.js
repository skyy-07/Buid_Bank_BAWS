/**
 * BAWS-NN Engine — REST API Server (Fastify)
 *
 * Production-ready HTTP API for the BAWS-NN risk engine.
 *
 * Endpoints:
 *   POST /api/v1/evaluate     — Full risk evaluation
 *   GET  /api/v1/health       — Health check
 *   GET  /api/v1/version      — Engine version info
 *
 * Validates input with Zod schemas matching the spec's input contract.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { initEngine, evaluate } from './engine.js';

// ─────────────────────────────────────────────────────────────────────
// Zod Input Validation Schemas
// ─────────────────────────────────────────────────────────────────────

const EvaluateRequestSchema = z.object({
    borrowerId: z.string().min(1, 'borrowerId is required'),
    grossInflows: z.array(z.number().min(0)).min(3, 'Minimum 3 observations required'),
    grossOutflows: z.array(z.number().min(0)).min(3),
    liquidBuffers: z.array(z.number().min(0)).min(3),
    eventTags: z.array(z.enum(['NORMAL', 'REGIME_SHIFT'])).optional(),
    options: z.object({
        alpha: z.number().min(0.5).max(0.999).default(0.90),
        nBoot: z.number().int().min(50).max(5000).default(500),
        beta: z.number().min(0.5).max(0.999).default(0.90),
        refWindow: z.number().int().min(2).max(24).default(6),
        preferPython: z.boolean().default(true),
    }).optional().default({}),
}).refine(
    (data) => {
        const len = data.grossInflows.length;
        return data.grossOutflows.length === len && data.liquidBuffers.length === len;
    },
    { message: 'grossInflows, grossOutflows, and liquidBuffers must have equal length' }
);

// ─────────────────────────────────────────────────────────────────────
// Server Setup
// ─────────────────────────────────────────────────────────────────────

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true },
        },
    },
});

await app.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
});

// ─────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/evaluate
 *
 * Accepts cash-flow observations and returns the full BAWS-NN
 * risk assessment including:
 *   - BAWS metadata (optimal window, break detection)
 *   - Risk metrics (Trust Score, Resilience Score, VaR, ES)
 *   - Adaptive product terms (underwriting decision, limits)
 */
app.post('/api/v1/evaluate', async (request, reply) => {
    // Validate input
    const parseResult = EvaluateRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
        return reply.status(400).send({
            error: 'Validation failed',
            details: parseResult.error.issues.map(i => ({
                path: i.path.join('.'),
                message: i.message,
            })),
        });
    }

    const input = parseResult.data;

    try {
        const startTime = performance.now();

        const result = await evaluate(input, {
            preferPython: input.options.preferPython,
        });

        const elapsed = (performance.now() - startTime).toFixed(2);

        request.log.info({
            borrowerId: input.borrowerId,
            seriesLength: input.grossInflows.length,
            elapsedMs: elapsed,
            trustScore: result.riskMetrics?.trustScore,
        }, 'Evaluation completed');

        return reply.status(200).send({
            ...result,
            _meta: {
                engineVersion: '0.1.0',
                evaluationTimeMs: parseFloat(elapsed),
                seriesLength: input.grossInflows.length,
            },
        });
    } catch (err) {
        request.log.error(err, 'Evaluation failed');
        return reply.status(500).send({
            error: 'Internal engine error',
            message: err.message,
        });
    }
});

/**
 * GET /api/v1/health
 * Health check endpoint for load balancers and monitoring.
 */
app.get('/api/v1/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    engine: 'baws-nn',
    version: '0.1.0',
}));

/**
 * GET /api/v1/version
 * Engine version and capability information.
 */
app.get('/api/v1/version', async () => ({
    engine: 'BAWS-NN Risk Engine',
    version: '0.1.0',
    capabilities: {
        bawsWindowSelection: true,
        mbbBootstrap: true,
        fisslerZiegelTailRisk: true,
        neuralScoring: true,
        nativeKernel: true,
        jsFallback: true,
    },
    parameters: {
        defaultAlpha: 0.90,
        defaultBeta: 0.90,
        defaultBootstrapReplications: 500,
        defaultRefWindow: 6,
        trustScoreRange: [300, 850],
        resilienceScoreRange: [0, 100],
    },
}));

// ─────────────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

try {
    await initEngine();
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 BAWS-NN Risk Engine API running at http://${HOST}:${PORT}`);
    console.log(`   POST /api/v1/evaluate  — Risk evaluation`);
    console.log(`   GET  /api/v1/health    — Health check`);
    console.log(`   GET  /api/v1/version   — Version info\n`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
