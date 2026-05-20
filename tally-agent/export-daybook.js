const axios = require('axios');
const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <EXPLODEFLAG>Yes</EXPLODEFLAG>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>20260531</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml).then(r => {
    const fs = require('fs');
    fs.writeFileSync('daybook.xml', r.data);
    console.log('Exported to daybook.xml');
}).catch(e => console.error(e.message));
