import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateSync, evaluateFallback, initNativeLibrary } from './nativeBridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let nativeAvailable = false;

/**
 * @returns {Promise<boolean>} True if native library is available.
 */
export async function initEngine() {
    try {
        nativeAvailable = await initNativeLibrary();
    } catch {
        nativeAvailable = false;
    }
    console.log(`[Engine] Native C++ kernel: ${nativeAvailable ? 'LOADED' : 'FALLBACK (JS)'}`);
    return nativeAvailable;
}

/**
 * @param {object} inputData - Cash-flow input data.
 * @returns {Promise<object>} Engine evaluation result.
 */
export function callPythonEngine(inputData) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.resolve(__dirname, '../../api/server.py');
        const proc = spawn('python', ['-c', `
import sys, json
sys.path.insert(0, '${path.resolve(__dirname, '../..').replace(/\\/g, '/')}')
from baws_engine.engine import BAWSEngine
import numpy as np

data = json.loads(sys.stdin.read())
engine = BAWSEngine()

timestamps = np.arange(len(data['grossInflows']))
result = engine.evaluate(
    borrower_id=data['borrowerId'],
    timestamps=timestamps,
    gross_inflows=np.array(data['grossInflows'], dtype=float),
    gross_outflows=np.array(data['grossOutflows'], dtype=float),
    liquid_buffers=np.array(data['liquidBuffers'], dtype=float),
)

print(result.model_dump_json(by_alias=True))
`], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python engine failed (code ${code}): ${stderr}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${stdout}`));
            }
        });

        proc.stdin.write(JSON.stringify(inputData));
        proc.stdin.end();
    });
}

/**
 * Evaluate using the C++ native kernel directly.
 *
 * This bypasses the Python engine entirely, using the C++ kernel
 * for MBB bootstrap and the JS fallback for scoring.
 *
 * @param {number[]} cashFlows - Net cash-flow series.
 * @param {object} [options] - Evaluation options.
 * @returns {object} Risk evaluation result.
 */
export function evaluateNative(cashFlows, options = {}) {
    const series = new Float32Array(cashFlows);

    if (nativeAvailable) {
        return evaluateSync(series, options);
    }
    return evaluateFallback(cashFlows, options);
}

/**
 *
 * @param {object} inputData - Input data with cash flows.
 * @param {object} [options] - Orchestration options.
 * @param {boolean} [options.preferPython=true] - Try Python engine first.
 * @returns {Promise<object>} Complete risk evaluation result.
 */
export async function evaluate(inputData, options = {}) {
    const { preferPython = true } = options;

    // Strategy 1: Python full pipeline
    if (preferPython) {
        try {
            return await callPythonEngine(inputData);
        } catch (err) {
            console.warn(`[Engine] Python engine failed: ${err.message}. Falling back to native.`);
        }
    }

    // Strategy 2/3: Native C++ or JS fallback
    const netCashFlows = inputData.grossInflows.map(
        (inflow, i) => inflow - (inputData.grossOutflows[i] || 0)
    );

    const nativeResult = evaluateNative(netCashFlows);

    // Assemble full output schema
    const now = new Date().toISOString();
    return {
        borrowerId: inputData.borrowerId,
        timestamp: now,
        bawsMetadata: {
            optimalLookbackMonths: nativeResult.optimalWindowK,
            structuralBreakDetected: nativeResult.breakDetected,
            rejectionVector: [],
            mbbBlockLength: Math.ceil(Math.pow(6, 1/3)),
        },
        riskMetrics: {
            trustScore: Math.round(nativeResult.trustScore * 10) / 10,
            resilienceScore: Math.round(nativeResult.resilienceScore * 10) / 10,
            valueAtRisk90: Math.round(nativeResult.var90 * 100) / 100,
            expectedShortfall90: Math.round(nativeResult.es90 * 100) / 100,
            coefficientOfVariation: 0,
            consistencyRatio: 0,
        },
        adaptiveProductTerms: {
            underwritingDecision: nativeResult.trustScore >= 450 ? 'APPROVED' : 'DECLINED',
            creditFacilityLimit: 0,
            repaymentMode: 'CASH_FLOW_ADAPTIVE',
            baseMonthlyCommitment: 0,
            surgeRepaymentFactorGamma: 0.20,
            shockShieldActive: nativeResult.breakDetected,
            gracePeriodMonthsAvailable: nativeResult.breakDetected ? 3 : 0,
        },
    };
}
