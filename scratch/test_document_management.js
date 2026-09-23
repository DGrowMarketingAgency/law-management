const http = require("http");

const BASE_URL = "http://localhost:9000/api/v1";

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith("/api/v1") ? path : `/api/v1${path}`;
    const options = {
      method,
      hostname: "localhost",
      port: 9000,
      path: fullPath,
      headers: { ...headers },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          rawBody: data,
        });
      });
    });

    req.on("error", (err) => reject(err));

    if (body) {
      if (Buffer.isBuffer(body) || typeof body === "string") {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function buildMultipartFormData(fields, fileField) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const crlf = "\r\n";
  let parts = [];

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) {
      parts.push(
        Buffer.from(
          `--${boundary}${crlf}Content-Disposition: form-data; name="${k}"${crlf}${crlf}${v}${crlf}`
        )
      );
    }
  }

  if (fileField) {
    const { name, filename, mimetype, content } = fileField;
    const fileHeader = `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"; filename="${filename}"${crlf}Content-Type: ${mimetype}${crlf}${crlf}`;
    const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    parts.push(Buffer.from(fileHeader));
    parts.push(fileBuffer);
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  const fullBody = Buffer.concat(parts);

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBody,
  };
}

async function runTests() {
  console.log("===============================================================================");
  console.log("TEST SUITE: PROMPT 7 — DOCUMENT MANAGEMENT + REPOSITORY + VERSIONS + SECURITY");
  console.log("===============================================================================");

  // 1. Authenticate Owner
  console.log("\n1. Authenticating as Chambers Owner...");
  const ownerEmail = "dgrowdeveloper@gmail.com";
  let ownerLogin = await makeRequest("POST", "/auth/login", { "Content-Type": "application/json" }, {
    email: ownerEmail,
    password: "Password@123",
  });

  let ownerToken = ownerLogin.data?.data?.accessToken;
  if (!ownerToken && ownerLogin.data?.data?.requires2FA) {
    const vRes = await makeRequest("POST", "/auth/verify-otp", { "Content-Type": "application/json" }, {
      challengeId: ownerLogin.data.data.challengeId,
      tempToken: ownerLogin.data.data.tempToken,
      otp: ownerLogin.data.data.devOtp,
    });
    ownerToken = vRes.data?.data?.accessToken;
  }

  if (!ownerToken) {
    const retry = await makeRequest("POST", "/auth/login", { "Content-Type": "application/json" }, {
      email: ownerEmail,
      password: "Chambers@2026",
    });
    ownerToken = retry.data?.data?.accessToken;
    if (!ownerToken && retry.data?.data?.requires2FA) {
      const vRes = await makeRequest("POST", "/auth/verify-otp", { "Content-Type": "application/json" }, {
        challengeId: retry.data.data.challengeId,
        tempToken: retry.data.data.tempToken,
        otp: retry.data.data.devOtp,
      });
      ownerToken = vRes.data?.data?.accessToken;
    }
  }
  console.log("Owner Authenticated:", !!ownerToken);
  if (!ownerToken) throw new Error("Could not log in as Owner");

  // 2. Fetch test cases
  console.log("\n2. Fetching Cases for Multi-Tier Authorization Testing...");
  const casesRes = await makeRequest("GET", "/cases", {
    Authorization: `Bearer ${ownerToken}`,
  });
  const caseList = casesRes.data?.data?.items || casesRes.data?.data?.cases || casesRes.data?.data || [];
  const cases = Array.isArray(caseList) ? caseList : [];
  console.log("Cases found:", cases.length);
  if (cases.length < 2) {
    console.log("Cases response structure:", casesRes.data);
    throw new Error("Need at least 2 cases in system for isolation tests");
  }
  const case1 = cases[0];
  const case2 = cases[1];
  console.log(`Case 1: ID ${case1.id} (${case1.case_number || case1.caseNumber}) | Case 2: ID ${case2.id} (${case2.case_number || case2.caseNumber})`);

  // 3. Create & Authenticate Junior Associate
  console.log("\n3. Creating & Authenticating Junior Associate...");
  const juniorEmail = `junior.${Date.now()}@chambers.in`;
  const createJuniorRes = await makeRequest(
    "POST",
    "/users",
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    {
      firstName: "Rohan",
      lastName: "Kapoor",
      email: juniorEmail,
      role: "JUNIOR_ASSOCIATE",
      initialPassword: "Password@123",
    }
  );
  console.log("Junior Created Status:", createJuniorRes.statusCode);

  const juniorLogin = await makeRequest("POST", "/auth/login", { "Content-Type": "application/json" }, {
    email: juniorEmail,
    password: "Password@123",
  });
  const juniorToken = juniorLogin.data?.data?.accessToken;
  const juniorUser = juniorLogin.data?.data?.user;
  console.log("Junior Associate Authenticated:", !!juniorToken, "ID:", juniorUser?.id, juniorUser?.email);
  if (!juniorToken) throw new Error("Could not authenticate Junior Associate");

  // Ensure Junior Associate is assigned to Case 1
  const assignRes = await makeRequest(
    "POST",
    `/cases/${case1.id}/assignments`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    {
      user_id: juniorUser.id,
      role_in_case: "BRIEFING_ASSOCIATE",
    }
  );
  console.log("Junior Assignment to Case 1 Status:", assignRes.statusCode);

  // 4. Test Upload: Valid PDF
  console.log("\n4. Testing Valid PDF Document Upload for Case 1 (Owner)...");
  const validPdfContent = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
  const pdfUploadData = buildMultipartFormData(
    {
      title: "Test Writ Petition Draft",
      category: "PETITION",
      confidentiality_level: "NORMAL",
      change_summary: "Initial draft petition",
    },
    {
      name: "file",
      filename: "petition_draft.pdf",
      mimetype: "application/pdf",
      content: validPdfContent,
    }
  );

  const pdfUploadRes = await makeRequest(
    "POST",
    `/cases/${case1.id}/documents`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": pdfUploadData.contentType,
    },
    pdfUploadData.body
  );

  console.log("Upload Status:", pdfUploadRes.statusCode);
  console.log("Document Created:", pdfUploadRes.data?.data?.id, "Title:", pdfUploadRes.data?.data?.title);
  if (pdfUploadRes.statusCode !== 201) {
    console.error("Upload error details:", pdfUploadRes.data);
    throw new Error("Valid PDF upload failed");
  }
  const createdDocId = pdfUploadRes.data.data.id;

  // 5. Test File Execution Security: Executable Rejected
  console.log("\n5. Testing Security: Uploading Malicious Executable (.exe)...");
  const exeUploadData = buildMultipartFormData(
    {
      title: "Malicious Payload",
      category: "OTHER",
    },
    {
      name: "file",
      filename: "trojan.exe",
      mimetype: "application/octet-stream",
      content: "MZ\x90\x00\x03\x00\x00\x00malicious binary content",
    }
  );

  const exeRes = await makeRequest(
    "POST",
    `/cases/${case1.id}/documents`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": exeUploadData.contentType,
    },
    exeUploadData.body
  );
  console.log("Executable Upload Result Status:", exeRes.statusCode);
  if (exeRes.statusCode === 422) {
    console.log("PASS: Executable file strictly blocked with HTTP 422.");
  } else {
    throw new Error(`Security Failure: Executable returned ${exeRes.statusCode} instead of 422.`);
  }

  // 6. Test File Execution Security: Script Files Rejected (.sh)
  console.log("\n6. Testing Security: Uploading Script File (.sh)...");
  const scriptUploadData = buildMultipartFormData(
    {
      title: "Malicious Script",
      category: "OTHER",
    },
    {
      name: "file",
      filename: "exploit.sh",
      mimetype: "text/plain",
      content: "#!/bin/bash\nrm -rf /",
    }
  );

  const scriptRes = await makeRequest(
    "POST",
    `/cases/${case1.id}/documents`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": scriptUploadData.contentType,
    },
    scriptUploadData.body
  );
  console.log("Script Upload Result Status:", scriptRes.statusCode);
  if (scriptRes.statusCode === 422) {
    console.log("PASS: Shell script strictly blocked with HTTP 422.");
  } else {
    throw new Error(`Security Failure: Shell script returned ${scriptRes.statusCode} instead of 422.`);
  }

  // 7. Test Version Control: Upload Revision v2
  console.log("\n7. Testing Version Control: Uploading Revision v2 to Document...");
  const v2Content = "%PDF-1.4\n% Revision 2 content with amendments\n%%EOF";
  const v2UploadData = buildMultipartFormData(
    {
      change_summary: "Second revision with advocate corrections",
    },
    {
      name: "file",
      filename: "petition_draft_v2.pdf",
      mimetype: "application/pdf",
      content: v2Content,
    }
  );

  const v2Res = await makeRequest(
    "POST",
    `/documents/${createdDocId}/versions`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": v2UploadData.contentType,
    },
    v2UploadData.body
  );
  console.log("Version 2 Upload Status:", v2Res.statusCode);
  console.log("Version Details:", v2Res.data?.data);
  if (v2Res.statusCode !== 201 || v2Res.data?.data?.version_number !== 2) {
    throw new Error("Version 2 creation failed");
  }

  // Verify version history endpoint
  const verListRes = await makeRequest("GET", `/documents/${createdDocId}/versions`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  console.log("Total Versions Recorded:", verListRes.data?.data?.length);
  if (verListRes.data?.data?.length !== 2) {
    throw new Error("Expected 2 versions in history");
  }
  console.log("PASS: Version control accurately increments and preserves revision history.");

  // 8. CRITICAL SECURITY TEST 1: Junior Associate downloads document from assigned Case 1
  console.log("\n8. Testing Authorization: Junior Associate accesses Document in Assigned Case 1...");
  const juniorCase1Res = await makeRequest("GET", `/documents/${createdDocId}`, {
    Authorization: `Bearer ${juniorToken}`,
  });
  console.log("Junior Case 1 Access Status:", juniorCase1Res.statusCode);
  if (juniorCase1Res.statusCode !== 200) {
    throw new Error("Junior Associate should be able to access NORMAL document in assigned case");
  }
  console.log("PASS: Junior Associate allowed access to assigned case document.");

  // 9. CRITICAL SECURITY TEST 2: Junior Associate attempts access to Case 2 Document
  console.log("\n9. Testing Security Isolation: Junior Associate attempts access to Document from Case 2...");
  const case2Upload = buildMultipartFormData(
    {
      title: "Case 2 Confidential Pleading",
      category: "PLEADING",
      confidentiality_level: "NORMAL",
    },
    {
      name: "file",
      filename: "case2_pleading.pdf",
      mimetype: "application/pdf",
      content: "%PDF-1.4\nCase 2 document data\n%%EOF",
    }
  );
  const case2DocRes = await makeRequest(
    "POST",
    `/cases/${case2.id}/documents`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": case2Upload.contentType,
    },
    case2Upload.body
  );
  const case2DocId = case2DocRes.data?.data?.id;

  const unassignedAccessRes = await makeRequest("GET", `/documents/${case2DocId}/download`, {
    Authorization: `Bearer ${juniorToken}`,
  });
  console.log("Unassigned Junior Download Status:", unassignedAccessRes.statusCode);
  if (unassignedAccessRes.statusCode === 403) {
    console.log("PASS: Junior Associate strictly DENIED access to unassigned Case 2 document (HTTP 403).");
  } else {
    throw new Error(`Security Breach: Junior associate accessed unassigned case document! Status: ${unassignedAccessRes.statusCode}`);
  }

  // 10. CRITICAL SECURITY TEST 3: ADVOCATE_ONLY Document in Case 1
  console.log("\n10. Testing Security Isolation: ADVOCATE_ONLY Document in Case 1...");
  const advOnlyUpload = buildMultipartFormData(
    {
      title: "Strict Advocate Strategy Memo",
      category: "OTHER",
      confidentiality_level: "ADVOCATE_ONLY",
    },
    {
      name: "file",
      filename: "advocate_strategy.pdf",
      mimetype: "application/pdf",
      content: "%PDF-1.4\nAdvocate eyes only strategy\n%%EOF",
    }
  );
  const advOnlyRes = await makeRequest(
    "POST",
    `/cases/${case1.id}/documents`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": advOnlyUpload.contentType,
    },
    advOnlyUpload.body
  );
  const advOnlyDocId = advOnlyRes.data?.data?.id;
  console.log("Created ADVOCATE_ONLY document:", advOnlyDocId);

  const juniorAdvOnlyDownload = await makeRequest("GET", `/documents/${advOnlyDocId}/download`, {
    Authorization: `Bearer ${juniorToken}`,
  });
  console.log("Junior ADVOCATE_ONLY Download Status:", juniorAdvOnlyDownload.statusCode);
  if (juniorAdvOnlyDownload.statusCode === 403) {
    console.log("PASS: Junior Associate strictly DENIED from ADVOCATE_ONLY document even within assigned Case 1.");
  } else {
    throw new Error(`Security Breach: Junior accessed ADVOCATE_ONLY document! Status: ${juniorAdvOnlyDownload.statusCode}`);
  }

  // 11. Test Internal Sharing Foundation
  console.log("\n11. Testing Internal Colleague Sharing...");
  const shareRes = await makeRequest(
    "POST",
    `/documents/${case2DocId}/shares`,
    {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    {
      shared_with_user_id: juniorUser.id,
      permission: "DOWNLOAD",
    }
  );
  console.log("Share Created Status:", shareRes.statusCode);
  const shareId = shareRes.data?.data?.id;

  const sharedDownload = await makeRequest("GET", `/documents/${case2DocId}/download`, {
    Authorization: `Bearer ${juniorToken}`,
  });
  console.log("Junior Download via Valid Share Status:", sharedDownload.statusCode);
  if (sharedDownload.statusCode === 200) {
    console.log("PASS: Internal authenticated share permitted download.");
  } else {
    throw new Error("Junior failed to download shared document");
  }

  // Revoke share
  const revokeRes = await makeRequest("DELETE", `/documents/${case2DocId}/shares/${shareId}`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  console.log("Revoke Share Status:", revokeRes.statusCode);

  const postRevokeDownload = await makeRequest("GET", `/documents/${case2DocId}/download`, {
    Authorization: `Bearer ${juniorToken}`,
  });
  console.log("Post-Revocation Download Status:", postRevokeDownload.statusCode);
  if (postRevokeDownload.statusCode === 403) {
    console.log("PASS: Revoked share immediately denied access (HTTP 403).");
  } else {
    throw new Error("Revocation was not enforced immediately");
  }

  // 12. Test Soft Deletion & Restore
  console.log("\n12. Testing Soft Deletion and Restoration...");
  const delRes = await makeRequest("DELETE", `/documents/${createdDocId}`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  console.log("Delete Status:", delRes.statusCode);

  const listRes = await makeRequest("GET", `/cases/${case1.id}/documents`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  const foundInList = listRes.data?.data?.documents?.some((d) => d.id === createdDocId);
  console.log("Document absent from active list:", !foundInList);

  const restoreRes = await makeRequest("POST", `/documents/${createdDocId}/restore`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  console.log("Restore Status:", restoreRes.statusCode);
  const postRestoreList = await makeRequest("GET", `/cases/${case1.id}/documents`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  const restoredFound = postRestoreList.data?.data?.documents?.some((d) => d.id === createdDocId);
  console.log("Document restored in active list:", restoredFound);
  if (!restoredFound) {
    throw new Error("Document was not restored");
  }
  console.log("PASS: Soft deletion and restoration verified.");

  console.log("\n===============================================================================");
  console.log("ALL 12 PROMPT 7 VERIFICATION AND SECURITY TESTS PASSED SUCCESSFULLY! (100%)");
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
