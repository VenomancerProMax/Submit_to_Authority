let app_id;

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
    console.log("APPLICATION RECORD: ", applicationData);


} catch (err) {
  console.error(err);
}
});

function clearErrors() {
  document.querySelectorAll(".error-message").forEach(span => {
    span.textContent = "";
  });
}

function showError(fieldId, message) {
  const errorSpan = document.getElementById(`error-${fieldId}`);
  if (errorSpan) errorSpan.textContent = message;
}

async function update_record(event = null) {
    if (event) event.preventDefault();

    clearErrors();

    const submitBtn = document.getElementById("submit_button_id");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
    }

    const referenceNo = document.getElementById("reference-number")?.value;
    const taxablePerson = document.getElementById("name-of-taxable-person")?.value;
    const registeredAddress = document.getElementById("registered-address")?.value;
    const applicationDate = document.getElementById("application-date")?.value;
    const fileInput = document.getElementById("attach-acknowledgement");
    const file = fileInput?.files[0];

    let hasError = false;

    if (!referenceNo) {
        showError("reference-number", "Reference Number is required.");
        hasError = true;
    }

    if (!taxablePerson) {
        showError("name-of-taxable-person", "Legal Name of Taxable Person is required.");
        hasError = true;
    }

    if (!registeredAddress) {
        showError("registered-address", "Registered Address is required.");
        hasError = true;
    }

    if (!applicationDate) {
        showError("application-date", "Application Date is required.");
        hasError = true;
    }

    if (!file) {
        showError("attach-acknowledgement", "Please upload the Acknowledgement email from FTA .");
    hasError = true;
    } else if (file.size > 20 * 1024 * 1024) {
        showError("attach-acknowledgement", "File size must not exceed 20MB.");
        hasError = true;
    }

    if (hasError) {
       if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
        }
        return;
    }

    alert("SUBMIT BUTTON CLICKED");
}

document.getElementById("record-form").addEventListener("submit", update_record);

async function closeWidget() {
  await ZOHO.CRM.UI.Popup.close()
        .then(function(data){
      console.log(data)
  })
}

// Initialize the embedded app
ZOHO.embeddedApp.init();