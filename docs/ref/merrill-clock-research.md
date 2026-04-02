# Merrill Lynch Investment Clock — Theoretical Foundation & Data Validation

> Reference document for GoldenHeat project
> Last updated: 2026-04-02
> Sources: IMF, OECD, FRED, NBS China, BofA Global Research, Gemini analysis

---

## 1. The Investment Clock Framework (Gary Baker et al., 2004)

### 1.1 Core Model

The Merrill Lynch Investment Clock divides the economic cycle into four phases based on two axes:

- **Horizontal axis**: Output Gap (GDP growth vs. potential growth)
- **Vertical axis**: Inflation Momentum (CPI/PPI trend direction)

```
                    GDP ↑ (Expansion)
                         │
         RECOVERY        │       OVERHEAT
         (Stocks ⭐)      │       (Commodities ⭐)
                         │
  CPI ↓ ─────────────────┼──────────────── CPI ↑
  (Disinflation)         │          (Inflation)
                         │
         RECESSION       │       STAGFLATION
         (Bonds ⭐)       │       (Cash ⭐)
                         │
                    GDP ↓ (Contraction)
```

**Clockwise rotation**: Recovery → Overheat → Stagflation → Recession → Recovery ...

### 1.2 Phase Definitions

| Phase | GDP | CPI | Best Asset | Mechanism |
|-------|-----|-----|------------|-----------|
| **Recovery** | ↑ above trend | ↓ falling | Stocks | Excess capacity absorbs demand; central bank easing stimulates growth; earnings recovery drives equities |
| **Overheat** | ↑ at peak | ↑ rising | Commodities | Capacity limits reached; demand > supply pushes prices; central bank tightens; commodity prices surge |
| **Stagflation** | ↓ slowing | ↑ still high | Cash | Productivity falls; wage-price spiral; high rates persist; cash preserves capital |
| **Recession** | ↓ contracting | ↓ falling | Bonds | Demand collapses; unemployment rises; central bank cuts rates; bonds rally on rate expectations |

### 1.3 Key Transition Signals

| Transition | Leading Indicator | Lag |
|-----------|-------------------|-----|
| Recovery → Overheat | PMI peaks + CPI accelerates | PMI leads GDP by 3-6 months |
| Overheat → Stagflation | PMI falls below 50 while CPI stays high | 3-6 months |
| Stagflation → Recession | Employment deteriorates + yield curve inverts | 6-12 months |
| Recession → Recovery | Central bank cuts + M2 expands + PMI bottoms | 3-6 months |

---

## 2. Data Validation — April 2026

### 2.1 Critical Assessment of Gemini Analysis

The Gemini analysis concludes: **"Global economy transitioning from Recovery to Overheat, with stagflation noise from energy shocks."**

**Evaluation**: Partially accurate but oversimplified. The assessment correctly identifies the global macro direction but fails to distinguish the significant divergence between US and China cycles.

### 2.2 Verified Data Points (as of 2026-04-02)

#### A. China Economic Data

| Indicator | Latest Value | Date | Source | Trend |
|-----------|-------------|------|--------|-------|
| GDP Growth | 4.5% (Q4 2025) | 2026-01-19 | NBS | ↓ Slowing (5.4% Q1 → 4.5% Q4) |
| CPI YoY | +1.3% | Feb 2026 | NBS | ↑ Recovering (from -0.1% Jun 2025) |
| PPI YoY | -0.9% | Feb 2026 | NBS | ↑ Narrowing deflation (from -3.6%) |
| PMI (Mfg) | **50.4** | Mar 2026 | NBS | ↑ Back to expansion (from 49.0 Feb) |
| M2 Growth | 8.8% | Aug 2025 | PBoC | ↑ Loose monetary policy |
| LPR (1Y) | 3.0% | Mar 2026 | PBoC | → Stable (cut cycle may resume) |

**China Clock Position: RECOVERY → early OVERHEAT transition**

Reasoning:
- GDP slowing from 5.4% to 4.5% BUT PMI just crossed back above 50 (50.4 in March)
- CPI turning positive (+1.3%) after months of near-zero/negative readings
- PPI deflation narrowing (-0.9% vs -3.6%) — producer prices recovering
- M2 >> GDP (8.8% vs 4.5%) = monetary easing still in effect
- **Key signal**: PMI 50.4 is the 12-month high, suggesting manufacturing bottomed

**⚠️ Our system's error**: The system uses stale data (CPI: 2025-08, PMI: 2025-08) which shows PMI at 49.4 and CPI at 0.0%. With updated data (PMI 50.4, CPI 1.3%), the phase judgment may shift from pure "Overheat" to "Recovery → Overheat transition." The GDP trend slope calculation using old data gives a misleading "up" direction when recent quarters actually show deceleration.

#### B. US Economic Data

| Indicator | Latest Value | Date | Source | Trend |
|-----------|-------------|------|--------|-------|
| GDP Growth | ~2.1% YTD (through Q3 2025) | Q3 2025 | BEA | ↓ Decelerating from 2.8% avg |
| CPI YoY | 2.4% | Feb 2026 | BLS | → Stable but tariffs lurking |
| Fed Funds Rate | 3.64% (effective) | Mar 2026 | FRED | → Paused after cuts from 4.33% |
| Non-Farm Payroll | 158,466K | Feb 2026 | BLS | → Steady |
| 10Y-2Y Spread | +0.52% | Apr 2026 | FRED | ↑ Positive (no inversion) |

**US Clock Position: Late RECOVERY, facing STAGFLATION risk from tariffs**

Reasoning:
- GDP decelerating but still positive — not yet contracting
- CPI stable at 2.4% but tariff impact not yet fully priced in
- Morningstar forecasts CPI rising to 2.7% in 2026 as tariff costs pass through
- Fed paused at 3.64% — "higher for longer" stance
- OECD raised G20 inflation forecast to 4.0% (up 1.2pp) due to Middle East conflict
- **Risk**: If tariffs + oil shock → CPI rises while GDP slows = Stagflation

#### C. Global Context — The Iran War Factor

| Indicator | Value | Impact |
|-----------|-------|--------|
| Brent Crude | ~$100-105/bbl | ↑ +40% since conflict started |
| Oil peak (Mar 2026) | ~$120/bbl | Supply disruption fear |
| VIX | 24-25 (Apr 1) | ↑ Elevated (was 30+ late March) |
| OECD G20 Inflation | 4.0% (2026 forecast) | ↑ +1.2pp revision due to conflict |

The Iran war is a **supply-side shock** — it raises inflation without stimulating growth. This is the classic stagflation trigger, distinct from demand-driven "overheat."

### 2.3 Corrected Assessment Matrix

| Economy | Growth | Inflation | Clock Phase | Confidence |
|---------|--------|-----------|-------------|------------|
| **China** | Recovering (PMI > 50) | Rising from deflation | **Recovery** (heading to Overheat) | 65% |
| **US** | Decelerating | Stable but threatened | **Late Recovery** (Stagflation risk) | 50% |
| **Global** | Moderate expansion | Rising (energy-driven) | **Recovery → Overheat** (with Stagflation noise) | 55% |

### 2.4 Gemini Analysis — Accuracy Verdict

| Claim | Verdict | Notes |
|-------|---------|-------|
| "Global Recovery → Overheat transition" | ✅ Broadly correct | Direction is right |
| "AI investment as core growth driver" | ✅ Correct | OECD and BofA confirm |
| "PMI 52-53 range globally" | ⚠️ Needs nuance | US ISM varies; China just crossed 50 |
| "OECD raised G20 inflation to 4.0%" | ✅ Verified | March 26, 2026 report |
| "Commodities outperforming bonds" | ✅ Correct for 2026 | Oil +40%, bonds under pressure |
| "China closer to Recovery" | ✅ Correct | CPI just turned positive, PMI just > 50 |
| "Energy shock = stagflation noise" | ✅ Important distinction | Supply shock ≠ demand-driven overheat |
| "BofA uses clock logic in CMO reports" | ✅ Verified | "Mid-cycle" language in Feb 2026 CMO |

**Overall accuracy: ~80%**. The analysis is directionally sound but lacks precision on regional divergences and uses some dated generalizations. The key insight — distinguishing demand-driven overheat from supply-shock stagflation noise — is correct and important.

---

## 3. Implications for GoldenHeat System

### 3.1 Data Freshness Problem (Critical)

Our system's macro_data is severely stale:

| Indicator | Our Latest | Actual Latest | Gap |
|-----------|-----------|---------------|-----|
| China CPI | 2025-08 (0.0%) | 2026-02 (1.3%) | **6 months** |
| China PMI | 2025-08 (49.4) | 2026-03 (50.4) | **7 months** |
| China GDP | 2025-07 (5.2%) | 2025-Q4 (4.5%) | **~6 months** |
| China PPI | 2025-08 (-3.6%) | 2026-02 (-0.9%) | **6 months** |
| US CPI | 2026-02 (2.4%) | 2026-02 (2.4%) | ✅ Current |
| US Fed Rate | 2026-03 (3.64%) | 2026-03 (3.64%) | ✅ Current |

**Impact**: The stale China data causes our system to judge "Overheat" (GDP up, CPI up) when updated data suggests "Recovery → early Overheat transition" because:
- GDP is actually decelerating (not accelerating)
- CPI has turned positive but from a very low base
- PMI just barely crossed 50 (expansion threshold)

**Action Required**: akshare collectors need to be re-run to pull latest China macro data. The CN data pipeline appears to have stopped updating after August 2025.

### 3.2 Model Refinement Recommendations

1. **Distinguish supply-shock inflation from demand-pull inflation**
   - Current model treats all CPI rises equally
   - Should add oil price / commodity index as a "shock" indicator
   - If CPI rises + oil spikes + PMI falls → Stagflation, not Overheat

2. **Add regional differentiation**
   - China and US are in different phases
   - Consider running separate clocks for CN and US (already supported in code)
   - Dashboard should show both, not just one

3. **Incorporate leading indicators not yet in system**
   - US 10Y-2Y yield spread (+0.52% = no inversion = not recession)
   - VIX level (24-25 = elevated uncertainty)
   - Brent crude trend (supply-shock proxy)

4. **Data freshness monitoring**
   - Add warning when any indicator is >60 days stale
   - Auto-run collectors weekly (or alert when data is missing)

---

## 4. Authoritative Data Sources Reference

### 4.1 Primary Sources (Free API)

| Data | Source | API/Method | Update Frequency |
|------|--------|-----------|-----------------|
| US GDP, CPI, Fed Rate, Payrolls | **FRED** (St. Louis Fed) | `fredapi` Python | Monthly/Quarterly |
| US 10Y-2Y Spread | **FRED** series `T10Y2Y` | `fredapi` | Daily |
| VIX | **FRED** series `VIXCLS` | `fredapi` | Daily |
| China GDP, CPI, PPI, PMI | **NBS** via `akshare` | `akshare` Python | Monthly/Quarterly |
| China M2, LPR | **PBoC** via `akshare` | `akshare` | Monthly |
| Oil (Brent) | **Yahoo Finance** | `yfinance` (`BZ=F`) | Daily |
| Global PMI | **S&P Global** | Web scraping / paid | Monthly |

### 4.2 Secondary Sources (Analysis)

| Source | Content | Access |
|--------|---------|--------|
| **BofA Capital Market Outlook** | Monthly; uses Investment Clock framework implicitly | PDF (paid) |
| **IMF World Economic Outlook** | Quarterly GDP/inflation forecasts | Free |
| **OECD Interim Economic Outlook** | Quarterly; inflation/growth projections | Free |
| **Goldman Sachs Global Macro** | Cycle positioning research | Paid |

### 4.3 Original Academic References

- Baker, G. & Greetham, T. (2004). "The Investment Clock." Merrill Lynch Global Economics Research.
- Baker, G. (2004). "The Investment Clock: Making Money from Macro." Merrill Lynch. (Original paper defining the four-phase model)

---

## 5. Correct Clock Implementation Notes

### 5.1 Standard Quadrant Layout

The standard Merrill Lynch clock displays quadrants as follows:

```
              GDP ↑
       ┌───────┬───────┐
       │       │       │
       │ 复苏  │  过热  │
  CPI ↓│Stocks │Commod.│CPI ↑
       │       │       │
       ├───────┼───────┤
       │       │       │
       │ 衰退  │  滞胀  │
       │Bonds  │ Cash  │
       │       │       │
       └───────┴───────┘
              GDP ↓
```

- **Top-left**: Recovery (GDP↑, CPI↓) → Stocks
- **Top-right**: Overheat (GDP↑, CPI↑) → Commodities
- **Bottom-right**: Stagflation (GDP↓, CPI↑) → Cash
- **Bottom-left**: Recession (GDP↓, CPI↓) → Bonds

Clockwise rotation follows the natural economic cycle.

### 5.2 Phase Detection Algorithm

The GoldenHeat system uses linear regression slope over sliding windows:
- GDP: 4-quarter window
- CPI: 6-month window

This is a reasonable simplification but should be supplemented with:
- PMI as a **leading** indicator (3-6 month lead over GDP)
- Yield curve as a **recession** early warning
- Oil prices as a **supply shock** discriminator

---

*Document maintained by: 小马 🐴 (GoldenHeat Engineering)*
*Next review: When CN macro data pipeline is updated*
