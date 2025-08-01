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

    try {
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

      const fileUploadPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function () {
          try {
            const fileResp = await ZOHO.CRM.API.attachFile({
              Entity: "Applications1",
              RecordID: app_id,
              File: {
                Name: file.name,
                Content: reader.result,
              },
            });
            resolve(fileResp);
          } catch (uploadError) {
            reject(uploadError);
          }
        };

        reader.onerror = reject;
        reader.onabort = () => reject(new Error("File reading aborted"));

        reader.readAsArrayBuffer(file);
      });
      fileUploadPromise.catch(console.error);
      console.log("FILE UPLOAD: ", fileUploadPromise);

      await fileUploadPromise;

      setTimeout(() => {
        ZOHO.CRM.BLUEPRINT.proceed();
        ZOHO.CRM.UI.Popup.closeReload();
        console.log("Successfully proceeded with Blueprint");
      }, 3000);


    } catch (err) {
        console.error("ERROR IN UPDATE RECORD: ", err);
        if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }
    } finally {
        if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }
    }
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