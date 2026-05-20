const axios = require('axios');
const TALLY_URL = 'http://127.0.0.1:9000';

async function test() {
    const xml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <REPORT NAME="AllCompaniesReport">
              <FORMS>AllCompaniesForm</FORMS>
            </REPORT>
            <FORM NAME="AllCompaniesForm">
              <PARTS>AllCompaniesPart</PARTS>
            </FORM>
            <PART NAME="AllCompaniesPart">
              <LINES>AllCompaniesLine</LINES>
              <REPEAT>AllCompaniesLine : CompanyCollection</REPEAT>
            </PART>
            <LINE NAME="AllCompaniesLine">
              <FIELDS>AllCompaniesField</FIELDS>
            </LINE>
            <LINE NAME="AllCompaniesHeader">
              <FIELDS>AllCompaniesHeaderField</FIELDS>
            </LINE>
            <FIELD NAME="AllCompaniesField">
              <SET>$Name</SET>
              <XMLTAG>COMPANYNAME</XMLTAG>
            </FIELD>
            <COLLECTION NAME="CompanyCollection">
              <TYPE>Company</TYPE>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
        <REPORTNAME>AllCompaniesReport</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
        const res = await axios.post(TALLY_URL, xml);
        console.log('Tally Response:\n', res.data);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
