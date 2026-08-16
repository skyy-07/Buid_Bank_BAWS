#ifndef BAWS_ENGINE_H
#define BAWS_ENGINE_H

#include <cstdint>

#ifdef _WIN32
    #ifdef BAWS_EXPORTS
        #define BAWS_API __declspec(dllexport)
    #else
        #define BAWS_API __declspec(dllimport)
    #endif
#else
    #define BAWS_API __attribute__((visibility("default")))
#endif

/**
 * BAWS Risk Assessment Result Structure
 *
 * Contains the output of the C++ BAWS evaluation kernel.
 * Memory layout is fixed for FFI interop (Node.js koffi, Python ctypes).
 *
 * Total size: 24 bytes (2 × int32 + 4 × float32)
 * Alignment: 4 bytes
 */
struct BawsRiskResult {
    int32_t optimal_window_k;   // Selected adaptive look-back window k̂_t
    int32_t break_detected;     // 1 if structural break found, 0 otherwise
    float   var_90;             // Value-at-Risk at 90% confidence
    float   es_90;              // Expected Shortfall at 90% confidence
    float   trust_score;        // Composite Financial Trust Score [300, 850]
    float   resilience_score;   // Financial Resilience Score [0, 1.0]
};

extern "C" {

/**
 * Evaluate BAWS risk for a single borrower's cash-flow series.
 *
 * This is the high-performance C++ kernel for the MBB bootstrap
 * and sequential break detection. Designed to be called from:
 *   - Node.js via koffi/ffi-napi
 *   - Python via ctypes/cffi
 *   - Java via FFM (Panama)
 *
 * @param raw_series   Pointer to deseasonalized residual float array X̃_t
 * @param series_len   Length of the input series
 * @param alpha        VaR/ES confidence level (e.g., 0.90)
 * @param n_boot       Number of MBB bootstrap replications (e.g., 500)
 * @param beta         Bootstrap threshold confidence level (e.g., 0.90)
 * @param ref_window   Reference window size i = k_min (e.g., 6)
 * @param out_result   Pointer to output struct (caller-allocated)
 */
BAWS_API void evaluate_baws_risk(
    const float* raw_series,
    int          series_len,
    float        alpha,
    int          n_boot,
    float        beta,
    int          ref_window,
    BawsRiskResult* out_result
);

/**
 * Calibrate MBB threshold for a given reference window.
 *
 * Exposed separately for testing and validation of Theorem 1.
 *
 * @param series      Pointer to reference window data
 * @param series_len  Length of the reference window
 * @param alpha       VaR confidence level
 * @param n_boot      Number of bootstrap replications
 * @param beta        Threshold quantile level
 * @return            Calibrated threshold τ(t, i)
 */
BAWS_API float calibrate_mbb_threshold_c(
    const float* series,
    int          series_len,
    float        alpha,
    int          n_boot,
    float        beta
);

} // extern "C"

#endif // BAWS_ENGINE_H
