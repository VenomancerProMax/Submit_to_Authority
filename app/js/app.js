let app_id, account_id;
let cachedFile = null;
let cachedBase64 = null;
let legalNameTaxablePerson = "";
let registered_Address = "";

// --- UI / Error Functions ---
function clearErrors() {
  document.querySelectorAll(".error-message").forEach(span => span.textContent = "");
}

function showError(fieldId, message) {
  const errorSpan = document.getElementById(`error-${fieldId}`);
  if (errorSpan) errorSpan.textContent = message;
}

function showUploadBuffer(message = "Caching file...") {
  const buffer = document.getElementById("upload-buffer");
  const title = document.getElementById("upload-title");
  const bar = document.getElementById("upload-progress");
  if (title) title.textContent = message;
  if (buffer) buffer.classList.remove("hidden");
  if (bar) {
    bar.classList.remove("animate");
    void bar.offsetWidth;
    bar.classList.add("animate");
  }
}

function hideUploadBuffer() {
  const buffer = document.getElementById("upload-buffer");
  const bar = document.getElementById("upload-progress");
  if (buffer) buffer.classList.add("hidden");
  if (bar) bar.classList.remove("animate");
}

// --- Close Widget ---
async function closeWidget() {
  await ZOHO.CRM.UI.Popup.closeReload().catch(err => console.error("Error closing widget:", err));
}

// --- Page Load ---
ZOHO.embeddedApp.on("PageLoad", async (entity) => {
  try {
    const entity_id = entity.EntityId;
    const appResponse = await ZOHO.CRM.API.getRecord({
      Entity: "Applications1",
      approved: "both",
      RecordID: entity_id,
    });
    const applicationData = appResponse.data[0];
    app_id = applicationData.id;

    // Defensive check
    if (!applicationData.Account_Name || !applicationData.Account_Name.id) {
        console.error("Application record is missing a linked Account ID.");
    }

    account_id = applicationData.Account_Name.id;

    const accountResponse = await ZOHO.CRM.API.getRecord({
      Entity: "Accounts",
      approved: "both",
      RecordID: account_id,
    });
    const accountData = accountResponse.data[0];

    legalNameTaxablePerson = accountData.Legal_Name_of_Taxable_Person || applicationData.Account_Name.name || "";
    registered_Address = accountData.Registered_Address || "";

    document.getElementById("name-of-taxable-person").value = legalNameTaxablePerson;
    document.getElementById("registered-address").value = registered_Address;

  } catch (err) {
    console.error("PageLoad Error:", err);
  }
});

// --- File Upload ---
async function cacheFileOnChange(event) {
  clearErrors();
  const fileInput = event.target;
  const file = fileInput?.files[0];

  if (!file) {
    cachedFile = null;
    cachedBase64 = null;
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError("attach-acknowledgement", "File size must not exceed 10MB.");
    cachedFile = null;
    cachedBase64 = null;
    fileInput.value = "";
    return;
  }

  showUploadBuffer("Reading file into memory...");

  try {
    const base64DataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    cachedFile = file;
    cachedBase64 = base64DataUrl.split(",")[1];

    await new Promise(res => setTimeout(res, 500)); // UX delay
    hideUploadBuffer();
  } catch (err) {
    console.error("Error caching file:", err);
    hideUploadBuffer();
    showError("attach-acknowledgement", "Failed to read file.");
    cachedFile = null;
    cachedBase64 = null;
    fileInput.value = "";
  }
}

async function uploadFileToCRM() {
  if (!cachedFile || !cachedBase64) throw new Error("No cached file found.");

  showUploadBuffer("Uploading file to CRM...");

  return await ZOHO.CRM.API.attachFile({
    Entity: "Applications1",
    RecordID: app_id,
    File: {
      Name: cachedFile.name,
      Content: cachedBase64,
    },
  });
}

// --- Main Submission ---
async function update_record(event) {
  event.preventDefault();
  clearErrors();
  let hasError = false;

  const submitBtn = document.getElementById("submit_button_id");
  const referenceNo = document.getElementById("reference-number")?.value.trim();
  const taxablePerson = document.getElementById("name-of-taxable-person")?.value.trim();
  const registeredAddress = document.getElementById("registered-address")?.value.trim();
  const applicationDate = document.getElementById("application-date")?.value.trim();
    
  const safe_account_id = account_id ? account_id.trim() : "";

  // Console logs for debugging
  console.log("Account ID:", safe_account_id);
  console.log("Taxable Person Name:", taxablePerson);
  console.log("Registered Address:", registeredAddress);

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }

  // --- Validation ---
  if (!referenceNo) { showError("reference-number", "Reference Number required."); hasError = true; }
  if (!taxablePerson) { showError("name-of-taxable-person", "Legal Name required."); hasError = true; }
  if (!registeredAddress) { showError("registered-address", "Registered Address required."); hasError = true; }
  if (!applicationDate) { showError("application-date", "Application Date required."); hasError = true; }
  if (!cachedFile || !cachedBase64) { showError("attach-acknowledgement", "Please upload the Acknowledgement file."); hasError = true; }

  // CRITICAL VALIDATION: Check the safe version of the account ID
  if (!safe_account_id) { 
    showError("submit_button_id", "Error: Associated Account ID is missing. Cannot proceed."); 
    hasError = true; 
    console.error("FATAL ERROR: Account ID is empty or null. Check PageLoad data.");
  }

  if (hasError) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit"; }
    hideUploadBuffer();
    return;
  }

  try {
    // --- 1. Update Application record ---
    await ZOHO.CRM.API.updateRecord({
      Entity: "Applications1",
      APIData: {
        id: app_id,
        Reference_Number: referenceNo,
        Legal_Name_of_Taxable_Person: taxablePerson,
        Registered_Address: registeredAddress,
        Application_Date: applicationDate
      }
    });

    // --- 2. Update Account via Deluge function (USING REQUESTED SYNTAX) ---
    var func_name = "ta_ctr_submit_to_auth_update_account";
    var req_data = {
        "arguments": JSON.stringify({
            "account_id": safe_account_id,
            "taxable_name": taxablePerson,
            "registered_address": registeredAddress
        })
    };

    const accountResponse = await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data);
    
    console.log("Account Function Response:", accountResponse);

    // --- 3. Attach file ---
    await uploadFileToCRM();

    // --- 4. Blueprint & Close ---
    await ZOHO.CRM.BLUEPRINT.proceed();
    await closeWidget();

  } catch (err) {
    console.error("Submission Error:", err);
    showError("submit_button_id", "Submission failed. Check console.");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit"; }
    hideUploadBuffer();
  }
}

// --- Event Listeners ---
document.getElementById("attach-acknowledgement").addEventListener("change", cacheFileOnChange);
document.getElementById("record-form").addEventListener("submit", update_record);

ZOHO.embeddedApp.init();