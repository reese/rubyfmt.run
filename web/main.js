import createRubyfmtModule from "./wasm/rubyfmt.js";
import { EditorView, basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";

let inputEditor, outputEditor;
let debounceTimer;
let Module = null;
let formatRuby = null;

const DEFAULT_CODE = `class Foo
def bar(x,y,z)
if x
y
else
z
end
end
end
`;

async function main() {
  const loadingEl = document.getElementById("loading");

  try {
    // Initialize Emscripten module
    Module = await createRubyfmtModule();

    // Create wrapper for format function
    formatRuby = (source) => {
      // Allocate memory for input string
      const sourceLen = Module.lengthBytesUTF8(source) + 1;
      const sourcePtr = Module._malloc(sourceLen);
      Module.stringToUTF8(source, sourcePtr, sourceLen);

      // Call format function
      const resultPtr = Module._format(sourcePtr);

      // Free input string
      Module._free(sourcePtr);

      if (resultPtr === 0) {
        throw new Error("Formatting failed");
      }

      // Convert result to JS string
      const result = Module.UTF8ToString(resultPtr);

      // Free result string
      Module._free_string(resultPtr);

      return result;
    };

    // Set up editors
    inputEditor = new EditorView({
      doc: getInitialCode(),
      extensions: [
        basicSetup,
        StreamLanguage.define(ruby),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            scheduleFormat();
          }
        }),
      ],
      parent: document.getElementById("input-editor"),
    });

    outputEditor = new EditorView({
      doc: "",
      extensions: [
        basicSetup,
        StreamLanguage.define(ruby),
        EditorView.editable.of(false),
      ],
      parent: document.getElementById("output-editor"),
    });

    // Hide loading state
    loadingEl.classList.add("hidden");

    // Initial format
    runFormat();
  } catch (e) {
    loadingEl.innerHTML = `<p>Failed to load: ${e}</p>`;
    console.error(e);
  }
}

function getInitialCode() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      return atob(hash);
    } catch {
      return DEFAULT_CODE;
    }
  }
  return DEFAULT_CODE;
}

function scheduleFormat() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runFormat, 200);
}

function runFormat() {
  const source = inputEditor.state.doc.toString();
  const errorDisplay = document.getElementById("error-display");

  try {
    const result = formatRuby(source);
    outputEditor.dispatch({
      changes: {
        from: 0,
        to: outputEditor.state.doc.length,
        insert: result,
      },
    });
    errorDisplay.classList.add("hidden");
    updateURL(source);
  } catch (e) {
    errorDisplay.textContent = e.message || String(e);
    errorDisplay.classList.remove("hidden");
  }
}

function updateURL(source) {
  const encoded = btoa(source);
  history.replaceState(null, "", "#" + encoded);
}

main();
