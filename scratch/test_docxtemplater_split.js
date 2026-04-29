import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

function angularParser(tag) {
  return { get: (scope) => "Replaced" };
}

const zip = new PizZip();
zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>{</w:t></w:r>
      <w:r><w:t>te</w:t></w:r>
      <w:r><w:t>st}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`);
zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

try {
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: angularParser
  });
  doc.render({ test: "Value" });
  console.log("Output XML:");
  console.log(doc.getZip().file("word/document.xml").asText());
} catch(e) {
  console.log("Error:", e.message);
}
