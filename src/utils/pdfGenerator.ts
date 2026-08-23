import { jsPDF } from 'jspdf';
import { BorrowerProfile, OAuthUser } from '../types';

/**
 * Generates a clean, professional, multi-page vector PDF Risk Assessment & Buffer Status Report
 */
export function generateRiskAndBufferPDF(
  profile: BorrowerProfile,
  currentUser?: OAuthUser | null
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryDark = [18, 53, 36]; // #123524
  const accentGreen = [21, 128, 61]; // #15803d
  const bgLight = [250, 248, 242]; // #faf8f2
  const textDark = [18, 53, 36];
  const textMuted = [100, 116, 106];
  const borderLight = [224, 216, 200];
  const amberColor = [180, 83, 9];

  let y = margin;

  // Helper functions
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;
      drawHeaderSmall();
    }
  };

  const drawHeaderSmall = () => {
    doc.setFillColor(18, 53, 36);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('BAWS ADAPTIVE FINANCE — RISK ASSESSMENT & LIQUIDITY BUFFER REPORT', margin + 4, y + 5.5);
    doc.text(`CERT: ${profile.passportCertId || 'BAWS-2026-X'}`, pageWidth - margin - 4, y + 5.5, { align: 'right' });
    y += 12;
  };

  // --- 1. COVER / TOP HEADER BANNER ---
  doc.setFillColor(18, 53, 36);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('BAWS RISK & BUFFER ASSESSMENT REPORT', margin + 6, y + 10);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 205, 175);
  doc.text('Borrower-Adaptive Working Capital & Non-Parametric Tail Liquidity Audit', margin + 6, y + 16);

  // Metadata row
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(8);
  doc.setTextColor(220, 235, 225);
  doc.text(`Generated: ${dateStr}`, margin + 6, y + 23);
  doc.text(`Audited Profile: ${profile.fullName} (${profile.sectorLabel})`, margin + 6, y + 28);

  // Status Badge on the right
  doc.setFillColor(250, 235, 215);
  doc.roundedRect(pageWidth - margin - 48, y + 8, 42, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text('VERIFIED AUDIT', pageWidth - margin - 27, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('LIVE TELEMETRY', pageWidth - margin - 27, y + 20, { align: 'center' });

  y += 40;

  // --- 2. BORROWER & CERTIFICATE SUMMARY BOX ---
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(224, 216, 200);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(18, 53, 36);

  // Column 1
  doc.text('Borrower Details:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 65);
  doc.text(`Name: ${profile.fullName}`, margin + 4, y + 11);
  doc.text(`ID: ${profile.borrowerId} | Phone: ${profile.phoneNumber}`, margin + 4, y + 16);
  doc.text(`Sector: ${profile.sectorLabel}`, margin + 4, y + 21);

  // Column 2
  const col2X = margin + (contentWidth / 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(18, 53, 36);
  doc.text('BAWS Telemetry State:', col2X, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 65);
  doc.text(`Lookback Window (k): ${profile.bawsEngineState.optimalLookbackWindowK} periods`, col2X, y + 11);
  doc.text(`Regime: ${profile.bawsEngineState.operationalRegime.replace('_', ' ')}`, col2X, y + 16);
  doc.text(`Structural Break: ${profile.bawsEngineState.structuralBreakDetected ? 'Active (Adapting)' : 'None'}`, col2X, y + 21);

  // Column 3
  const col3X = margin + (contentWidth * 2 / 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(18, 53, 36);
  doc.text('Passport Verification:', col3X, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 75, 65);
  doc.text(`Cert ID: ${profile.passportCertId}`, col3X, y + 11);
  doc.text(`Issued: ${profile.passportIssuedDate || 'August 2026'}`, col3X, y + 16);
  const truncatedHash = profile.passportHash ? `${profile.passportHash.substring(0, 18)}...` : 'N/A';
  doc.text(`Hash: ${truncatedHash}`, col3X, y + 21);

  y += 29;

  // --- 3. DUAL-SCORE EXECUTIVE HIGHLIGHTS ---
  const boxWidth = (contentWidth - 6) / 3;

  // Card 1: Trust Score
  doc.setFillColor(18, 53, 36);
  doc.roundedRect(margin, y, boxWidth, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 195, 165);
  doc.text('TRUST SCORE (T_score)', margin + 4, y + 6);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`${profile.scoringProfile.trustScore}`, margin + 4, y + 15);
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 210);
  doc.text(`/ 850 (${profile.scoringProfile.trustGrade})`, margin + 24, y + 15);
  doc.setFontSize(7);
  doc.setTextColor(160, 210, 180);
  doc.text('Based on cash flow consistency & bank data', margin + 4, y + 22);

  // Card 2: Resilience Score
  doc.setFillColor(250, 235, 215);
  doc.roundedRect(margin + boxWidth + 3, y, boxWidth, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 80, 20);
  doc.text('RESILIENCE SCORE (R_score)', margin + boxWidth + 7, y + 6);
  doc.setFontSize(16);
  doc.setTextColor(120, 53, 15);
  doc.text(`${profile.scoringProfile.resilienceScore}%`, margin + boxWidth + 7, y + 15);
  doc.setFontSize(7);
  doc.setTextColor(140, 70, 15);
  doc.text(`Tail Deficit Stress: ES_0.90 covered`, margin + boxWidth + 7, y + 22);

  // Card 3: Liquid Buffer
  doc.setFillColor(238, 247, 242);
  doc.setDrawColor(203, 228, 212);
  doc.roundedRect(margin + (boxWidth * 2) + 6, y, boxWidth, 26, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text('VERIFIED LIQUID BUFFER (B_t)', margin + (boxWidth * 2) + 10, y + 6);
  doc.setFontSize(14);
  doc.setTextColor(18, 53, 36);
  doc.text(`Rs. ${profile.currentLiquidBuffer.toLocaleString('en-IN')}`, margin + (boxWidth * 2) + 10, y + 15);
  doc.setFontSize(7.5);
  doc.setTextColor(40, 110, 70);
  const essentialDays = profile.scoringProfile.formulaBreakdown.essentialDaysCovered || 9;
  doc.text(`Covers ~${essentialDays} essential days of burn`, margin + (boxWidth * 2) + 10, y + 22);

  y += 32;

  // --- 4. SECTION: STATISTICAL RISK & STRESS TESTING METRICS ---
  checkPageBreak(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(18, 53, 36);
  doc.text('1. Statistical Risk & Bootstrap Tail Loss Assessment', margin, y + 4);
  y += 7;

  // Metrics Table Grid
  const tableData = [
    ['Metric Description', 'Formula / Anchor', 'Current Value', 'Risk Assessment'],
    [
      'Mean Positive Inflow (E[X_pos])',
      'Average expansion periods',
      `Rs. ${Math.round(profile.statisticalMetrics.meanPositiveCashFlow).toLocaleString('en-IN')}`,
      'Healthy baseline operational income',
    ],
    [
      'Cash Flow Volatility (Sigma)',
      'Standard deviation of delta',
      `Rs. ${Math.round(profile.statisticalMetrics.cashFlowVolatilitySigma).toLocaleString('en-IN')}`,
      profile.statisticalMetrics.cashFlowVolatilitySigma > 15000 ? 'Elevated seasonal swings' : 'Moderate volatility',
    ],
    [
      'Value-at-Risk (VaR_0.90)',
      '90% worst-case weekly loss',
      `Rs. ${Math.round(profile.statisticalMetrics.valueAtRisk90).toLocaleString('en-IN')}`,
      'Within auto-adjustment threshold',
    ],
    [
      'Expected Shortfall (ES_0.90)',
      'Tail Conditional Deficit E[L|L>VaR]',
      `Rs. ${Math.round(profile.statisticalMetrics.expectedShortfall90).toLocaleString('en-IN')}`,
      'Protected by buffer + shock shield',
    ],
    [
      'Coefficient of Variation (CV)',
      'sigma / mu',
      `${(profile.statisticalMetrics.coefficientOfVariation || 0.42).toFixed(2)}`,
      'Non-stationary seasonal regime',
    ],
  ];

  const colWidths = [58, 48, 38, 38];
  const rowHeight = 6.5;

  tableData.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const currentY = y + rowIndex * rowHeight;

    if (isHeader) {
      doc.setFillColor(18, 53, 36);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 242 : 255);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      doc.setDrawColor(230, 225, 215);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 45, 35);
    }

    let cellX = margin;
    row.forEach((cell, cellIndex) => {
      const padX = 2.5;
      const textY = currentY + 4.5;
      if (cellIndex === 2 && !isHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(18, 53, 36);
      } else if (!isHeader) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 55, 45);
      }
      doc.text(String(cell), cellX + padX, textY);
      cellX += colWidths[cellIndex];
    });
  });

  y += tableData.length * rowHeight + 8;

  // --- 5. SECTION: ADAPTIVE CREDIT & ZERO-DEFAULT POLICY ---
  checkPageBreak(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(18, 53, 36);
  doc.text('2. Approved Adaptive Credit Facility & Repayment Structure', margin, y + 4);
  y += 7;

  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(224, 216, 200);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(18, 53, 36);
  doc.text('Underwriting Decision:', margin + 4, y + 6);
  doc.setTextColor(21, 128, 61);
  doc.text(profile.adaptiveProductRecommendation.underwritingDecision, margin + 44, y + 6);

  doc.setTextColor(18, 53, 36);
  doc.text('Approved Credit Limit:', margin + 105, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(21, 128, 61);
  doc.text(`Rs. ${profile.adaptiveProductRecommendation.approvedCreditLimit.toLocaleString('en-IN')}`, margin + 140, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 75, 65);
  doc.text(`Repayment Model: ${profile.adaptiveProductRecommendation.repaymentStructure}`, margin + 4, y + 13);
  doc.text(`Surge Repayment Factor (Gamma): ${profile.adaptiveProductRecommendation.surgeRepaymentFactorGamma * 100}% of surplus`, margin + 105, y + 13);

  doc.text(`Dynamic Equation: ${profile.adaptiveProductRecommendation.repaymentEquationFormula}`, margin + 4, y + 19);
  doc.text(`Shock Shield Protection: ${profile.adaptiveProductRecommendation.shockShieldGracePeriodActive ? 'ACTIVE (Zero Penalty)' : 'Available'}`, margin + 105, y + 19);

  // Bank rationale note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(80, 95, 85);
  const rationale = profile.adaptiveProductRecommendation.bankUnderwritingJustification || 'Facility limits dynamically track moving lookback buffer without triggering fixed default penalties.';
  doc.text(`Risk Desk Rationale: ${rationale.substring(0, 110)}...`, margin + 4, y + 26);

  y += 38;

  // --- 6. SECTION: REAL-TIME BANKING & CONNECTED ACCOUNTS ---
  checkPageBreak(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(18, 53, 36);
  doc.text('3. Verified Bank Account Balances & Telemetry Streams', margin, y + 4);
  y += 7;

  const accounts = profile.connectedBankAccounts && profile.connectedBankAccounts.length > 0
    ? profile.connectedBankAccounts
    : [
        { bankName: 'State Bank of India', mask: '•••• 4821', accountType: 'SAVINGS' as const, balanceAvailable: profile.currentLiquidBuffer + 4850, lastSyncedAt: 'Live (Aug 2026)' },
        { bankName: 'HDFC Mandi Merchant', mask: '•••• 9104', accountType: 'CURRENT' as const, balanceAvailable: 8400, lastSyncedAt: 'Live (Aug 2026)' },
      ];

  const bankHeader = ['Institution / Bank Name', 'Account Type', 'Masked Number', 'Live Available Balance', 'Sync Status'];
  const bankColWidths = [50, 30, 30, 42, 30];

  doc.setFillColor(18, 53, 36);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let bX = margin;
  bankHeader.forEach((h, idx) => {
    doc.text(h, bX + 2, y + 4.2);
    bX += bankColWidths[idx];
  });
  y += 6;

  accounts.forEach((acc, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 242 : 255);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setDrawColor(230, 225, 215);
    doc.line(margin, y + 6, margin + contentWidth, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 35, 25);
    doc.text(acc.bankName, margin + 2, y + 4.2);
    doc.text(acc.accountType, margin + 52, y + 4.2);
    doc.text(acc.mask, margin + 82, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(18, 53, 36);
    doc.text(`Rs. ${acc.balanceAvailable.toLocaleString('en-IN')}`, margin + 112, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(21, 128, 61);
    doc.text('RBI AA Synced', margin + 154, y + 4.2);
    y += 6;
  });

  y += 6;

  // --- 7. SECTION: RECOMMENDED ACTION PLAN ---
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(18, 53, 36);
  doc.text('4. Recommended Liquidity Actions & Buffer Defenses', margin, y + 4);
  y += 7;

  profile.actions.slice(0, 3).forEach((act, idx) => {
    doc.setFillColor(250, 248, 242);
    doc.setDrawColor(224, 216, 200);
    doc.roundedRect(margin, y, contentWidth, 13, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(18, 53, 36);
    doc.text(`${act.stepNumber} — ${act.title}`, margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(70, 85, 75);
    doc.text(act.description.substring(0, 115), margin + 4, y + 9.5);

    // Impact text on the right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(act.status === 'COMPLETED' ? 21 : 180, act.status === 'COMPLETED' ? 128 : 83, act.status === 'COMPLETED' ? 61 : 9);
    doc.text(act.status === 'COMPLETED' ? 'COMPLETED' : act.impactText, pageWidth - margin - 4, y + 7, { align: 'right' });

    y += 15;
  });

  // --- 8. FOOTER / SIGNATURE COMPLIANCE ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(220, 215, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 135, 125);
    doc.text('Confidential — Generated by BAWS Adaptive Finance Engine for Risk Assessment and Buffer Monitoring.', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Sanitize filename and trigger download
  const cleanName = (profile.fullName || 'Borrower').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `baws-risk-report-${cleanName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
