const fs = require('fs')
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

function resolveValue(scope, pathStr) {
  if (!scope || !pathStr) return undefined;
  if (pathStr in scope) return scope[pathStr];
  if (pathStr.includes(".")) {
    const parts = pathStr.split(".");
    let current = scope;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
  return undefined;
}

function angularParser(tag) {
  tag = tag.trim();
  return {
    get: (scope) => {
      return resolveValue(scope, tag) ?? "";
    },
  };
}

// 1. Create a dummy docx with Pizzip
// Word splits tags! E.g. <w:t>{</w:t><w:t>etude.nom</w:t><w:t>}</w:t>
const zip = new PizZip();
const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Hello </w:t></w:r>
      <w:r><w:t>{</w:t></w:r>
      <w:r><w:t>etude.nom</w:t></w:r>
      <w:r><w:t>}</w:t></w:r>
      <w:r><w:t>!</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Regular tag: {client.nom}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
zip.file("word/document.xml", content);
zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

const buf = zip.generate({ type: "nodebuffer" });

// 2. Load it into docxtemplater
const testZip = new PizZip(buf);
const doc = new Docxtemplater(testZip, {
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => "",
  parser: angularParser,
});

doc.render({ etude: { nom: "My Project" }, client: { nom: "Google" } });

const out = doc.getZip().generate({ type: "nodebuffer" });
const outZip = new PizZip(out);
console.log("Rendered output:");
console.log(outZip.file("word/document.xml").asText());
