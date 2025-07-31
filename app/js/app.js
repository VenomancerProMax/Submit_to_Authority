async function closeWidget() {
  await ZOHO.CRM.UI.Popup.close()
        .then(function(data){
      console.log(data)
  })
}

// Initialize the embedded app
ZOHO.embeddedApp.init();