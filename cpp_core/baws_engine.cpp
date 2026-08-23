/**
 * Mathematical Reference:
 *   Block length:  l_i = c * ceil(i^{1/3})     (Künsch 1989)
 *   Threshold:     τ(t,i) = β-quantile of bootstrap excess losses
 *   Break test:    T_k = I(D(t,k,i) > τ(t,i))
 *   Selection:     k̂_t = max{k : T_k = 0}
 */

#include "baws_engine.h"

#include <iostream>
#include <vector>
#include <cmath>
#include <numeric>
#include <algorithm>
#include <random>
#include <cstring>

//   Quantile check function (pinball loss) for VaR estimation.
//   S_{V,α}(v, x) = (I(x < v) - α)(v - x)
//   Strictly consistent scoring function whose minimizer is VaR_α.
inline float pinball_loss(float x, float q, float alpha) {
    float diff = q - x;
    return (x < q) ? (1.0f - alpha) * diff : -alpha * diff;
}
static float empirical_quantile(const std::vector<float>& sorted_data, float p) {
    int n = static_cast<int>(sorted_data.size());
    if (n == 0) return 0.0f;
    if (n == 1) return sorted_data[0];

    float idx = p * (n - 1);
    int lo = static_cast<int>(std::floor(idx));
    int hi = static_cast<int>(std::ceil(idx));

    if (lo == hi || hi >= n) return sorted_data[std::min(lo, n - 1)];

    float frac = idx - lo;
    return sorted_data[lo] * (1.0f - frac) + sorted_data[hi] * frac;
}
static int compute_block_length(int ref_window_size) {
    return std::max(1, static_cast<int>(
        std::ceil(std::pow(static_cast<double>(ref_window_size), 1.0 / 3.0))
    ));
}

extern "C" BAWS_API float calibrate_mbb_threshold_c(
    const float* series,
    int          series_len,
    float        alpha,
    int          n_boot,
    float        beta
) {
    if (series_len < 2) return 0.0f;

    int block_length = compute_block_length(series_len);
    int num_blocks = (series_len + block_length - 1) / block_length;
    std::vector<float> sorted_ref(series, series + series_len);
    std::sort(sorted_ref.begin(), sorted_ref.end());
    float theta_ref = empirical_quantile(sorted_ref, 1.0f - alpha);
    float loss_ref = 0.0f;
    for (int j = 0; j < series_len; ++j) {
        loss_ref += pinball_loss(series[j], theta_ref, alpha);
    }
    loss_ref /= series_len;

    std::vector<float> excess_losses(n_boot, 0.0f);
    std::mt19937 rng(42);
    int max_start = std::max(0, series_len - block_length);
    std::uniform_int_distribution<int> dist(0, max_start);

    std::vector<float> resampled(series_len);
    std::vector<float> resampled_sorted(series_len);

    for (int b = 0; b < n_boot; ++b) {
        int filled = 0;
        for (int nb = 0; nb < num_blocks && filled < series_len; ++nb) {
            int start_idx = dist(rng);
            int copy_len = std::min(block_length, series_len - filled);
            std::memcpy(&resampled[filled], &series[start_idx],
                       copy_len * sizeof(float));
            filled += copy_len;
        }

        std::copy(resampled.begin(), resampled.end(), resampled_sorted.begin());
        std::sort(resampled_sorted.begin(), resampled_sorted.end());
        float theta_boot = empirical_quantile(resampled_sorted, 1.0f - alpha);

        // Step 3: Excess loss on ORIGINAL reference data
        float loss_boot = 0.0f;
        for (int j = 0; j < series_len; ++j) {
            loss_boot += pinball_loss(series[j], theta_boot, alpha);
        }
        loss_boot /= series_len;

        excess_losses[b] = loss_boot - loss_ref;
    }

    std::sort(excess_losses.begin(), excess_losses.end());
    float threshold = empirical_quantile(excess_losses, beta);

    return std::max(threshold, 0.0f);
}


extern "C" BAWS_API void evaluate_baws_risk(
    const float* raw_series,
    int          series_len,
    float        alpha,
    int          n_boot,
    float        beta,
    int          ref_window,
    BawsRiskResult* out_result
) {
    if (series_len < 1 || raw_series == nullptr || out_result == nullptr) {
        return;
    }

    ref_window = std::min(ref_window, series_len);
    if (ref_window < 2) ref_window = std::min(2, series_len);

    const float* ref_start = raw_series + (series_len - ref_window);
    float tau = calibrate_mbb_threshold_c(
        ref_start, ref_window, alpha, n_boot, beta
    );

    std::vector<float> ref_sorted(ref_start, ref_start + ref_window);
    std::sort(ref_sorted.begin(), ref_sorted.end());
    float theta_ref = empirical_quantile(ref_sorted, 1.0f - alpha);

    float loss_ref = 0.0f;
    for (int j = 0; j < ref_window; ++j) {
        loss_ref += pinball_loss(ref_start[j], theta_ref, alpha);
    }
    loss_ref /= ref_window;

    int optimal_k = ref_window;
    int break_detected = 0;

    std::vector<int> candidates;
    int k = ref_window;
    while (k <= series_len) {
        candidates.push_back(k);
        if (k < 50) k += 5;
        else if (k < 100) k += 10;
        else if (k < 300) k += 20;
        else if (k < 1000) k += 50;
        else k += 100;
    }
    if (candidates.empty() || candidates.back() != series_len) {
        candidates.push_back(series_len);
    }

    for (int cand_k : candidates) {
        if (cand_k <= ref_window) {
            optimal_k = cand_k;
            continue;
        }

        const float* cand_start = raw_series + (series_len - cand_k);
        std::vector<float> cand_sorted(cand_start, cand_start + cand_k);
        std::sort(cand_sorted.begin(), cand_sorted.end());
        float theta_k = empirical_quantile(cand_sorted, 1.0f - alpha);

        float loss_k_on_ref = 0.0f;
        for (int j = 0; j < ref_window; ++j) {
            loss_k_on_ref += pinball_loss(ref_start[j], theta_k, alpha);
        }
        loss_k_on_ref /= ref_window;

        float D = std::abs(loss_k_on_ref - loss_ref);

        // Rejection test: T_k = I(D > τ)
        if (D > tau) {
            break_detected = 1;
            break; 
        }
        optimal_k = cand_k;
    }

    
    const float* opt_start = raw_series + (series_len - optimal_k);
    std::vector<float> opt_sorted(opt_start, opt_start + optimal_k);
    std::sort(opt_sorted.begin(), opt_sorted.end());

    float var_90 = empirical_quantile(opt_sorted, 1.0f - alpha);

    // ES = mean of observations ≤ VaR (tail conditional expectation)
    float es_sum = 0.0f;
    int es_count = 0;
    for (int j = 0; j < optimal_k; ++j) {
        if (opt_start[j] <= var_90) {
            es_sum += opt_start[j];
            es_count++;
        }
    }
    float es_90 = (es_count > 0) ? (es_sum / es_count) : var_90;

    // Mean positive cash flow
    float sum_pos = 0.0f;
    int count_pos = 0;
    float sum_all = 0.0f;
    int count_nonneg = 0;

    for (int j = 0; j < optimal_k; ++j) {
        float val = opt_start[j];
        sum_all += val;
        if (val > 0) { sum_pos += val; count_pos++; }
        if (val >= 0) { count_nonneg++; }
    }

    float mean_pos = (count_pos > 0) ? (sum_pos / count_pos) : 0.0f;
    float mean_all = sum_all / optimal_k;

    // Standard deviation
    float sum_sq = 0.0f;
    for (int j = 0; j < optimal_k; ++j) {
        float diff = opt_start[j] - mean_all;
        sum_sq += diff * diff;
    }
    float sigma = (optimal_k > 1) ? std::sqrt(sum_sq / (optimal_k - 1)) : 0.0f;

    // Coefficient of variation
    float cv = (mean_pos > 0) ? (sigma / mean_pos) : 10.0f;
    cv = std::min(cv, 10.0f);

    // Consistency ratio
    float c_ratio = static_cast<float>(count_nonneg) / optimal_k;

    // Shock frequency
    int shock_count = 0;
    for (int j = 0; j < optimal_k; ++j) {
        if (opt_start[j] < var_90) shock_count++;
    }
    float s_freq = static_cast<float>(shock_count) / optimal_k;

    
    // Analytical Trust Score formula
    float vol_component = 1.0f - std::min(1.0f, cv);
    float composite = 0.4f * vol_component + 0.4f * c_ratio + 0.2f * (1.0f - s_freq);
    composite = std::max(0.0f, std::min(1.0f, composite));
    float trust_score = 300.0f + 550.0f * composite;

    // Apply break penalty
    if (break_detected) {
        trust_score = std::max(300.0f, trust_score - 100.0f);
    }

    // Resilience Score (simplified — liquid buffer not available in this kernel)
    float es_abs = std::abs(es_90);
    if (es_abs < 1e-10f) es_abs = 1e-10f;
    float resilience = std::min(1.0f, mean_pos / es_abs);

    out_result->optimal_window_k = optimal_k;
    out_result->break_detected = break_detected;
    out_result->var_90 = var_90;
    out_result->es_90 = es_90;
    out_result->trust_score = trust_score;
    out_result->resilience_score = resilience;
}
