import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("descrição e valor permanecem locais durante a digitação", () => {
  const source = readFileSync("src/components/NewTransactionCard.tsx", "utf8");

  assert.match(source, /const \[draftDescription, setDraftDescription\] = useState\(formDesc\)/);
  assert.match(source, /const \[draftAmount, setDraftAmount\] = useState\(formValor\)/);
  assert.match(source, /value=\{draftDescription\}/);
  assert.match(source, /onChange=\{setDraftDescription\}/);
  assert.match(source, /value=\{draftAmount\}/);
  assert.match(source, /onChange=\{\(e\) => setDraftAmount\(normalizeBRLInput\(e\.target\.value\)\)\}/);

  assert.doesNotMatch(source, /onChange=\{\(e\) => setFormDesc\(e\.target\.value\)\}/);
  assert.doesNotMatch(
    source,
    /onChange=\{\(e\) => setFormValor\(normalizeBRLInput\(e\.target\.value\)\)\}/
  );
});

test("modal de edição mantém descrição e valor fora do estado do App", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const fieldsSource = readFileSync(
    "src/components/BufferedEditTransactionFields.tsx",
    "utf8"
  );

  assert.match(appSource, /const editValueInputRef = useRef\(""\)/);
  assert.match(appSource, /const editDescInputRef = useRef\(""\)/);
  assert.doesNotMatch(appSource, /setEditDescInput\(/);
  assert.doesNotMatch(appSource, /setEditValueInput\(/);
  assert.match(fieldsSource, /const \[description, setDescription\] = useState\(initialDescription\)/);
  assert.match(fieldsSource, /const \[valueDigits, setValueDigits\] = useState\(initialValueDigits\)/);
});

test("submit entrega os valores atuais ao mesmo handler financeiro", () => {
  const cardSource = readFileSync("src/components/NewTransactionCard.tsx", "utf8");
  const appSource = readFileSync("src/App.tsx", "utf8");

  assert.match(
    cardSource,
    /handleAddTransaction\(\{\s*description: draftDescription,\s*amount: submittedAmount,\s*\}\)/
  );
  assert.match(
    appSource,
    /const submittedDescription = draft\?\.description \?\? formDesc;/
  );
  assert.match(appSource, /const submittedAmount = draft\?\.amount \?\? formValor;/);
  assert.match(appSource, /const valorNum = extrairValorMoeda\(submittedAmount\);/);
  assert.match(appSource, /const descDigitada = \(submittedDescription \|\| ""\)\.trim\(\);/);
  assert.match(
    appSource,
    /const descFinal = submittedDescription\.trim\(\) \|\| \(formTipo === "receita" \? formCat : "Despesa"\);/
  );
});
