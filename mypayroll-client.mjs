/**
 * MyPayroll Statutory Doctor — Browser-Local Audit & Statutory Repair Module
 * Runs 100% locally in browser RAM to preview statutory fixes & calculations.
 * Official fixed-width & portal compilers (KWSP i-Akaun CSV, PERKESO ASSIST 244-byte TXT,
 * LHDN e-Data PCB CP39 57/136-byte TXT, DuitNow Bulk Salary CSV) execute statelessly in Hyperfetch Cloud.
 */

export const MALAYSIAN_BANK_BICS = {
  MAYBANK: 'MBBEMYKL',
  MBB: 'MBBEMYKL',
  MAE: 'MBBEMYKL',
  'MAYBANK ISLAMIC': 'MBISMYKL',
  CIMB: 'CIBBMYKL',
  'CIMB ISLAMIC': 'CTBBMYKL',
  'PUBLIC BANK': 'PBBEMYKL',
  PBB: 'PBBEMYKL',
  RHB: 'RHBBMYKL',
  'HONG LEONG': 'HLBBMYKL',
  HLB: 'HLBBMYKL',
  AMBANK: 'ARBKMYKL',
  'BANK ISLAM': 'BIMBMYKL',
  BIMB: 'BIMBMYKL',
  GXBANK: 'GXSPMYKL',
  UOB: 'UOVBMYKL',
  OCBC: 'OCBCMYKL',
  HSBC: 'HBMBMYKL',
  SCB: 'SCBLMYKX',
  'STANDARD CHARTERED': 'SCBLMYKX',
  BSN: 'BSNAMYK1',
  AFFIN: 'PHBMMYKL',
  ALLIANCE: 'MFBBMYKL',
  MUAMALAT: 'BMMBMYKL',
  'AGRO BANK': 'AGOBMYKL',
  WISE: 'CHASMYKX',
};

export function parseCsv(rawText) {
  const clean = String(rawText || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };

  const firstLine = clean.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delim = tabCount > commaCount ? '\t' : (semiCount > commaCount ? ';' : ',');

  const lines = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      if (cur.trim() !== '') lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') lines.push(cur);
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitRow(line) {
    const out = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          q = !q;
        }
      } else if (c === delim && !q) {
        out.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    out.push(cell.trim());
    return out;
  }

  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map((ln) => {
    const vals = splitRow(ln);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    return obj;
  });
  return { headers, rows };
}

function pickField(row, patterns) {
  const keys = Object.keys(row);
  for (const pat of patterns) {
    const hit = keys.find((k) => pat.test(k.trim()));
    if (hit !== undefined && String(row[hit]).trim() !== '') return String(row[hit]).trim();
  }
  for (const pat of patterns) {
    const hit = keys.find((k) => pat.test(k.trim()));
    if (hit !== undefined) return String(row[hit]).trim();
  }
  return '';
}

function parseMoney(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function isValidMyKadDate(sixDigits) {
  if (!/^\d{6}$/.test(sixDigits)) return false;
  const mm = Number(sixDigits.slice(2, 4));
  const dd = Number(sixDigits.slice(4, 6));
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

function computeAgeFromMyKad(nric12, salaryYear, salaryMonth) {
  if (!/^\d{12}$/.test(nric12)) return null;
  const yy = Number(nric12.slice(0, 2));
  const mm = Number(nric12.slice(2, 4));
  if (mm < 1 || mm > 12) return null;
  const currentYY = salaryYear % 100;
  const birthYear = yy <= currentYY - 14 ? 2000 + yy : 1900 + yy;
  let age = salaryYear - birthYear;
  if (salaryMonth < mm) age -= 1;
  return age >= 14 && age <= 95 ? age : null;
}

/**
 * Official KWSP Third Schedule step calculator (Local Citizens/PRs vs 2% Foreign Workers)
 */
export function calcStatutoryKwsp(wages, isForeign, age) {
  if (!wages || wages <= 10) return { employer: 0, employee: 0 };
  if (age !== null && age >= 75) return { employer: 0, employee: 0 };

  //Wage step ceiling per KWSP Third Schedule (RM 20 steps up to RM 5,000; RM 100 steps above RM 5,000; exact <= 20k)
  let stepWage = wages;
  if (wages <= 5000) {
    stepWage = Math.ceil(wages / 20) * 20;
  } else if (wages <= 20000) {
    stepWage = Math.ceil(wages / 100) * 100;
  }

  // Mandatory 2% Employer + 2% Employee for Foreign Workers (Oct 2025+ KWSP Act Mandate)
  if (isForeign) {
    return {
      employer: Math.ceil(stepWage * 0.02),
      employee: Math.ceil(stepWage * 0.02),
    };
  }

  // Senior Citizens (Age 60–74 Malaysian Citizen): 4% Employer, 0% Employee statutory minimum
  if (age !== null && age >= 60) {
    return {
      employer: Math.ceil(stepWage * 0.04),
      employee: 0,
    };
  }

  const empRate = 0.11;
  const erRate = wages <= 5000 ? 0.13 : 0.12;
  return {
    employer: Math.ceil(stepWage * erRate),
    employee: Math.ceil(stepWage * empRate),
  };
}

/**
 * Official PERKESO Act 4 (SOCSO) & Act 800 (EIS) RM 6,000 Wage-Band Schedule
 */
export function calcStatutoryPerkeso(wages, category, isForeign, age) {
  if (!wages || wages <= 0) {
    return { socsoEr: 0, socsoEe: 0, eisEr: 0, eisEe: 0 };
  }

  // Capped at RM 6,000 statutory insurable monthly wage ceiling
  if (wages > 5900) {
    const isCat2 = category === 'CAT2' || isForeign || (age !== null && age >= 60);
    const eisExempt = isForeign || (age !== null && (age >= 60 || age < 18));
    return {
      socsoEr: isCat2 ? 74.40 : 104.65,
      socsoEe: isCat2 ? 0.00 : 29.90,
      eisEr: eisExempt ? 0.00 : 11.90,
      eisEe: eisExempt ? 0.00 : 11.90,
    };
  }

  let midpoint = 25;
  if (wages <= 30) midpoint = 20;
  else if (wages <= 50) midpoint = 40;
  else if (wages <= 70) midpoint = 60;
  else if (wages <= 100) midpoint = 85;
  else if (wages <= 140) midpoint = 120;
  else if (wages <= 200) midpoint = 170;
  else {
    const bandFloor = Math.floor((wages - 0.001) / 100) * 100;
    midpoint = bandFloor + 50;
  }

  const isCat2 = category === 'CAT2' || isForeign || (age !== null && age >= 60);
  const eisExempt = isForeign || (age !== null && (age >= 60 || age < 18));

  const round5Sen = (n) => Number((Math.round(n * 20) / 20).toFixed(2));
  const socsoEr = isCat2 ? round5Sen(midpoint * 0.0125) : round5Sen(midpoint * 0.0175);
  const socsoEe = isCat2 ? 0.00 : round5Sen(midpoint * 0.005);
  const eisAmt = eisExempt ? 0.00 : Number((midpoint * 0.002).toFixed(2));

  return {
    socsoEr,
    socsoEe,
    eisEr: eisAmt,
    eisEe: eisAmt,
  };
}

export function getContributionPeriod(salaryYm) {
  const m = String(salaryYm || '2026-10').match(/^(\d{4})-(\d{2})$/);
  const sYear = m ? Number(m[1]) : 2026;
  const sMonth = m ? Number(m[2]) : 10;
  let cYear = sYear;
  let cMonth = sMonth + 1;
  if (cMonth > 12) {
    cMonth = 1;
    cYear += 1;
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  return {
    salaryYear: sYear,
    salaryMonth: sMonth,
    salaryMMYYYY: `${pad2(sMonth)}${sYear}`,
    kwspYear: cYear,
    kwspMonth: cMonth,
    kwspMMYYYY: `${pad2(cMonth)}/${cYear}`,
  };
}

export function diagnoseAndRepairPayroll(rawRows, employerConfig = {}) {
  const period = getContributionPeriod(employerConfig.salaryMonth || '2026-10');
  const diagnostics = {
    totalEmployees: 0,
    leadingZeroFixes: 0,
    foreignWorkerEpfs: 0,
    cat2SeniorOrForeignRoutes: 0,
    pcbTinNormalizations: 0,
    bankBicMappings: 0,
    totals: {
      grossWages: 0,
      kwspTotal: 0,
      perkesoTotal: 0,
      pcbTotal: 0,
      netSalaryTotal: 0,
    },
  };

  const normalizedEmployees = [];

  rawRows.forEach((raw, idx) => {
    const rawName = pickField(raw, [/^(employee\s*)?name$/i, /nama/i, /staff\s*name/i]);
    const rawWages = parseMoney(pickField(raw, [/^(basic|gross|monthly)?\s*(wages?|salary|pay)$/i, /gaji/i]));
    if (!rawName && !rawWages) return;

    const repairs = [];
    const staffId = pickField(raw, [/^(staff|emp(loyee)?)\s*(id|no|code)$/i, /^id$/i]) || `EMP${String(idx + 1).padStart(3, '0')}`;
    const rawId = pickField(raw, [/^(nric|ic|mykad|id\s*no|identification)/i]);
    const rawPassport = pickField(raw, [/passport/i, /ssfw/i, /foreign\s*id/i]);
    const rawCountry = pickField(raw, [/country|nationality|citizen/i]).toUpperCase();
    const rawKwspNo = pickField(raw, [/^(kwsp|epf)\s*(no|id|member)?$/i]);
    const rawTaxTin = pickField(raw, [/^(lhdn|tax|pcb|ig)?\s*(tin|no|file)$/i, /^tin$/i]);
    const rawBank = pickField(raw, [/^(bank\s*name|bank\s*code|bank\s*bic)?$/i]);
    const rawBankAcct = pickField(raw, [/^(bank\s*)?(acc(ount)?|acct)\s*(no|number)?$/i]);

    const cleanName = (rawName || `EMPLOYEE ${idx + 1}`).replace(/[^A-Za-z0-9 '/.\-@()]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

    // Detect Local vs Foreign Worker
    let digitsId = rawId.replace(/[^0-9]/g, '');
    const alphaInId = /[A-Za-z]/.test(rawId);
    const isExplicitForeign =
      (rawCountry && !['MY', 'MYS', 'MALAYSIA', 'LOCAL', 'CITIZEN'].includes(rawCountry)) ||
      (Boolean(rawPassport) && !digitsId) ||
      (alphaInId && rawId.length >= 6);

    let finalNric = '';
    let finalPassport = rawPassport.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!isExplicitForeign) {
      // Repair stripped leading zeros on Malaysian 12-digit MyKad (e.g. 010203-14-5678 saved by Excel as 10203145678)
      if (digitsId.length >= 9 && digitsId.length < 12) {
        const padded = digitsId.padStart(12, '0');
        if (isValidMyKadDate(padded.slice(0, 6))) {
          repairs.push({ field: 'nric', from: rawId, to: padded, reason: 'Restored Excel-stripped leading zero on 12-digit MyKad' });
          digitsId = padded;
          diagnostics.leadingZeroFixes++;
        }
      } else if (rawId.includes('-') && digitsId.length === 12) {
        repairs.push({ field: 'nric', from: rawId, to: digitsId, reason: 'Stripped hyphens for KWSP/PERKESO/CP39 schema' });
        diagnostics.leadingZeroFixes++;
      }
      finalNric = digitsId;
    } else if (!finalPassport && rawId) {
      finalPassport = rawId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }

    const isForeign = isExplicitForeign || (!finalNric && Boolean(finalPassport));
    const countryCode = isForeign ? ((rawCountry.slice(0, 2) && rawCountry.slice(0, 2) !== 'FO') ? rawCountry.slice(0, 2) : 'BD') : '';
    const age = finalNric ? computeAgeFromMyKad(finalNric, period.salaryYear, period.salaryMonth) : null;
    const rawAgeCol = Number(pickField(raw, [/^age$/i, /umur/i])) || null;
    const effectiveAge = age !== null ? age : rawAgeCol;

    const wages = rawWages !== null ? Math.max(0, rawWages) : 0;

    // KWSP Calculation / Repair (including Oct 2025+ Mandatory 2% Foreign Worker Rule!)
    const rawEpfEr = parseMoney(pickField(raw, [/^(epf|kwsp)[\s_]*(er|employer)$/i]));
    const rawEpfEe = parseMoney(pickField(raw, [/^(epf|kwsp)[\s_]*(ee|employee)$/i]));
    const autoKwsp = calcStatutoryKwsp(wages, isForeign, effectiveAge);

    let epfEr = rawEpfEr !== null ? rawEpfEr : autoKwsp.employer;
    let epfEe = rawEpfEe !== null ? rawEpfEe : autoKwsp.employee;

    if (isForeign && (rawEpfEr === null || rawEpfEr === 0 || rawEpfEe === null || rawEpfEe > wages * 0.05)) {
      epfEr = autoKwsp.employer;
      epfEe = autoKwsp.employee;
      repairs.push({
        field: 'kwsp',
        from: rawEpfEr !== null ? `${rawEpfEr}/${rawEpfEe}` : 'blank',
        to: `${epfEr.toFixed(2)}/${epfEe.toFixed(2)} (2%)`,
        reason: 'Applied mandatory 2% Foreign Worker KWSP rate',
      });
      diagnostics.foreignWorkerEpfs++;
    } else if (rawEpfEr === null || rawEpfEe === null) {
      repairs.push({
        field: 'kwsp',
        from: 'blank',
        to: `${epfEr.toFixed(2)}/${epfEe.toFixed(2)}`,
        reason: 'Auto-calculated KWSP Third Schedule',
      });
    }

    let cleanKwspNo = rawKwspNo.replace(/[^0-9]/g, '');
    if (cleanKwspNo && cleanKwspNo.length < 8) {
      const paddedKwsp = cleanKwspNo.padStart(8, '0');
      repairs.push({ field: 'kwspNo', from: rawKwspNo, to: paddedKwsp, reason: 'Restored leading zero on KWSP Member No.' });
      cleanKwspNo = paddedKwsp;
      diagnostics.leadingZeroFixes++;
    }

    // PERKESO SOCSO + EIS (RM 6,000 ceiling + Cat 1 vs Cat 2 + Foreign/60+ EIS Exemption)
    const shouldBeCat2 = isForeign || (effectiveAge !== null && effectiveAge >= 60);
    const perkesoCategory = shouldBeCat2 ? 'CAT2' : 'CAT1';
    const autoPerkeso = calcStatutoryPerkeso(wages, perkesoCategory, isForeign, effectiveAge);

    const rawSocsoEr = parseMoney(pickField(raw, [/^socso[\s_]*(er|employer)$/i, /^perkeso[\s_]*er$/i]));
    const rawSocsoEe = parseMoney(pickField(raw, [/^socso[\s_]*(ee|employee)$/i, /^perkeso[\s_]*ee$/i]));
    const rawEisEr = parseMoney(pickField(raw, [/^(eis|sip)[\s_]*(er|employer)$/i]));
    const rawEisEe = parseMoney(pickField(raw, [/^(eis|sip)[\s_]*(ee|employee)$/i]));

    let socsoEr = rawSocsoEr !== null ? rawSocsoEr : autoPerkeso.socsoEr;
    let socsoEe = rawSocsoEe !== null ? rawSocsoEe : autoPerkeso.socsoEe;
    let eisEr = rawEisEr !== null ? rawEisEr : autoPerkeso.eisEr;
    let eisEe = rawEisEe !== null ? rawEisEe : autoPerkeso.eisEe;

    if (shouldBeCat2 && (socsoEe > 0 || eisEr > 0 || eisEe > 0 || rawSocsoEr === null)) {
      socsoEr = autoPerkeso.socsoEr;
      socsoEe = 0;
      eisEr = 0;
      eisEe = 0;
      repairs.push({
        field: 'perkeso',
        from: rawEisEe ? `Cat1+EIS(${rawEisEe})` : 'auto',
        to: `Cat2(${socsoEr.toFixed(2)}) · EIS 0.00`,
        reason: isForeign ? 'Foreign worker: Injury-only Cat 2 & EIS exempt' : 'Age 60+: Cat 2 & EIS exempt',
      });
      diagnostics.cat2SeniorOrForeignRoutes++;
    } else if (rawSocsoEr === null || rawEisEr === null) {
      repairs.push({
        field: 'perkeso',
        from: 'blank',
        to: `SOCSO ${socsoEr.toFixed(2)}/${socsoEe.toFixed(2)} · EIS ${eisEr.toFixed(2)}`,
        reason: 'Calculated RM 6,000 Act 4/800 wage-band schedule',
      });
    }

    // LHDN PCB / CP39 TIN Normalization (strip IG/SG/OG prefix to 10-digit numeric)
    const pcbMtd = parseMoney(pickField(raw, [/^(pcb|mtd|monthly\s*tax)$/i])) || 0;
    const cp38Amt = parseMoney(pickField(raw, [/^cp38$/i])) || 0;
    let cleanTinDigits = rawTaxTin.replace(/^(IG|SG|OG)/i, '').replace(/[^0-9]/g, '');
    if (rawTaxTin && cleanTinDigits !== rawTaxTin) {
      repairs.push({
        field: 'taxTin',
        from: rawTaxTin,
        to: cleanTinDigits.padStart(10, '0'),
        reason: 'Stripped IG/SG prefix & zero-padded to 10-digit CP39 spec',
      });
      diagnostics.pcbTinNormalizations++;
    }

    // Bank BIC Resolution & Net Salary Calculation
    const upperBank = rawBank.toUpperCase().trim();
    const resolvedBic = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(upperBank)
      ? upperBank.slice(0, 8)
      : (MALAYSIAN_BANK_BICS[upperBank] || 'MBBEMYKL');
    if (rawBank && resolvedBic !== upperBank) {
      repairs.push({ field: 'bankBic', from: rawBank, to: resolvedBic, reason: 'Mapped bank name to 8-char SWIFT/DuitNow BIC' });
      diagnostics.bankBicMappings++;
    }
    const cleanBankAcct = rawBankAcct.replace(/[^0-9]/g, '');

    const totalEmployeeDeductions = Number((epfEe + socsoEe + eisEe + pcbMtd + cp38Amt).toFixed(2));
    const netPay = Number(Math.max(0, wages - totalEmployeeDeductions).toFixed(2));

    diagnostics.totalEmployees++;
    diagnostics.totals.grossWages = Number((diagnostics.totals.grossWages + wages).toFixed(2));
    diagnostics.totals.kwspTotal = Number((diagnostics.totals.kwspTotal + epfEr + epfEe).toFixed(2));
    diagnostics.totals.perkesoTotal = Number((diagnostics.totals.perkesoTotal + socsoEr + socsoEe + eisEr + eisEe).toFixed(2));
    diagnostics.totals.pcbTotal = Number((diagnostics.totals.pcbTotal + pcbMtd + cp38Amt).toFixed(2));
    diagnostics.totals.netSalaryTotal = Number((diagnostics.totals.netSalaryTotal + netPay).toFixed(2));

    normalizedEmployees.push({
      rowIndex: normalizedEmployees.length + 1,
      staffId,
      name: cleanName,
      isForeign,
      countryCode,
      age: effectiveAge,
      nric: finalNric,
      passport: finalPassport,
      kwspNo: cleanKwspNo || '00000000',
      taxTinDigits: cleanTinDigits ? cleanTinDigits.slice(-10).padStart(10, '0') : '0000000000',
      wages,
      epfEr,
      epfEe,
      perkesoCategory,
      socsoEr,
      socsoEe,
      eisEr,
      eisEe,
      pcbMtd,
      cp38Amt,
      bankBic: resolvedBic,
      bankAcct: cleanBankAcct,
      netPay,
      repairs,
      rawOriginal: {
        id: rawId || rawPassport,
        kwsp: rawEpfEr !== null ? `${rawEpfEr}/${rawEpfEe}` : '',
        perkeso: rawSocsoEr !== null ? `${rawSocsoEr}/${rawSocsoEe}` : '',
        taxTin: rawTaxTin,
        bank: rawBank,
      },
    });
  });

  return {
    employer: {
      companyName: String(employerConfig.companyName || 'HYPERFETCH DEMO SDN BHD').trim().toUpperCase(),
      ssmNo: String(employerConfig.ssmNo || '202401012345').trim().toUpperCase(),
      kwspEmployerNo: String(employerConfig.kwspEmployerNo || '012345678').replace(/[^0-9]/g, ''),
      perkesoCode: String(employerConfig.perkesoCode || 'E1100012345Z').trim().toUpperCase(),
      lhdnEmployerNo: String(employerConfig.lhdnEmployerNo || 'E9089151000').replace(/[^0-9]/g, ''),
      period,
    },
    employees: normalizedEmployees,
    diagnostics,
  };
}

/**
 * Sample fixed-width preview snippet for UI inspector (first 2 rows only)
 */
export function buildFixedWidthPreviewSnippet(audit) {
  if (!audit || !audit.employees.length) return '';
  const emp = audit.employer;
  const p = emp.period;
  const sample = audit.employees.slice(0, 2);

  const cents = (v, len) => String(Math.round(Number(v || 0) * 100)).padStart(len, '0');
  const rpad = (s, len) => String(s || '').slice(0, len).padEnd(len, ' ');

  const perkesoLines = sample.map((e) =>
    rpad(emp.perkesoCode, 12) +
    rpad(emp.ssmNo, 20) +
    rpad(e.nric || e.passport, 12) +
    rpad(e.name, 42) + '…[150 chars]…' +
    p.salaryMMYYYY +
    cents(e.wages, 14) +
    cents(e.socsoEr, 6) +
    cents(e.socsoEe, 6) +
    cents(e.eisEr, 6) +
    cents(e.eisEe, 6) +
    '000000'
  );

  const lhdnE = String(emp.lhdnEmployerNo || '').slice(-10).padStart(10, '0');
  const mtdRows = sample.filter((e) => e.pcbMtd > 0 || e.cp38Amt > 0);
  const cpHeader =
    'H' + lhdnE + lhdnE + String(p.salaryYear) + String(p.salaryMonth).padStart(2, '0') +
    cents(mtdRows.reduce((s, x) => s + x.pcbMtd, 0), 10) +
    String(mtdRows.length).padStart(5, '0') +
    cents(mtdRows.reduce((s, x) => s + x.cp38Amt, 0), 10) +
    String(mtdRows.filter((x) => x.cp38Amt > 0).length).padStart(5, '0');

  return [
    `=== 1. KWSP i-Akaun Contribution Period: ${p.kwspMMYYYY} (Wage Month ${p.salaryMMYYYY} + 1 Month) ===`,
    ...sample.map((e) => `${e.kwspNo},${e.nric || e.passport},${e.name},${e.wages.toFixed(2)},${e.epfEr.toFixed(2)},${e.epfEe.toFixed(2)}`),
    '',
    `=== 2. PERKESO ASSIST Combined 244-Byte Fixed-Width (.TXT) Preview ===`,
    ...perkesoLines,
    '',
    `=== 3. LHDN e-Data PCB / CP39 (57-Byte Header + 136-Byte Detail) Preview ===`,
    cpHeader + `  [57 bytes]`,
    ...(mtdRows.length ? mtdRows : sample.slice(0, 1)).map((e) =>
      'D' + e.taxTinDigits + '0' + rpad(e.name, 28) + '…[60 chars]…' + rpad('', 12) + rpad(e.nric, 12) + rpad(e.passport, 12) + rpad(e.countryCode, 2) + cents(e.pcbMtd, 8) + cents(e.cp38Amt, 8) + rpad(e.staffId, 10)
    ),
  ].join('\n');
    }
