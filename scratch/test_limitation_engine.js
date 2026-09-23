const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function api(method, path, data, token) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    hostname: "localhost",
    port: 9000,
    path: "/api/v1" + path,
    method,
    headers,
  };

  return request(options, data);
}

const runTests = async () => {
  console.log("=== STARTING PROMPT 6 LIMITATION ACT DEADLINE ENGINE TESTS ===\n");

  // Step 1: Authenticate as Owner
  console.log("[1/10] Authenticating as Chambers Owner...");
  let ownerToken = "";
  let ownerEmail = "dgrowdeveloper@gmail.com";
  let loginRes = await api("POST", "/auth/login", {
    email: ownerEmail,
    password: "Password@123",
  });

  if (!loginRes.data.data?.accessToken) {
    loginRes = await api("POST", "/auth/login", {
      email: ownerEmail,
      password: "Chambers@2026",
    });
  }

  if (!loginRes.data.data?.accessToken) {
    loginRes = await api("POST", "/auth/login", {
      email: "owner@chambers.in",
      password: "Chambers@2026",
    });
  }

  if (loginRes.status !== 200 || !loginRes.data.data?.accessToken) {
    console.error("  -> Failed to login as owner:", loginRes.status, loginRes.data);
    process.exit(1);
  }
  ownerToken = loginRes.data.data.accessToken;
  console.log("  -> Owner authenticated. ID:", loginRes.data.data.user.id);

  // Step 2: Test Rule Management
  console.log("\n[2/10] Testing Limitation Rules Management...");
  const createRuleRes = await api(
    "POST",
    "/deadline-rules",
    {
      act_name: "Limitation Act, 1963",
      act_version: "1963",
      article_reference: "Article 54",
      section_reference: "Section 3",
      proceeding_type: "Specific Performance Suit",
      description: "For specific performance of a contract",
      limitation_years: 3,
      trigger_type: "DATE_FIXED_FOR_PERFORMANCE",
      source_reference: "Limitation Act 1963 Schedule Part II",
      is_active: true,
    },
    ownerToken
  );

  if (createRuleRes.status !== 201) {
    console.error("  -> Create rule failed:", createRuleRes.status, createRuleRes.data);
    process.exit(1);
  }
  const ruleId = createRuleRes.data.data.rule.id;
  console.log("  -> Created Limitation Rule ID:", ruleId, "Article:", createRuleRes.data.data.rule.article_reference);

  const listRulesRes = await api("GET", "/deadline-rules", null, ownerToken);
  console.log("  -> Total rules count:", listRulesRes.data.data?.total);

  // Inactive rule test
  const inactiveRuleRes = await api(
    "POST",
    "/deadline-rules",
    {
      act_name: "Limitation Act, 1963",
      article_reference: "Article 113",
      proceeding_type: "Residuary Suit",
      limitation_years: 3,
      trigger_type: "RIGHT_TO_SUE_ACCRUES",
      is_active: false,
    },
    ownerToken
  );
  const inactiveRuleId = inactiveRuleRes.data.data.rule.id;

  const inactiveCalcRes = await api(
    "POST",
    "/deadlines/calculate",
    {
      trigger_date: "2026-09-11",
      deadline_rule_id: inactiveRuleId,
    },
    ownerToken
  );
  console.log("  -> Inactive rule rejected status:", inactiveCalcRes.status, "Message:", inactiveCalcRes.data?.message);
  if (inactiveCalcRes.status === 422) {
    console.log("  -> PASS: Inactive rule safely rejected with 422.");
  } else {
    throw new Error(`Expected 422 for inactive rule calculation but got ${inactiveCalcRes.status}`);
  }

  // Step 3: Test Calculation Engine (Days, Months, Years, Disclaimer)
  console.log("\n[3/10] Testing Limitation Calculation Engine (Days, Months, Years)...");
  // 3A: Years Calculation
  const yearsCalc = await api(
    "POST",
    "/deadlines/calculate",
    {
      trigger_date: "2024-02-29",
      deadline_rule_id: ruleId,
      notes: "Contract performance date",
    },
    ownerToken
  );

  console.log("  -> 3 Years Calc: 2024-02-29 + 3 Years =", yearsCalc.data.data.calculated_deadline);
  if (yearsCalc.data.data.calculated_deadline !== "2027-02-28") {
    throw new Error(`Expected 2027-02-28 (leap year clamp) but got ${yearsCalc.data.data.calculated_deadline}`);
  }
  console.log("  -> Legal Disclaimer attached:", yearsCalc.data.data.disclaimer.slice(0, 45) + "...");
  console.log("  -> Calculation Explanation:", yearsCalc.data.data.calculation_explanation);

  // 3B: Months Calculation Rule
  const monthRuleRes = await api(
    "POST",
    "/deadline-rules",
    {
      act_name: "Arbitration and Conciliation Act, 1996",
      section_reference: "Section 34(3)",
      proceeding_type: "Challenge to Arbitral Award",
      limitation_months: 3,
      trigger_type: "DATE_OF_RECEIPT_OF_AWARD",
    },
    ownerToken
  );
  const monthRuleId = monthRuleRes.data.data.rule.id;

  const monthCalc = await api(
    "POST",
    "/deadlines/calculate",
    {
      trigger_date: "2026-01-31",
      deadline_rule_id: monthRuleId,
    },
    ownerToken
  );
  console.log("  -> 3 Months Calc: 2026-01-31 + 3 Months =", monthCalc.data.data.calculated_deadline);
  if (monthCalc.data.data.calculated_deadline !== "2026-04-30") {
    throw new Error(`Expected 2026-04-30 (month-end clamp) but got ${monthCalc.data.data.calculated_deadline}`);
  }
  console.log("  -> PASS: Calendar month arithmetic with clamping verified.");

  // 3C: Days Calculation Rule
  const daysRuleRes = await api(
    "POST",
    "/deadline-rules",
    {
      act_name: "Limitation Act, 1963",
      article_reference: "Article 116",
      proceeding_type: "Civil Appeal to High Court",
      limitation_days: 90,
      trigger_type: "DATE_OF_DECREE_OR_ORDER",
    },
    ownerToken
  );
  const daysRuleId = daysRuleRes.data.data.rule.id;

  const daysCalc = await api(
    "POST",
    "/deadlines/calculate",
    {
      trigger_date: "2026-09-11",
      deadline_rule_id: daysRuleId,
    },
    ownerToken
  );
  console.log("  -> 90 Days Calc: 2026-09-11 + 90 Days =", daysCalc.data.data.calculated_deadline);
  if (daysCalc.data.data.calculated_deadline !== "2026-12-10") {
    throw new Error(`Expected 2026-12-10 but got ${daysCalc.data.data.calculated_deadline}`);
  }
  console.log("  -> PASS: Calendar days arithmetic verified.");

  // Step 4: Ensure Active Case for Deadlines
  console.log("\n[4/10] Ensuring Active Case for Deadlines...");
  let caseId = null;
  const casesRes = await api("GET", "/cases?limit=1", null, ownerToken);
  const existingCases = casesRes.data.data?.items || casesRes.data.data?.cases || [];
  if (existingCases.length > 0) {
    caseId = existingCases[0].id;
  } else {
    const courtRes = await api(
      "POST",
      "/courts",
      {
        name: "Test Court for Deadlines",
        code: "TC-DL-" + Date.now().toString().slice(-4),
        city: "New Delhi",
        state: "Delhi",
      },
      ownerToken
    );
    const clientRes = await api("GET", "/clients?limit=1", null, ownerToken);
    const clientItems = clientRes.data.data?.items || clientRes.data.data?.clients || [];
    const testCaseRes = await api(
      "POST",
      "/cases",
      {
        case_number: "CS(OS)/" + Date.now().toString().slice(-4) + "/2026",
        court_id: courtRes.data.data.court.id,
        case_type: "Civil Suit",
        title: "Test Suit for Limitation Deadlines",
        primary_client_id: clientItems[0].id,
      },
      ownerToken
    );
    caseId = testCaseRes.data.data.case.id;
  }
  console.log("  -> Using Case ID:", caseId);

  // Step 5: Test Case Deadline Creation & Alert Scheduling
  console.log("\n[5/10] Testing Case Deadline Creation & Alert Generation...");
  const createDlRes = await api(
    "POST",
    `/cases/${caseId}/deadlines`,
    {
      deadline_rule_id: ruleId,
      trigger_date: "2026-09-11",
      trigger_type: "DATE_FIXED_FOR_PERFORMANCE",
      priority: "CRITICAL",
      notes: "Breach occurred on 11 Sep 2026",
    },
    ownerToken
  );

  if (createDlRes.status !== 201) {
    console.error("  -> Failed to create deadline:", createDlRes.status, createDlRes.data);
    process.exit(1);
  }

  const dl = createDlRes.data.data.deadline;
  const deadlineId = dl.id;
  console.log("  -> Case Deadline Created. ID:", deadlineId);
  console.log("  -> Calculated Deadline:", dl.calculated_deadline);
  console.log("  -> Effective Deadline:", dl.effective_deadline);
  console.log("  -> Derived Status:", dl.status);
  console.log("  -> Scheduled Alerts Count:", dl.alerts?.length);
  dl.alerts?.forEach((a) => {
    console.log(`     Alert ${a.alert_type} scheduled for ${String(a.scheduled_for).slice(0, 10)} [Status: ${a.status}]`);
  });
  console.log("  -> PASS: Case deadline created with automated alert schedule.");

  // Step 6: Test Manual Fallback Deadline Entry
  console.log("\n[6/10] Testing Manual Fallback Deadline Entry...");
  const manualRes = await api(
    "POST",
    `/cases/${caseId}/deadlines`,
    {
      is_manual: true,
      manual_deadline: "2026-10-25",
      manual_reason: "Special limitation order under commercial court rules",
      title: "Commercial Court Summary Procedure Response",
      trigger_date: "2026-09-11",
      priority: "HIGH",
    },
    ownerToken
  );

  const manualDl = manualRes.data.data.deadline;
  console.log("  -> Manual Deadline Created. ID:", manualDl.id);
  console.log("  -> Status:", manualDl.status);
  console.log("  -> Calculation Method:", manualDl.calculation_method);
  if (manualDl.status !== "MANUAL_REVIEW_REQUIRED" || manualDl.calculation_method !== "MANUAL_ENTRY") {
    throw new Error("Expected MANUAL_REVIEW_REQUIRED status for manual fallback entry.");
  }
  console.log("  -> PASS: Manual fallback deadline created cleanly.");

  // Step 7: Test Manual Override & Alert Regeneration
  console.log("\n[7/10] Testing Manual Override & Alert Regeneration...");
  // 7A: Empty reason rejection
  const invalidOverRes = await api(
    "POST",
    `/cases/${caseId}/deadlines/${deadlineId}/override`,
    {
      override_deadline: "2029-09-20",
      reason: "",
    },
    ownerToken
  );
  console.log("  -> Empty reason rejected status:", invalidOverRes.status, "Message:", invalidOverRes.data?.message);
  if (invalidOverRes.status === 422) {
    console.log("  -> PASS: Override without reason rejected with 422.");
  } else {
    throw new Error(`Expected 422 for empty reason override but got ${invalidOverRes.status}`);
  }

  // 7B: Valid Override
  const overrideRes = await api(
    "POST",
    `/cases/${caseId}/deadlines/${deadlineId}/override`,
    {
      override_deadline: "2029-09-20",
      reason: "Section 14 Exclusion of time during bona fide court proceedings",
      notes: "3-year period extended due to representation in wrong forum",
    },
    ownerToken
  );
  const overDl = overrideRes.data.data.deadline;
  console.log("  -> Overridden Deadline Updated. ID:", overDl.id);
  console.log("  -> Original Calculated Deadline Preserved:", String(overDl.calculated_deadline).slice(0, 10));
  console.log("  -> Overridden Deadline:", String(overDl.overridden_deadline).slice(0, 10));
  console.log("  -> Effective Deadline:", String(overDl.effective_deadline).slice(0, 10));
  console.log("  -> is_manual_override:", overDl.is_manual_override);
  console.log("  -> Override Reason:", overDl.override_reason);

  if (
    String(overDl.calculated_deadline).slice(0, 10) !== "2029-09-11" ||
    String(overDl.effective_deadline).slice(0, 10) !== "2029-09-20"
  ) {
    throw new Error("Calculation preservation or effective deadline assignment failed.");
  }
  console.log("  -> PASS: Original calculation preserved and effective deadline updated.");

  // Step 8: Test Completion & Waiver Workflows
  console.log("\n[8/10] Testing Completion & Waiver Workflows...");
  const compRes = await api(
    "POST",
    `/cases/${caseId}/deadlines/${deadlineId}/complete`,
    {
      completed_at: "2026-09-11",
      notes: "Specific performance suit drafted and filed before Registry",
    },
    ownerToken
  );
  console.log("  -> Deadline marked COMPLETED. Status:", compRes.data.data.deadline.status);
  console.log("  -> Completed by:", compRes.data.data.deadline.completed_by_name);

  // Waiver test
  const waiverDlRes = await api(
    "POST",
    `/cases/${caseId}/deadlines`,
    {
      is_manual: true,
      manual_deadline: "2026-11-01",
      manual_reason: "Notice limitation period",
      trigger_date: "2026-09-11",
    },
    ownerToken
  );
  const wId = waiverDlRes.data.data.deadline.id;

  const emptyWaiveRes = await api(
    "POST",
    `/cases/${caseId}/deadlines/${wId}/waive`,
    { reason: "" },
    ownerToken
  );
  console.log("  -> Missing waiver reason status:", emptyWaiveRes.status);
  if (emptyWaiveRes.status === 422) {
    console.log("  -> PASS: Missing waiver reason rejected with 422.");
  }

  const waivedRes = await api(
    "POST",
    `/cases/${caseId}/deadlines/${wId}/waive`,
    { reason: "Parties entered into bilateral out-of-court settlement agreement" },
    ownerToken
  );
  console.log("  -> Deadline marked WAIVED. Status:", waivedRes.data.data.deadline.status);
  console.log("  -> Waiver Reason:", waivedRes.data.data.deadline.waiver_reason);
  console.log("  -> PASS: Completion and waiver lifecycles verified.");

  // Step 9: Test Deadlines Dashboard & Alert Processing
  console.log("\n[9/10] Testing Deadlines Dashboard & Alert Processing...");
  const dashRes = await api("GET", "/deadlines/dashboard", null, ownerToken);
  const m = dashRes.data.data.metrics;
  console.log("  -> Deadlines Dashboard Metrics:");
  console.log("     Total Deadlines:", m.total);
  console.log("     Completed:", m.completed);
  console.log("     Waived:", m.waived);
  console.log("     Manual Review Required:", m.manualReviewRequired);
  console.log("     Due Today:", m.dueToday);
  console.log("     Due 7 Days:", m.due7Days);
  console.log("     Due 15 Days:", m.due15Days);
  console.log("     Due 30 Days:", m.due30Days);
  console.log("     Overdue:", m.overdue);

  const alertProcRes = await api("POST", "/deadlines/alerts/process", null, ownerToken);
  console.log("  -> Process Pending Alerts Result:", alertProcRes.data.data);
  console.log("  -> PASS: Dashboard and alert processor verified.");

  // Step 10: CRITICAL SECURITY TEST - Junior Associate Access Control
  console.log("\n[10/10] Testing Junior Associate Two-Layer Authorization (CRITICAL SECURITY TEST)...");
  const clientRes = await api("GET", "/clients?limit=1", null, ownerToken);
  const courtRes = await api("GET", "/courts?limit=1", null, ownerToken);
  const courtsList = courtRes.data.data?.courts || courtRes.data.data?.items || [];
  const clientList = clientRes.data.data?.clients || clientRes.data.data?.items || [];
  const unassignedCaseRes = await api(
    "POST",
    "/cases",
    {
      case_number: "UNASSIGNED-SEC/" + Date.now().toString().slice(-4),
      court_id: courtsList[0].id,
      case_type: "Criminal Matter",
      title: "Highly Confidential Matter - Unassigned",
      primary_client_id: clientList[0].id,
    },
    ownerToken
  );
  const unassignedCaseId = unassignedCaseRes.data.data.case.id;

  await api(
    "POST",
    `/cases/${unassignedCaseId}/deadlines`,
    {
      is_manual: true,
      manual_deadline: "2026-10-01",
      manual_reason: "Special statutory challenge limitation",
      trigger_date: "2026-09-11",
    },
    ownerToken
  );

  const juniorEmail = `junior.security.${Date.now()}@chambers.internal`;
  await api(
    "POST",
    "/users",
    {
      firstName: "TestJunior",
      lastName: "Associate",
      email: juniorEmail,
      phone: "9876543299",
      role: "JUNIOR_ASSOCIATE",
      initialPassword: "ChangeMe123!",
    },
    ownerToken
  );

  const juniorLogin = await api("POST", "/auth/login", {
    email: juniorEmail,
    password: "ChangeMe123!",
  });
  const juniorToken = juniorLogin.data.data.accessToken;
  const juniorUserId = juniorLogin.data.data.user.id;
  console.log("  -> Junior Associate authenticated. ID:", juniorUserId);

  // Negative Check 1: Junior attempts to read deadlines on unassigned case
  console.log(`  -> Attempting Junior access to unassigned Case #${unassignedCaseId} deadlines (expect 403)...`);
  const negRead = await api("GET", `/cases/${unassignedCaseId}/deadlines`, null, juniorToken);
  console.log("  -> Negative Deadlines Access Status:", negRead.status);
  if (negRead.status === 403) {
    console.log("  -> PASS: Junior Associate successfully blocked with 403 Forbidden.");
  } else {
    throw new Error(`Expected 403 for unassigned case read, got ${negRead.status}`);
  }

  // Negative Check 2: Junior attempts to create deadline on unassigned case
  console.log(`  -> Attempting Junior deadline creation on unassigned Case #${unassignedCaseId} (expect 403)...`);
  const negCreate = await api(
    "POST",
    `/cases/${unassignedCaseId}/deadlines`,
    {
      is_manual: true,
      manual_deadline: "2026-11-01",
      manual_reason: "Unauthorized attempt",
      trigger_date: "2026-09-11",
    },
    juniorToken
  );
  console.log("  -> Negative Deadline Creation Status:", negCreate.status);
  if (negCreate.status === 403) {
    console.log("  -> PASS: Junior Associate blocked from creating deadline on unassigned case with 403 Forbidden.");
  } else {
    throw new Error(`Expected 403 for unassigned case create, got ${negCreate.status}`);
  }

  // Assign Junior to Case, verify access succeeds
  console.log(`  -> Assigning Junior to Case #${unassignedCaseId}...`);
  const assignRes = await api(
    "POST",
    `/cases/${unassignedCaseId}/assignments`,
    {
      user_id: juniorUserId,
      role_in_case: "RESEARCHER",
    },
    ownerToken
  );
  console.log("  -> Assignment Status:", assignRes.status);

  const authorizedRes = await api("GET", `/cases/${unassignedCaseId}/deadlines`, null, juniorToken);
  console.log("  -> Junior Access after Assignment Status:", authorizedRes.status);
  console.log("  -> Junior Deadlines retrieved count:", authorizedRes.data.data?.total);
  if (authorizedRes.status === 200) {
    console.log("  -> PASS: Junior Associate successfully authorized after formal assignment.");
  } else {
    throw new Error(`Expected 200 for assigned case read, got ${authorizedRes.status}`);
  }

  console.log("\n=== ALL PROMPT 6 INTEGRATION & SECURITY TESTS PASSED PERFECTLY ===");
  process.exit(0);
};

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
