import createRubyfmtModule from "./wasm/rubyfmt.js";
import { EditorView, basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { oneDark } from "@codemirror/theme-one-dark";

let inputEditor, outputEditor;
let debounceTimer;
let Module = null;
let formatRuby = null;
let currentTheme = null;
let versionInfo = null;

const DEFAULT_CODE = `def rubyfmt(n)
(1..n).each{|i| x=case when i%15==0 then "rubyfmt" when i%3==0 then "ruby" when i%5==0 then "fmt" else i end;puts x}
end

class Greeter
def initialize(name:,excited:false) @name=name;@excited=excited end
def greet()= "Hello, #@name#{?! if @excited}"
def with_excitement() = begin;@excited=true;self; end
end

rubyfmt( 20 )
puts Greeter.new(name: 'world').with_excitement.greet
`;

function getTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return saved;
  return "dark";
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function getEditorExtensions(editable = true) {
  const extensions = [
    basicSetup,
    StreamLanguage.define(ruby),
  ];

  if (currentTheme === "dark") {
    extensions.push(oneDark);
  }

  if (!editable) {
    extensions.push(EditorView.editable.of(false));
  }

  return extensions;
}

function recreateEditors() {
  const inputCode = inputEditor ? inputEditor.state.doc.toString() : getInitialCode();
  const outputCode = outputEditor ? outputEditor.state.doc.toString() : "";

  if (inputEditor) {
    inputEditor.destroy();
  }
  if (outputEditor) {
    outputEditor.destroy();
  }

  inputEditor = new EditorView({
    doc: inputCode,
    extensions: [
      ...getEditorExtensions(true),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          scheduleFormat();
        }
      }),
    ],
    parent: document.getElementById("input-editor"),
  });

  outputEditor = new EditorView({
    doc: outputCode,
    extensions: getEditorExtensions(false),
    parent: document.getElementById("output-editor"),
  });
}

function toggleTheme() {
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
  recreateEditors();
}

function handleFileIssue(ev) {
  ev.preventDefault();

  const inputCode = inputEditor ? inputEditor.state.doc.toString() : "";
  const outputCode = outputEditor ? outputEditor.state.doc.toString() : "";
  const errorDisplay = document.getElementById("error-display");
  const hasError = !errorDisplay.classList.contains("hidden");
  const errorText = hasError ? errorDisplay.textContent : "";

  const commitLine = versionInfo
    ? `**Commit:** [\`${versionInfo.shortCommit}\`](https://github.com/fables-tales/rubyfmt/commit/${versionInfo.commit})\n\n`
    : "";

  const template = `${commitLine}#### Input

[→ View on rubyfmt.run](${window.location.href})

\`\`\`ruby
${inputCode}
\`\`\`

#### Output

\`\`\`ruby
${outputCode}
\`\`\`
${hasError ? `\n#### Error\n\n\`\`\`\n${errorText}\n\`\`\`` : ""}

#### Expected behavior

<!-- TODO: Briefly explain what the expected behavior should be on this example. -->

---

<!-- TODO: If there is any additional information you'd like to include, include it here. -->
`;

  const body = encodeURIComponent(template);
  const issueUrl = `https://github.com/fables-tales/rubyfmt/issues/new?body=${body}`;
  window.open(issueUrl, "_blank");
}

async function loadVersionInfo() {
  try {
    const response = await fetch("version.json");
    versionInfo = await response.json();
    const versionEl = document.getElementById("version-info");
    const releaseUrl = `https://github.com/fables-tales/rubyfmt/releases/tag/v${versionInfo.version}`;
    const commitUrl = `https://github.com/fables-tales/rubyfmt/commit/${versionInfo.commit}`;
    versionEl.innerHTML = `<a href="${releaseUrl}" target="_blank" rel="noopener">v${versionInfo.version}</a> @ <a href="${commitUrl}" target="_blank" rel="noopener">${versionInfo.shortCommit}</a>`;
  } catch (e) {
    console.warn("Could not load version info:", e);
  }
}

async function main() {
  const loadingEl = document.getElementById("loading");

  // Initialize theme
  setTheme(getTheme());

  // Set up theme toggle
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  // Set up file issue button
  document.getElementById("file-issue").addEventListener("click", handleFileIssue);

  // Set up GitHub dropdown
  const githubDropdown = document.querySelector(".github-dropdown");
  const dropdownToggle = document.querySelector(".github-dropdown-toggle");

  dropdownToggle.addEventListener("click", () => {
    const isOpen = githubDropdown.classList.toggle("open");
    dropdownToggle.setAttribute("aria-expanded", isOpen);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (ev) => {
    if (!githubDropdown.contains(ev.target)) {
      githubDropdown.classList.remove("open");
      dropdownToggle.setAttribute("aria-expanded", "false");
    }
  });

  // Load version info
  loadVersionInfo();

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
        throw new Error("Encountered a syntax error");
      }

      // Convert result to JS string
      const result = Module.UTF8ToString(resultPtr);

      // Free result string
      Module._free_string(resultPtr);

      return result;
    };

    // Set up editors
    recreateEditors();

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
