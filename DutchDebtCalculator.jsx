import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Formatters ──────────────────────────────────────────────────────────────
const fmtEur = (val) => {
  if (val == null || isNaN(val)) return '€0';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val);
};
const fmtEurK = (val) => {
  if (val == null || isNaN(val)) return '€0';
  if (Math.abs(val) >= 1000) return `€${(val / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}k`;
  return fmtEur(val);
};
const fmtPct = (val) => `${Number(val).toFixed(2).replace('.', ',')}%`;

// ── Simulation engine ────────────────────────────────────────────────────────
function runSimulation(inp) {
  const {
    portfolio_start, monthly_inleg, annual_return, inflation_rate,
    duo_debt_start, duo_rate, extra_duo_monthly, duo_remaining_years,
    heffingsvrij, box3_system, mortgage_weging, horizon_years,
  } = inp;

  const r_port = annual_return / 100 / 12;
  const r_duo = duo_rate / 100 / 12;
  const infl = inflation_rate / 100;
  const n_duo = Math.round(duo_remaining_years * 12);

  // Annuity minimum DUO payment (fixed over full term)
  let min_duo_payment;
  if (r_duo === 0 || n_duo === 0) {
    min_duo_payment = n_duo > 0 ? duo_debt_start / n_duo : 0;
  } else {
    min_duo_payment =
      duo_debt_start * (r_duo * Math.pow(1 + r_duo, n_duo)) /
      (Math.pow(1 + r_duo, n_duo) - 1);
  }

  // State: A
  let a_port = portfolio_start;
  let a_duo = duo_debt_start;
  let a_paid_year = null;

  // State: B
  let b_port = portfolio_start;
  let b_duo = duo_debt_start;
  let b_paid_year = null;

  const rows = [];

  for (let yr = 1; yr <= horizon_years; yr++) {
    // ── Scenario A ──
    let a_port_yr_start = a_port;
    for (let m = 0; m < 12; m++) {
      a_port = a_port * (1 + r_port) + monthly_inleg;
      if (a_duo > 0) {
        const interest = a_duo * r_duo;
        a_duo = Math.max(0, a_duo + interest - min_duo_payment);
        if (a_duo === 0 && a_paid_year === null) a_paid_year = yr;
      }
    }
    // Box 3 A
    const a_taxable = Math.max(0, a_port - heffingsvrij);
    let a_box3 = 0;
    if (box3_system === 'forfaitair') {
      a_box3 = a_taxable * 0.0216;
    } else {
      const a_ret = a_port_yr_start > 0
        ? (a_port - a_port_yr_start - monthly_inleg * 12) / a_port_yr_start
        : annual_return / 100;
      a_box3 = a_taxable * Math.max(0, a_ret) * 0.36;
    }
    a_port = Math.max(0, a_port - a_box3);

    // ── Scenario B ──
    let b_port_yr_start = b_port;
    let b_extra_yr = 0;
    for (let m = 0; m < 12; m++) {
      b_port = b_port * (1 + r_port) + monthly_inleg;
      if (b_duo > 0) {
        const interest = b_duo * r_duo;
        const owed = b_duo + interest;
        const payment = Math.min(owed, min_duo_payment + extra_duo_monthly);
        b_duo = Math.max(0, owed - payment);
        if (b_duo === 0 && b_paid_year === null) b_paid_year = yr;
      }
    }
    // Year-end surplus → DUO
    if (b_duo > 0 && b_port > heffingsvrij) {
      const surplus = b_port - heffingsvrij;
      const transfer = Math.min(surplus, b_duo);
      b_port -= transfer;
      b_duo -= transfer;
      b_extra_yr = transfer;
      if (b_duo <= 0) {
        b_duo = 0;
        if (b_paid_year === null) b_paid_year = yr;
      }
    }
    // Box 3 B
    const b_taxable = Math.max(0, b_port - heffingsvrij);
    let b_box3 = 0;
    if (box3_system === 'forfaitair') {
      b_box3 = b_taxable * 0.0216;
    } else {
      const b_ret = b_port_yr_start > 0
        ? (b_port - b_port_yr_start - monthly_inleg * 12) / b_port_yr_start
        : annual_return / 100;
      b_box3 = b_taxable * Math.max(0, b_ret) * 0.36;
    }
    b_port = Math.max(0, b_port - b_box3);

    // Inflation correction
    const infl_factor = Math.pow(1 + infl, yr);
    const weging_factor = mortgage_weging / 100;

    rows.push({
      year: yr,
      a_portfolio: a_port,
      a_duo: a_duo,
      a_box3,
      a_net_nom: a_port - a_duo,
      a_net_real: (a_port - a_duo) / infl_factor,
      a_hyp_impact: a_duo * weging_factor * 110,
      b_portfolio: b_port,
      b_duo: b_duo,
      b_box3,
      b_net_nom: b_port - b_duo,
      b_net_real: (b_port - b_duo) / infl_factor,
      b_hyp_impact: b_duo * weging_factor * 110,
      b_extra_yr,
    });
  }

  return { rows, a_paid_year, b_paid_year, min_duo_payment };
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">Jaar {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {fmtEur(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Number input ──────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, prefix, suffix, min = 0, max, step = 1, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 leading-tight">{label}</label>
      <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg focus-within:border-gray-500 transition-colors overflow-hidden">
        {prefix && <span className="pl-2.5 pr-1 text-gray-500 text-sm select-none">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="flex-1 bg-transparent px-2.5 py-2 text-white text-sm focus:outline-none min-w-0"
        />
        {suffix && <span className="pr-2.5 pl-1 text-gray-500 text-sm select-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DutchDebtCalculator() {
  // ── Inputs ──
  const [portfolio, setPortfolio] = useState(50000);
  const [monthlyInleg, setMonthlyInleg] = useState(500);
  const [annualReturn, setAnnualReturn] = useState(7);
  const [inflation, setInflation] = useState(2.5);

  const [duoDebt, setDuoDebt] = useState(30000);
  const [duoRate, setDuoRate] = useState(2.33);
  const [extraDuo, setExtraDuo] = useState(0);
  const [duoYears, setDuoYears] = useState(35);

  const [heffingsvrij, setHeffingsvrij] = useState(59357);
  const [box3System, setBox3System] = useState('forfaitair');

  const [mortgageWish, setMortgageWish] = useState(300000);
  const [mortgageRate, setMortgageRate] = useState(4.0);
  const [mortgageWeging, setMortgageWeging] = useState(0.75);

  const [horizon, setHorizon] = useState(20);
  const [showReal, setShowReal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tableExpanded, setTableExpanded] = useState(false);

  // ── Simulation ──
  const sim = useMemo(() => runSimulation({
    portfolio_start: portfolio,
    monthly_inleg: monthlyInleg,
    annual_return: annualReturn,
    inflation_rate: inflation,
    duo_debt_start: duoDebt,
    duo_rate: duoRate,
    extra_duo_monthly: extraDuo,
    duo_remaining_years: duoYears,
    heffingsvrij,
    box3_system: box3System,
    mortgage_weging: mortgageWeging,
    horizon_years: horizon,
  }), [portfolio, monthlyInleg, annualReturn, inflation, duoDebt, duoRate,
      extraDuo, duoYears, heffingsvrij, box3System, mortgageWeging, horizon]);

  const { rows, a_paid_year, b_paid_year, min_duo_payment } = sim;
  const last = rows[rows.length - 1];

  const netKey = showReal ? 'net_real' : 'net_nom';
  const a_final = last ? (showReal ? last.a_net_real : last.a_net_nom) : 0;
  const b_final = last ? (showReal ? last.b_net_real : last.b_net_nom) : 0;
  const winner = a_final >= b_final ? 'A' : 'B';
  const diff = Math.abs(a_final - b_final);

  const totalA_box3 = rows.reduce((s, r) => s + r.a_box3, 0);
  const totalB_box3 = rows.reduce((s, r) => s + r.b_box3, 0);

  const box3EffRate = box3System === 'forfaitair'
    ? '2,16% (6% × 36%)'
    : `${(annualReturn * 0.36).toFixed(2).replace('.', ',')}% (${annualReturn.toString().replace('.', ',')}% × 36%)`;

  const tabs = ['Grafiek', 'Hypotheek', 'Box 3', 'Jaar-overzicht'];

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Beleggingen vs. DUO-schuld Calculator</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Scenario A = alles beleggen + minimum DUO · Scenario B = surplus boven heffingsvrij naar DUO
          </p>
        </div>

        {/* ── Input panels ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">

          {/* Beleggingen */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <h2 className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-widest">Beleggingen</h2>
            <div className="space-y-3">
              <NumInput label="Huidige portefeuille" value={portfolio} onChange={setPortfolio} prefix="€" step={1000} />
              <NumInput label="Maandelijkse inleg" value={monthlyInleg} onChange={setMonthlyInleg} prefix="€" step={50} />
              <NumInput label="Verwacht jaarrendement" value={annualReturn} onChange={setAnnualReturn} suffix="%" step={0.1} max={30} />
              <NumInput label="Verwachte inflatie" value={inflation} onChange={setInflation} suffix="%" step={0.1} max={10} hint="Standaard 2,5%" />
            </div>
          </div>

          {/* DUO */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <h2 className="text-xs font-bold text-green-400 mb-3 uppercase tracking-widest">DUO-schuld</h2>
            <div className="space-y-3">
              <NumInput label="Huidige DUO-schuld" value={duoDebt} onChange={setDuoDebt} prefix="€" step={1000} />
              <NumInput label="DUO rentepercentage" value={duoRate} onChange={setDuoRate} suffix="%" step={0.01} max={10} hint="Standaard 2,33%" />
              <NumInput label="Extra maandlast DUO (sc. B)" value={extraDuo} onChange={setExtraDuo} prefix="€" step={50} />
              <NumInput label="Resterende aflostermijn" value={duoYears} onChange={setDuoYears} suffix="jaar" step={1} max={35} hint="Standaard 35 jaar" />
            </div>
          </div>

          {/* Box 3 */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <h2 className="text-xs font-bold text-yellow-400 mb-3 uppercase tracking-widest">Box 3</h2>
            <div className="space-y-3">
              <NumInput label="Heffingsvrij vermogen" value={heffingsvrij} onChange={setHeffingsvrij} prefix="€" step={1000} hint="2025: €57.000 p.p." />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Belastingstelsel</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {['forfaitair', 'reeel'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setBox3System(s)}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        box3System === s
                          ? 'bg-yellow-500 text-gray-900'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {s === 'forfaitair' ? 'Forfaitair' : 'Reëel'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600">
                  {box3System === 'forfaitair'
                    ? 'Huidig stelsel · 6% × 36% = 2,16% eff.'
                    : `Nieuw stelsel · ${annualReturn.toString().replace('.', ',')}% × 36% = ${(annualReturn * 0.36).toFixed(2).replace('.', ',')}% eff.`}
                </p>
              </div>
            </div>
          </div>

          {/* Hypotheek */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <h2 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-widest">Hypotheek</h2>
            <div className="space-y-3">
              <NumInput label="Gewenste hypotheek" value={mortgageWish} onChange={setMortgageWish} prefix="€" step={10000} />
              <NumInput label="Hypotheekrente" value={mortgageRate} onChange={setMortgageRate} suffix="%" step={0.1} hint="Standaard 4,0%" />
              <NumInput
                label="Weging DUO op hypotheek"
                value={mortgageWeging}
                onChange={setMortgageWeging}
                suffix="%"
                step={0.01}
                max={2}
                hint="0,75% = standaard (NHG)"
              />
            </div>
          </div>
        </div>

        {/* ── Horizon slider ── */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400 font-medium">Tijdshorizon</span>
            <span className="text-white font-bold text-lg">{horizon} jaar</span>
          </div>
          <input
            type="range" min={1} max={35} value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#3b82f6' }}
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>1 jaar</span><span>35 jaar</span>
          </div>
        </div>

        {/* ── Summary card ── */}
        {last && (
          <div className={`rounded-2xl p-5 mb-5 border ${
            winner === 'A'
              ? 'bg-blue-950/60 border-blue-800'
              : 'bg-green-950/60 border-green-800'
          }`}>
            <div className="flex flex-wrap gap-6 items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Winnend scenario na {horizon} jaar</p>
                <p className={`text-2xl font-bold ${winner === 'A' ? 'text-blue-400' : 'text-green-400'}`}>
                  Scenario {winner} — {winner === 'A' ? 'Alles beleggen' : 'DUO aflossen'}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  <span className="font-semibold text-white">{fmtEur(diff)}</span> meer netto vermogen ({showReal ? 'reëel' : 'nominaal'})
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  Min. DUO-maandlast (annuïteit): <span className="text-gray-300">{fmtEur(min_duo_payment)}/mnd</span>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {[
                  { label: 'Netto vermogen A', val: showReal ? last.a_net_real : last.a_net_nom, color: 'text-blue-400' },
                  { label: 'Netto vermogen B', val: showReal ? last.b_net_real : last.b_net_nom, color: 'text-green-400' },
                  { label: 'DUO vrij (A)', val: a_paid_year ? `Jaar ${a_paid_year}` : `>${horizon}jr`, color: 'text-gray-200', raw: true },
                  { label: 'DUO vrij (B)', val: b_paid_year ? `Jaar ${b_paid_year}` : `>${horizon}jr`, color: 'text-gray-200', raw: true },
                ].map(({ label, val, color, raw }) => (
                  <div key={label} className="bg-gray-900/50 rounded-xl p-3 min-w-[110px]">
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <p className={`font-bold text-base ${color}`}>{raw ? val : fmtEur(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Nominal/Real toggle ── */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Weergave:</span>
          {[
            { key: false, label: 'Nominaal' },
            { key: true, label: `Reëel (−${inflation.toString().replace('.', ',')}% inflatie/jr)` },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => setShowReal(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showReal === key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800">
          <div className="flex border-b border-gray-800 overflow-x-auto">
            {tabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setActiveTab(i)}
                className={`flex-1 py-3 px-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === i
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── Tab 0: Grafiek ── */}
            {activeTab === 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-4">
                  Netto vermogen = portefeuille − DUO-restschuld · {showReal ? 'Reëel (gecorrigeerd voor inflatie)' : 'Nominaal'}
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }}
                      label={{ value: 'Jaar', position: 'insideBottomRight', offset: -5, fill: '#6b7280', fontSize: 11 }} />
                    <YAxis stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickFormatter={fmtEurK} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px', paddingTop: '8px' }} />
                    <Line type="monotone"
                      dataKey={showReal ? 'a_net_real' : 'a_net_nom'}
                      name="Scenario A — Beleggen"
                      stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone"
                      dataKey={showReal ? 'b_net_real' : 'b_net_nom'}
                      name="Scenario B — DUO aflossen"
                      stroke="#22c55e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wide">Scenario A — Portefeuille & DUO</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }} />
                        <YAxis stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={fmtEurK} width={60} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="a_portfolio" name="Portefeuille A" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="a_duo" name="DUO-schuld A" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide">Scenario B — Portefeuille & DUO</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }} />
                        <YAxis stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={fmtEurK} width={60} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="b_portfolio" name="Portefeuille B" stroke="#4ade80" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="b_duo" name="DUO-schuld B" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 1: Hypotheek ── */}
            {activeTab === 1 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Vuistregel: restschuld × {mortgageWeging.toString().replace('.', ',')}% = maandlast → maandlast × 110 = hypotheekvermindering
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Bij {fmtEur(rows[0]?.a_duo)} schuld: {fmtEur(rows[0]?.a_duo * (mortgageWeging / 100))}/mnd maandlast → {fmtEur(rows[0]?.a_hyp_impact)} minder hypotheekruimte
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={fmtEurK} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="a_hyp_impact" name="Hypotheekvermindering A" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="b_hyp_impact" name="Hypotheekvermindering B" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      label: 'Scenario A', color: 'blue', paid: a_paid_year,
                      now: rows[0]?.a_hyp_impact, final: last?.a_hyp_impact,
                    },
                    {
                      label: 'Scenario B', color: 'green', paid: b_paid_year,
                      now: rows[0]?.b_hyp_impact, final: last?.b_hyp_impact,
                    },
                  ].map(({ label, color, paid, now, final }) => (
                    <div key={label} className={`bg-${color}-950/50 border border-${color}-900 rounded-xl p-4`}>
                      <p className={`text-${color}-400 text-xs font-semibold uppercase mb-2`}>{label}</p>
                      <p className="text-gray-300 text-sm">
                        DUO-vrij: <span className="text-white font-bold">
                          {paid ? `Jaar ${paid}` : `Na ${horizon} jaar`}
                        </span>
                      </p>
                      <p className="text-gray-400 text-xs mt-1">Nu: {fmtEur(now)} minder hypotheekruimte</p>
                      <p className="text-gray-400 text-xs">Na {horizon} jaar: {fmtEur(final)} minder</p>
                    </div>
                  ))}
                </div>

                {last && (
                  <div className="mt-4 bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Verschil hypotheekruimte A vs. B na {horizon} jaar</p>
                    <p className="text-white font-bold text-lg">
                      {fmtEur(Math.abs(last.a_hyp_impact - last.b_hyp_impact))} {last.b_hyp_impact < last.a_hyp_impact ? '(B heeft meer ruimte)' : '(A heeft meer ruimte)'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 2: Box 3 ── */}
            {activeTab === 2 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Stelsel: <span className="text-yellow-400">{box3System === 'forfaitair' ? 'Forfaitair (2026–2027)' : 'Reëel (vanaf 2028)'}</span>
                  {' · '}Effectief tarief: {box3EffRate}
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Heffingsvrij: {fmtEur(heffingsvrij)} · In scenario B wordt surplus boven heffingsvrij naar DUO gestuurd → weinig/geen box 3
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={fmtEurK} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px', paddingTop: '8px' }} />
                    <Bar dataKey="a_box3" name="Box 3 belasting A" fill="#3b82f6" opacity={0.85} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="b_box3" name="Box 3 belasting B" fill="#22c55e" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-blue-400 text-xs font-semibold uppercase mb-1">Totaal belasting A</p>
                    <p className="text-white font-bold text-lg">{fmtEur(totalA_box3)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-green-400 text-xs font-semibold uppercase mb-1">Totaal belasting B</p>
                    <p className="text-white font-bold text-lg">{fmtEur(totalB_box3)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-yellow-400 text-xs font-semibold uppercase mb-1">Belastingvoordeel B</p>
                    <p className="text-white font-bold text-lg">{fmtEur(Math.max(0, totalA_box3 - totalB_box3))}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {totalA_box3 > totalB_box3 ? 'B betaalt minder box 3' : 'A betaalt minder box 3'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 3: Jaar-overzicht ── */}
            {activeTab === 3 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">
                    Alle bedragen {showReal ? 'reëel (koopkrachtequivalent huidig)' : 'nominaal'}
                  </p>
                  <button
                    onClick={() => setTableExpanded(!tableExpanded)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {tableExpanded ? '▲ Inklappen' : `▼ Toon alle ${rows.length} jaar`}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-xs border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="text-left py-2.5 px-3 text-gray-400 font-medium border-b border-gray-700" rowSpan={2}>Jaar</th>
                        <th className="text-center py-2 px-2 text-blue-400 font-semibold border-b border-gray-700 border-r border-gray-700" colSpan={5}>Scenario A — Beleggen</th>
                        <th className="text-center py-2 px-2 text-green-400 font-semibold border-b border-gray-700" colSpan={5}>Scenario B — DUO aflossen</th>
                      </tr>
                      <tr className="bg-gray-800/60">
                        {['Portfolio', 'DUO-schuld', 'Box 3', 'Netto', 'Hyp.verlies'].map((h) => (
                          <th key={'a' + h} className={`text-right py-2 px-3 text-gray-500 font-normal ${h === 'Hyp.verlies' ? 'border-r border-gray-700' : ''}`}>{h}</th>
                        ))}
                        {['Portfolio', 'DUO-schuld', 'Box 3', 'Netto', 'Hyp.verlies'].map((h) => (
                          <th key={'b' + h} className="text-right py-2 px-3 text-gray-500 font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(tableExpanded ? rows : rows.slice(0, 5)).map((d, idx) => (
                        <tr key={d.year} className={`border-b border-gray-800/70 hover:bg-gray-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-900/30'}`}>
                          <td className="py-2 px-3 text-gray-400 font-medium">{d.year}</td>
                          <td className="text-right py-2 px-3 text-blue-300">{fmtEur(d.a_portfolio)}</td>
                          <td className="text-right py-2 px-3 text-red-400">{d.a_duo > 0 ? fmtEur(d.a_duo) : <span className="text-green-500">✓ vrij</span>}</td>
                          <td className="text-right py-2 px-3 text-yellow-500">{fmtEur(d.a_box3)}</td>
                          <td className="text-right py-2 px-3 text-white font-semibold">{fmtEur(showReal ? d.a_net_real : d.a_net_nom)}</td>
                          <td className="text-right py-2 px-3 text-purple-400 border-r border-gray-700">{fmtEur(d.a_hyp_impact)}</td>
                          <td className="text-right py-2 px-3 text-green-300">{fmtEur(d.b_portfolio)}</td>
                          <td className="text-right py-2 px-3 text-red-400">{d.b_duo > 0 ? fmtEur(d.b_duo) : <span className="text-green-500">✓ vrij</span>}</td>
                          <td className="text-right py-2 px-3 text-yellow-500">{fmtEur(d.b_box3)}</td>
                          <td className="text-right py-2 px-3 text-white font-semibold">{fmtEur(showReal ? d.b_net_real : d.b_net_nom)}</td>
                          <td className="text-right py-2 px-3 text-purple-400">{fmtEur(d.b_hyp_impact)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!tableExpanded && rows.length > 5 && (
                  <p className="text-center text-gray-600 text-xs mt-2">
                    {rows.length - 5} jaar verborgen ·{' '}
                    <button onClick={() => setTableExpanded(true)} className="text-blue-400 hover:underline">
                      Alles tonen
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-gray-700 mt-5">
          Indicatieve berekening — geen financieel advies · DUO-maandlast (annuïteit): {fmtEur(min_duo_payment)}/mnd ·
          Box 3 forfaitair = 6% rendement × 36% = 2,16% eff. over vermogen boven {fmtEur(heffingsvrij)}
        </p>
      </div>
    </div>
  );
}
