const axios = require('axios');
const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Type</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml).then(r => {
    require('fs').writeFileSync('vchtypes.xml', r.data);
    console.log('Exported to vchtypes.xml');
}).catch(e => console.error(e.message));
